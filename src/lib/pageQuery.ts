import type { Filters } from "./urlState";

export type PageQuery = Pick<Filters, "from" | "to" | "statuses" | "page">;

export function pageQueryKey(query: PageQuery) {
  return JSON.stringify([
    query.from,
    query.to,
    [...query.statuses].sort(),
    query.page,
  ]);
}
