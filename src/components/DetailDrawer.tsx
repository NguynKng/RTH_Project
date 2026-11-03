import { useCallback, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  ChevronLeft,
  Globe,
  MessageSquareReply,
  Plus,
  StickyNote,
  Undo2,
  UserRound,
  X,
} from "./icons";
import { useBoardStore } from "../data/store";
import { useDialog } from "../hooks/useDialog";
import { useNow } from "../hooks/useNow";
import { useRequestDetail } from "../hooks/useRequestDetail";
import {
  elapsedLabel,
  formatDueAt,
  formatInstant,
  formatSiteDate,
  zoneLabel,
  zoneOffset,
} from "../lib/dates";
import {
  firstResponse,
  hiddenEventIds,
  isDueTomorrow,
  isOverdue,
  staffName,
} from "../lib/rules";
import type { RequestEvent, Site } from "../types";
import {
  Assignee,
  Avatar,
  CopyLinkButton,
  DueSoonTag,
  Icon,
  OverdueTag,
  PriorityIcon,
  shortSiteName,
  StatePanel,
  StatusPill,
} from "./ui";
import { SkeletonDetail } from "./Skeleton";
function Timeline({
  events,
  site,
  createdAt,
}: {
  events: RequestEvent[];
  site: Site;
  createdAt: string;
}) {
  const [showUndone, setShowUndone] = useState(false);
  const staff = useBoardStore((state) => state.staff),
    labels = useBoardStore((state) => state.statusLabels);
  const hidden = hiddenEventIds(events),
    first = firstResponse(events, hidden);
  const visible = showUndone
    ? events
    : events.filter((event) => !hidden.has(event.id));
  const undoneCount = events.filter((event) => hidden.has(event.id)).length;
  const firstName = first ? staffName(first.actor_id, staff) : null;
  return (
    <>
      <section
        className="first-response"
        aria-labelledby="first-response-label"
      >
        <div className="first-response-label">
          <Icon as={MessageSquareReply} size={17} />
          <h3 id="first-response-label">First response</h3>
        </div>
        {first && firstName ? (
          <>
            <div className="first-response-person">
              <Avatar name={firstName} small />
              <strong>{firstName}</strong>
            </div>
            <p>{formatInstant(first.at, site.timezone)}</p>
            <span className="muted">
              {elapsedLabel(first.at * 1000 - Date.parse(createdAt))} after the
              request was created
            </span>
          </>
        ) : (
          <>
            <p className="no-response">—</p>
            <span className="muted">No response yet</span>
          </>
        )}
      </section>
      <section className="history">
        <div className="history-heading">
          <h3>
            History <span>{events.length} events</span>
          </h3>
          <button
            className="undone-toggle"
            role="switch"
            aria-checked={showUndone}
            onClick={() => setShowUndone(!showUndone)}
          >
            <span className={`switch-track ${showUndone ? "switch-on" : ""}`}>
              <span />
            </span>
            Show undone ({undoneCount})
          </button>
        </div>
        {!visible.length ? (
          <p className="muted timeline-empty">
            {events.length ? "All events have been undone." : "No history yet."}
          </p>
        ) : (
          <ol className="timeline">
            {visible.map((event, index) => {
              const undone = hidden.has(event.id),
                previous = visible
                  .slice(0, index)
                  .filter((item) => !hidden.has(item.id))
                  .at(-1);
              const changedStatus = event.status !== previous?.status;
              const created =
                index === 0 &&
                event.status === "pending" &&
                Math.abs(event.at * 1000 - Date.parse(createdAt)) < 120_000;
              const actor = staffName(event.actor_id, staff);
              const matches = Object.values(staff).filter(
                (name) => name === event.assignee_name,
              );
              const glyph =
                event.reverts_id !== null
                  ? Undo2
                  : event.note
                    ? StickyNote
                    : event.due_at
                      ? CalendarClock
                      : event.assignee_name
                        ? UserRound
                        : created
                          ? Plus
                          : ArrowRight;
              return (
                <li
                  className={`timeline-item ${undone ? "timeline-undone" : ""}`}
                  key={event.id}
                >
                  <span className="timeline-icon">
                    <Icon as={glyph} size={15} />
                  </span>
                  <div className="timeline-content">
                    <div className="event-description">
                      {created ? (
                        <p>
                          Request created <StatusPill status={event.status} />
                        </p>
                      ) : event.reverts_id !== null ? (
                        <p>Undid event #{event.reverts_id}</p>
                      ) : changedStatus ? (
                        <p>
                          Status <Icon as={ArrowRight} size={13} />{" "}
                          <strong>
                            {labels[event.status] ?? event.status}
                          </strong>
                        </p>
                      ) : null}
                      {event.assignee_name && (
                        <p>
                          Assigned to{" "}
                          <strong>
                            {matches.length === 1
                              ? matches[0]
                              : event.assignee_name}
                          </strong>
                          {matches.length !== 1 && (
                            <span className="historical-name">
                              {" "}
                              (name at the time)
                            </span>
                          )}
                        </p>
                      )}
                      {event.due_at && (
                        <p>
                          Deadline set to{" "}
                          <strong>
                            {formatDueAt(event.due_at, site.timezone)}
                          </strong>
                        </p>
                      )}
                      {event.note && <blockquote>{event.note}</blockquote>}
                      {!created &&
                        !changedStatus &&
                        !event.note &&
                        !event.due_at &&
                        !event.assignee_name &&
                        event.reverts_id === null && <p>Request updated</p>}
                    </div>
                    {first?.id === event.id && (
                      <span className="first-response-tag">First response</span>
                    )}
                    {undone && <span className="undone-tag">Undone</span>}
                    <div className="event-meta">
                      <span className="event-actor">
                        {event.actor_id === null ? (
                          <Icon as={Bot} size={13} />
                        ) : (
                          <Avatar name={actor} small />
                        )}
                        {actor}
                      </span>
                      <time dateTime={new Date(event.at * 1000).toISOString()}>
                        {formatInstant(event.at, site.timezone)}
                      </time>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}
export function DetailDrawer() {
  const { id: rawId } = useParams();
  const id =
    rawId &&
    /^\d+$/.test(rawId) &&
    Number.isSafeInteger(Number(rawId)) &&
    Number(rawId) > 0
      ? Number(rawId)
      : null;
  const location = useLocation(),
    navigate = useNavigate();
  const close = useCallback(() => {
    navigate({ pathname: "/", search: location.search });
  }, [navigate, location.search]);
  const ref = useDialog(close);
  const sites = useBoardStore((state) => state.sites),
    staff = useBoardStore((state) => state.staff);
  const [retry, setRetry] = useState(0);
  const detail = useRequestDetail(id, retry);
  const now = useNow();
  const request = detail.request,
    site = request ? sites[request.site_id] : undefined;
  const assignee = request?.assignee
    ? staffName(request.assignee.id, staff)
    : null;
  const dueTomorrow =
    !!request && !!site && isDueTomorrow(request, site.timezone, now);
  return (
    <div
      className="drawer-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        ref={ref}
      >
        <div className="drawer-toolbar">
          <button className="mobile-back text-button" onClick={close}>
            <Icon as={ChevronLeft} />
            Back
          </button>
          <span className="drawer-ref">
            {request?.ref ?? (id ? `Request #${id}` : "Request details")}
          </span>
          <div className="drawer-toolbar-actions">
            <CopyLinkButton compact />
            <button
              className="icon-button"
              aria-label="Close request details"
              title="Close (Esc)"
              onClick={close}
            >
              <Icon as={X} size={21} />
            </button>
          </div>
        </div>
        <div className="drawer-content">
          <h2
            id="detail-title"
            tabIndex={-1}
            data-initial-focus
            className={request ? "" : "sr-only"}
          >
            {request?.title ?? "Request details"}
          </h2>
          {id === null ? (
            <StatePanel
              title="Not a valid request link"
              description="The request ID must be a positive number."
              error
            />
          ) : detail.missing ? (
            <StatePanel
              title="This request no longer exists"
              description="It may have been removed from the helpdesk."
            />
          ) : !request ? (
            detail.loading ? (
              <SkeletonDetail />
            ) : (
              <StatePanel
                title="Can't load this request"
                description={detail.error ?? undefined}
                error
              >
                <button
                  className="button button-outline"
                  onClick={() => setRetry((value) => value + 1)}
                >
                  Try again
                </button>
              </StatePanel>
            )
          ) : (
            <>
              {detail.error && (
                <div className="notice detail-notice" role="status">
                  {detail.error}
                  <button
                    className="text-button"
                    onClick={() => setRetry((value) => value + 1)}
                  >
                    Retry
                  </button>
                </div>
              )}
              <div className="detail-pills">
                <StatusPill status={request.status} />
                <PriorityIcon priority={request.priority} />
                {site && isOverdue(request, site.timezone, now) && (
                  <OverdueTag request={request} site={site} now={now} />
                )}
                {dueTomorrow && <DueSoonTag />}
              </div>
              {request.deleted_at && (
                <div className="notice" role="status">
                  This request was deleted
                  {site
                    ? ` on ${formatInstant(request.deleted_at, site.timezone)}`
                    : ""}
                  .
                </div>
              )}
              {request.merged_into_id !== null && (
                <div className="notice" role="status">
                  Merged into{" "}
                  <Link
                    to={`/requests/${request.merged_into_id}${location.search}`}
                  >
                    WO-{request.merged_into_id}
                  </Link>
                  .
                </div>
              )}
              <dl className="details-grid">
                <dt>Site</dt>
                <dd>
                  {site ? (
                    <span title={site.name}>{shortSiteName(site)}</span>
                  ) : (
                    `Unknown site #${request.site_id}`
                  )}
                </dd>
                <dt>Location</dt>
                <dd>{request.location || "—"}</dd>
                <dt>Assignee</dt>
                <dd>
                  <Assignee name={assignee} />
                </dd>
                <dt>Due</dt>
                <dd className={dueTomorrow ? "due-soon-date" : undefined}>
                  {formatSiteDate(request.due_on)}
                  {!request.due_on && (
                    <span className="detail-hint">No due date</span>
                  )}
                </dd>
                <dt>Created</dt>
                <dd>
                  {site
                    ? formatInstant(request.created_at, site.timezone)
                    : "Timezone unavailable"}
                </dd>
                <dt>Last updated</dt>
                <dd>
                  {site
                    ? formatInstant(request.updated_at, site.timezone)
                    : "Timezone unavailable"}
                </dd>
              </dl>
              {site ? (
                <>
                  <p className="timezone-caption">
                    <Icon as={Globe} size={15} />
                    All times in {site.timezone} (
                    {zoneLabel(site.timezone, new Date(request.updated_at))},{" "}
                    {zoneOffset(site.timezone, new Date(request.updated_at))}).
                  </p>
                  {detail.loading ? (
                    <div className="history-loading">
                      <span className="skeleton" />
                      Loading history…
                    </div>
                  ) : (
                    <Timeline
                      key={id}
                      events={detail.events}
                      site={site}
                      createdAt={request.created_at}
                    />
                  )}
                </>
              ) : (
                <p className="notice">
                  History cannot be displayed correctly without this site's
                  timezone.
                </p>
              )}
            </>
          )}
        </div>
        <div className="drawer-footer">
          <span className="live-dot" />
          Read-only · Updates automatically
        </div>
      </div>
    </div>
  );
}
