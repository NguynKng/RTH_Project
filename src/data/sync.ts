import { ApiError } from "../api/client";
import { listStaff } from "../api/endpoints";
import { POLL_MS } from "../config";
import { loadRequestPage } from "./snapshot";
import type { PageQuery } from "../lib/pageQuery";
import { useBoardStore } from "./store";
// Refresh only the active page, scheduling the next poll after this one finishes.
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
      await loadRequestPage(query, controller.signal);
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
