import { create } from "zustand";
import type { HelpdeskRequest, Site } from "../types";
import type { PageQuery } from "../lib/pageQuery";

export interface LoadedPage extends PageQuery {
  key: string;
  ids: number[];
  perPage: number;
  total: number;
  totalPages: number;
}
export interface BoardStore {
  sites: Record<number, Site>;
  staff: Record<number, string>;
  statusLabels: Record<string, string>;
  bootstrap: "idle" | "loading" | "ready" | "error";
  bootstrapError?: string;
  requests: Record<number, HelpdeskRequest>;
  loadedPage: LoadedPage | null;
  snapshot: "idle" | "loading" | "ready" | "error";
  snapshotError?: string;
  sync: {
    status: "starting" | "live" | "retrying" | "offline";
    lastSuccessAt: number | null;
    retryAt?: number;
    polling: boolean;
  };
  recentlyChanged: Record<number, number>;
  refreshVersion: number;
  announcement: string;
  upsertRequests(list: HelpdeskRequest[]): number;
  setStaffName(id: number, name: string): void;
  setSync(patch: Partial<BoardStore["sync"]>): void;
  refresh(): void;
}
export function mergeRequests(
  current: Record<number, HelpdeskRequest>,
  incoming: HelpdeskRequest[],
) {
  const requests = { ...current };
  const changed: number[] = [];
  for (const request of incoming) {
    const existing = requests[request.id];
    if (
      !existing ||
      Date.parse(request.updated_at) > Date.parse(existing.updated_at)
    ) {
      requests[request.id] = request;
      changed.push(request.id);
    }
  }
  return { requests: changed.length ? requests : current, changed };
}
export const useBoardStore = create<BoardStore>()((set, get) => ({
  sites: {},
  staff: {},
  statusLabels: {},
  bootstrap: "idle",
  requests: {},
  loadedPage: null,
  snapshot: "idle",
  sync: { status: "starting", lastSuccessAt: null, polling: false },
  recentlyChanged: {},
  refreshVersion: 0,
  announcement: "",
  upsertRequests: (list) => {
    const merged = mergeRequests(get().requests, list);
    if (merged.changed.length)
      set({
        requests: merged.requests,
        recentlyChanged: Object.fromEntries(
          merged.changed.map((id) => [id, Date.now()]),
        ),
      });
    return merged.changed.length;
  },
  setStaffName: (id, name) =>
    set((state) => ({ staff: { ...state.staff, [id]: name } })),
  setSync: (patch) => set((state) => ({ sync: { ...state.sync, ...patch } })),
  refresh: () => set((state) => ({ refreshVersion: state.refreshVersion + 1 })),
}));
