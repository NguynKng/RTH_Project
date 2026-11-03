import { describe, expect, it } from "vitest";
import {
  applyFiltersPatch,
  defaultFilters,
  parseFilters,
  toSearchParams,
} from "./urlState";
import { pageQueryKey } from "./pageQuery";
const defaults = defaultFilters(new Date("2026-11-03T05:00:00Z"));

describe("pagination and filter scope", () => {
  const current = { ...defaults, page: 4 };
  it("keeps the current API page for local search, site and sorting", () => {
    expect(
      applyFiltersPatch(current, { q: "lift", sites: [11], sort: "created" })
        .page,
    ).toBe(4);
    expect(pageQueryKey(current)).toBe(
      pageQueryKey({ ...current, statuses: [...current.statuses].reverse() }),
    );
  });
  it("resets to page one only when server filters change", () => {
    expect(applyFiltersPatch(current, { from: "2026-10-01" }).page).toBe(1);
    expect(applyFiltersPatch(current, { statuses: ["complete"] }).page).toBe(1);
    expect(
      applyFiltersPatch(current, { statuses: [...current.statuses].reverse() })
        .page,
    ).toBe(4);
    expect(applyFiltersPatch(current, { page: 2 }).page).toBe(2);
  });
});
describe("shareable filter URLs", () => {
  it("uses exactly 30 inclusive calendar days in the furthest ahead site", () => {
    expect(defaults.from).toBe("2026-10-05");
    expect(defaults.to).toBe("2026-11-03");
    expect(
      defaultFilters(new Date("2026-11-03T14:00:00Z"), [
        "Asia/Jakarta",
        "Australia/Sydney",
      ]).to,
    ).toBe("2026-11-04");
  });
  it("round-trips all filters including all statuses, search and pagination", () => {
    const filters = {
      ...defaults,
      sites: [11, 12],
      statuses: [],
      sort: "created" as const,
      dir: "desc" as const,
      q: "lift lobby",
      page: 3,
    };
    expect(parseFilters(toSearchParams(filters), defaults)).toEqual(filters);
    expect(toSearchParams(defaults).has("from")).toBe(true);
    expect(toSearchParams(defaults).has("to")).toBe(true);
  });
  it("validates garbage, impossible dates and unsafe IDs", () => {
    const result = parseFilters(
      new URLSearchParams(
        "from=2026-02-30&to=nope&site=-1,x,11,11,9007199254740999&status=evil&sort=bad&dir=bad&page=-4",
      ),
      defaults,
    );
    expect(result).toEqual({ ...defaults, sites: [11] });
  });
  it("swaps an inverted range and deduplicates sites and statuses", () => {
    const result = parseFilters(
      new URLSearchParams(
        "from=2026-11-03&to=2026-10-05&status=pending,pending,complete&site=12,11,12",
      ),
      defaults,
    );
    expect(result.from).toBe("2026-10-05");
    expect(result.to).toBe("2026-11-03");
    expect(result.sites).toEqual([11, 12]);
    expect(result.statuses).toEqual(["complete", "pending"]);
  });
});
