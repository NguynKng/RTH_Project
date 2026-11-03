# Implementation plan: Bluebay requests board

The working plan for the 3-hour build. It is derived from the brief, `docs/rules.md`, `docs/api.md`,
the kit `README.md`, and the UI in `UI_SPEC.md` / `DESIGN.md`.

Stack: React 18 + TypeScript + Vite + Vitest, from the kit starter. No backend.

| Library | Used for |
| --- | --- |
| `zustand` | App data: sites, staff, statuses, requests, snapshot and sync status |
| `react-router` (v7) | Routes (`/` and `/requests/:id`), and filters in the URL via `useSearchParams` |
| `lucide-react` | Every icon (always `aria-hidden`, with text or `aria-label` beside it) |

Search uses a small hand-written `useDebouncedValue` hook (300 ms). Data is polled **every 10 s**.

---

## 0. Ground rules from the kit (checked by a script before any human reads the code)

| Check | Command | Consequence |
| --- | --- | --- |
| Builds | `npm ci && npm run build` | `package.json` and `package-lock.json` must sit at the **repo root** |
| Tests pass | `npm test` | Vitest, `environment: "node"`; keep tests on pure functions |
| Type-checks | `npx tsc --noEmit` | strict mode, `noUnusedLocals` and `noUnusedParameters` are on |
| Complete | `DECISIONS.md` with its 4 headings, ≥ 5 commits, a video link, no secrets | `.env` never committed; the token is never hard-coded |

Other constraints:
- **3-hour cap.** Build the levels in order (1 → 4). Commit after each level.
- **Data starts changing 5 minutes after the first API call.** Do the API probe (step 1) right
  before you start coding, not earlier.
- **The client may post messages on the invitation page.** Check it at each commit.
- The token ends up in the browser bundle (`envPrefix: ["VITE_", "HELPDESK_"]`). This is acceptable
  for a practice API and gets a line in DECISIONS.md.

---

## 1. Step-by-step

### Step 0: Fix the repo layout (5 min)

The starter was copied into `react-vite/`, but the checks run at the root. Move it:

```bash
cp -r react-vite/. . && rm -rf react-vite      # brings .env, DESIGN.md, UI_SPEC.md along
rm -rf node_modules && npm install
npm install zustand react-router lucide-react  # lockfile updated → npm ci works
git status                                     # .env must NOT be listed
npm test && npx tsc --noEmit && npm run build
```

Commit: `chore: use the React starter at the repo root, add zustand, react-router, lucide-react`

### Step 1: Probe the API and write down surprises (15 min)

Write `scripts/probe.mjs`. It reads `.env` via `process.env` (run it with `node --env-file=.env`),
so no secret is ever in the code. The script fetches the data and prints facts; it does not change
anything. Check each of these:

| Question | Why it matters |
| --- | --- |
| `/v1/sites`: how many sites, their timezones, any odd ones | Every date rule depends on the timezone |
| `/v1/staff`: count; are any `assignee.id` / `actor_id` missing from it? | Rule 3, the "Unknown staff" fallback |
| `/v1/statuses`: the labels, and any value beyond the 4 documented | Display labels; unknown statuses |
| `/v1/requests` over the last 30 days: `total`, `total_pages`, the real `per_page` cap | Pagination cost and rate limits |
| Do pages overlap (same `id` on two pages)? Does `total` change between pages? | Dedupe by id |
| Any `site_id` that is not in `/v1/sites`? | Without a timezone, the rules cannot be applied |
| `priority` values: casing, `null`, others? | Normalise before display and sort |
| `created_at` format: always `Z`? any offsets, or values without a timezone? | Parse safely |
| `due_on`: always `YYYY-MM-DD` or `null`? | Overdue rule |
| Do `created_from` / `created_to` use the UTC date or the site date? Compare the edges of the result | Decides the ±1-day padding (step 3) |
| Events: is `at` ever in milliseconds? `due_at` format? `reverts_id` chains? Reverts pointing at missing ids? | Rules 4 and 5 |
| `/v1/changes`: how many pages to drain from the start with `limit=500`? | Whether the change feed is feasible at startup (step 6) |
| How often do 429 and 5xx happen, and what are the `Retry-After` values? Response times? | Retry and backoff tuning |

Copy every surprise into `DECISIONS.md → What I found in the API or data` **as you find it**.

Commit: `chore: API probe script and first findings`

### Step 2: API client that holds up (20 min). Partly level 4, but needed by everything

`src/api/client.ts` extends the starter `get()`:

- **Timeout**: `AbortController`, 10 s per request.
- **Retries**:
  - `429` → wait `Retry-After` seconds (capped at 30 s, with a small jitter).
  - `5xx`, network error or timeout → exponential backoff (1 s, 2 s, 4 s, 8 s, with jitter), at most 4 tries.
  - `4xx` other than 429 → no retry, throw `ApiError`.
- **Concurrency limiter**: at most 2 requests in flight **per endpoint** (the API rate-limits per
  endpoint). A small queue is enough; no library needed.
- **Status reporting**: the client emits `{ kind: "retrying", endpoint, retryAt }` and
  `{ kind: "ok" }` to a tiny subscriber set, so the UI can show "Helpdesk busy, retrying in 8 s".
- **Abort**: every call accepts a `signal`, so a range change cancels the old load.

```ts
async function request<T>(path, params, { signal, attempt = 0 }): Promise<T> {
  await limiter.acquire(endpointOf(path));
  try {
    const res = await fetchWithTimeout(url, { headers, signal }, 10_000);
    if (res.ok) { emit({ kind: "ok" }); return res.json(); }
    const err = await toApiError(res);                 // reads { error }, Retry-After
    if (!retryable(err) || attempt >= 4) throw err;    // 429 / 5xx only
    const wait = err.status === 429 ? clamp(err.retryAfterSeconds ?? 5, 1, 30) * 1000
                                    : backoff(attempt); // 1s, 2s, 4s, 8s + jitter
    emit({ kind: "retrying", endpoint: endpointOf(path), retryAt: Date.now() + wait });
    await sleep(wait, signal);
    return request(path, params, { signal, attempt: attempt + 1 });
  } finally { limiter.release(endpointOf(path)); }
}
```

Note: release the limiter slot **before** sleeping, otherwise a retrying call blocks others.

Tests (`client.test.ts`, with a mocked `fetch`): a 429 with `Retry-After: 2` waits ~2 s (use fake
timers) and then succeeds; a 500 retries then throws; a 404 does not retry.

### Step 3: Data layer and the six rules as pure functions (30 min). Level 1 core

`src/lib/dates.ts`: extend the starter's helpers.

| Function | In → out | Rule |
| --- | --- | --- |
| `localDate(instant, tz)` | `Date` → `YYYY-MM-DD` | (exists) |
| `todayIn(tz, now)` | → `YYYY-MM-DD` | 2 |
| `addDays(isoDate, n)` | calendar arithmetic in UTC | range padding |
| `formatInstant(isoOrUnix, tz)` | → `06 Oct 2026, 11:42 GMT+8` | 4 |
| `formatSiteDate(YYYY-MM-DD)` | → `31 Oct 2026` (formatted with `timeZone: "UTC"` so it never shifts) | 2/4 |
| `parseDueAt("07/10/2026 10:00")` | → `{ date: "2026-10-07", time: "10:00" }`. Displayed as wall-clock time plus the site zone, **never** passed through `new Date()` | 4 |
| `zoneLabel(tz, instant)` | → `GMT+8` via `Intl` `timeZoneName: "short"`; also show the IANA name in captions | 4 |

`src/lib/rules.ts` holds pure, tested functions, one per rule:

```ts
// Rule 1
export function counts(r: HelpdeskRequest, tz: string, from: string, to: string): boolean {
  if (r.status === "canceled" || r.deleted_at || r.merged_into_id) return false;
  const d = localDate(new Date(r.created_at), tz);
  return d >= from && d <= to;                 // YYYY-MM-DD compares as a string
}

// Rule 2
export function isOverdue(r: HelpdeskRequest, tz: string, now: Date): boolean {
  if (r.status !== "pending" && r.status !== "processing") return false;
  if (!r.due_on) return false;
  return r.due_on < todayIn(tz, now);
}

// Rule 3
export function staffName(id: number | null, staff: Map<number, string>): string {
  if (id === null) return "System";
  return staff.get(id) ?? `Unknown staff #${id}`;   // never r.assignee.name / e.actor_name
}

// Rule 5: process newest → oldest, so an undo of an undo restores the original
export function hiddenEventIds(events: RequestEvent[]): Set<number> {
  const hidden = new Set<number>();
  for (const e of [...events].sort(byAtDescThenIdDesc)) {
    if (e.reverts_id === null || hidden.has(e.id)) continue; // already undone itself → its undo is void
    hidden.add(e.id);
    hidden.add(e.reverts_id);                               // may point at an id we never saw: fine
  }
  return hidden;
}

// Rule 6
export function firstResponse(events: RequestEvent[], hidden: Set<number>) {
  return [...events].sort(byAtAscThenIdAsc)
    .find(e => e.status === "processing" && e.actor_id !== null && !hidden.has(e.id)) ?? null;
}
```

**Decisions to record** in DECISIONS.md:
- Rule 5 and chains: a revert-of-a-revert leaves the original event visible.
- Rule 6 ignores undone events. The rule is silent on this; the reasoning is that an undone
  "processing" was not a real response. Keep it behind one constant so it is easy to flip if the
  client says otherwise.
- Event `assignee_name` has no id, so it **cannot** be looked up as rule 3 asks. Show it labelled
  "name at the time". If it matches exactly one staff member by name, show that person's current
  name.
- Ties on `at` are broken by `id`.

Tests (`rules.test.ts`) are the most valuable tests in the repo:
- rule 1 at the Sydney/UTC date boundary; canceled, deleted and merged requests are excluded;
  inclusive edges;
- rule 2 with `due_on` null, `complete`, due today (not overdue), due yesterday, and "today" being
  different in Sydney vs Jakarta;
- rule 5 with a simple pair, a chain A ← B ← C, and a revert pointing at an unknown id;
- rule 6 picking the earliest by `at` even when the API returns newest first, skipping System
  events, skipping undone events.

### Step 4: Store, snapshot loading and URL state (25 min). Level 1

**Bootstrap** (once, in parallel): `/v1/sites`, `/v1/staff`, `/v1/statuses` go into maps
`sitesById`, `staffById`, `statusLabel`. If this fails, show a full-page error with Retry: nothing
can be displayed correctly without the timezones.

**Snapshot for a range** (`src/data/snapshot.ts`):
1. Ask the API for a **padded** range: `created_from = from − 1 day`, `created_to = to + 1 day`,
   in `DD/MM/YYYY`. The API's date is not the site's local date (or step 1 proved it is, in which
   case drop the padding). Rule 1 is applied client-side, so the padding is always safe.
2. Do **not** send a `status` filter. Fetch everything and filter client-side. The status filter
   then stays instant, and canceled requests still arrive, so they can be removed from the board.
3. Fetch page 1 with `per_page=100` to read `total_pages`. Fetch pages 2..N through the limiter.
4. Merge every page into `Map<id, request>`. This **dedupes** items that slide across pages while
   the data changes during paging. Anything missed is caught by the change feed.
5. If some pages fail after retries, keep what arrived and report it: "Showing 180 of 231,
   retrying…".

**Store** (`src/data/store.ts`, zustand). It holds **server data and sync status only**. Filters,
sort, search and the open request live in the URL, which is the single source of truth. Do not
copy them into zustand: two sources of truth drift apart.

Use plain `Record`s, not `Map`s. Zustand detects changes by reference, so every update returns a
new object, and records are easier to copy.

```ts
interface BoardStore {
  // reference data (bootstrap)
  sites: Record<number, Site>;
  staff: Record<number, string>;
  statusLabels: Record<string, string>;
  bootstrap: "idle" | "loading" | "ready" | "error";

  // requests
  requests: Record<number, HelpdeskRequest>;
  loadedRange: { from: string; to: string } | null;
  snapshot: "idle" | "loading" | "ready" | "error";
  snapshotError?: string;
  partial?: { got: number; total: number };

  // live sync
  sync: { status: "starting" | "live" | "retrying" | "stale" | "offline";
          lastSuccessAt: number | null; retryAt?: number; cursor?: string; lastSeq: number };
  recentlyChanged: Record<number, number>;          // id → timestamp, for the row highlight

  // actions
  upsertRequests(list: HelpdeskRequest[]): number;  // returns how many actually changed
  setStaffName(id: number, name: string): void;
  setSync(patch: Partial<BoardStore["sync"]>): void;
}

export const useBoardStore = create<BoardStore>()((set, get) => ({ ... }));
```

Upsert guard. A feed item or a refetch must never overwrite newer data with older data:

```ts
upsertRequests: (list) => {
  const next = { ...get().requests }; let changed = 0;
  for (const r of list) {
    const cur = next[r.id];
    if (!cur || r.updated_at > cur.updated_at) { next[r.id] = r; changed++; }
  }
  if (changed) set({ requests: next });
  return changed;
}
```

Reading from the store:
- Components select narrowly, e.g. `useBoardStore(s => s.sync)`. Use `useShallow` when a selector
  returns an object.
- Data loading (`snapshot.ts`, `sync.ts`) calls `useBoardStore.getState()` and `.setState()`
  outside React.
- Tests use the same `getState()` / `setState()` calls in the node environment. No DOM is needed.

**Derived board rows**. `useBoardRows(filters, now)` is a `useMemo` over requests, sites, staff,
filters and `now`. It is a pure function `buildRows(...)` in `lib/rows.ts`, so it can be tested.
The steps:
1. drop requests whose `site_id` is unknown, and count them so they can be reported in a footnote;
2. apply rule 1 (`counts`) with the site's timezone;
3. apply the site and status filters;
4. add `overdue` (rule 2), the assignee name (rule 3) and the site name;
5. apply **search** (debounced `q`, see below);
6. sort:
   - `created` → by `created_at` instant;
   - `due` → by `due_on` string, with **nulls always last**;
   - tie-break by `id`.

**Search** (client-side; the API has no search parameter):
- It matches, case-insensitive and trimmed: ref, title, location, the assignee's **current** name
  and the site name. Normalise with `toLocaleLowerCase()` and strip accents with
  `normalize("NFD")`.
- The input keeps its own local state, so typing is instant. A `useDebouncedValue(text, 300)`
  hook writes `q` to the URL (with `replace: true`). Filtering runs on the debounced value only.
- "✕" clears it; Esc inside the input also clears it.
- The result count is announced in a polite live region: "12 results".
- Its empty state is "No requests match 'lift'", with a Clear search button.

```ts
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
```

**Routing and URL state** (`react-router` v7, `createBrowserRouter`):

```
/                    → <BoardPage/>            (layout: TopBar + FilterBar + table, with <Outlet/>)
/requests/:id        → <DetailDrawer/>         (child route rendered in the board's <Outlet/>)
*                    → redirect to /
```

The query string carries everything else:

```
/requests/41210?from=2026-10-05&to=2026-11-03&site=11,12&status=pending,processing&sort=due&dir=asc&q=lift
```

- `src/lib/urlState.ts` holds pure `parseFilters(URLSearchParams) → Filters` and
  `toSearchParams(Filters)`. `useFilters()` wraps `useSearchParams()` and returns
  `[filters, setFilters]`.
- Every field is validated. Invalid values fall back to the default. If `from > to`, swap them.
- `from`/`to` are **always written explicitly** on the first load (a `replace` navigation). A link
  sent today must show the same range tomorrow.
- Filter, sort and search changes use `setSearchParams(..., { replace: true })`, so the history is
  not spammed.
- Opening a row is a `<Link to={`/requests/${id}?${searchParams}`}>`, a push. Closing navigates to
  `/?${searchParams}`. The **Back button closes the drawer** and filters survive both ways.
- A detail link works on its own: opening `/requests/41210?...` directly shows the board behind the
  drawer.
- Vite's dev server and `vite preview` already fall back to `index.html`, so deep links work. A
  real deploy needs an SPA rewrite: note this in DECISIONS.
- Default range: `to` = today in the site that is furthest ahead (Sydney), `from = to − 29` (30
  calendar days inclusive). Record this in DECISIONS.
- Tests: the parse/serialize round-trip; garbage input → defaults.

### Step 5: Board UI (25 min). Level 1 done

Components (follow `UI_SPEC.md`):
`TopBar` (`LiveIndicator`, `CopyLinkButton`) · `FilterBar` (with `SearchInput`) · `RequestTable` ·
`RequestCards` (mobile) · `StatusPill` · `PriorityIcon` · `OverdueTag` · `Avatar` · `EmptyState` /
`ErrorState` · `Skeleton` (`SkeletonRows`, `SkeletonCards`, `SkeletonDetail`).

**Icons** (`lucide-react`). Decorative icons get `aria-hidden="true"`. Icon-only buttons get an
`aria-label`. Size 16 inside the table, 20 in buttons, `strokeWidth={1.75}`.

| Use | Icon |
| --- | --- |
| Search / clear | `Search`, `X` |
| Copy link / refresh | `Link`, `RefreshCw` (spins while a poll is in flight; static under reduced motion) |
| Sort headers | `ArrowUp`, `ArrowDown`, `ArrowUpDown` (inactive) |
| Priority | `SignalHigh`, `SignalMedium`, `SignalLow`, `Minus` (none) |
| Status | `Circle` (pending), `CircleDot` (processing), `CircleCheck` (complete) |
| Overdue | `Clock` |
| Filters / date | `SlidersHorizontal`, `Calendar`, `Building2` (site) |
| Timeline | `Plus` (created), `UserRound` (assigned), `ArrowRight` (status), `StickyNote` (note), `CalendarClock` (deadline), `Undo2` (undone), `Bot` (System actor) |
| Detail | `Globe` (timezone caption), `MessageSquareReply` (first response), `ChevronLeft` (mobile back) |
| States | `Inbox` (empty), `SearchX` (no search match), `AlertTriangle` (error/busy), `WifiOff` (offline) |

**Skeleton loading** is shown only when there is **nothing to show yet**: the first load of a range,
and a detail that is not in the store. Polls never show a skeleton; they update silently.
- `SkeletonRows`: the real table header plus 8 rows. Each cell holds a grey bar (`#ededed`,
  radius 4px) whose width roughly matches the column. The skeleton has the same row height as real
  rows, so nothing jumps when the data arrives.
- `SkeletonCards`: 4 cards under 768 px.
- `SkeletonDetail`: in the drawer, a title bar, a details grid and 5 timeline lines.
- A shimmer animation runs via CSS `@keyframes`, and is turned off under
  `prefers-reduced-motion`.
- The container gets `aria-busy="true"`. The skeleton itself is `aria-hidden`. A visually hidden
  "Loading requests…" text gives screen readers one announcement.
- A range change while rows already exist: keep the old rows dimmed (`opacity .5`) with a small
  spinner, instead of flashing back to a skeleton.

- Table semantics: `<table>`, `<caption class="sr-only">`, `<th scope="col">`. Sortable headers
  hold a `<button>` and put `aria-sort` on the `<th>`.
- The ref cell is a router `<Link to="/requests/41210?…">`, which renders a real `<a>`. That gives
  native keyboard and screen reader behaviour and middle-click. Clicking anywhere on the row also opens it (via `onClick`), but the
  link is the accessible target.
- Columns: Site · Ref · Title (with the location as a second line) · Priority · Status · Assignee
  · Due (+ Overdue tag) · Created (site time + zone).
- Status labels come from `/v1/statuses`. Unknown values show the raw value.
- "Copy link" copies `location.href` and announces "Link copied" through a polite live region.

Commit: `feat: requests board with filters, sort and shareable URL`

### Step 6: Request detail (25 min). Level 2

`DetailDrawer` is the `/requests/:id` route, rendered in the board's `<Outlet/>`. On desktop it is
a right drawer; under 768 px it is a full screen. `:id` is validated as a positive integer;
anything else shows "Not a valid request link".

1. Show the row from the store immediately, if present. Otherwise show `SkeletonDetail`. Then fetch
   `GET /v1/requests/{id}` for the fresh version and upsert it.
2. Fetch **all** event pages (`has_more` loop) and sort ascending by `at`, then `id`.
3. Compute `hidden = hiddenEventIds(events)` and `first = firstResponse(events, hidden)`.
4. Render:
   - header: ref, title, status, priority, overdue;
   - details grid: site, location, assignee, due, created, updated;
   - caption: "All times in Asia/Singapore (GMT+8)";
   - a First response card ("—" with the text "No response yet" if none);
   - the timeline, with a "Show undone (n)" toggle that defaults to off.
5. Each event line is derived from its fields:
   - the `status` changed compared with the previous visible event → "Status → Processing";
   - `assignee_name` → "Assigned to …";
   - `due_at` → "Deadline set to 07 Oct 2026, 10:00 GMT+8";
   - `note` → a quoted note.

   One event can produce several lines.
6. Edge cases:
   - `404` → "This request no longer exists";
   - `merged_into_id` set → "Merged into WO-xxxx", with a link that opens that request;
   - `deleted_at` → a banner saying it was deleted;
   - the request is outside the current filters → still open it. The link is the source of truth.
7. Accessibility:
   - `role="dialog"`, `aria-modal`, `aria-labelledby` pointing at the title;
   - focus moves to the heading on open; Esc closes (navigates to `/?${searchParams}`);
   - focus returns to the row link on close;
   - focus is trapped while the drawer is open.

Commit: `feat: request detail with history and first response`

### Step 7: Keep it live (20 min). Level 3

**Preferred: the change feed** (`src/data/sync.ts`). Use it if step 1 showed that draining it is
feasible (≲ 20 pages of 500):

```
start:  cursor = undefined
loop:   GET /v1/changes?cursor&limit=500
          apply items (skip seq ≤ lastSeq; items can repeat)
          request.created / request.updated → upsert(request)        // "as it is now"
          event.created → if detail open for request_id: refetch or append event
          staff.updated → staff.set(id, name)
        has_more ? continue immediately : wait POLL_MS (10 s)
        410 (cursor expired) → cursor = undefined, refetch the snapshot, drain again
        error → the client retries; after it gives up, sync.status = "retrying", try again in 10 s
```

- `POLL_MS = 10_000`, one constant in `src/config.ts`.
- **Schedule the next poll with `setTimeout` after the previous call finishes**, not with
  `setInterval`. A slow response or a retry can then never stack two polls on top of each other.
- On `429`, the next poll waits `max(POLL_MS, Retry-After)`. The 10 s rhythm never fights the
  rate limit.
- **Detail drawer.** While a request is open, refetch its events every 10 s as well (page 1 is
  enough; merge by event id). When the feed delivers `event.created` for that request, refetch
  at once. This keeps the timeline live even if feed items for events are delayed.
- Mark `lastSuccessAt` after **every** successful poll, including one with zero items. The
  label shows "Updated 8 s ago". It ticks with a `useNow(1_000)` hook, which only the
  `LiveIndicator` subscribes to, so the table does not re-render every second.
- A 10 s poll keeps changes visible well within the 1-minute requirement, even after two retries.
- `visibilitychange`: when the tab is hidden, keep polling but let the browser throttle it. When the
  tab becomes visible again, poll immediately.
- Changed rows get a short highlight (2 s background fade, disabled under
  `prefers-reduced-motion`).
- Screen readers: a polite live region announces **only real changes**, e.g. "3 requests updated".
  It never announces every tick.

**Fallback** if the feed is too large to drain at startup: refetch the snapshot for the current
range every 10 s (pages are already deduped), and say so in DECISIONS.
- This costs N requests every 10 s, so 429s become more likely. The client's `Retry-After`
  handling and the `setTimeout` chain slow the loop down by themselves when that happens.

`useNow(60_000)` also re-evaluates **overdue** when midnight passes in a site, with no refetch.

Commit: `feat: live updates from the change feed`

### Step 8: Make it hold up (25 min). Level 4

| State | Where | What the user sees |
| --- | --- | --- |
| Not configured | App | "Add HELPDESK_URL and HELPDESK_TOKEN to .env" (from the starter) |
| Bootstrapping | App | Centered spinner, "Loading sites and staff…" |
| Bootstrap failed | App | Full error, "Can't reach the helpdesk", Try again |
| First snapshot loading | Board | Filters visible, `SkeletonRows` / `SkeletonCards`, `aria-busy="true"` |
| Polling in background | TopBar | Nothing else changes; `RefreshCw` spins; "Updated Xs ago" resets |
| Range changed, reloading | Board | Old rows dimmed, small spinner in the summary; abort the previous load |
| Ready, rows | Board | Table or cards |
| Ready, nothing in range | Board | "No requests created between X and Y" |
| Ready, filters hide all | Board | "No requests match these filters" + Clear filters |
| Ready, search matches nothing | Board | `SearchX`, "No requests match 'lift'" + Clear search |
| Partial load | Board | Yellow banner "Showing 180 of 231 requests. Retrying the rest…" |
| Snapshot failed, no data | Board | Error panel + Try again |
| Busy (429/5xx) with data | Banner | "The helpdesk is busy. Showing data from 14:02. Retrying in 8 s." + Retry now |
| Stale (no success > 60 s) | LiveIndicator | Grey dot, "Paused · Updated 2 min ago" |
| Offline (`navigator.onLine`) | Banner | "You're offline. Updates resume when you reconnect." |
| Unknown site / staff in data | Footnote / inline | "2 requests hidden: unknown site" · "Unknown staff #999" |
| Detail loading / error / 404 / merged / deleted | Drawer | `SkeletonDetail`; the rest as in step 6 |

Responsive and accessibility pass:
- Under 768 px, cards replace the table, the filters move into a sheet, and the detail is full screen.
- Tap targets are ≥ 44 px.
- Visible focus rings; a skip link to the results; every input has a label.
- Status is never shown by colour alone.
- Check with keyboard only, and with Windows Narrator or NVDA on one flow.

Commit: `feat: loading, empty and error states, retries, mobile and a11y`

### Step 9: Finish (15 min)

- `npm ci && npm run build && npm test && npx tsc --noEmit` all green.
- `git grep -n "cbee\|HELPDESK_TOKEN="` finds nothing outside `.env.example`.
- Fill in `DECISIONS.md` (outline in section 3).
- Record the video (section 4) and add the link to DECISIONS.md.

Commit: `docs: decisions and video link`

---

## 2. Target folder layout

```
src/
  api/client.ts          fetch wrapper: timeout, retry, limiter, status events
  api/endpoints.ts       listRequests, getRequest, listEvents (all pages), listChanges, sites, staff, statuses
  types.ts               API shapes (from the starter, extended with Change and StatusInfo)
  lib/dates.ts           tz-aware date helpers           (+ dates.test.ts)
  lib/rules.ts           the six rules, pure            (+ rules.test.ts)
  lib/urlState.ts        parseFilters / toSearchParams  (+ urlState.test.ts)
  lib/rows.ts            buildRows: rule 1 + filters + search + sort (+ rows.test.ts)
  lib/search.ts          normalise + match              (+ search.test.ts)
  config.ts              POLL_MS = 10_000, SEARCH_DEBOUNCE_MS = 300, page sizes
  data/store.ts          zustand store, upsert guard    (+ store.test.ts)
  data/snapshot.ts       paged range load, dedupe
  data/sync.ts           10 s change-feed loop (setTimeout chain)
  hooks/useNow.ts, useFilters.ts (wraps useSearchParams), useDebouncedValue.ts,
        useBoardRows.ts, useRequestDetail.ts
  routes/router.tsx      createBrowserRouter: / and /requests/:id
  routes/BoardPage.tsx   layout + <Outlet/>
  components/…           as listed in step 5 and step 6, Skeleton.tsx
  App.tsx (RouterProvider + bootstrap gate), main.tsx, styles.css (tokens from DESIGN.md as CSS variables)
scripts/probe.mjs        one-off API exploration (reads .env, prints facts)
```

Libraries: `zustand`, `react-router`, `lucide-react`. Nothing else. Retry, debounce, the limiter
and date formatting are hand-written with `Intl`; each is small enough to explain line by line in
the interview.

---

## 3. DECISIONS.md outline (fill as you go)

**What I assumed**
- Default range: 30 calendar days inclusive, ending today in the site furthest ahead.
- Shared links carry absolute dates.
- Due-date sort compares site-local dates as plain dates; nulls come last.
- Rule 6 ignores undone events; rule 5 chains (undo of an undo) restore the original.
- Business hours and holidays are not used: none of the six rules needs them (an SLA view is "next").

**What I found in the API or data**: from step 1 plus anything seen while building, e.g. page
overlap, unknown site or staff ids, 429 frequency, the date semantics of `created_from`, event
`assignee_name` having no id, and anything that differs from `docs/api.md`.

**How I used AI**: which tool, for what (reading the brief, planning, UI spec, scaffolding
components, tests), and what you corrected (be specific: e.g. a timezone bug it introduced).

**Trade-offs and what I would do next**
- The token is in the browser bundle → a small proxy in production.
- Virtualise the table for big ranges.
- SLA using business hours and holidays.
- E2E tests (Playwright).
- A Kanban view.
- Persist the feed cursor.

---

## 4. Video checklist (~3 min, English)

1. Board: the skeleton on first load, the default 30 days, filter by site and status, type in
   search (debounced), sort by due, copy the link and open it in a new tab → same view (≈ 40 s).
2. An overdue row and why (the site-local today); a request without a due date (≈ 15 s).
3. Detail: times with the zone named, first response, timeline, the "Show undone" toggle (≈ 40 s).
4. Live: leave it open, a change appears, "Updated Xs ago" ticks (≈ 25 s).
5. Hold up: throttle or offline in DevTools → banner, recovery; empty filters; mobile width; keyboard
   only through the board and the drawer; a screen reader reading a row (≈ 50 s).
6. One sentence on DECISIONS and what's next (≈ 10 s).

---

## 5. Time budget

| Step | Min | Cumulative |
| --- | --- | --- |
| 0 Layout | 5 | 0:05 |
| 1 Probe | 15 | 0:20 |
| 2 Client | 20 | 0:40 |
| 3 Rules + tests | 30 | 1:10 |
| 4 Store + URL | 25 | 1:35 |
| 5 Board UI | 25 | 2:00 |
| 6 Detail | 25 | 2:25 |
| 7 Live | 20 | 2:45 |
| 8 Hold up | 25 | 3:10 |
| 9 Finish | 15 | 3:25 |

This is about 25 minutes over budget. If you are behind, cut in this order:
1. Row highlight animation.
2. The mobile filter sheet (keep the filters inline and wrapping).
3. The partial-load banner (treat a partial load as an error).
4. The change feed (fall back to polling).

Never cut the rule tests or DECISIONS.md.
