import { describe, expect, it } from "vitest";
import type { HelpdeskRequest, Site } from "../types";
import { buildRows } from "./rows";
import { defaultFilters } from "./urlState";
const now = new Date("2026-11-03T02:00:00Z");
const filters = { ...defaultFilters(now), statuses: [] };
const site: Site = {
  id: 11,
  name: "Tower Singapore",
  timezone: "Asia/Singapore",
  business_hours: {},
};
const request = (
  id: number,
  patch: Partial<HelpdeskRequest> = {},
): HelpdeskRequest => ({
  id,
  ref: `WO-${id}`,
  title: "Lift broken",
  location: "Lobby",
  site_id: 11,
  status: "pending",
  priority: "High",
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  due_on: "2026-11-02",
  assignee: { id: 304, name: "Stale person" },
  deleted_at: null,
  merged_into_id: null,
  ...patch,
});
describe("board rows", () => {
  it("uses current names for both display and search", () => {
    const data = { 1: request(1) };
    expect(
      buildRows(
        data,
        { 11: site },
        { 304: "Current person" },
        { ...filters, q: "current" },
        now,
      ).rows[0].assignee,
    ).toBe("Current person");
    expect(
      buildRows(
        data,
        { 11: site },
        { 304: "Current person" },
        { ...filters, q: "stale" },
        now,
      ).rows,
    ).toHaveLength(0);
  });
  it("keeps null due dates last in both sort directions and ties by ID", () => {
    const data = {
      3: request(3, { due_on: null }),
      2: request(2),
      1: request(1),
    };
    for (const dir of ["asc", "desc"] as const)
      expect(
        buildRows(data, { 11: site }, {}, { ...filters, dir }, now).rows.map(
          (row) => row.request.id,
        ),
      ).toEqual([1, 2, 3]);
  });
  it("sorts creation by instant rather than the date string offset", () => {
    const data = {
      1: request(1, { created_at: "2026-11-01T10:00:00+08:00" }),
      2: request(2, { created_at: "2026-11-01T03:00:00Z" }),
    };
    expect(
      buildRows(
        data,
        { 11: site },
        {},
        { ...filters, sort: "created", dir: "asc" },
        now,
      ).rows.map((row) => row.request.id),
    ).toEqual([1, 2]);
  });
  it("reports unknown sites and excludes canceled, deleted and filtered rows", () => {
    const data = {
      1: request(1, { site_id: 999 }),
      2: request(2, { status: "canceled" }),
      3: request(3, { deleted_at: "2026-11-02T00:00:00Z" }),
      4: request(4, { status: "complete" }),
      5: request(5),
    };
    const result = buildRows(
      data,
      { 11: site },
      {},
      { ...filters, statuses: ["pending"] },
      now,
    );
    expect(result.unknownSites).toBe(1);
    expect(result.inRange).toBe(2);
    expect(result.rows).toHaveLength(1);
    expect(result.overdue).toBe(1);
    expect(
      buildRows(data, { 11: site }, {}, { ...filters, sites: [12] }, now).rows,
    ).toHaveLength(0);
  });
});
