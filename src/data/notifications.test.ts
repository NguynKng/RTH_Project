import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HelpdeskRequest, Site } from "../types";
import { defaultFilters } from "../lib/urlState";
import { parseUnread, useNotificationStore } from "./notifications";
import { UNREAD_REQUEST_CACHE_LIMIT } from "../config";

const query = defaultFilters(new Date("2026-11-03T05:00:00Z"));
const sites: Record<number, Site> = {
  11: {
    id: 11,
    name: "Singapore",
    timezone: "Asia/Singapore",
    business_hours: {},
  },
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
  created_at: id === 1 ? "2026-11-01T00:00:00Z" : "2026-11-02T00:00:00Z",
  updated_at: "2026-11-02T00:00:00Z",
  due_on: null,
  assignee: null,
  deleted_at: null,
  merged_into_id: null,
  ...patch,
});
const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };

describe("unread new requests", () => {
  beforeEach(() => {
    storage.setItem.mockReset();
    vi.stubGlobal("window", { localStorage: storage });
    useNotificationStore.setState(
      { ...useNotificationStore.getInitialState(), unread: {} },
      true,
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps New through later polls and page changes until the detail is seen", () => {
    const store = useNotificationStore.getState();
    expect(store.observeHead(query, [request(1)], sites)).toBe(0);
    expect(store.observeHead(query, [request(2), request(1)], sites)).toBe(1);
    expect(useNotificationStore.getState().unread[2]?.ref).toBe("WO-2");
    expect(
      store.observeHead({ ...query, page: 4 }, [request(2), request(1)], sites),
    ).toBe(0);
    expect(useNotificationStore.getState().unread[2]).toBeDefined();
    expect(useNotificationStore.getState().serial).toBe(1);
    store.setActiveRequest(2);
    expect(useNotificationStore.getState().unread[2]).toBeUndefined();
    store.setActiveRequest(null);
    store.observeHead(query, [request(2)], sites);
    expect(useNotificationStore.getState().unread[2]).toBeUndefined();
    expect(useNotificationStore.getState().serial).toBe(1);
  });
  it("persists unread state for reload and removes it from storage when seen", () => {
    const store = useNotificationStore.getState();
    store.observeHead(query, [request(1)], sites);
    store.observeHead(query, [request(2)], sites);
    const saved = JSON.parse(storage.setItem.mock.calls.at(-1)![1]);
    expect(parseUnread(saved)[2].ref).toBe("WO-2");
    store.markSeen(2);
    expect(JSON.parse(storage.setItem.mock.calls.at(-1)![1])).toEqual({});
  });
  it("does not notify for initial filter changes or request updates", () => {
    const store = useNotificationStore.getState();
    store.observeHead(query, [request(1)], sites);
    expect(
      store.observeHead(
        query,
        [
          request(1, {
            title: "Updated title",
            updated_at: "2026-11-03T00:00:00Z",
          }),
        ],
        sites,
      ),
    ).toBe(0);
    expect(
      store.observeHead(
        { ...query, statuses: ["complete"] },
        [request(3, { status: "complete" })],
        sites,
      ),
    ).toBe(0);
    expect(useNotificationStore.getState().unread).toEqual({});
  });
  it("does not mark an already open detail as unread or play another notification", () => {
    const store = useNotificationStore.getState();
    store.observeHead(query, [request(1)], sites);
    store.setActiveRequest(2);
    expect(store.observeHead(query, [request(2)], sites)).toBe(0);
    expect(useNotificationStore.getState().serial).toBe(0);
    expect(useNotificationStore.getState().unread).toEqual({});
  });
  it("ignores canceled, deleted, merged, unknown-site and out-of-range records", () => {
    const store = useNotificationStore.getState();
    store.observeHead(query, [request(1)], sites);
    expect(
      store.observeHead(
        query,
        [
          request(2, { status: "canceled" }),
          request(3, { deleted_at: "2026-11-02T01:00:00Z" }),
          request(4, { merged_into_id: 1 }),
          request(5, { site_id: 999 }),
          request(6, { created_at: "2026-11-04T00:00:00Z" }),
        ],
        sites,
      ),
    ).toBe(0);
    expect(store.observeHead(query, [request(7)], sites)).toBe(1);
  });
  it("keeps all newly detected badges but emits one sound signal for a batch", () => {
    const store = useNotificationStore.getState();
    store.observeHead(query, [request(1)], sites);
    expect(
      store.observeHead(query, [request(2), request(3), request(4)], sites),
    ).toBe(3);
    expect(Object.keys(useNotificationStore.getState().unread)).toHaveLength(3);
    expect(useNotificationStore.getState().serial).toBe(1);
  });
  it("keeps notification state working if localStorage is full or unavailable", () => {
    storage.setItem.mockImplementation(() => {
      throw new Error("Quota exceeded");
    });
    const store = useNotificationStore.getState();
    store.observeHead(query, [request(1)], sites);
    expect(() => store.observeHead(query, [request(2)], sites)).not.toThrow();
    expect(useNotificationStore.getState().unread[2]).toBeDefined();
    expect(() => store.setSoundEnabled(false)).not.toThrow();
    expect(useNotificationStore.getState().soundEnabled).toBe(false);
  });
  it("validates persisted unread records", () => {
    expect(parseUnread(null)).toEqual({});
    expect(parseUnread([])).toEqual({});
    expect(
      parseUnread({
        "-1": { ref: "bad", createdAt: 1 },
        bad: {},
        "3": { ref: "WO-3", createdAt: 1 },
        "4": { ref: 7, createdAt: 1 },
      }),
    ).toEqual({ 3: { ref: "WO-3", createdAt: 1 } });
  });
  it("exposes only real arrival batches for motion without replaying on cache updates or seen state", () => {
    const store = useNotificationStore.getState();
    store.observeHead(query, [request(1)], sites);
    expect(useNotificationStore.getState().latestArrivalIds).toEqual([]);
    store.observeHead(query, [request(2), request(3)], sites);
    const arrivals = useNotificationStore.getState().latestArrivalIds;
    expect(arrivals).toEqual([2, 3]);
    store.cacheUnreadRequests([request(2)]);
    store.markSeen(2);
    store.observeHead(query, [request(2), request(3)], sites);
    expect(useNotificationStore.getState().latestArrivalIds).toBe(arrivals);
    expect(useNotificationStore.getState().serial).toBe(1);
    store.observeHead(
      query,
      [request(4, { created_at: "2026-11-03T00:00:00Z" })],
      sites,
    );
    expect(useNotificationStore.getState().latestArrivalIds).toEqual([4]);
    expect(useNotificationStore.getState().serial).toBe(2);
  });
  it("keeps full unread records available across table pages and frees them when seen", () => {
    const store = useNotificationStore.getState();
    store.observeHead(query, [request(1)], sites);
    store.observeHead(query, [request(2)], sites);
    expect(useNotificationStore.getState().records[2].title).toBe("Lift");
    store.observeHead({ ...query, page: 4 }, [], sites);
    expect(useNotificationStore.getState().records[2]).toBeDefined();
    store.setActiveRequest(2);
    expect(useNotificationStore.getState().records[2]).toBeUndefined();
    store.cacheUnreadRequests([request(2)]);
    expect(useNotificationStore.getState().unread[2]).toBeUndefined();
    expect(useNotificationStore.getState().records[2]).toBeUndefined();
  });
  it("bounds the payload cache without dropping unread badges and hydrates evicted records on demand", () => {
    const store = useNotificationStore.getState();
    store.observeHead(query, [request(1)], sites);
    const arrivals = Array.from(
      { length: UNREAD_REQUEST_CACHE_LIMIT + 20 },
      (_, i) => request(i + 2),
    );
    store.observeHead(query, arrivals, sites);
    expect(Object.keys(useNotificationStore.getState().unread)).toHaveLength(
      arrivals.length,
    );
    expect(Object.keys(useNotificationStore.getState().records)).toHaveLength(
      UNREAD_REQUEST_CACHE_LIMIT,
    );
    const evictedId = arrivals.at(-1)!.id;
    expect(useNotificationStore.getState().records[evictedId]).toBeUndefined();
    store.cacheUnreadRequests([request(evictedId)]);
    expect(useNotificationStore.getState().records[evictedId]).toBeDefined();
    expect(Object.keys(useNotificationStore.getState().records)).toHaveLength(
      UNREAD_REQUEST_CACHE_LIMIT,
    );
    expect(useNotificationStore.getState().serial).toBe(1);
  });
  it("updates the unread table from fresh records without overwriting them with older snapshots or replaying sound", () => {
    const store = useNotificationStore.getState();
    store.observeHead(query, [request(1)], sites);
    store.observeHead(query, [request(2)], sites);
    store.cacheUnreadRequests([
      request(2, { title: "Fresh title", updated_at: "2026-11-03T00:00:00Z" }),
    ]);
    store.observeHead(query, [request(2)], sites);
    expect(useNotificationStore.getState().records[2].title).toBe(
      "Fresh title",
    );
    expect(useNotificationStore.getState().serial).toBe(1);
    store.cacheUnreadRequests([request(999)]);
    expect(useNotificationStore.getState().records[999]).toBeUndefined();
  });
});
