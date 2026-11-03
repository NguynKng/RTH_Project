import { describe, expect, it } from "vitest";
import type { HelpdeskRequest, Site } from "../types";
import { buildUnreadRows, unreadPage } from "./unreadRows";

const site: Site = {
  id: 11,
  name: "Singapore",
  timezone: "Asia/Singapore",
  business_hours: {},
};
const request = (
  id: number,
  patch: Partial<HelpdeskRequest> = {},
): HelpdeskRequest => ({
  id,
  ref: `WO-${id}`,
  title: "Lift",
  location: "Lobby",
  site_id: 11,
  status: "pending",
  priority: "High",
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  due_on: "2026-11-02",
  assignee: { id: 304, name: "Stale name" },
  deleted_at: null,
  merged_into_id: null,
  ...patch,
});
describe("unread request inbox", () => {
  const unread = Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [
      i + 1,
      { ref: `WO-${i + 1}`, createdAt: i + 1 },
    ]),
  );
  it("shows only five newest unread requests per inbox page", () => {
    expect(unreadPage(unread, 1)).toEqual({
      ids: [12, 11, 10, 9, 8],
      total: 12,
      page: 1,
      pages: 3,
    });
    expect(unreadPage(unread, 2).ids).toEqual([7, 6, 5, 4, 3]);
    expect(unreadPage(unread, 3).ids).toEqual([2, 1]);
  });
  it("clamps the inbox page as seen requests are removed", () => {
    expect(unreadPage({ 1: unread[1] }, 3)).toEqual({
      ids: [1],
      total: 1,
      page: 1,
      pages: 1,
    });
    expect(unreadPage({}, 3)).toEqual({ ids: [], total: 0, page: 1, pages: 1 });
  });
  it("breaks equal creation times by ID and does not include other cached records", () => {
    expect(
      unreadPage(
        { 1: { ref: "WO-1", createdAt: 1 }, 2: { ref: "WO-2", createdAt: 1 } },
        1,
      ).ids,
    ).toEqual([2, 1]);
    const { rows } = buildUnreadRows(
      [2],
      { 1: request(1), 2: request(2) },
      { 11: site },
      { 304: "Current name" },
      new Date("2026-11-03T00:00:00Z"),
    );
    expect(rows.map((row) => row.request.id)).toEqual([2]);
    expect(rows[0].assignee).toBe("Current name");
    expect(rows[0].overdue).toBe(true);
  });
  it("keeps requested order and reports unavailable timezones without inventing site data", () => {
    const result = buildUnreadRows(
      [3, 1, 2, 4],
      { 1: request(1), 2: request(2, { site_id: 999 }), 3: request(3) },
      { 11: site },
      {},
      new Date(),
    );
    expect(result.rows.map((row) => row.request.id)).toEqual([3, 1]);
    expect(result.unavailable).toEqual([2]);
  });
});
