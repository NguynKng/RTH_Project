import { AlertTriangle, WifiOff } from "./icons";
import { useBoardStore } from "../data/store";
import { useNow } from "../hooks/useNow";
import { Icon } from "./ui";
export function SyncBanner() {
  const sync = useBoardStore((state) => state.sync),
    error = useBoardStore((state) => state.snapshotError),
    refresh = useBoardStore((state) => state.refresh);
  const now = useNow(1000).getTime();
  const seconds = sync.retryAt
    ? Math.max(0, Math.ceil((sync.retryAt - now) / 1000))
    : 0;
  const stale =
    sync.lastSuccessAt !== null && now - sync.lastSuccessAt > 60_000;
  if (sync.status === "offline")
    return (
      <div className="notice notice-offline" role="status">
        <Icon as={WifiOff} />
        <span>You're offline. Updates resume when you reconnect.</span>
      </div>
    );
  if (
    (sync.status === "retrying" || stale || error) &&
    useBoardStore.getState().loadedPage
  )
    return (
      <div className="notice" role="status">
        <Icon as={AlertTriangle} />
        <span>
          The helpdesk is busy.{" "}
          {sync.lastSuccessAt
            ? `Showing data from ${new Date(sync.lastSuccessAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" })} (Asia/Bangkok). `
            : "Showing available data. "}
          {seconds ? `Retrying in ${seconds} s.` : "Retrying automatically."}
        </span>
        <button className="text-button" onClick={refresh}>
          Retry now
        </button>
      </div>
    );
  return null;
}
