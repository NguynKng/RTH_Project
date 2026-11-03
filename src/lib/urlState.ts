import { addDays, todayIn, validDate } from "./dates";
export interface Filters {
  from: string;
  to: string;
  sites: number[];
  statuses: string[];
  sort: "due" | "created";
  dir: "asc" | "desc";
  q: string;
  page: number;
}

export function applyFiltersPatch(
  filters: Filters,
  patch: Partial<Filters>,
): Filters {
  const serverFiltersChanged =
    (patch.from !== undefined && patch.from !== filters.from) ||
    (patch.to !== undefined && patch.to !== filters.to) ||
    (patch.statuses !== undefined &&
      [...patch.statuses].sort().join(",") !==
        [...filters.statuses].sort().join(","));
  return {
    ...filters,
    ...patch,
    page: patch.page ?? (serverFiltersChanged ? 1 : filters.page),
  };
}
export function defaultFilters(
  now = new Date(),
  timezones = ["Australia/Sydney"],
): Filters {
  const to =
    timezones
      .map((zone) => todayIn(zone, now))
      .sort()
      .at(-1) ?? todayIn("UTC", now);
  return {
    from: addDays(to, -29),
    to,
    sites: [],
    statuses: ["pending", "processing"],
    sort: "due",
    dir: "asc",
    q: "",
    page: 1,
  };
}
export function parseFilters(
  params: URLSearchParams,
  defaults = defaultFilters(),
): Filters {
  let from = params.get("from") ?? defaults.from,
    to = params.get("to") ?? defaults.to;
  if (!validDate(from)) from = defaults.from;
  if (!validDate(to)) to = defaults.to;
  if (from > to) [from, to] = [to, from];
  const sites = [
    ...new Set(
      (params.get("site") ?? "")
        .split(",")
        .filter((x) => /^\d+$/.test(x))
        .map(Number)
        .filter((x) => Number.isSafeInteger(x) && x > 0),
    ),
  ].sort((a, b) => a - b);
  const rawStatus = params.get("status");
  const statuses =
    rawStatus === "all"
      ? []
      : rawStatus
          ?.split(",")
          .filter((x) => ["pending", "processing", "complete"].includes(x));
  const page = Number(params.get("page"));
  return {
    from,
    to,
    sites,
    statuses: statuses?.length
      ? [...new Set(statuses)].sort()
      : rawStatus === "all"
        ? []
        : defaults.statuses,
    sort: params.get("sort") === "created" ? "created" : "due",
    dir: params.get("dir") === "desc" ? "desc" : "asc",
    q: (params.get("q") ?? "").trim().slice(0, 200),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}
export function toSearchParams(filters: Filters) {
  const params = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    status: filters.statuses.length
      ? [...filters.statuses].sort().join(",")
      : "all",
    sort: filters.sort,
    dir: filters.dir,
  });
  if (filters.sites.length)
    params.set("site", [...filters.sites].sort((a, b) => a - b).join(","));
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}
