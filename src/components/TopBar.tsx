import { RefreshCw } from "./icons";
import { useBoardStore } from "../data/store";
import { useNow } from "../hooks/useNow";
import { CopyLinkButton, Icon } from "./ui";
export function LiveIndicator() {
  const sync = useBoardStore((state) => state.sync);
  const now = useNow(1000).getTime();
  const seconds =
    sync.lastSuccessAt === null
      ? null
      : Math.max(0, Math.floor((now - sync.lastSuccessAt) / 1000));
  const stale = seconds !== null && seconds > 60;
  const live = sync.status === "live" && !stale;
  const updated =
    seconds === null
      ? "Connecting…"
      : seconds < 5
        ? "Updated just now"
        : seconds < 60
          ? `Updated ${seconds} s ago`
          : `Updated ${Math.floor(seconds / 60)} min ago`;
  const label =
    sync.status === "offline"
      ? "Offline"
      : live
        ? "Live"
        : seconds === null
          ? ""
          : "Paused";
  return (
    <div
      className="live-indicator"
      title="Requests refresh automatically every 10 seconds after the previous update completes."
    >
      <span className={`live-dot ${live ? "" : "live-dot-muted"}`} />
      <span>
        <span className="live-label">
          {label}
          {label ? " · " : ""}
        </span>
        {updated}
      </span>
    </div>
  );
}
export function TopBar() {
  const polling = useBoardStore((state) => state.sync.polling);
  const refresh = useBoardStore((state) => state.refresh);
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <a className="wordmark" href="/" aria-label="Bluebay home">
          Bluebay
        </a>
        <span className="workspace-name">
          <span className="live-dot" />
          Requests
        </span>
      </div>
      <div className="topbar-actions">
        <LiveIndicator />
        <button
          className="icon-button refresh-button"
          aria-label="Refresh requests"
          title="Refresh requests"
          onClick={refresh}
        >
          <Icon as={RefreshCw} size={20} className={polling ? "spin" : ""} />
        </button>
        <CopyLinkButton />
      </div>
    </header>
  );
}
