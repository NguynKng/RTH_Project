import { create } from "zustand";
import { detectNewRequests, type CreationCursor } from "../lib/newRequests";
import { pageQueryKey, type PageQuery } from "../lib/pageQuery";
import { counts } from "../lib/rules";
import type { HelpdeskRequest, Site } from "../types";
import { UNREAD_REQUEST_CACHE_LIMIT } from "../config";
import { mergeRequests } from "./store";

export interface RequestNotice {
  ref: string;
  createdAt: number;
}
export type UnreadRequests = Record<number, RequestNotice>;

/** Keep full records only for unread requests, with a bounded in-memory cache.
 * Newly fetched/visible records take priority; the persisted unread ledger is never evicted. */
export function mergeUnreadRecords(
  current: Record<number, HelpdeskRequest>,
  incoming: HelpdeskRequest[],
  unread: UnreadRequests,
) {
  const matching = incoming.filter((request) => unread[request.id]);
  const merged = mergeRequests(current, matching).requests;
  const ids = [
    ...new Set([
      ...matching.map((request) => request.id),
      ...Object.keys(current).map(Number),
    ]),
  ]
    .filter((id) => unread[id] && merged[id])
    .slice(0, UNREAD_REQUEST_CACHE_LIMIT);
  const next = Object.fromEntries(ids.map((id) => [id, merged[id]]));
  return Object.keys(current).length === ids.length &&
    ids.every((id) => current[id] === next[id])
    ? current
    : next;
}
const UNREAD_KEY = "bluebay.notifications.unread.v1";
const SOUND_KEY = "bluebay.notifications.sound.v1";

function readStored(key: string): unknown {
  try {
    return typeof window === "undefined"
      ? null
      : JSON.parse(window.localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
function writeStored(key: string, value: unknown) {
  try {
    if (typeof window !== "undefined")
      window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Keep this session usable if browser storage is unavailable or full. */
  }
}
export function parseUnread(value: unknown): UnreadRequests {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const unread: UnreadRequests = {};
  for (const [id, notice] of Object.entries(value)) {
    if (
      !/^\d+$/.test(id) ||
      !Number.isSafeInteger(Number(id)) ||
      Number(id) <= 0 ||
      !notice ||
      typeof notice !== "object"
    )
      continue;
    const candidate = notice as Partial<RequestNotice>;
    if (
      typeof candidate.ref === "string" &&
      candidate.ref.length <= 64 &&
      typeof candidate.createdAt === "number" &&
      Number.isFinite(candidate.createdAt)
    ) {
      unread[Number(id)] = {
        ref: candidate.ref,
        createdAt: candidate.createdAt,
      };
    }
  }
  return unread;
}

interface NotificationStore {
  unread: UnreadRequests;
  records: Record<number, HelpdeskRequest>;
  activeRequestId: number | null;
  context: string | null;
  cursor: CreationCursor | null;
  serial: number;
  latestArrivalIds: number[];
  soundEnabled: boolean;
  observeHead(
    query: PageQuery,
    requests: HelpdeskRequest[],
    sites: Record<number, Site>,
  ): number;
  markSeen(id: number): void;
  cacheUnreadRequests(requests: HelpdeskRequest[]): void;
  setActiveRequest(id: number | null): void;
  setSoundEnabled(enabled: boolean): void;
}

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  unread: parseUnread(readStored(UNREAD_KEY)),
  records: {},
  activeRequestId: null,
  context: null,
  cursor: null,
  serial: 0,
  latestArrivalIds: [],
  soundEnabled: readStored(SOUND_KEY) !== false,
  observeHead: (query, requests, sites) => {
    const state = get();
    const context = pageQueryKey({ ...query, page: 1 });
    const eligible = requests.filter((request) => {
      const site = sites[request.site_id];
      return (
        Number.isFinite(Date.parse(request.created_at)) &&
        site &&
        counts(request, site.timezone, query.from, query.to)
      );
    });
    const result = detectNewRequests(
      eligible,
      context === state.context ? state.cursor : null,
    );
    const added = result.newRequests.filter(
      (request) =>
        !state.unread[request.id] && state.activeRequestId !== request.id,
    );
    const unread = added.length ? { ...state.unread } : state.unread;
    added.forEach((request) => {
      unread[request.id] = {
        ref: request.ref,
        createdAt: Date.parse(request.created_at),
      };
    });
    set({
      context,
      cursor: result.cursor,
      unread,
      records: mergeUnreadRecords(state.records, eligible, unread),
      serial: state.serial + (added.length ? 1 : 0),
      latestArrivalIds: added.length
        ? added.map((request) => request.id)
        : state.latestArrivalIds,
    });
    if (added.length) writeStored(UNREAD_KEY, unread);
    return added.length;
  },
  markSeen: (id) => {
    if (!get().unread[id]) return;
    const unread = { ...get().unread };
    const records = { ...get().records };
    delete unread[id];
    delete records[id];
    set({ unread, records });
    writeStored(UNREAD_KEY, unread);
  },
  cacheUnreadRequests: (requests) =>
    set((state) => ({
      records: mergeUnreadRecords(state.records, requests, state.unread),
    })),
  setActiveRequest: (id) => {
    set({ activeRequestId: id });
    if (id !== null) get().markSeen(id);
  },
  setSoundEnabled: (soundEnabled) => {
    set({ soundEnabled });
    writeStored(SOUND_KEY, soundEnabled);
  },
}));
