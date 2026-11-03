import { beforeEach, describe, expect, it, vi } from "vitest";
import { listRequests } from "../api/endpoints";
import { defaultFilters } from "../lib/urlState";
import { useBoardStore } from "./store";
import { loadRequestPage } from "./snapshot";
import type { HelpdeskRequest, Page } from "../types";

vi.mock("../api/endpoints", () => ({ listRequests: vi.fn() }));
const query = { ...defaultFilters(new Date("2026-11-03T05:00:00Z")), page: 3 };
const request = (id: number, updated_at = "2026-11-01T00:00:00Z") =>
  ({
    id,
    ref: `WO-${id}`,
    title: "Lift",
    location: "Lobby",
    site_id: 11,
    status: "pending",
    priority: "High",
    created_at: "2026-11-01T00:00:00Z",
    updated_at,
    due_on: null,
    assignee: null,
    deleted_at: null,
    merged_into_id: null,
  }) as HelpdeskRequest;
const page = (data: HelpdeskRequest[], page = 3): Page<HelpdeskRequest> => ({
  data,
  page,
  per_page: 50,
  total: 3190,
  total_pages: 66,
});

describe("on-demand API pagination", () => {
  beforeEach(() => {
    vi.mocked(listRequests).mockReset();
    useBoardStore.setState(useBoardStore.getInitialState(), true);
    useBoardStore.setState({
      statusLabels: {
        pending: "Pending",
        processing: "Processing",
        complete: "Complete",
        canceled: "Cancelled",
      },
    });
  });

  it("fetches exactly the requested page even when the API reports many more", async () => {
    vi.mocked(listRequests).mockResolvedValue(page([request(1), request(2)]));
    await loadRequestPage(query, new AbortController().signal);
    expect(listRequests).toHaveBeenCalledTimes(1);
    expect(listRequests).toHaveBeenCalledWith(
      {
        page: 3,
        per_page: 50,
        created_from: "04/10/2026",
        created_to: "04/11/2026",
        status: '["pending","processing"]',
      },
      expect.any(AbortSignal),
    );
    expect(useBoardStore.getState().loadedPage).toMatchObject({
      page: 3,
      total: 3190,
      totalPages: 66,
      perPage: 50,
      ids: [1, 2],
    });
  });

  it("replaces the active page and deduplicates overlaps without accumulating all pages", async () => {
    vi.mocked(listRequests)
      .mockResolvedValueOnce(page([request(1), request(2)]))
      .mockResolvedValueOnce(page([request(2), request(3), request(3)], 4));
    await loadRequestPage(query, new AbortController().signal);
    await loadRequestPage({ ...query, page: 4 }, new AbortController().signal);
    expect(Object.keys(useBoardStore.getState().requests)).toEqual(["2", "3"]);
    expect(useBoardStore.getState().loadedPage?.ids).toEqual([2, 3]);
    expect(listRequests).toHaveBeenCalledTimes(2);
  });

  it("polls only the active page, retaining fresh details and reconciling removals", async () => {
    vi.mocked(listRequests)
      .mockResolvedValueOnce(page([request(1), request(2)]))
      .mockResolvedValueOnce(page([request(1)]));
    await loadRequestPage(query, new AbortController().signal);
    useBoardStore
      .getState()
      .upsertRequests([request(1, "2026-11-02T00:00:00Z"), request(999)]);
    await loadRequestPage(query, new AbortController().signal);
    expect(useBoardStore.getState().requests[1].updated_at).toBe(
      "2026-11-02T00:00:00Z",
    );
    expect(Object.keys(useBoardStore.getState().requests)).toEqual(["1"]);
    expect(useBoardStore.getState().announcement).toBe(
      "1 requests updated on this page",
    );
    expect(
      vi.mocked(listRequests).mock.calls.map(([params]) => params.page),
    ).toEqual([3, 3]);
  });

  it("does not commit an old page response after cancellation", async () => {
    const controller = new AbortController();
    vi.mocked(listRequests).mockImplementation(async () => {
      controller.abort();
      return page([request(1)]);
    });
    await loadRequestPage(query, controller.signal);
    expect(useBoardStore.getState().loadedPage).toBeNull();
    expect(useBoardStore.getState().requests).toEqual({});
  });

  it("asks the API for all non-canceled statuses when no status is selected", async () => {
    vi.mocked(listRequests).mockResolvedValue(page([]));
    await loadRequestPage(
      { ...query, statuses: [] },
      new AbortController().signal,
    );
    expect(
      JSON.parse(vi.mocked(listRequests).mock.calls[0][0].status!),
    ).toEqual(["pending", "processing", "complete"]);
  });
});
