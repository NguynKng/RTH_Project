import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { NEW_REQUESTS_PAGE_SIZE } from "../config";
import { useNotificationStore } from "../data/notifications";
import { useBoardStore } from "../data/store";
import { useUnreadRequests } from "../hooks/useUnreadRequests";
import { buildUnreadRows, unreadPage } from "../lib/unreadRows";
import type { Filters } from "../lib/urlState";
import { Bell } from "./icons";
import { Pagination, RequestTable } from "./RequestTable";
import { SkeletonRows } from "./Skeleton";
import { Icon } from "./ui";

export function NewRequestsTable({
  filters,
  now,
  selectedId,
}: {
  filters: Filters;
  now: Date;
  selectedId?: number;
}) {
  const unread = useNotificationStore((state) => state.unread);
  const sites = useBoardStore((state) => state.sites);
  const staff = useBoardStore((state) => state.staff);
  const { search } = useLocation();
  const [page, setPage] = useState(1);
  const view = useMemo(() => unreadPage(unread, page), [unread, page]);
  const { records, failed, loading, retry } = useUnreadRequests(view.ids);
  const { rows, unavailable } = useMemo(
    () => buildUnreadRows(view.ids, records, sites, staff, now),
    [view.ids, records, sites, staff, now],
  );
  const problems = [
    ...new Set([
      ...failed.filter((id) => view.ids.includes(id) && !records[id]),
      ...unavailable,
    ]),
  ];
  useEffect(() => {
    if (page !== view.page) setPage(view.page);
  }, [page, view.page]);
  if (!view.total) return null;

  return (
    <section
      className="new-requests-panel"
      aria-labelledby="new-requests-heading"
    >
      <header className="new-requests-header">
        <div className="new-requests-title">
          <Icon as={Bell} size={18} />
          <h2 id="new-requests-heading" tabIndex={-1}>
            New requests
          </h2>
          <span className="count-badge">{view.total}</span>
        </div>
        <p>Newest first · Open a request to mark it as seen</p>
      </header>
      <div className="new-requests-content" aria-busy={loading}>
        {rows.length > 0 ? (
          <RequestTable
            rows={rows}
            filters={filters}
            now={now}
            selectedId={selectedId}
            tableId="new-requests"
            label="New unread requests"
            sortable={false}
          />
        ) : loading ? (
          <SkeletonRows count={view.ids.length} />
        ) : null}
        {loading && (
          <p className="new-requests-loading" role="status">
            Loading new requests…
          </p>
        )}
        {problems.length > 0 && (
          <div className="new-requests-errors" role="status">
            <p>
              Some requests could not be displayed. Open their details or try
              again.
            </p>
            <div>
              {problems.map((id) => (
                <Link key={id} to={`/requests/${id}${search}`}>
                  {unread[id]?.ref ?? `Request #${id}`}
                </Link>
              ))}
            </div>
            <button type="button" className="text-button" onClick={retry}>
              Try again
            </button>
          </div>
        )}
      </div>
      <Pagination
        page={view.page}
        totalPages={view.pages}
        perPage={NEW_REQUESTS_PAGE_SIZE}
        shown={rows.length}
        label="New request pages"
        onPage={(next) => {
          setPage(next);
          document
            .getElementById("new-requests-table-scroll")
            ?.scrollTo({ top: 0 });
          document
            .getElementById("new-requests-heading")
            ?.focus({ preventScroll: true });
        }}
      />
    </section>
  );
}
