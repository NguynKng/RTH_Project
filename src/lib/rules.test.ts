import { describe, expect, it } from "vitest";
import type { HelpdeskRequest, RequestEvent } from "../types";
import {
  counts,
  firstResponse,
  hiddenEventIds,
  isDueTomorrow,
  isOverdue,
  staffName,
} from "./rules";
const request: HelpdeskRequest = {
  id: 1,
  ref: "WO-1",
  title: "Leak",
  location: "",
  site_id: 12,
  status: "pending",
  priority: null,
  created_at: "2026-10-06T15:30:00Z",
  updated_at: "2026-10-06T15:30:00Z",
  due_on: "2026-10-07",
  assignee: null,
  deleted_at: null,
  merged_into_id: null,
};
const event = (
  id: number,
  patch: Partial<RequestEvent> = {},
): RequestEvent => ({
  id,
  status: "pending",
  at: id * 1000,
  actor_id: null,
  actor_name: "Stale name",
  assignee_name: null,
  due_at: null,
  note: null,
  reverts_id: null,
  ...patch,
});
describe("which requests count", () => {
  it("uses each site local date and inclusive boundaries", () => {
    expect(
      counts(request, "Australia/Sydney", "2026-10-07", "2026-10-07"),
    ).toBe(true);
    expect(counts(request, "Asia/Jakarta", "2026-10-07", "2026-10-07")).toBe(
      false,
    );
    expect(counts(request, "Asia/Jakarta", "2026-10-06", "2026-10-06")).toBe(
      true,
    );
  });
  it.each([
    { status: "canceled" },
    { deleted_at: "2026-10-08T00:00:00Z" },
    { merged_into_id: 2 },
  ])("excludes canceled, deleted or merged: %j", (patch) => {
    expect(
      counts(
        { ...request, ...patch },
        "Australia/Sydney",
        "2026-10-01",
        "2026-10-31",
      ),
    ).toBe(false);
  });
});
describe("overdue", () => {
  const now = new Date("2026-10-07T14:30:00Z");
  it("is different in Sydney and Jakarta at the same instant", () => {
    expect(isOverdue(request, "Australia/Sydney", now)).toBe(true);
    expect(isOverdue(request, "Asia/Jakarta", now)).toBe(false);
  });
  it.each(["complete", "canceled"])("never marks %s overdue", (status) =>
    expect(isOverdue({ ...request, status }, "Australia/Sydney", now)).toBe(
      false,
    ),
  );
  it("never marks null or today overdue", () => {
    expect(
      isOverdue({ ...request, due_on: null }, "Australia/Sydney", now),
    ).toBe(false);
    expect(
      isOverdue({ ...request, due_on: "2026-10-08" }, "Australia/Sydney", now),
    ).toBe(false);
  });
});
describe("due tomorrow warning", () => {
  const now = new Date("2026-10-06T14:30:00Z");
  it("uses each site's next calendar day at the same instant", () => {
    expect(isDueTomorrow(request, "Asia/Jakarta", now)).toBe(true);
    expect(isDueTomorrow(request, "Australia/Sydney", now)).toBe(false);
    expect(
      isDueTomorrow({ ...request, status: "processing" }, "Asia/Jakarta", now),
    ).toBe(true);
  });
  it("handles a month boundary", () => {
    expect(
      isDueTomorrow(
        { ...request, due_on: "2026-11-01" },
        "Asia/Jakarta",
        new Date("2026-10-31T05:00:00Z"),
      ),
    ).toBe(true);
  });
  it.each([
    { status: "complete" },
    { status: "canceled" },
    { due_on: null },
    { due_on: "2026-10-05" },
    { due_on: "2026-10-06" },
    { due_on: "2026-10-08" },
    { deleted_at: "2026-10-06T01:00:00Z" },
    { merged_into_id: 2 },
  ])("does not warn for resolved, excluded or other deadlines: %j", (patch) => {
    expect(isDueTomorrow({ ...request, ...patch }, "Asia/Jakarta", now)).toBe(
      false,
    );
  });
});

describe("staff lookup", () => {
  it("uses the current directory and explicit unknown/system fallbacks", () => {
    expect(staffName(304, { 304: "Current name" })).toBe("Current name");
    expect(staffName(999, {})).toBe("Unknown staff #999");
    expect(staffName(null, {})).toBe("System");
  });
});
describe("undone events", () => {
  it("hides an event and its undo regardless of input ordering", () =>
    expect(
      [...hiddenEventIds([event(2, { reverts_id: 1 }), event(1)])].sort(),
    ).toEqual([1, 2]));
  it("an undo of an undo restores the original", () => {
    const hidden = hiddenEventIds([
      event(1),
      event(3, { reverts_id: 2 }),
      event(2, { reverts_id: 1 }),
    ]);
    expect(hidden.has(1)).toBe(false);
    expect(hidden.has(2)).toBe(true);
    expect(hidden.has(3)).toBe(true);
  });
  it("handles missing targets and breaks timestamp ties by ID", () => {
    expect(hiddenEventIds([event(2, { reverts_id: 999 })]).has(2)).toBe(true);
    expect(
      hiddenEventIds([
        event(1, { at: 1 }),
        event(2, { at: 1, reverts_id: 1 }),
        event(3, { at: 1, reverts_id: 2 }),
      ]).has(1),
    ).toBe(false);
  });
});
describe("first response", () => {
  it("chooses the earliest human processing event, skipping system and undone events", () => {
    const events = [
      event(5, { status: "processing", actor_id: 9 }),
      event(1, { status: "processing" }),
      event(2, { status: "processing", actor_id: 7 }),
      event(3, { reverts_id: 2 }),
      event(4, { status: "processing", actor_id: 8 }),
    ];
    expect(firstResponse(events)?.id).toBe(4);
  });
  it("returns null if there is no response", () =>
    expect(firstResponse([event(1)])).toBeNull());
});
