import { beforeEach, describe, expect, it } from "vitest";
import type { HelpdeskRequest } from "../types";
import { mergeRequests, useBoardStore } from "./store";
const request = {
  id: 1,
  updated_at: "2026-11-01T10:00:00Z",
  title: "Current",
} as HelpdeskRequest;
describe("request store", () => {
  beforeEach(() => useBoardStore.setState({ requests: {}, staff: {} }));
  it("does not let a stale snapshot overwrite fresher details", () => {
    useBoardStore.getState().upsertRequests([request]);
    expect(
      useBoardStore
        .getState()
        .upsertRequests([
          { ...request, updated_at: "2026-11-01T09:00:00Z", title: "Old" },
        ]),
    ).toBe(0);
    expect(useBoardStore.getState().requests[1].title).toBe("Current");
  });
  it("compares actual instants including UTC offsets and deduplicates pages", () => {
    const result = mergeRequests({}, [
      request,
      { ...request, updated_at: "2026-11-01T20:00:00+08:00", title: "Newer" },
      request,
    ]);
    expect(Object.keys(result.requests)).toHaveLength(1);
    expect(result.requests[1].title).toBe("Newer");
  });
  it("preserves immutable references when nothing changes and updates names immutably", () => {
    const current = { 1: request };
    expect(mergeRequests(current, [request]).requests).toBe(current);
    const old = useBoardStore.getState().staff;
    useBoardStore.getState().setStaffName(304, "New name");
    expect(old[304]).toBeUndefined();
    expect(useBoardStore.getState().staff[304]).toBe("New name");
  });
});
