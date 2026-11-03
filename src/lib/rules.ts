import type { HelpdeskRequest, RequestEvent } from "../types";
import { addDays, localDate, todayIn } from "./dates";
export function counts(
  request: HelpdeskRequest,
  timezone: string,
  from: string,
  to: string,
) {
  if (
    request.status === "canceled" ||
    request.deleted_at ||
    request.merged_into_id !== null
  )
    return false;
  const date = localDate(new Date(request.created_at), timezone);
  return date >= from && date <= to;
}
export function isOverdue(
  request: HelpdeskRequest,
  timezone: string,
  now = new Date(),
) {
  return (
    (request.status === "pending" || request.status === "processing") &&
    !!request.due_on &&
    request.due_on < todayIn(timezone, now)
  );
}
export function staffName(id: number | null, staff: Record<number, string>) {
  return id === null ? "System" : (staff[id] ?? `Unknown staff #${id}`);
}

/** One calendar day remaining, in the request site's timezone. */
export function isDueTomorrow(
  request: HelpdeskRequest,
  timezone: string,
  now = new Date(),
) {
  return (
    (request.status === "pending" || request.status === "processing") &&
    !request.deleted_at &&
    request.merged_into_id === null &&
    !!request.due_on &&
    request.due_on === addDays(todayIn(timezone, now), 1)
  );
}
export const byEventTime = (a: RequestEvent, b: RequestEvent) =>
  a.at - b.at || a.id - b.id;
export function hiddenEventIds(events: RequestEvent[]) {
  const hidden = new Set<number>();
  for (const event of [...events].sort((a, b) => byEventTime(b, a))) {
    if (event.reverts_id === null || hidden.has(event.id)) continue;
    hidden.add(event.id);
    hidden.add(event.reverts_id);
  }
  return hidden;
}
export const IGNORE_UNDONE_RESPONSES = true;
export function firstResponse(
  events: RequestEvent[],
  hidden = hiddenEventIds(events),
) {
  return (
    [...events]
      .sort(byEventTime)
      .find(
        (event) =>
          event.status === "processing" &&
          event.actor_id !== null &&
          (!IGNORE_UNDONE_RESPONSES || !hidden.has(event.id)),
      ) ?? null
  );
}
