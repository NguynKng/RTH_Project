type Params = Record<string, string | number | undefined>;
export type ApiStatus =
  | { kind: "retrying"; endpoint: string; retryAt: number }
  | { kind: "ok"; endpoint: string };
const listeners = new Set<(status: ApiStatus) => void>();
export function subscribeApi(listener: (status: ApiStatus) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const emit = (status: ApiStatus) =>
  listeners.forEach((listener) => listener(status));
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export function configured() {
  return Boolean(
    import.meta.env.HELPDESK_URL && import.meta.env.HELPDESK_TOKEN,
  );
}
const abortError = () => new DOMException("Request canceled", "AbortError");
export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}
// A slot is transferred directly to the next waiter; retries release it before sleeping.
const queues = new Map<
  string,
  { active: number; waiting: Array<() => void> }
>();
async function acquire(endpoint: string, signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
  const queue = queues.get(endpoint) ?? { active: 0, waiting: [] };
  queues.set(endpoint, queue);
  if (queue.active >= 2)
    await new Promise<void>((resolve, reject) => {
      const ready = () => {
        signal?.removeEventListener("abort", abort);
        resolve();
      };
      const abort = () => {
        queue.waiting = queue.waiting.filter((item) => item !== ready);
        reject(abortError());
      };
      queue.waiting.push(ready);
      signal?.addEventListener("abort", abort, { once: true });
    });
  else queue.active++;
  return () => {
    const next = queue.waiting.shift();
    if (next) next();
    else queue.active--;
  };
}
export async function get<T>(
  path: string,
  params: Params = {},
  signal?: AbortSignal,
): Promise<T> {
  const base = (import.meta.env.HELPDESK_URL ?? "").replace(/\/$/, "");
  const url = new URL(base + path);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) url.searchParams.set(key, String(value));
  });
  const endpoint = path.replace(/\/\d+/g, "/:id");
  for (let attempt = 0; ; attempt++) {
    const release = await acquire(endpoint, signal);
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timeout = setTimeout(abort, 10_000);
    let failure: unknown;
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${import.meta.env.HELPDESK_TOKEN ?? ""}`,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        const retry = response.headers.get("Retry-After");
        const seconds = retry === null ? null : Number(retry);
        throw new ApiError(
          response.status,
          body.error || `Helpdesk returned HTTP ${response.status}`,
          seconds !== null && Number.isFinite(seconds) ? seconds : null,
        );
      }
      const data = (await response.json()) as T;
      emit({ kind: "ok", endpoint });
      return data;
    } catch (error) {
      failure = error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      release();
    }
    if (signal?.aborted) throw abortError();
    if (
      attempt >= 3 ||
      (failure instanceof ApiError &&
        failure.status !== 429 &&
        failure.status < 500)
    )
      throw failure;
    const delay =
      failure instanceof ApiError && failure.status === 429
        ? Math.min(30, Math.max(1, failure.retryAfterSeconds ?? 5)) * 1000
        : 1000 * 2 ** attempt + Math.random() * 200;
    emit({ kind: "retrying", endpoint, retryAt: Date.now() + delay });
    await sleep(delay, signal);
  }
}
