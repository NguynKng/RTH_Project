import type { MouseEvent } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "./icons";
import { useBoardStore } from "../data/store";
import { useNotificationStore } from "../data/notifications";
import { formatInstant, formatSiteDate, todayIn } from "../lib/dates";
import { isDueTomorrow } from "../lib/rules";
import type { BoardRow } from "../lib/rows";
import { toSearchParams, type Filters } from "../lib/urlState";
import {
  Assignee,
  DueSoonTag,
  Icon,
  OverdueTag,
  PriorityIcon,
  shortSiteName,
  StatusPill,
} from "./ui";
interface Props {
  rows: BoardRow[];
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  now: Date;
  selectedId?: number;
}
function Due({ row, now }: { row: BoardRow; now: Date }) {
  const dueTomorrow = isDueTomorrow(row.request, row.site.timezone, now);
  return (
    <span className="due-cell">
      <span
        className={
          !row.request.due_on ? "muted" : dueTomorrow ? "due-soon-date" : ""
        }
      >
        {formatSiteDate(row.request.due_on)}
      </span>
      {row.overdue ? (
        <OverdueTag request={row.request} site={row.site} now={now} />
      ) : dueTomorrow ? (
        <DueSoonTag />
      ) : row.request.due_on === todayIn(row.site.timezone, now) ? (
        <span className="today-label">Today</span>
      ) : null}
    </span>
  );
}
export function RequestTable({
  rows,
  filters,
  setFilters,
  now,
  selectedId,
}: Props) {
  const navigate = useNavigate();
  const changed = useBoardStore((state) => state.recentlyChanged);
  const unread = useNotificationStore((state) => state.unread);
  const search = toSearchParams(filters).toString();
  function openRow(event: MouseEvent, id: number) {
    if (
      (event.target as HTMLElement).closest("a,button,input") ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      window.getSelection()?.toString()
    )
      return;
    event.currentTarget
      .querySelector<HTMLElement>("[data-request-link]")
      ?.focus();
    navigate(`/requests/${id}?${search}`);
  }
  function SortHeader({
    label,
    field,
  }: {
    label: string;
    field: "due" | "created";
  }) {
    const active = filters.sort === field;
    return (
      <th
        scope="col"
        aria-sort={
          active ? (filters.dir === "asc" ? "ascending" : "descending") : "none"
        }
      >
        <button
          className={`table-sort ${active ? "sort-active" : ""}`}
          onClick={() =>
            setFilters({
              sort: field,
              dir: active
                ? filters.dir === "asc"
                  ? "desc"
                  : "asc"
                : field === "created"
                  ? "desc"
                  : "asc",
            })
          }
        >
          {label}
          <Icon
            as={
              active
                ? filters.dir === "asc"
                  ? ArrowUp
                  : ArrowDown
                : ArrowUpDown
            }
            size={15}
          />
        </button>
      </th>
    );
  }
  return (
    <>
      <p className="table-scroll-hint" id="table-scroll-hint">
        <Icon as={ArrowRight} size={14} /> Scroll horizontally to see all
        columns
      </p>
      <div
        className="table-scroll"
        role="region"
        aria-label="Requests table"
        aria-describedby="table-scroll-hint"
        tabIndex={0}
      >
        <table className="request-table">
          <caption className="sr-only">
            Maintenance requests. Open a request reference to view its details
            and history. All dates and times use the request site's timezone.
          </caption>
          <colgroup>
            {[
              "ref",
              "title",
              "site",
              "priority",
              "status",
              "assignee",
              "due",
              "created",
            ].map((col) => (
              <col className={`col-${col}`} key={col} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Ref</th>
              <th scope="col">Title</th>
              <th scope="col">Site</th>
              <th scope="col">Priority</th>
              <th scope="col">Status</th>
              <th scope="col">Assignee</th>
              <SortHeader label="Due" field="due" />
              <SortHeader label="Created" field="created" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.request.id}
                className={`${selectedId === row.request.id ? "is-selected" : ""} ${changed[row.request.id] > Date.now() - 2500 ? "is-updated" : ""}`}
                onClick={(event) => openRow(event, row.request.id)}
              >
                <td>
                  <Link
                    className="request-ref"
                    data-request-link={row.request.id}
                    to={`/requests/${row.request.id}?${search}`}
                  >
                    {row.request.ref}
                  </Link>
                </td>
                <td className="title-cell">
                  <span className="request-title-line">
                    <span className="request-title">{row.request.title}</span>
                    {unread[row.request.id] && (
                      <span className="new-request-badge">New</span>
                    )}
                  </span>
                  {row.request.location && (
                    <span className="request-location">
                      {row.request.location.replace(/\s*\/\s*/g, " · ")}
                    </span>
                  )}
                </td>
                <td title={row.site.name}>{shortSiteName(row.site)}</td>
                <td>
                  <PriorityIcon priority={row.request.priority} />
                </td>
                <td>
                  <StatusPill status={row.request.status} />
                </td>
                <td>
                  <Assignee name={row.assignee} />
                </td>
                <td>
                  <Due row={row} now={now} />
                </td>
                <td className="created-cell">
                  <time dateTime={row.request.created_at}>
                    {formatInstant(row.request.created_at, row.site.timezone)}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
export function Pagination({
  totalPages,
  page,
  perPage,
  shown,
  disabled = false,
  onPage,
}: {
  totalPages: number;
  page: number;
  perPage: number;
  shown: number;
  disabled?: boolean;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, totalPages);
  const choices = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((value) => value >= 1 && value <= pages)
    .sort((a, b) => a - b);
  return (
    <footer className="table-footer">
      <span className="pagination-summary">
        Page {page} of {pages} · {shown} shown
        <span className="pagination-page-size">
          {perPage} requests per page
        </span>
      </span>
      <nav aria-label="Results pages" className="pagination">
        <button
          className="page-button"
          aria-label="Previous page"
          disabled={disabled || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <Icon as={ChevronLeft} size={16} />
        </button>
        {choices.map((value, index) => (
          <span className="page-choice" key={value}>
            {index > 0 && value - choices[index - 1] > 1 && (
              <span className="pagination-ellipsis">…</span>
            )}
            <button
              className={`page-button ${page === value ? "current-page" : ""}`}
              aria-current={page === value ? "page" : undefined}
              disabled={disabled}
              onClick={() => onPage(value)}
            >
              {value}
            </button>
          </span>
        ))}
        <button
          className="page-button"
          aria-label="Next page"
          disabled={disabled || page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <Icon as={ChevronRight} size={16} />
        </button>
      </nav>
    </footer>
  );
}
