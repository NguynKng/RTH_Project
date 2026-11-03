import { useEffect, useMemo, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { LoaderCircle, SearchX } from "../components/icons";
import { subscribeApi } from "../api/client";
import { useBoardStore } from "../data/store";
import { useNotificationStore } from "../data/notifications";
import { startPageSync } from "../data/sync";
import { useBoardRows } from "../hooks/useBoardRows";
import { useFilters } from "../hooks/useFilters";
import { useNow } from "../hooks/useNow";
import { formatSiteDate } from "../lib/dates";
import { pageQueryKey, type PageQuery } from "../lib/pageQuery";
import { FilterBar } from "../components/FilterBar";
import { BackToTop } from "../components/BackToTop";
import { Pagination, RequestTable } from "../components/RequestTable";
import { SkeletonRows } from "../components/Skeleton";
import { SyncBanner } from "../components/SyncBanner";
import { NewRequestsTable } from "../components/NewRequestsTable";
import { TopBar } from "../components/TopBar";
import { Icon, StatePanel } from "../components/ui";

export function BoardPage() {
  const [filters, setFilters, defaults] = useFilters();
  const now = useNow();
  const snapshot = useBoardStore((state) => state.snapshot);
  const loadedPage = useBoardStore((state) => state.loadedPage);
  const error = useBoardStore((state) => state.snapshotError);
  const refreshVersion = useBoardStore((state) => state.refreshVersion);
  const refresh = useBoardStore((state) => state.refresh);
  const announcement = useBoardStore((state) => state.announcement);
  const hasNewRequests = useNotificationStore(
    (state) => Object.keys(state.unread).length > 0,
  );
  const statusKey = filters.statuses.join(",");
  const query: PageQuery = useMemo(
    () => ({
      from: filters.from,
      to: filters.to,
      page: filters.page,
      statuses: statusKey ? statusKey.split(",") : [],
    }),
    [filters.from, filters.to, filters.page, statusKey],
  );
  const queryKey = pageQueryKey(query);
  const reloading = !!loadedPage && loadedPage.key !== queryKey;
  const displayFilters = useMemo(
    () =>
      reloading && loadedPage
        ? {
            ...filters,
            from: loadedPage.from,
            to: loadedPage.to,
            statuses: loadedPage.statuses,
          }
        : filters,
    [filters, loadedPage, reloading],
  );
  const { rows, overdue, unknownSites } = useBoardRows(displayFilters, now);
  const location = useLocation();
  const background = useRef<HTMLDivElement>(null);
  const selectedId = /^\/requests\/(\d+)$/.exec(location.pathname)?.[1];
  const detailOpen = location.pathname.startsWith("/requests/");

  useEffect(() => startPageSync(query), [query, refreshVersion]);
  useEffect(
    () =>
      subscribeApi((status) => {
        if (status.kind === "retrying")
          useBoardStore
            .getState()
            .setSync({ status: "retrying", retryAt: status.retryAt });
      }),
    [],
  );
  useEffect(() => {
    if (background.current) background.current.inert = detailOpen;
  }, [detailOpen]);
  useEffect(() => {
    if (loadedPage?.key === queryKey && filters.page > loadedPage.totalPages) {
      setFilters({ page: loadedPage.totalPages });
    }
  }, [loadedPage, queryKey, filters.page, setFilters]);
  useEffect(() => {
    if (loadedPage?.key === queryKey) {
      document.getElementById("requests-table-scroll")?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    }
  }, [queryKey, loadedPage?.key]);

  const loading =
    !loadedPage && (snapshot === "idle" || snapshot === "loading");
  return (
    <>
      <div
        ref={background}
        className={`board-layout ${hasNewRequests ? "has-new-requests" : ""}`}
      >
        <a href="#requests-results" className="skip-link">
          Skip to requests
        </a>
        <TopBar />
        <main className="board-main">
          <div className="page-heading">
            <h1 id="requests-title" tabIndex={-1}>
              Requests
            </h1>
            <p className="board-summary">
              {loading ? (
                "Loading requests…"
              ) : (
                <>
                  <strong>{rows.length.toLocaleString()}</strong> requests on
                  this page
                  <span className="summary-dot">·</span>
                  <span>{overdue.toLocaleString()} overdue</span>
                  <span className="summary-dot">·</span>
                  <span className="summary-range">
                    created {formatSiteDate(filters.from)} –{" "}
                    {formatSiteDate(filters.to)}{" "}
                    <span className="local-date-caption">
                      (each site's local date)
                    </span>
                  </span>
                </>
              )}
              {reloading && (
                <span className="page-loading-label">
                  <Icon as={LoaderCircle} size={14} className="spin" />
                  Loading page {filters.page}…
                </span>
              )}
            </p>
          </div>
          <FilterBar
            filters={filters}
            defaults={defaults}
            setFilters={setFilters}
            resultCount={rows.length}
          />
          <SyncBanner />
          <NewRequestsTable
            filters={filters}
            now={now}
            selectedId={selectedId ? Number(selectedId) : undefined}
          />
          <section
            className={`results-shell ${reloading ? "results-reloading" : ""}`}
            id="requests-results"
            tabIndex={-1}
            aria-label="Request results"
            aria-busy={loading || reloading}
          >
            <div className="results-content">
              {loading ? (
                <SkeletonRows />
              ) : snapshot === "error" && !loadedPage ? (
                <StatePanel
                  title="Can't reach the helpdesk"
                  description={
                    error ??
                    "Check your connection. We'll keep trying automatically."
                  }
                  error
                >
                  <button className="button button-outline" onClick={refresh}>
                    Try again
                  </button>
                </StatePanel>
              ) : !rows.length ? (
                filters.q ? (
                  <div className="state-panel">
                    <span className="state-icon">
                      <Icon as={SearchX} size={27} />
                    </span>
                    <h2>No requests match “{filters.q}” on this page</h2>
                    <p>
                      Try another page or a different reference, title, location
                      or person's name.
                    </p>
                    <button
                      className="button button-outline"
                      onClick={() => setFilters({ q: "" })}
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <StatePanel
                    title={
                      loadedPage?.total === 0
                        ? "No requests in this date range"
                        : "No matching requests on this page"
                    }
                    description={
                      loadedPage?.total === 0
                        ? `No requests were created between ${formatSiteDate(filters.from)} and ${formatSiteDate(filters.to)}.`
                        : "Try another page, select a different site or status, or clear the filters."
                    }
                  >
                    <button
                      className="button button-outline"
                      onClick={() => setFilters({ ...defaults, statuses: [] })}
                    >
                      Clear filters
                    </button>
                  </StatePanel>
                )
              ) : (
                <RequestTable
                  rows={rows}
                  filters={filters}
                  setFilters={setFilters}
                  now={now}
                  selectedId={selectedId ? Number(selectedId) : undefined}
                />
              )}
            </div>
            {loadedPage && (
              <Pagination
                totalPages={loadedPage.totalPages}
                page={loadedPage.page}
                perPage={loadedPage.perPage}
                shown={rows.length}
                disabled={reloading && snapshot === "loading"}
                onPage={(page) => {
                  setFilters({ page });
                  document.getElementById("requests-results")?.focus();
                }}
              />
            )}
          </section>
          <div className="board-footnote">
            <span>
              Dates and times are local to each site. Site, search and sorting
              apply to this page.
            </span>
            {unknownSites > 0 && (
              <span>{unknownSites} requests hidden: unknown site.</span>
            )}
          </div>
          <span className="sr-only" role="status" aria-live="polite">
            {rows.length} results on page {loadedPage?.page ?? filters.page}.{" "}
            {announcement}
          </span>
        </main>
        <BackToTop containerRef={background} hidden={detailOpen} />
      </div>
      <Outlet />
    </>
  );
}
