import { useState, type ReactNode } from "react";
import {
  Check,
  Clock,
  Circle,
  Copy,
  Link as LinkIcon,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Minus,
  Bot,
  Inbox,
  AlertTriangle,
  type LucideIcon,
} from "./icons";
import { useBoardStore } from "../data/store";
import { daysBetween, todayIn } from "../lib/dates";
import type { HelpdeskRequest, Site } from "../types";
export function Icon({
  as: Component,
  size = 18,
  className = "",
}: {
  as: LucideIcon;
  size?: number;
  className?: string;
}) {
  return (
    <Component
      size={size}
      strokeWidth={1.75}
      aria-hidden="true"
      className={className}
    />
  );
}
export function StatusPill({ status }: { status: string }) {
  const label = useBoardStore((state) => state.statusLabels[status] ?? status);
  return (
    <span
      className={`status-pill status-${["pending", "processing", "complete", "canceled"].includes(status) ? status : "unknown"}`}
    >
      {status === "complete" ? (
        <Icon as={Check} size={14} />
      ) : (
        <Circle
          size={7}
          fill="currentColor"
          strokeWidth={0}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
}
export function PriorityIcon({
  priority,
}: {
  priority: HelpdeskRequest["priority"];
}) {
  const value = priority?.toLowerCase();
  const glyph =
    value === "high"
      ? SignalHigh
      : value === "medium"
        ? SignalMedium
        : value === "low"
          ? SignalLow
          : Minus;
  return (
    <span className={`priority priority-${value ?? "none"}`}>
      <Icon as={glyph} size={20} />
      {priority || <span className="sr-only">No priority</span>}
    </span>
  );
}
export function Avatar({
  name,
  small = false,
  system = false,
}: {
  name: string;
  small?: boolean;
  system?: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`avatar ${small ? "avatar-small" : ""}`}
    >
      {system ? <Icon as={Bot} size={small ? 13 : 17} /> : initials}
    </span>
  );
}
export function Assignee({ name }: { name: string | null }) {
  return name ? (
    <span className="person">
      <Avatar name={name} />
      <span>{name}</span>
    </span>
  ) : (
    <span className="unassigned">Unassigned</span>
  );
}
export function OverdueTag({
  request,
  site,
  now,
}: {
  request: HelpdeskRequest;
  site: Site;
  now: Date;
}) {
  const days = request.due_on
    ? daysBetween(request.due_on, todayIn(site.timezone, now))
    : 0;
  return (
    <span className="overdue-tag">
      <Icon as={Clock} size={13} />
      Overdue · {days} d
    </span>
  );
}
export function CopyLinkButton({ compact = false }: { compact?: boolean }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("Link copied");
    } catch {
      setMessage("Could not copy. Copy the address from your browser.");
    }
    setTimeout(() => setMessage(""), 3000);
  }
  return (
    <>
      <button
        type="button"
        className={compact ? "icon-button" : "button button-primary"}
        onClick={copy}
        aria-label={compact ? "Copy request link" : undefined}
        title={compact ? "Copy request link" : undefined}
      >
        <Icon
          as={message === "Link copied" ? Check : compact ? Copy : LinkIcon}
          size={compact ? 18 : 19}
        />
        {!compact && (message === "Link copied" ? "Copied!" : "Copy link")}
      </button>
      <span className="sr-only" role="status">
        {message}
      </span>
    </>
  );
}

export function DueSoonTag() {
  return (
    <span className="due-soon-tag">
      <Icon as={Clock} size={13} />
      Due tomorrow
    </span>
  );
}
export function StatePanel({
  title,
  description,
  error = false,
  children,
}: {
  title: string;
  description?: string;
  error?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="state-panel">
      <span className="state-icon">
        <Icon as={error ? AlertTriangle : Inbox} size={26} />
      </span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
export function shortSiteName(site: Site) {
  const names: Record<string, string> = {
    "Asia/Singapore": "Singapore",
    "Australia/Sydney": "Sydney",
    "Asia/Jakarta": "Jakarta",
  };
  return names[site.timezone] ?? site.name;
}
