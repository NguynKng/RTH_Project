import { listRequests } from "../api/endpoints";
import {
  pageQueryKey,
  requestPageParams,
  type PageQuery,
} from "../lib/pageQuery";
import { mergeRequests, useBoardStore } from "./store";

/** Fetch exactly the requested API page; never drain or prefetch other pages. */
export async function loadRequestPage(query: PageQuery, signal: AbortSignal) {
  const initial = useBoardStore.getState();
  const key = pageQueryKey(query);
  const changingPage = initial.loadedPage?.key !== key;
  if (
    changingPage ||
    initial.snapshot === "idle" ||
    initial.snapshot === "error"
  ) {
    useBoardStore.setState({ snapshot: "loading", snapshotError: undefined });
  }

  const response = await listRequests(
    requestPageParams(query, initial.statusLabels),
    signal,
  );
  if (signal.aborted) return;

  const previous = useBoardStore.getState();
  const ids = [...new Set(response.data.map((request) => request.id))];
  const merged = mergeRequests(previous.requests, response.data);
  // Keep only this page. A detail outside it keeps its own fetched record in its hook.
  const requests = Object.fromEntries(
    ids.map((id) => [id, merged.requests[id]]),
  );
  const removed = changingPage
    ? 0
    : (previous.loadedPage?.ids ?? []).filter((id) => !requests[id]).length;
  const changes = changingPage ? [] : merged.changed;

  useBoardStore.setState({
    requests,
    loadedPage: {
      ...query,
      statuses: [...query.statuses],
      key,
      ids,
      page: response.page,
      perPage: response.per_page,
      total: response.total ?? ids.length,
      totalPages: Math.max(1, response.total_pages ?? 1),
    },
    snapshot: "ready",
    snapshotError: undefined,
    recentlyChanged: Object.fromEntries(changes.map((id) => [id, Date.now()])),
    announcement: changingPage
      ? ""
      : changes.length || removed
        ? `${changes.length + removed} requests updated on this page`
        : previous.announcement,
  });
  return response.data;
}
