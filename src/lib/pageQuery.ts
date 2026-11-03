import type { Filters } from "./urlState";
import { BOARD_PAGE_SIZE } from "../config";
import { addDays, toApiDate } from "./dates";

export type PageQuery = Pick<Filters, "from" | "to" | "statuses" | "page">;

export function pageQueryKey(query: PageQuery) {
  return JSON.stringify([
    query.from,
    query.to,
    [...query.statuses].sort(),
    query.page,
  ]);
}

export function requestPageParams(
  query: PageQuery,
  statusLabels: Record<string, string>,
) {
  const statuses = query.statuses.length
    ? query.statuses
    : Object.keys(statusLabels).filter((value) => value !== "canceled");
  return {
    page: query.page,
    per_page: BOARD_PAGE_SIZE,
    created_from: toApiDate(addDays(query.from, -1)),
    created_to: toApiDate(addDays(query.to, 1)),
    status: statuses.length ? JSON.stringify(statuses) : undefined,
  };
}
