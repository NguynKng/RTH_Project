import { Link, useLocation } from "react-router";
import { useNotificationStore } from "../data/notifications";
import { ArrowRight, Bell } from "./icons";
import { Icon } from "./ui";

export function NewRequestsNotice() {
  const unread = useNotificationStore((state) => state.unread);
  const { search } = useLocation();
  const entries = Object.entries(unread).sort(
    (a, b) => b[1].createdAt - a[1].createdAt || Number(b[0]) - Number(a[0]),
  );
  if (!entries.length) return null;
  const [id, latest] = entries[0];
  return (
    <div className="new-requests-notice" aria-label="Unread new requests">
      <Icon as={Bell} size={17} />
      <span>
        <strong>{entries.length}</strong> new{" "}
        {entries.length === 1 ? "request" : "requests"} to review
      </span>
      <Link className="text-button" to={`/requests/${id}${search}`}>
        Open {latest.ref}
        <Icon as={ArrowRight} size={14} />
      </Link>
    </div>
  );
}
