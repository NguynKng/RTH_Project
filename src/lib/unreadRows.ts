import { NEW_REQUESTS_PAGE_SIZE } from "../config";
import type { UnreadRequests } from "../data/notifications";
import type { HelpdeskRequest, Site } from "../types";
import type { BoardRow } from "./rows";
import { isOverdue, staffName } from "./rules";

export function unreadPage(unread: UnreadRequests, requestedPage: number) {
  const entries = Object.entries(unread).sort(
    (a, b) => b[1].createdAt - a[1].createdAt || Number(b[0]) - Number(a[0]),
  );
  const pages = Math.max(1, Math.ceil(entries.length / NEW_REQUESTS_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, requestedPage));
  return {
    ids: entries
      .slice((page - 1) * NEW_REQUESTS_PAGE_SIZE, page * NEW_REQUESTS_PAGE_SIZE)
      .map(([id]) => Number(id)),
    total: entries.length,
    page,
    pages,
  };
}

/** The unread inbox spans board views; main-table filters must not hide notifications. */
export function buildUnreadRows(
  ids: number[],
  records: Record<number, HelpdeskRequest>,
  sites: Record<number, Site>,
  staff: Record<number, string>,
  now: Date,
) {
  const rows: BoardRow[] = [];
  const unavailable: number[] = [];
  for (const id of ids) {
    const request = records[id];
    if (!request) continue;
    const site = sites[request.site_id];
    if (!site) {
      unavailable.push(id);
      continue;
    }
    rows.push({
      request,
      site,
      assignee: request.assignee ? staffName(request.assignee.id, staff) : null,
      overdue: isOverdue(request, site.timezone, now),
    });
  }
  return { rows, unavailable };
}
