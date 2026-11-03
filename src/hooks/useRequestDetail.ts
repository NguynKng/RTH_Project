import { useEffect, useState } from "react";
import { getRequest, allEvents, listEvents } from "../api/endpoints";
import { ApiError } from "../api/client";
import { POLL_MS } from "../config";
import { useBoardStore } from "../data/store";
import { byEventTime } from "../lib/rules";
import type { HelpdeskRequest, RequestEvent } from "../types";
export function useRequestDetail(id: number | null, refreshVersion: number) {
  const request = useBoardStore((state) =>
    id === null ? undefined : state.requests[id],
  );
  const [detail, setDetail] = useState<{
    id: number | null;
    record?: HelpdeskRequest;
    events: RequestEvent[];
    loading: boolean;
    error: string | null;
    missing: boolean;
  }>({ id: null, events: [], loading: true, error: null, missing: false });
  useEffect(() => {
    if (id === null) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>,
      running = false,
      pending = false,
      first = true;
    const events = new Map<number, RequestEvent>();
    setDetail({ id, events: [], loading: true, error: null, missing: false });
    async function recentEvents() {
      const result: RequestEvent[] = [];
      for (let page = 1; ; page++) {
        const response = await listEvents(id!, page, controller.signal);
        result.push(...response.data);
        // Stop only after reaching known history. A burst of >50 events is safe too.
        if (
          !response.has_more ||
          response.data.some((event) => events.has(event.id))
        )
          break;
      }
      return result;
    }
    async function poll() {
      if (controller.signal.aborted) return;
      if (running) {
        pending = true;
        return;
      }
      running = true;
      clearTimeout(timer);
      try {
        const [fresh, result] = await Promise.all([
          getRequest(id!, controller.signal),
          first ? allEvents(id!, controller.signal) : recentEvents(),
        ]);
        if (controller.signal.aborted) return;
        useBoardStore.getState().upsertRequests([fresh]);
        result.forEach((event) => events.set(event.id, event));
        first = false;
        setDetail({
          id,
          record: fresh,
          events: [...events.values()].sort(byEventTime),
          loading: false,
          error: null,
          missing: false,
        });
      } catch (error) {
        if (!controller.signal.aborted)
          setDetail((previous) => ({
            ...previous,
            loading: false,
            error:
              error instanceof ApiError && error.status === 404
                ? "This request no longer exists."
                : "Could not refresh this request. Retrying automatically.",
            missing: error instanceof ApiError && error.status === 404,
          }));
      } finally {
        running = false;
        if (!controller.signal.aborted) {
          timer = setTimeout(poll, pending ? 0 : POLL_MS);
          pending = false;
        }
      }
    }
    const wake = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", poll);
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", poll);
    };
  }, [id, refreshVersion]);
  const cached = detail.id === id ? detail.record : undefined;
  const current =
    request &&
    (!cached || Date.parse(request.updated_at) >= Date.parse(cached.updated_at))
      ? request
      : cached;
  return {
    request: current,
    ...(detail.id === id
      ? detail
      : { events: [], loading: true, error: null, missing: false }),
  };
}
