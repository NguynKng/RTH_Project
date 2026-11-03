import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listRequests, listStaff } from "../api/endpoints";
import { loadRequestPage } from "./snapshot";
import { useBoardStore } from "./store";
import { useNotificationStore } from "./notifications";
import { startPageSync } from "./sync";
import { POLL_MS } from "../config";
import { defaultFilters } from "../lib/urlState";
import type { HelpdeskRequest } from "../types";

vi.mock("../api/endpoints", () => ({
  listRequests: vi.fn(),
  listStaff: vi.fn(),
}));
vi.mock("./snapshot", () => ({ loadRequestPage: vi.fn() }));
const query = defaultFilters(new Date("2026-11-03T05:00:00Z"));
const request = (id: number) =>
  ({
    id,
    ref: `WO-${id}`,
    site_id: 11,
    status: "pending",
    created_at: `2026-11-0${id}T00:00:00Z`,
    deleted_at: null,
    merged_into_id: null,
  }) as HelpdeskRequest;

describe("bounded page polling with new request alerts", () => {
  let stop: (() => void) | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal(
      "document",
      Object.assign(new EventTarget(), { visibilityState: "visible" }),
    );
    vi.stubGlobal("window", new EventTarget());
    vi.mocked(loadRequestPage).mockReset();
    vi.mocked(listRequests).mockReset();
    vi.mocked(listStaff).mockReset();
    vi.mocked(listStaff).mockResolvedValue({ data: [] });
    useBoardStore.setState(useBoardStore.getInitialState(), true);
    useBoardStore.setState({
      sites: {
        11: {
          id: 11,
          name: "Singapore",
          timezone: "Asia/Singapore",
          business_hours: {},
        },
      },
      statusLabels: { pending: "Pending", processing: "Processing" },
    });
    useNotificationStore.setState(
      { ...useNotificationStore.getInitialState(), unread: {} },
      true,
    );
  });
  afterEach(() => {
    stop?.();
    stop = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reuses page one's response and emits one new batch without any extra request pages", async () => {
    vi.mocked(loadRequestPage)
      .mockResolvedValueOnce([request(1)])
      .mockResolvedValue([request(2), request(1)]);
    stop = startPageSync(query);
    await vi.advanceTimersByTimeAsync(0);
    expect(useNotificationStore.getState().serial).toBe(0);
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(useNotificationStore.getState().unread[2]?.ref).toBe("WO-2");
    expect(useNotificationStore.getState().serial).toBe(1);
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(useNotificationStore.getState().serial).toBe(1);
    expect(listRequests).not.toHaveBeenCalled();
  });
  it("checks only the newest page while viewing another page, without draining the list", async () => {
    vi.mocked(loadRequestPage).mockResolvedValue([request(1)]);
    vi.mocked(listRequests)
      .mockResolvedValueOnce({
        data: [request(1)],
        page: 1,
        per_page: 50,
        total_pages: 500,
      })
      .mockResolvedValue({
        data: [request(2), request(1)],
        page: 1,
        per_page: 50,
        total_pages: 500,
      });
    stop = startPageSync({ ...query, page: 4 });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(useNotificationStore.getState().unread[2]).toBeDefined();
    expect(
      vi.mocked(loadRequestPage).mock.calls.map(([query]) => query.page),
    ).toEqual([4, 4]);
    expect(
      vi
        .mocked(listRequests)
        .mock.calls.map(([params]) => [params.page, params.per_page]),
    ).toEqual([
      [1, 50],
      [1, 50],
    ]);
  });
  it("keeps a successful visible page live if the independent head check fails", async () => {
    vi.mocked(loadRequestPage).mockResolvedValue([request(1)]);
    vi.mocked(listRequests).mockRejectedValue(
      new Error("Notification check unavailable"),
    );
    stop = startPageSync({ ...query, page: 4 });
    await vi.advanceTimersByTimeAsync(0);
    expect(useBoardStore.getState().sync.status).toBe("live");
    expect(useNotificationStore.getState().serial).toBe(0);
  });
  it("cancels polling and prevents a late response from notifying after teardown", async () => {
    let finish!: (requests: HelpdeskRequest[]) => void;
    vi.mocked(loadRequestPage).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    stop = startPageSync(query);
    stop();
    stop = undefined;
    finish([request(2)]);
    await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    expect(useNotificationStore.getState().context).toBeNull();
    expect(useNotificationStore.getState().serial).toBe(0);
    expect(loadRequestPage).toHaveBeenCalledTimes(1);
  });
});
