# Bluebay requests board

A read-only maintenance requests dashboard built with React 18, TypeScript and Vite. The interface follows the supplied Bluebay reference: a white canvas, emerald accents, a desktop table, mobile cards and a request history drawer.

## Run locally

Requires Node 20+.

```sh
npm ci
```

Copy `.env.example` to `.env` and set `HELPDESK_URL` and `HELPDESK_TOKEN` to your practice API credentials. The local `.env` is ignored by Git.

```sh
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. Run commands from this repository's root; the React starter has been moved out of `react-vite/`.

## Available commands

```sh
npm run build       # production bundle in dist/
npm run preview     # serve the production bundle
npm run typecheck   # strict TypeScript checks
npm test            # business rules, API retry, date, search, URL and store tests
npm run test:watch
node --env-file=.env scripts/probe.mjs  # read-only API inspection; prints no credentials
```

## Features

- On-demand API pagination: fetch just the selected 50-request page, using the API's page count. No background draining or prefetching of other pages.
- Date and status filters are sent to the API. Site filtering, due/created sorting and debounced search apply to the current page, as labelled in the interface; the API does not support those operations across the complete dataset.
- Search the current page by reference, title, location, current assignee name and site; updates after 300 ms.
- Absolute dates and filters in the URL. `/requests/:id` opens a request directly; browser Back closes a drawer opened from the board.
- Site-local timestamps with named timezones, overdue indicators and current staff names from the directory.
- All history pages on first open, first response, hidden undone events and a show-undone switch.
- Automatic polling of only the active request page and open detail, scheduled 10 seconds after the previous load completes. Background updates keep the current content and scroll position visible.
- Timeouts, bounded concurrency, retry/backoff, `Retry-After`, cancellation, offline/retry notices and empty/loading/error states.
- The same request table on desktop and mobile, with horizontal scrolling inside the table on narrow screens. Mobile filters use a sheet and request details use a full-screen view.
- A compact “Back to top” button appears after scrolling down. It returns the page/table to the top, respects reduced motion and moves keyboard focus back to the heading.
- Priority badges use red for High, amber for Medium and blue for Low, alongside text and signal icons.
- Open requests due tomorrow show a yellow “Due tomorrow” badge and highlighted date in the table and detail drawer, based on each site's local calendar date.
- Desktop results fit the available viewport through flex layout, with the footer outside the scroll region. Short windows and mobile use normal vertical document flow; horizontal overflow stays inside the table.

## Code map

```text
src/api/          API client, limiter and typed endpoints
src/data/         Zustand server-data store, bootstrap, active-page loading and polling
src/lib/          Pure date, rule, search, URL and row derivation functions
src/hooks/        URL filters, debounce, clock, detail loading and modal focus
src/components/   Table, filters, detail timeline, back-to-top control and shared UI
src/routes/       React Router board layout and nested detail route
```

Read [DECISIONS.md](DECISIONS.md) for API findings and trade-offs, [docs/rules.md](docs/rules.md) for the six business rules, and [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the implementation brief.

Production hosting needs an SPA fallback to `index.html` for `/requests/*`. `HELPDESK_*` values are exposed to the browser for this practice API; a production integration should use a server-side proxy.

Browser and visual acceptance testing is left to the project owner as requested. No deployment, submission or narrated video has been produced.
