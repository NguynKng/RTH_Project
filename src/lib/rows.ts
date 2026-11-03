import type { HelpdeskRequest, Site } from "../types";
import type { Filters } from "./urlState";
import { counts, isOverdue, staffName } from "./rules";
import { matchesSearch } from "./search";
export interface BoardRow {
  request: HelpdeskRequest;
  site: Site;
  assignee: string | null;
  overdue: boolean;
}
export function buildRows(
  requests: Record<number, HelpdeskRequest>,
  sites: Record<number, Site>,
  staff: Record<number, string>,
  filters: Filters,
  now: Date,
) {
  const rows: BoardRow[] = [];
  let unknownSites = 0,
    inRange = 0;
  for (const request of Object.values(requests)) {
    const site = sites[request.site_id];
    if (!site) {
      unknownSites++;
      continue;
    }
    if (!counts(request, site.timezone, filters.from, filters.to)) continue;
    inRange++;
    if (filters.sites.length && !filters.sites.includes(site.id)) continue;
    if (filters.statuses.length && !filters.statuses.includes(request.status))
      continue;
    const assignee = request.assignee
      ? staffName(request.assignee.id, staff)
      : null;
    if (
      !matchesSearch(filters.q, [
        request.ref,
        request.title,
        request.location ?? "",
        assignee ?? "",
        site.name,
      ])
    )
      continue;
    rows.push({
      request,
      site,
      assignee,
      overdue: isOverdue(request, site.timezone, now),
    });
  }
  rows.sort((a, b) => {
    let comparison: number;
    if (filters.sort === "due") {
      if (a.request.due_on === null && b.request.due_on !== null) return 1;
      if (b.request.due_on === null && a.request.due_on !== null) return -1;
      comparison = (a.request.due_on ?? "").localeCompare(
        b.request.due_on ?? "",
      );
    } else
      comparison =
        Date.parse(a.request.created_at) - Date.parse(b.request.created_at);
    return (
      comparison * (filters.dir === "asc" ? 1 : -1) ||
      a.request.id - b.request.id
    );
  });
  return {
    rows,
    unknownSites,
    inRange,
    overdue: rows.filter((row) => row.overdue).length,
  };
}
