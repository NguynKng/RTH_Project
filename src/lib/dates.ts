// Date helpers. The API wants DD/MM/YYYY; the rules talk about each site's local date.

/** "2026-10-06" -> "06/10/2026" (the format the API's created_from/created_to expect). */
export function toApiDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`Not a YYYY-MM-DD date: ${isoDate}`);
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** The YYYY-MM-DD date of an instant in a given IANA timezone. */
export function localDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Today's date, as YYYY-MM-DD, minus `days` days (UTC arithmetic on the calendar date). */
export function daysAgo(days: number, today = new Date()): string {
  const date = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() - days,
    ),
  );
  return date.toISOString().slice(0, 10);
}

export const todayIn = (timeZone: string, now = new Date()) =>
  localDate(now, timeZone);
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function addDays(date: string, days: number) {
  const instant = new Date(`${date}T00:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
export function formatSiteDate(value: string | null) {
  if (!value || !validDate(value)) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
const friendlyZones: Record<string, string> = {
  "Asia/Singapore": "SGT",
  "Asia/Jakarta": "WIB",
};
export function zoneLabel(timeZone: string, instant: Date = new Date()) {
  if (friendlyZones[timeZone]) return friendlyZones[timeZone];
  if (timeZone === "Australia/Sydney") {
    const offset = new Intl.DateTimeFormat("en", {
      timeZone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(instant)
      .find((p) => p.type === "timeZoneName")?.value;
    return offset === "GMT+11" ? "AEDT" : "AEST";
  }
  return (
    new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "short" })
      .formatToParts(instant)
      .find((p) => p.type === "timeZoneName")?.value ?? timeZone
  );
}
export function zoneOffset(timeZone: string, instant = new Date()) {
  return (
    new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(instant)
      .find((p) => p.type === "timeZoneName")
      ?.value.replace("GMT", "UTC") ?? ""
  );
}
export function formatInstant(value: string | number, timeZone: string) {
  const instant = new Date(typeof value === "number" ? value * 1000 : value);
  if (Number.isNaN(instant.getTime())) return "—";
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(instant);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
  return `${date}, ${time} ${zoneLabel(timeZone, instant)}`;
}
export function parseDueAt(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  const date = `${year}-${month}-${day}`;
  return validDate(date) && Number(hour) < 24 && Number(minute) < 60
    ? { date, time: `${hour}:${minute}` }
    : null;
}
export function formatDueAt(value: string, timeZone: string) {
  const due = parseDueAt(value);
  // This is a wall clock value, not a UTC instant. The IANA name is unambiguous at DST boundaries.
  return due ? `${formatSiteDate(due.date)}, ${due.time} (${timeZone})` : value;
}
export function elapsedLabel(milliseconds: number) {
  const minutes = Math.max(0, Math.floor(milliseconds / 60000));
  if (minutes < 60) return `${minutes} m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h ${minutes % 60} m`;
  return `${Math.floor(minutes / 1440)} d ${Math.floor((minutes % 1440) / 60)} h`;
}
