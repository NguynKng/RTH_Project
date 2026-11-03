# DECISIONS

## What I assumed

- The default range contains 30 calendar days inclusive, ending on today's date in the configured site furthest ahead. On 03 November 2026 that is 05 October–03 November, rather than the 31-day span in the illustrative screenshot.
- Shared URLs contain absolute dates. Filters, search, sort and page live in the URL; the open request is the nested `/requests/:id` route. Zustand contains server data and loading/sync state.
- Clearing filters selects all sites and all non-excluded statuses and restores the default range/sort. Selecting no checkboxes means all values.
- Due-date sorting compares site-local calendar dates, with nulls last in both directions and request ID breaking ties. Creation sorting compares actual instants, including UTC offsets.
- Following the owner's pagination revision, the board fetches one API page of 50 records at a time. The API's `total_pages` drives navigation even when local rules/search hide every row on the current page. Request counts and overdue counts are labelled as current-page values.
- The API supports date/status filters, but a probe with a deliberately unmatched `q` and `site_id` still returned requests from all three sites. Site/search/sort therefore apply to the current page and are labelled accordingly; global versions need backend support. Local filter/sort changes preserve the page, while date/status changes reset to page one.
- Priority now uses red/amber/blue badges for High/Medium/Low, with the existing text and icons preserved. This follows the owner's requested update to the original monochrome priorities.
- A pending/processing request due on the next site-local calendar date gets a yellow “Due tomorrow” warning. Completed, canceled, deleted, merged or undated requests do not. This is one calendar day remaining rather than a rolling 24-hour deadline, because the API exposes `due_on` as a date.
- Following the owner's mobile revision, all screen sizes use the same semantic request table. Narrow screens scroll horizontally inside the table and vertically through the page; the old mobile card rendering and card skeletons were removed.
- A 44px back-to-top control appears after 320px of vertical page/table scrolling, respects reduced motion and restores focus to the page heading. It listens for a visibility threshold without re-rendering React for every scroll pixel. Changing pages resets vertical scrolling; background polls preserve the scroll position.
- New-request detection establishes a creation-time baseline from the first successful newest-page response for each date/status context. Later creation timestamps, including unseen IDs at the same timestamp, become unread. Page navigation and updates to older requests do not produce alerts. Changing server filters primes a new baseline while keeping existing unread badges.
- Unread notifications retain only ID, reference and creation timestamp in localStorage. They have no automatic expiry: readable request details mark their request seen. An already open request is treated as seen, and unavailable storage falls back to in-memory behavior. A separate, bounded cache holds up to 100 full unread records in memory for the notification table; marking a request seen removes its cached record too.
- The owner's separate-table revision replaces the unread notice with a New requests table above the main results. It shows five unread requests per page, newest first, independently of main-table filters/pagination. It reuses the shared columns, colors and links with sorting controls disabled. Restored or evicted records are hydrated only for the visible inbox page, with cancellation, retry and the existing API concurrency limiter.
- Table scroll regions, captions and pagination labels are scoped independently. The back-to-top control handles both tables. When both tables are present on desktop, the page uses normal document flow with bounded table viewports so the inbox cannot squeeze the main table out of view.
- The sound preference defaults on. Each new batch makes one playback attempt; the speaker button can enable/preview or mute it. Autoplay rejection updates the button instead of failing the data poll. There is one lazy HTMLAudioElement for the mounted notification owner, reused between polls, with no Web Audio contexts, buffer caches, playback queues or retry timers. Teardown unsubscribes the listener, pauses the element, removes its source and calls load to abort pending media operations. See [play()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play) and [load()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/load).
- Undo chains are resolved newest first, breaking ties by event ID. Undoing an undo restores the original. First response excludes undone processing events; `IGNORE_UNDONE_RESPONSES` is the single switch for changing that interpretation.
- Deadline events contain wall-clock text, so their dates/times are never parsed as UTC instants. The IANA zone is named directly, avoiding an invented offset for an ambiguous daylight-saving wall-clock time.
- An event assignment has a name but no staff ID. An exact unique directory-name match is shown; otherwise the supplied assignment name is explicitly labelled “name at the time.” Actors and request assignees are always looked up by ID.
- Business hours and holidays are outside the six requested rules.

## What I found in the API or data

- The existing `.env` was inside `react-vite/`; it was moved with the starter and remains ignored. No credentials are included in source or these notes.
- The API returned three sites: IDs 11 (Asia/Singapore), 12 (Australia/Sydney), and 13 (Asia/Jakarta), 15 staff members, and four status labels. The canceled status label is “Cancelled.”
- An initial unfiltered probe returned 11,986 unique requests across 122 pages, with 121 duplicate IDs across page boundaries. Requested pages deduplicate by ID and retain the most recent `updated_at` instant. The standalone probe defaults to the padded last-30-day range.
- The initial sample had no unknown site/staff IDs, and priorities were High, Medium, Low or null. UI fallbacks still handle unknown IDs, missing assignments and unfamiliar status labels.
- Sample events used Unix seconds and `DD/MM/YYYY HH:MM` deadlines. The real request data differs from the illustrative screenshot, so the application displays live API records and computes its own counts.
- The change feed was still not drained after 21 pages of 500 items (10,500 changes), and returned HTTP 429 with `Retry-After: 1` during the probe.
- The board polls the selected API page instead of replaying the change feed or fetching a complete range snapshot. For notifications, it reuses page one if already open, or checks page one separately while viewing later pages. Every next poll starts 10 seconds after the previous load/retries complete. Staff are refreshed too, so current names remain current. Detail events are polled independently while open.
- Date-filter semantics were not conclusively established. The API query pads the range by one day on either side, then applies the exact inclusive range in each site's timezone in the client.

## How I used AI

- Codex read the implementation plan, business rules, API contract, UI spec, design notes and reference image, then implemented the React application and pure-function tests.
- The library selection was updated to the owner's revised plan: Zustand, React Router v7 and Lucide React. No router, debounce or date libraries beyond that selection were added.
- The API probe informed the pagination deduplication and snapshot-polling fallback. Synthetic unit fixtures exercise timezone boundaries, undo chains, unknown staff, current-name search, null sorting, URL validation, retry timing and stale updates.
- During review, Codex corrected focus restoration after removing `inert`, kept a fetched detail available outside the board's range, retained old rows during a range reload, and handled bursts spanning multiple event pages.
- In the requested follow-up, Codex replaced fixed viewport subtraction with flex-based desktop scrolling, added priority colors, and changed client-side slicing to on-demand API pagination. Regression tests cover single-page fetching, page replacement, polling, aborts and filter/page scope.
- Browser/visual acceptance testing is intentionally left to the owner following their request. There is no claim of screen-reader or browser QA.

## Trade-offs and what I would do next

- Polling fetches the active request page plus the staff directory. On later pages there is one extra newest-page request for notifications. A failed newest-page check does not discard successful visible-page data. Failed visible-page loads preserve the last successful page and offer retry.
- Notification detection is bounded to the newest 50 matching API records per poll. A burst larger than that, or a newly inserted record with a backdated creation timestamp, needs a fresh change-feed cursor/server notification endpoint for lossless detection. Unread metadata is stored until seen, while the inbox payload cache is capped at 100 records. Audio objects are not retained per notification.
- API pages can overlap while data changes. Each active page is deduplicated and refreshed independently; global ordering/search/filtering requires additional server-side API parameters rather than downloading every page in the browser.
- The practice token is exposed through Vite's `HELPDESK_` env prefix and therefore appears in a production browser bundle. Use a small server-side proxy for production credentials.
- Browser Back closes a pushed detail route; the close button explicitly navigates to the board with the same filters. Production hosting needs an SPA rewrite to `index.html`.
- The Inter font is self-hosted. There are no generated images or third-party runtime UI/date/search libraries.
- Next steps: owner-run browser/mobile and screen-reader checks, E2E coverage, virtualized rows for larger page sizes, persistent incremental cursors, and an SLA view based on business hours/holidays.
- Submission items are not fabricated: no narrated video link, public push or deployment was produced. Existing Git changes were preserved for owner review.
