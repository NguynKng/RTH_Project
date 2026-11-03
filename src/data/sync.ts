import { ApiError } from "../api/client";
import { listRequests, listStaff } from "../api/endpoints";
import { POLL_MS } from "../config";
import { loadRequestPage } from "./snapshot";
import { requestPageParams, type PageQuery } from "../lib/pageQuery";
import { useBoardStore } from "./store";
import { useNotificationStore } from "./notifications";
// Load only the selected page, plus the first page when needed to detect new arrivals.
// Never drain the full list; schedule the next poll after this one finishes.
export function startPageSync(query: PageQuery) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false,
    pending = false;
  async function poll() {
    if (controller.signal.aborted) return;
    if (running) {
      pending = true;
      return;
    }
    clearTimeout(timer);
    if (!navigator.onLine) {
      useBoardStore.getState().setSync({ status: "offline", polling: false });
      timer = setTimeout(poll, POLL_MS);
      return;
    }
    running = true;
    useBoardStore.getState().setSync({ polling: true });
    let delay = POLL_MS;
    try {
      const [page, head] = await Promise.allSettled([
        loadRequestPage(query, controller.signal),
        query.page === 1
          ? Promise.resolve(null)
          : listRequests(
              requestPageParams(
                { ...query, page: 1 },
                useBoardStore.getState().statusLabels,
              ),
              controller.signal,
            ),
      ]);
      if (controller.signal.aborted) return;
      if (page.status === "rejected") throw page.reason;
      // A failed notification-head check must not discard a successful visible page.
      if (head.status === "fulfilled") {
        const newCount = useNotificationStore
          .getState()
          .observeHead(
            query,
            head.value?.data ?? page.value ?? [],
            useBoardStore.getState().sites,
          );
        if (newCount)
          useBoardStore.setState({
            announcement: `${newCount} new requests available`,
          });
      }
      const staff = await listStaff(controller.signal);
      if (controller.signal.aborted) return;
      useBoardStore.setState({
        staff: Object.fromEntries(
          staff.data.map((person) => [person.id, person.name]),
        ),
      });
      useBoardStore.getState().setSync({
        status: navigator.onLine ? "live" : "offline",
        lastSuccessAt: Date.now(),
        retryAt: undefined,
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.retryAfterSeconds)
        delay = Math.max(POLL_MS, error.retryAfterSeconds * 1000);
      useBoardStore.setState({
        snapshot: useBoardStore.getState().loadedPage ? "ready" : "error",
        snapshotError:
          error instanceof Error ? error.message : "Could not load requests.",
      });
      useBoardStore.getState().setSync({
        status: navigator.onLine ? "retrying" : "offline",
        retryAt: Date.now() + delay,
      });
    } finally {
      running = false;
      if (!controller.signal.aborted) {
        useBoardStore.getState().setSync({ polling: false });
        if (pending) {
          pending = false;
          timer = setTimeout(poll, 0);
        } else timer = setTimeout(poll, delay);
      }
    }
  }
  const wake = () => {
    if (document.visibilityState === "visible") void poll();
  };
  const offline = () => useBoardStore.getState().setSync({ status: "offline" });
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("online", poll);
  window.addEventListener("offline", offline);
  void poll();
  return () => {
    controller.abort();
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", wake);
    window.removeEventListener("online", poll);
    window.removeEventListener("offline", offline);
  };
}
