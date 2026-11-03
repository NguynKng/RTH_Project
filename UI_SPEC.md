# Bluebay Requests Board: UI spec

A UI description for generating mockups. Visual language follows `DESIGN.md` (white canvas,
near-black ink, a single emerald accent, Inter, 6px radii, 1px hairlines), adapted from a marketing
site to a **dense, Jira-style list view** for site managers.

All on-screen text is in **English**. Today is **Tue 03 Nov 2026**.

---

## 1. Product context (what the screens must communicate)

- Bluebay Properties runs 3 buildings ("sites"), each in its own timezone:
  - **Singapore**: Asia/Singapore, label `SGT`
  - **Sydney**: Australia/Sydney, label `AEDT` (daylight saving in November)
  - **Jakarta**: Asia/Jakarta, label `WIB`
- Tenants raise maintenance requests. Managers need to scan them, spot what is overdue, and open
  one to see its full history.
- The board is **read-only**: no create/edit buttons, no drag and drop.
- Every time and date is shown **in the request's site timezone, with the zone named** (e.g.
  `06 Oct 2026, 11:42 SGT`).
- The board is **live**: it refreshes on its own and always says when it last updated.

---

## 2. Visual system (from DESIGN.md, tuned for a data-dense app)

| Element | Value |
| --- | --- |
| Page background | `#ffffff` |
| Subtle band / row hover / table header | `#fafafa` |
| Borders | 1px `#dfdfdf`; stronger `#c7c7c7` for inputs and outline buttons |
| Text | Primary `#171717`; secondary `#707070`; tertiary `#9a9a9a`; placeholder `#b2b2b2` |
| Accent | Emerald `#3ecf8e` (pressed `#24b47e`). Used **only** for the live dot, the one primary button, the selected-row marker and focus rings |
| Font | Inter; page title 22px/500 (-0.3px); section headings 16px/500; table and body 14px/400; captions 13px; micro labels 12px |
| Monospace | `ui-monospace` / Menlo / Consolas, used for request refs (`WO-41210`) |
| Radii | inputs 4px; buttons 6px; cards and panels 8–12px; pills and avatars fully round |
| Shadows | flat by default; the detail drawer uses `0 16px 48px rgba(0,0,0,0.12)` |
| Spacing | 8px grid; table rows 44px tall on desktop |

### Semantic colors (kept small, always paired with text or an icon)

| Meaning | Look |
| --- | --- |
| Status **Pending** | Pill, bg `#f4f4f4`, text `#707070`, small grey dot |
| Status **Processing** | Pill, bg `#eff6ff`, text `#1d4ed8`, blue dot |
| Status **Complete** | Pill, bg `#e8f9f0`, text `#1f7a52`, green check icon |
| **Overdue** | Tag, bg `#fdecea`, text `#c0392b`, clock icon, word "Overdue". The only red in the UI |
| Warning (helpdesk busy, stale data) | Banner, bg `#fffbe6`, left border 3px `#ffdb13`, text `#171717` |
| Priority | Monochrome "signal bars" icon plus text: High = 3 bars, Medium = 2, Low = 1, none = "—" |

Avatars are 24px circles with initials, light grey fill `#ededed`, ink text. "System" uses a small
gear icon in place of initials.

---

## 3. Screen A: Board, desktop (1440 × 900)

### A1. Top bar (64px, white, bottom hairline)
- Left: wordmark **"Bluebay"**, followed by a small emerald dot and the muted word **"Requests"**.
- Right: live status **"● Live · Updated 12 s ago"** (emerald dot, 13px muted text), a small
  "Refresh" icon button, and a **"Copy link"** button (the one emerald filled button on the page,
  near-black label, link icon).

### A2. Page header (24px top padding)
- Title **"Requests"** (22px/500).
- Summary line under it in muted 13px:
  **"142 requests · 9 overdue · created 04 Oct – 03 Nov 2026 (each site's local date)"**

### A3. Filter bar (one row, 8px gaps, inputs 36px tall)
0. **Search** input, 280px wide, with a magnifier icon on the left and the placeholder
   "Search ref, title, location, assignee…".
1. **Date range** input showing `04 Oct 2026 → 03 Nov 2026`, calendar icon, with a small hint
   chip "Last 30 days".
2. **Site** dropdown showing `All sites`.
3. **Status** dropdown showing `Pending, Processing` with a count badge "2".
4. **Sort** dropdown showing `Due date · soonest first`.
5. Text link **"Clear filters"** at the right end.

### A4. Table (full width inside a 12px-radius bordered container)

Header row bg `#fafafa`, 12px uppercase-free labels in `#707070`, weight 500.
**Created** and **Due** headers have sort arrows; Due is the active sort (arrow up, ink colored).

Columns: **Ref** (mono) · **Title** (location on a second muted line) · **Site** · **Priority** ·
**Status** · **Assignee** · **Due** · **Created**

Sample rows (use these exactly):

| Ref | Title / location | Site | Priority | Status | Assignee | Due | Created |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WO-41188 | Lift stuck on level 4 / Tower B · Lift lobby | Jakarta | High | Processing | Dewi Lestari | 30 Oct 2026 + **Overdue · 4 d** tag | 28 Oct 2026, 09:12 WIB |
| WO-41210 | Room too warm / North Wing · Lobby | Singapore | High | Processing | Benjamin Tan | 31 Oct 2026 + **Overdue · 3 d** tag | 06 Oct 2026, 10:15 SGT |
| WO-41254 | Water leak under pantry sink / Level 12 · Pantry | Sydney | Medium | Pending | *Unassigned* (muted, italic) | 02 Nov 2026 + **Overdue · 1 d** tag | 01 Nov 2026, 16:40 AEDT |
| WO-41260 | Flickering lights in corridor / Level 7 · East corridor | Singapore | Low | Pending | Aisha Rahman | 03 Nov 2026 (bold "Today") | 02 Nov 2026, 08:05 SGT |
| WO-41271 | Car park gate not opening / Basement 1 | Sydney | High | Processing | Liam O'Connor | 04 Nov 2026 | 03 Nov 2026, 07:22 AEDT |
| WO-41275 | Replace ceiling tile / Level 3 · Meeting room 3A | Jakarta | — | Pending | Rizky Pratama | — (no due date, muted) | 03 Nov 2026, 11:30 WIB |
| WO-41102 | Toilet keeps running / Level 9 · Restroom | Singapore | Medium | Complete | Benjamin Tan | 20 Oct 2026 | 18 Oct 2026, 14:02 SGT |
| WO-41140 | Air-con noisy at night / Level 15 · Unit 1502 | Sydney | Low | Complete | Olivia Nguyen | 25 Oct 2026 | 21 Oct 2026, 19:48 AEDT |

Row details:
- Rows are separated by 1px hairlines and turn `#fafafa` on hover.
- Overdue rows have **no** red background; only the Due cell shows the red "Overdue" tag.
- **One row (WO-41210) shows a keyboard focus ring**: 2px emerald outline, inset, rounded 6px. This
  shows the table is keyboard navigable.

### A5. Table footer
Left: muted "Showing 1–50 of 142". Right: pagination `‹ 1 2 3 ›` with page 1 selected (ink
background, white number).

---

## 4. Screen B: Board with request detail open, desktop (1440 × 900)

Same board as Screen A, dimmed slightly on the left. The row **WO-41210** is selected (2px emerald
bar on its left edge, `#fafafa` background).

A **right-side drawer**, 520px wide, full height, white, deep shadow, 1px left hairline.

### B1. Drawer header
- Top row: mono ref **"WO-41210"**, an icon button "Copy link", and a close "✕" icon button.
- Title **"Room too warm"** (22px/500).
- Pills under the title: **Processing** status pill, **High** priority (signal bars), **Overdue · 3 d** tag.

### B2. Details (two-column label/value grid, labels muted 13px)
| Label | Value |
| --- | --- |
| Site | Singapore · North Wing / Lobby |
| Assignee | (BT avatar) Benjamin Tan |
| Due | 31 Oct 2026 |
| Created | 06 Oct 2026, 10:15 SGT |
| Last updated | 02 Nov 2026, 17:03 SGT |

Under the grid, a muted caption with a globe icon:
**"All times in Asia/Singapore (SGT, UTC+8)."**

### B3. First response card
A bordered card (8px radius, `#fafafa` bg) with a small emerald left accent:
- Label: **"First response"**
- Body: (BT avatar) **Benjamin Tan** · **06 Oct 2026, 11:42 SGT**
- Muted: "1 h 27 m after the request was created"

### B4. History timeline
- Heading **"History"** with a muted count "8 events". On the right, a small toggle switch
  **"Show undone (2)"**, currently off.
- A vertical timeline, **oldest first**, with a thin grey line connecting 20px circular icons.
  Each item has: icon, one-line description in ink, actor avatar and name, and the time in muted 13px.

| Icon | Description | Actor | Time |
| --- | --- | --- | --- |
| plus | Request created · **Pending** | System (gear) | 06 Oct 2026, 10:15 SGT |
| user | Assigned to **Benjamin Tan** | System (gear) | 06 Oct 2026, 10:16 SGT |
| arrow | Status → **Processing** + small emerald "First response" label | Benjamin Tan | 06 Oct 2026, 11:42 SGT |
| note | Note: *"Thermostat reading 27 °C. Compressor fault suspected, contractor booked."* (quoted in a light grey box) | Benjamin Tan | 06 Oct 2026, 11:45 SGT |
| calendar | Deadline set to **08 Oct 2026, 10:00 SGT** | Aisha Rahman | 06 Oct 2026, 14:20 SGT |
| calendar | Deadline moved to **31 Oct 2026, 18:00 SGT** | Aisha Rahman | 08 Oct 2026, 09:05 SGT |
| note | Note: *"Parts delayed by supplier."* | Benjamin Tan | 15 Oct 2026, 16:30 SGT |
| clock (red) | Became **overdue** | System (gear) | 01 Nov 2026, 00:00 SGT |

(When "Show undone" is on, two extra items appear in muted grey with strike-through text and an
"Undone" chip. Show this toggled-on variant only if a second image is requested.)

---

## 5. Screen C: Board, mobile (390 × 844)

- **Top bar (56px):** "Bluebay" wordmark left; on the right a small emerald dot with
  "Updated 12 s ago", plus a share/link icon button.
- **Title row:** "Requests", with the summary "142 · 9 overdue" in muted text under it.
- **Search row:** a full-width search input with a magnifier icon, placeholder "Search requests…".
- **Controls row:** a full-width outline button **"Filters (2)"** with a sliders icon, and next to
  it a compact sort select **"Due ↑"**.
- **Card list** replaces the table. Each card is full-width with a 12px radius, a 1px hairline,
  16px padding and 8px gaps between cards:
  - Row 1: mono ref `WO-41188` on the left, **Processing** pill on the right.
  - Row 2: title **"Lift stuck on level 4"** (16px/500).
  - Row 3, muted: "Jakarta · Tower B · Lift lobby".
  - Row 4: priority signal bars "High", with the DL avatar and "Dewi Lestari" next to it.
  - Row 5: "Due 30 Oct 2026" and the red **Overdue · 4 d** tag.
- Show 3–4 cards using the first rows from the table in Screen A.
- Cards have a ≥ 44px tap height, and the whole card is the tap target.

### C2. Mobile filter sheet (optional second image)
A bottom sheet with a 16px top radius and a drag handle, titled "Filters". It contains:
- A date range with "From" and "To" inputs
- A Site list of checkboxes: Singapore, Sydney, Jakarta
- A Status list of checkboxes: Pending ✓, Processing ✓, Complete
- At the bottom, a "Clear" text button and a **"Show 142 results"** emerald button.

### C3. Mobile request detail (optional third image)
A full-screen page with "‹ Back" at the top left and the ref `WO-41210`. It has the same content
as the drawer in Screen B (pills, details grid, timezone caption, first response card, history
timeline), stacked in a single column.

---

## 6. Screen D: States (one image, four panels in a 2 × 2 grid, desktop table area only)

1. **Loading:** the filter bar is visible. The table shows its header plus 6 skeleton rows of grey
   rounded bars (`#ededed`) of varying widths. The live label reads "Loading…".
2. **Empty:** the table container holds a centered, simple line icon of an empty inbox. Under it,
   **"No requests match these filters"**, with the muted line "Try a wider date range or clear the
   site and status filters." and a **"Clear filters"** outline button.
3. **Helpdesk busy, keeping old data:** a warning banner above the table (yellow left border):
   **"The helpdesk is busy. Showing data from 14:02. Retrying in 8 s."** with a "Retry now" text
   link. The table below still shows rows, slightly dimmed. The live label in the top bar turns
   grey: "● Paused · Updated 2 min ago".
4. **Error, no data yet:** the table container holds a centered alert icon,
   **"Can't reach the helpdesk"**, the muted line "Check your connection. We'll keep trying every
   30 s.", and a **"Try again"** outline button.

---

## 7. Accessibility cues to make visible in mockups

- A visible emerald focus ring on the focused row or button (2px, with an offset).
- Status is never shown by color alone: every pill has text, and overdue has an icon plus the word.
- Sortable headers show an arrow icon, and the active sort is visually distinct.
- Contrast: body text is at least `#707070` on white; no light grey text on grey.
- Mobile tap targets are ≥ 44px.

---

## 8. Ready-to-paste prompts for image generation

Attach this file and `DESIGN.md`, then use one prompt per image.

**Prompt 1: Desktop board**
> Create a high-fidelity desktop web app UI mockup (1440×900) following Screen A in UI_SPEC.md and
> the visual system in DESIGN.md. Clean white SaaS dashboard, Jira-style list view, Inter font,
> near-black text, 1px light grey hairlines, a single emerald green accent (#3ecf8e) used sparingly.
> Show the top bar with the live "Updated 12 s ago" indicator, the filter bar, and a data table with
> exactly the 8 sample rows given, including red "Overdue" tags in the Due column and a keyboard
> focus ring on row WO-41210. Flat design, no gradients, no illustrations, crisp readable text.

**Prompt 2: Desktop board with detail drawer**
> Same app and style. Follow Screen B in UI_SPEC.md: the board is dimmed on the left, and a
> 520px right drawer shows request WO-41210 "Room too warm" with status pills, a details grid, the
> caption "All times in Asia/Singapore (SGT, UTC+8).", a "First response" card, and a vertical
> history timeline with the 8 events listed. Every timestamp ends with "SGT".

**Prompt 3: Mobile board**
> Same app and style, mobile 390×844, following Screen C in UI_SPEC.md: compact top bar with the
> live indicator, a "Filters (2)" button with a sort select, and a vertical list of request cards
> (ref, status pill, title, site/location, priority, assignee avatar, due date with red Overdue
> tag). Large tap targets, white background.

**Prompt 4: States**
> Same app and style. One image with four panels in a 2×2 grid, following Screen D in UI_SPEC.md:
> a loading skeleton table, an empty state, a yellow "helpdesk is busy, retrying" banner above
> slightly dimmed data, and a full "Can't reach the helpdesk" error state with a Try again button.
