import { create } from "zustand";
import { detectNewRequests, type CreationCursor } from "../lib/newRequests";
import { pageQueryKey, type PageQuery } from "../lib/pageQuery";
import { counts } from "../lib/rules";
import type { HelpdeskRequest, Site } from "../types";

export interface RequestNotice {
  ref: string;
  createdAt: number;
}
export type UnreadRequests = Record<number, RequestNotice>;
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
  activeRequestId: number | null;
  context: string | null;
  cursor: CreationCursor | null;
  serial: number;
  soundEnabled: boolean;
  observeHead(
    query: PageQuery,
    requests: HelpdeskRequest[],
    sites: Record<number, Site>,
  ): number;
  markSeen(id: number): void;
  setActiveRequest(id: number | null): void;
  setSoundEnabled(enabled: boolean): void;
}

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  unread: parseUnread(readStored(UNREAD_KEY)),
  activeRequestId: null,
  context: null,
  cursor: null,
  serial: 0,
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
      serial: state.serial + (added.length ? 1 : 0),
    });
    if (added.length) writeStored(UNREAD_KEY, unread);
    return added.length;
  },
  markSeen: (id) => {
    if (!get().unread[id]) return;
    const unread = { ...get().unread };
    delete unread[id];
    set({ unread });
    writeStored(UNREAD_KEY, unread);
  },
  setActiveRequest: (id) => {
    set({ activeRequestId: id });
    if (id !== null) get().markSeen(id);
  },
  setSoundEnabled: (soundEnabled) => {
    set({ soundEnabled });
    writeStored(SOUND_KEY, soundEnabled);
  },
}));
