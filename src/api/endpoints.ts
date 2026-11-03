import { get } from "./client";
import type {
  ChangePage,
  HelpdeskRequest,
  Page,
  RequestEvent,
  Site,
  Staff,
  StatusInfo,
} from "../types";
export const listSites = (signal?: AbortSignal) =>
  get<{ data: Site[] }>("/v1/sites", {}, signal);
export const listStaff = (signal?: AbortSignal) =>
  get<{ data: Staff[] }>("/v1/staff", {}, signal);
export const listStatuses = (signal?: AbortSignal) =>
  get<{ data: StatusInfo[] }>("/v1/statuses", {}, signal);
export const listRequests = (
  params: {
    page?: number;
    per_page?: number;
    created_from?: string;
    created_to?: string;
    status?: string;
  },
  signal?: AbortSignal,
) => get<Page<HelpdeskRequest>>("/v1/requests", params, signal);
export const getRequest = (id: number, signal?: AbortSignal) =>
  get<HelpdeskRequest>(`/v1/requests/${id}`, {}, signal);
export const listEvents = (id: number, page = 1, signal?: AbortSignal) =>
  get<Page<RequestEvent>>(`/v1/requests/${id}/events`, { page }, signal);
export const listChanges = (cursor?: string, signal?: AbortSignal) =>
  get<ChangePage>("/v1/changes", { cursor, limit: 500 }, signal);
export async function allEvents(id: number, signal?: AbortSignal) {
  const events = new Map<number, RequestEvent>();
  for (let page = 1; ; page++) {
    const result = await listEvents(id, page, signal);
    result.data.forEach((event) => events.set(event.id, event));
    if (!result.has_more) break;
  }
  return [...events.values()].sort((a, b) => a.at - b.at || a.id - b.id);
}
