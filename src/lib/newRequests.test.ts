import { describe, expect, it } from "vitest";
import type { HelpdeskRequest } from "../types";
import { detectNewRequests } from "./newRequests";

const request = (id: number, created_at = "2026-11-01T00:00:00Z") =>
  ({ id, created_at }) as HelpdeskRequest;
describe("new request detection", () => {
  it("does not label the initial head as new", () => {
    const result = detectNewRequests([request(1), request(2)], null);
    expect(result.newRequests).toEqual([]);
    expect(result.cursor.ids).toEqual([1, 2]);
  });
  it("detects later creation dates and only reports each request once", () => {
    const initial = detectNewRequests([request(1)], null);
    const next = detectNewRequests(
      [request(2, "2026-11-02T00:00:00Z"), request(1)],
      initial.cursor,
    );
    expect(next.newRequests.map((request) => request.id)).toEqual([2]);
    expect(
      detectNewRequests([request(2, "2026-11-02T00:00:00Z")], next.cursor)
        .newRequests,
    ).toEqual([]);
  });
  it("does not mistake older rows moving between pages for new creations", () => {
    const initial = detectNewRequests([request(5)], null);
    const result = detectNewRequests(
      [request(5), request(1, "2026-10-30T00:00:00Z")],
      initial.cursor,
    );
    expect(result.newRequests).toEqual([]);
  });
  it("recognizes requests created in the same timestamp without repeating known IDs", () => {
    const initial = detectNewRequests([request(1)], null);
    const next = detectNewRequests(
      [request(2), request(1), request(2)],
      initial.cursor,
    );
    expect(next.newRequests.map((request) => request.id)).toEqual([2]);
    const repeated = detectNewRequests([request(1)], next.cursor);
    expect(
      detectNewRequests([request(2)], repeated.cursor).newRequests,
    ).toEqual([]);
  });
  it("detects the first arrival after a genuinely empty initial load", () => {
    const initial = detectNewRequests([], null);
    expect(
      detectNewRequests([request(1)], initial.cursor).newRequests,
    ).toHaveLength(1);
  });
  it("never rewinds the creation boundary after an empty or stale response", () => {
    const initial = detectNewRequests(
      [request(3, "2026-11-03T00:00:00Z")],
      null,
    );
    expect(detectNewRequests([], initial.cursor).cursor).toEqual(
      initial.cursor,
    );
    expect(detectNewRequests([request(1)], initial.cursor).cursor).toEqual(
      initial.cursor,
    );
    expect(
      detectNewRequests([request(4, "invalid")], initial.cursor).newRequests,
    ).toEqual([]);
  });
});
