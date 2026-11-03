// Read-only API exploration. Run: node --env-file=.env scripts/probe.mjs
const base = process.env.HELPDESK_URL?.replace(/\/$/, "");
const token = process.env.HELPDESK_TOKEN;
if (!base || !token)
  throw new Error("Set HELPDESK_URL and HELPDESK_TOKEN in .env first.");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function get(path, params = {}) {
  const url = new URL(base + path);
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, String(value)),
  );
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if ((response.status === 429 || response.status >= 500) && attempt < 4) {
      const seconds = Math.min(
        30,
        Math.max(
          1,
          Number(response.headers.get("Retry-After")) || 2 ** attempt,
        ),
      );
      console.log(
        JSON.stringify({ endpoint: path, retry: response.status, seconds }),
      );
      await pause(seconds * 1000);
      continue;
    }
    if (!response.ok) throw new Error(`API returned HTTP ${response.status}`);
    return response.json();
  }
}
const [sites, staff, statuses] = await Promise.all(
  ["sites", "staff", "statuses"].map((name) => get(`/v1/${name}`)),
);
console.log(
  JSON.stringify({
    sites: sites.data.map(({ id, name, timezone }) => ({ id, name, timezone })),
    staffCount: staff.data.length,
    statuses: statuses.data,
  }),
);
const requests = new Map();
const localDates = sites.data.map((site) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: site.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((key) => parts.find((part) => part.type === key).value)
    .join("-");
});
const to = localDates.sort().at(-1);
const fromDate = new Date(`${to}T00:00:00Z`);
fromDate.setUTCDate(fromDate.getUTCDate() - 30);
const toDate = new Date(`${to}T00:00:00Z`);
toDate.setUTCDate(toDate.getUTCDate() + 1);
const apiDate = (date) =>
  date.toISOString().slice(0, 10).split("-").reverse().join("/");
const range = { created_from: apiDate(fromDate), created_to: apiDate(toDate) };
const first = await get("/v1/requests", { ...range, page: 1, per_page: 100 });
let duplicates = 0;
function collect(page) {
  for (const request of page.data) {
    if (requests.has(request.id)) duplicates++;
    requests.set(request.id, request);
  }
}
collect(first);
for (let page = 2; page <= (first.total_pages ?? 1); page++)
  collect(await get("/v1/requests", { ...range, page, per_page: 100 }));
const rows = [...requests.values()];
console.log(
  JSON.stringify({
    total: first.total,
    pages: first.total_pages,
    perPage: first.per_page,
    unique: requests.size,
    duplicates,
    unknownSites: [
      ...new Set(
        rows
          .filter((r) => !sites.data.some((s) => s.id === r.site_id))
          .map((r) => r.site_id),
      ),
    ],
    unknownStaff: [
      ...new Set(
        rows
          .filter(
            (r) =>
              r.assignee && !staff.data.some((s) => s.id === r.assignee.id),
          )
          .map((r) => r.assignee.id),
      ),
    ],
    priorities: [...new Set(rows.map((r) => r.priority))],
    oldest: rows.map((r) => r.created_at).sort()[0],
    newest: rows
      .map((r) => r.created_at)
      .sort()
      .at(-1),
    invalidDueDates: rows.filter(
      (r) => r.due_on && !/^\d{4}-\d{2}-\d{2}$/.test(r.due_on),
    ).length,
  }),
);
const request = rows.find((r) => r.id === 41210) ?? rows[0];
if (request) {
  const events = await get(`/v1/requests/${request.id}/events`);
  console.log(
    JSON.stringify({
      requestId: request.id,
      eventPageSize: events.per_page,
      moreEvents: events.has_more,
      unixSeconds: events.data.every((e) => e.at < 1e11),
      dueAtExamples: events.data
        .filter((e) => e.due_at)
        .slice(0, 3)
        .map((e) => e.due_at),
      revertsOnFirstPage: events.data.filter((e) => e.reverts_id !== null)
        .length,
    }),
  );
}
let cursor,
  feedPages = 0,
  changes = 0,
  more = true;
while (more && feedPages < 21) {
  const page = await get("/v1/changes", {
    limit: 500,
    ...(cursor ? { cursor } : {}),
  });
  feedPages++;
  changes += page.data.length;
  cursor = page.next_cursor;
  more = page.has_more;
}
console.log(JSON.stringify({ feedPages, changes, fullyDrained: !more }));
