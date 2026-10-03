# Explorer Home, view: blueprint

Derived from [Explorer Home](../explorer-home.md) (Route, Layout, Recent, Timeline, Opens, States, Telemetry,
Accessibility), with the page-title rules of [Explorer structure](../explorer-structure.md) and the landing of
[Timeline](../timeline.md) §8. The data, its wire and its reads are [Explorer Home, data](explorer-home.md); this file
is the view that renders them, the browser's own opens of local documents, and the route. Defaults applied where the
spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                    | Role                                                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `packages/api-schema/src/frecency.ts`                                   | The half-life and the key maths, shared by the api and the browser                |
| `packages/api-schema/src/home.ts`                                       | `HomeJumpBackInItem.frecencyKey` on the wire                                      |
| `apps/api/src/db/home.ts`                                               | `readJumpBackIn` returns the key                                                  |
| `apps/live/lib/offline/offline-opens.ts`                                | `LocalOpens`, `nextLocalOpens`, `offlineRecordOpen`, `offlineListOpens`           |
| `apps/live/lib/offline/offline-store.ts`                                | `OfflineDocumentRecord.opens`                                                     |
| `apps/live/lib/api/tabs.ts`                                             | A marked load of a local document records a local open                            |
| `apps/live/app/explorer/home/page.tsx`                                  | The `/explorer/home` route stub and its title                                     |
| `apps/live/app/explorer/home/home-model.ts`                             | Pure: merge, fold, sides, hrefs, days, the strip's fade                           |
| `apps/live/app/explorer/home/home-copy.ts`                              | Pure: every sentence, label and state copy                                        |
| `apps/live/app/explorer/home/useHome.ts`                                | The read, the local merge, paging, retry, the unread clear, the landing telemetry |
| `apps/live/components/panels/home/HomePane.tsx`                         | Columns or the phone switch; landmarks; the error state                           |
| `apps/live/components/panels/home/HomeSwitch.tsx`                       | The phone's Recent / Timeline tabs                                                |
| `apps/live/components/panels/home/JumpBackIn.tsx`                       | The strip, its fade, its empty state                                              |
| `apps/live/components/panels/home/WhatHappened.tsx`                     | Day headings, See all activity, the entries                                       |
| `apps/live/components/panels/home/WhatHappenedEntry.tsx`                | `ActionEntry` (one person) and `SummaryEntry` (the disclosure)                    |
| `apps/live/components/panels/home/HomeTimeline.tsx`                     | The centre line, day markers, alternating entries, the paging slot                |
| `apps/live/components/panels/home/HomeAvatar.tsx`                       | `HomeAvatar`, `AvatarStack`: people without presence rings                        |
| `apps/live/components/panels/home/home-icons.tsx`                       | The kind markers and the verb icons                                               |
| `apps/live/components/panels/home/HomeSkeletons.tsx`                    | The three skeletons, sized as what replaces them                                  |
| `apps/live/app/explorer/{views.tsx,routes.ts,view-titles.ts}`           | `{ kind: 'home' }`, `/explorer/home`, the default, the titles                     |
| `apps/live/app/explorer/{useExplorerPane.ts,ExplorerPane.tsx}`          | Crumbs (`Home › All activity`), the dispatch, the header                          |
| `apps/live/app/explorer/page.tsx`, `apps/live/src/worker.ts`            | The landing goes to `/explorer/home`                                              |
| `apps/live/app/explorer/sidebar/OverviewGroup.tsx`                      | The Home row selects and opens Home                                               |
| `apps/live/components/panels/explorer-tree/PanelOverviewGroup.tsx`      | The panel's Home row opens Home                                                   |
| `apps/live/app/explorer/useTimelineFeed.ts`                             | `Timeline·Opened·Landing` only for a load that started on `/explorer/timeline`    |
| `apps/live/app/explorer/useTimelineUnread.ts`                           | A clear outlives a count still in flight                                          |
| `packages/ui/src/timeline/useTimelineGrouping.ts`                       | `formatDay` exported, shared by the day headings                                  |
| `packages/api-schema/src/telemetry-schema.ts`                           | The `Home` category                                                               |
| `apps/telemetry/app/{catalogue/collaboration.ts,event-explanations.ts}` | Home's charts and sentences                                                       |
| `apps/help/app/explorer/timeline/page.mdx`, `packages/help-registry`    | The Home article: Home, then All activity                                         |

## Domain and naming

| Term            | Identifier                                          | Meaning                                                        |
| --------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| Home            | `{ kind: 'home' }`, `/explorer/home`, `HomePane`    | The landing view                                               |
| All activity    | `{ kind: 'timeline' }`, `/explorer/timeline`        | The Timeline feed's page title; the kind keeps its name        |
| Strip           | `JumpBackIn`, `JumpBackInItem` (view)               | Jump back in's row of thumbnails                               |
| Local open      | `LocalOpens`, `OfflineDocumentRecord.opens`         | This browser's count of opens of a document stored only here   |
| Timeline column | `HomeTimeline`, `TimelineRow` (view)                | Home's own Timeline, folded one per document per local day     |
| Side            | `'start' \| 'end'`                                  | Which side of the centre line an entry's thumbnail sits        |
| Action entry    | `ActionEntry`                                       | One action of a one-person group, a link                       |
| Summary entry   | `SummaryEntry`                                      | A group of several people, a disclosure                        |
| Switch          | `HomeSwitch`, `HomeColumn = 'recent' \| 'timeline'` | The phone's tabs                                               |
| Paging slot     | `PagingSlot`                                        | The Timeline's reserved foot: sentinel, loading row, Try again |

Banned: "feed" for Home's Timeline column (it is the column; the feed is All activity), "recent" for the frecency
strip in code (it is `jumpBackIn`), "notification" for an action.

## Behaviour and state

### Route and landing

- `selectedFromRoute('/explorer/home')` → `{ kind: 'home' }`; the `default:` case and id-less `folder` / `team` links
  → `{ kind: 'home' }`. `explorerPathFor({ kind: 'home' })` → `/explorer/home`.
- `/explorer` → 302 `/explorer/home` (worker), `router.replace('/explorer/home')` (dev fallback).
- `VIEW_TITLES.home = 'Home'` (`SIDEBAR_LABELS.home`); `VIEW_TITLES.timeline = 'All activity'` (`D81`).
- Crumbs: `timeline` → `[{ Home, go home }, { All activity }]`; `home` → `[{ Home }]` (one crumb, not shown).
- The sidebar Home row: `selected = kind === 'home'`; activation tracks `Sidebar.Home`, clears the unread badge, goes
  home. The panel's Home row opens `/explorer/home`.
- `SECTION_HELP.home = 'timeline'` (the Home article). `newDocument` applies to `home` (navigates to `/new`); no
  folder, no import toolbar, no view toggle.
- A team left (`onLeftTeam`) goes home.

### `useHome(ownerId, enabled)`

State: `{ status: 'loading' | 'ready' | 'error', jumpBackIn, whatHappened, timeline: { items, nextCursor, paging:
'idle' | 'loading' | 'error' } }`.

1. When `enabled` and `ownerId`: `status = 'loading'`; `Promise.all([apiReadHome(owner, { tz }), offlineListOpens()])`
   with `tz = Intl.DateTimeFormat().resolvedOptions().timeZone` (`D82`). A request id guards a stale response (owner
   change, retry).
2. Home `null` → `status = 'error'`. Otherwise `ready`; `jumpBackIn = mergeJumpBackIn(home.jumpBackIn, local)`;
   `whatHappened` as sent; `timeline = home.timeline`; call `onSeen()` (the unread clear: the read moved the mark).
3. `offlineListOpens` failing (no IndexedDB) resolves to `[]` and logs `[home] local-opens-unavailable`; it never
   fails the page.
4. `loadMore()`: only when `ready`, `nextCursor` set and `paging !== 'loading'`; `paging = 'loading'`;
   `apiReadHomeTimeline(owner, { cursor })`; success appends `items` (deduplicated by event id), sets `nextCursor`,
   `paging = 'idle'`, tracks `Home·Loaded·More`; `null` → `paging = 'error'`.
5. `retry()`: tracks `Home·Loaded·Retry`, re-runs 1. `retryMore()`: tracks `Home·Loaded·Retry`, re-runs 4.
6. Once per mount: `Home·Opened·Landing` when the page load started on `/explorer` or `/explorer/home`
   (`ARRIVED_ON_HOME`, captured at module evaluation), else `Home·Opened·Nav`.

### Merge (`mergeJumpBackIn(server, local, max = HOME_JUMP_BACK_IN_MAX)`)

`local` is `{ document: DocumentSummary, opens: LocalOpens }[]` for live local records with `opens`. Each becomes a
`JumpBackInItem` `{ documentId, name, href: /document/<id>, savedAt, empty, frecencyKey, localOnly: true }`; each
server item `{ ..., href: homeDocumentHref(item), localOnly: false }`. Concatenate, sort by `frecencyKey` descending,
ties by `documentId` ascending (`D77`), keep the first `max`.

### Local opens (`offline-opens.ts`)

- `LocalOpens = { openDays: number; lastOpenDay: string; lastOpenedAt: number; frecencyKey: number }`.
- `nextLocalOpens(prev, now)`: `day = utcDay(now)`; `prev?.lastOpenDay === day` → `null` (same day); else
  `{ openDays: (prev?.openDays ?? 0) + 1, lastOpenDay: day, lastOpenedAt: now, frecencyKey: nextFrecencyKey(prev?.frecencyKey ?? null, now) }`.
- `offlineRecordOpen(id, now)`: inside `serializeOfflineWrite`, read the record; absent or trashed → skip; next null
  → log `[home] local-open-skipped reason=same-day`; else put `{ ...rec, opens }` (no `savedAt` change: an open is not
  an edit) and log `[home] local-open-recorded days=<n>`. A thrown error logs `[home] local-open-failed` and resolves.
- `_apiLoadTab`: for a local id with `opts.open`, `void offlineRecordOpen(documentId, Date.now())` before reading the
  tab. The editor's first-tab read is the only marked one (data blueprint `D66`), so embeds never count.
- `offlineListOpens()`: live records (no `trashedAt`) with `opens`, as `{ document: recordToSummary(rec), opens }`.

### Fold (`foldTimeline(items, dayOf)`)

Items arrive newest first across loaded pages. Key `<documentId>:<dayOf(occurredAt)>`. Within a key the strongest
kind wins (`created` > `updated` > `opened`), at that event's time; equal strength keeps the newest. Output keeps the
order of each key's first appearance, re-sorted by the kept event's `occurredAt` descending, then id descending.
`dayOf` is `dateKey` (the browser's local day, the `tz` sent).

### Timeline rows

`timelineRows(folded, today)` → a flat list of `{ type: 'day', key, label }` and `{ type: 'entry', entry, side }`:
a day row before the first entry of each local day; `side` alternates `start`, `end`, `start`, ... over entries only,
continuing across days (`D83`). Day labels: `Today`, `Yesterday`, else `formatDay(key).label` (`Tue, 29 Sep`), with
the year appended when it is not the current year.

### What happened by day

`groupsByDay(groups)` → `[{ day, label, groups }]` in the order sent (newest group first), label as the Timeline's.
A group with `summary: false` renders one `ActionEntry` per action (newest first); `summary: true` one `SummaryEntry`.

### Strip fade

`stripFade({ scrollLeft, clientWidth, scrollWidth })` → `true` while `scrollLeft + clientWidth < scrollWidth - 1`.
Read on mount, on `scroll` (passive) and on `ResizeObserver`; the fade is an overlay whose opacity toggles, so the
layout never changes.

### Paging slot

While `nextCursor` is set, the column ends in a reserved slot of one entry's height. An `IntersectionObserver`
(`rootMargin: 400px`) on it calls `loadMore()` when it nears the viewport and `paging === 'idle'`. `paging === 'loading'`
shows a skeleton entry in the slot; `'error'` shows "Could not load more." and **Try again**. No cursor → no slot.

### Disclosure

`SummaryEntry` holds `expanded` (initially false, never persisted). Expanding tracks `Home·Opened·Group`; collapsing
tracks nothing. The list is rendered only while expanded.

### Phone switch

`HomePane` reads `useMediaQuery('(min-width: 768px)')`. Wide: two `section`s side by side. Narrow: `HomeSwitch` and
one `tabpanel`. `column` state starts `'recent'` on every mount (`D84`).

## Interfaces and contracts

```ts
// packages/api-schema/src/frecency.ts
export const FRECENCY_HALF_LIFE_MS: number; // 14 days
export function frecencyScore(key: number, at: number, halfLifeMs?: number): number;
export function nextFrecencyKey(
  previousKey: number | null,
  at: number,
  halfLifeMs?: number,
): number;
export function mergeFrecencyKeys(a: number, b: number, at: number, halfLifeMs?: number): number;

// packages/api-schema/src/home.ts (addition)
type HomeJumpBackInItem = HomeDocument & {
  lastOpenedAt: number;
  openDays: number;
  frecencyKey: number;
};

// apps/live/app/explorer/home/home-model.ts
export type JumpBackInItem = {
  documentId: string;
  name: string;
  href: string;
  savedAt: number;
  empty: boolean;
  shareCode: string | null;
  frecencyKey: number;
  localOnly: boolean;
};
export function homeDocumentHref(
  doc: Pick<HomeDocument, 'documentId' | 'via' | 'shareCode'>,
): string;
export function mergeJumpBackIn(
  server: HomeJumpBackInItem[],
  local: LocalOpenDocument[],
  max?: number,
): JumpBackInItem[];
export function foldTimeline(
  items: HomeTimelineEntry[],
  dayOf: (at: number) => string,
): HomeTimelineEntry[];
export type TimelineRow =
  | { type: 'day'; key: string; label: string }
  | { type: 'entry'; entry: HomeTimelineEntry; side: 'start' | 'end' };
export function timelineRows(entries: HomeTimelineEntry[], now: number): TimelineRow[];
export function dayHeading(day: string, now: number): string;
export function groupsByDay(
  groups: HomeGroup[],
  now: number,
): { day: string; label: string; groups: HomeGroup[] }[];
export function stripFade(box: {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}): boolean;

// apps/live/app/explorer/home/home-copy.ts
export const HOME_COPY: {
  recent: 'Recent';
  timeline: 'Timeline';
  jumpBackIn: 'Jump back in';
  whatHappened: 'What happened';
  seeAllActivity: 'See all activity';
  jumpBackInEmpty: string;
  whatHappenedEmpty: string;
  timelineEmpty: string;
  readFailed: string;
  pageFailed: string;
  tryAgain: 'Try again';
  switchLabel: 'Home sections';
};
export const VERB_PHRASES: Record<HomeVerb, string>;
export const KIND_LABELS: Record<HomeTimelineKind, string>; // 'Created', 'Updated', 'Opened'
export function personName(person: HomePerson | undefined): string; // name ?? 'Someone'
export function peopleList(people: HomePerson[]): string; // 'Priya', 'Priya and Sam', 'Priya, Sam and Lee', 'Priya, Sam, Lee and 2 others'
export function verbList(verbs: HomeVerbCount[]): string; // 'commented, edited and assigned you an action'
export function summarySentence(group: HomeGroup): {
  people: string;
  verbs: string;
  document: string;
};
export function updatesLabel(total: number): string; // '1 update', '5 updates'
export function locationLabel(doc: HomeDocument): string;
export function clockTime(at: number): string; // timeLabel from @livediagram/ui
export function timelineEntryLabel(entry: HomeTimelineEntry): string; // 'Payments architecture, created at 14:05'
export function actionDetail(action: HomeAction): string | null;
```

Component props:

- `HomePane({ ownerId })`: owns `useHome`.
- `JumpBackIn({ ownerId, items, loading })`.
- `WhatHappened({ groups, loading, onSeeAll })`.
- `ActionEntry({ group, action, person })`, `SummaryEntry({ group })`.
- `HomeTimeline({ ownerId, entries, loading, hasMore, paging, onLoadMore, onRetryMore })`.
- `HomeSwitch({ column, onChange, ids })`.

## Data and persistence

- `OfflineDocumentRecord.opens?: LocalOpens`, optional: records written before it read as never opened. It lives and
  goes with the record (local Trash, purge, Sync Document, Take Offline's new record starts without it). Never sent.
- No new server storage. The wire gains `frecencyKey` (already stored as `document_opens.frecency_key`).
- View state (switch, disclosures, loaded pages) is per mount, never stored.

## Errors and edge cases

| Case                                                  | Handling                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Home read fails                                       | The error state with Try again in place of both columns                                           |
| A further page fails                                  | `paging = 'error'`: "Could not load more." and Try again in the slot                              |
| No IndexedDB                                          | No local items; logged; Home renders the server's                                                 |
| Local document trashed or synced to the cloud         | Not listed (trashed skipped; the record is gone after Sync)                                       |
| Owner id changes mid-read (a guest signs in)          | The request id drops the stale answer; the read re-runs for the new id                            |
| Same document twice in one local day across two pages | Folded into one entry, the strongest kind                                                         |
| A page repeats an event already loaded                | Deduplicated by event id                                                                          |
| Group whose actor has no name                         | "Someone"                                                                                         |
| Group of more than three people                       | "Priya, Sam, Lee and 2 others"                                                                    |
| Shared document                                       | Opens through `?s=<code>`; location "Shared by <owner>" ("Shared with you" without an owner name) |
| Document name longer than the thumbnail               | Truncated with an ellipsis; the full name is `title` and the accessible name                      |
| Nothing drawn (`empty`)                               | The thumbnail shows the undrawn sketch and sends no request                                       |
| Strip narrower than its items / wider                 | Fade only while more lies to the right                                                            |
| Viewport crosses 768 px                               | Columns ↔ switch; the switch starts on Recent when it appears                                     |
| Event in a future local day (clock skew)              | Labelled by its date; ordered as sent                                                             |

## Security and trust

- No new endpoint. Names, comments and team names render as text, never HTML.
- Hrefs are built from ids and share codes the api already gave the same reader; codes are URL-encoded.
- Local opens never leave the browser; telemetry carries only the closed types.

## Performance and limits

- One request draws the first screen (`GET /api/home`); `offlineListOpens` reads IndexedDB in parallel.
- Thumbnails: at most 12 in the strip and 30 per Timeline page, each lazily fetched on intersection by
  `DocumentThumbnail`, cached page-wide.
- The fold is O(n) over loaded entries (at most a few hundred); rows recomputed with `useMemo` on entries.
- Paging is keyset, 30 per page; the observer fires at most one request at a time.

## Presentation and UX

- Body: `md:grid md:grid-cols-[minmax(0,1fr)_16rem] lg:grid-cols-[minmax(0,1fr)_20rem] md:gap-8`. Recent left,
  Timeline right; neither column has a background or border.
- Section heading (`h2`): `text-sm font-semibold text-slate-900 dark:text-slate-100`, 8 px below. Sub-heading (`h3`,
  Jump back in / What happened) `text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400`.
- Strip: `ul` flex, `gap-3`, `overflow-x-auto`, `scrollbar-slim`, `snap-x`, padding 4 px for focus rings. Item: a
  link 128 × 80 thumbnail (`h-20 w-32 rounded-md`, slate border) and the name below (`mt-1 w-32 truncate text-xs`).
  Local only: `LocalOnlyPill asLabel` absolutely in the thumbnail's bottom-left corner (4 px inset). Fade: 48 px
  `bg-gradient-to-l from-white dark:from-slate-950`, `pointer-events-none`, opacity transition.
- What happened: day heading (`h4`, `text-xs font-medium text-slate-500`), entries in a `ul` with 4 px between.
  `ActionEntry`: a link row, 28 px avatar, text column: "**Priya** commented in **Payments architecture**"
  (`text-sm`), the detail in quotes (`text-xs text-slate-500 truncate`), then location (`text-xs text-slate-500`),
  the time right-aligned (`text-xs tabular-nums`). `SummaryEntry`: a full-width button, overlapped 24 px avatars
  (`-ml-2`, `ring-2 ring-white dark:ring-slate-950`, at most 3 plus a `+N` disc), the sentence, "location · N updates",
  time and a 16 px chevron rotating 180° when open (`motion-safe:transition-transform`). Expanded list indented
  under the sentence: each a link row with a 20 px avatar, "**Sam** edited", the verb icon (14 px), the time.
  Rows hover `bg-slate-50 dark:bg-slate-800/60`, `rounded-lg`, padding 8 px.
- See all activity: in the What happened heading row, right, `text-xs font-medium text-brand-700
dark:text-brand-300 hover:underline`.
- Timeline column: `ol`, `relative`; centre line `absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2
bg-slate-200 dark:bg-slate-700`. Row grid `grid-cols-[1fr_1.5rem_1fr]`, 16 px between rows. Day marker: a centred
  pill `rounded-full px-2 text-[11px] font-semibold bg-white dark:bg-slate-950 ring-1 ring-slate-200
dark:ring-slate-700`. Entry: the link (thumbnail `h-16 w-24 lg:h-20 lg:w-32 rounded-md`, the name below
  `text-[11px] truncate` at the thumbnail's width) in its side's cell, aligned towards the line; the 20 px marker
  in the middle cell (`rounded-full ring-2` in the kind's tone, a 12 px glyph); the time (`text-[11px]
tabular-nums text-slate-500`) in the other cell, aligned towards the line.
- Kind tones (with a glyph, never alone): created `emerald-600 / emerald-400` plus, updated `sky-600 / sky-400`
  pencil, opened `slate-500 / slate-400` eye.
- Phone switch: a two-tab segmented control, full width, `rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5`; the
  selected tab `bg-white dark:bg-slate-900 shadow-sm`; height 36 px.
- Skeletons: strip 6 boxes `h-20 w-32` with name bars `h-3 w-24`; What happened 3 rows of 56 px; Timeline 4 entries
  at the entry's size, alternating; `motion-safe:animate-pulse`, `bg-slate-100 dark:bg-slate-800`.
- Error state: a centred block, `text-sm`, copy plus a secondary Try again button.
- Copy is final as in the spec's States table.

## Accessibility

- Wide: `section aria-labelledby` (Recent, Timeline) with visible `h2`s: two region landmarks.
- Narrow: `div role="tablist" aria-label="Home sections"`, two `button role="tab"` with `aria-selected`,
  `aria-controls`, `id`; roving `tabIndex` (0 on the selected); Left / Right move and select (wrapping), Home / End
  first / last. One `div role="tabpanel" aria-labelledby=<tab id> tabIndex=0`; the `h2`s stay as `sr-only`.
- Strip: `ul aria-labelledby` (Jump back in); each link's accessible name is the document name ("Payments
  architecture", plus ", Local only" for a local one, from the pill label); `title` the full name.
- Summary: `button aria-expanded aria-controls=<list id>`; the list `ul id` follows it. Avatars `aria-hidden`; the
  sentence names everyone.
- Timeline: `ol aria-labelledby` (Timeline); day markers are `li` with `h3`-level text (`role="presentation"` not
  used: they are list items carrying the day); each entry link `aria-label` = `timelineEntryLabel`, `title` = the
  name. Markers and times `aria-hidden` (the label carries both).
- Focus: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500` on every link and
  button. Targets ≥ 24 × 24 px (the smallest is the 36 px switch tab; links are larger).
- Contrast: body text slate-900 / slate-100; muted slate-500 on white (4.6:1) and slate-400 on slate-950 (7.0:1).
- Reduced motion: `motion-safe:` on the pulse, the chevron and the fade's transition; `scroll-behavior` untouched.

## Web Experience

- LCP: the first screen is one api read; the largest element is a heading or the skeleton, both painted at once.
- CLS 0: headings render with the skeletons; each skeleton has its section's real box (strip height fixed; What
  happened is last in its column; the Timeline column has a reserved paging slot); thumbnails keep their box
  (`DocumentThumbnail`); the fade and the disclosure chevron change opacity / transform only. Expanding a group is
  a user-initiated change.
- INP: handlers are one state set each; the fold runs on data change, not on input.
- The pane is lazy-loaded (`next/dynamic`, `ssr: false`) like the other panes.

## Observability

| Fingerprint                                                                                 | Where        |
| ------------------------------------------------------------------------------------------- | ------------ |
| `[home] read failed status=<n/thrown/unparseable>`                                          | editor, warn |
| `[home] local-open-recorded days=<n>`                                                       | editor, info |
| `[home] local-open-skipped reason=same-day`                                                 | editor, info |
| `[home] local-open-failed` + error                                                          | editor, warn |
| `[home] local-opens-unavailable` + error                                                    | editor, warn |
| `[home] page failed`                                                                        | editor, warn |
| `Home·Opened·Landing/Nav`, `Home·Selected·*`, `Home·Opened·Group`, `Home·Loaded·More/Retry` | telemetry    |

## Testing

| Rule                                                              | Test                                                                          |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Frecency maths in the shared package                              | `packages/api-schema/src/frecency.test.ts`                                    |
| The api returns the key                                           | `apps/api/src/routes/home.test.ts`                                            |
| Local opens: first, same day, next day, trashed, absent, failure  | `apps/live/lib/offline/offline-opens.test.ts`                                 |
| A marked local load records; an unmarked one does not             | `apps/live/lib/api/tabs-local-open.test.ts`                                   |
| Merge order, cap, ties, local flag, hrefs                         | `apps/live/app/explorer/home/home-model.test.ts`                              |
| Fold strength, day keys, order; rows, sides, day labels; fade     | `apps/live/app/explorer/home/home-model.test.ts`                              |
| Sentences, people, verbs, updates, location, entry labels         | `apps/live/app/explorer/home/home-copy.test.ts`                               |
| Read, error, retry, paging, dedupe, stale owner, unread clear     | `apps/live/app/explorer/home/useHome.test.tsx`                                |
| Strip: names, pill, fade, telemetry                               | `apps/live/components/panels/home/JumpBackIn.test.tsx`                        |
| Entries: one-person links, summary disclosure, telemetry, See all | `apps/live/components/panels/home/WhatHappened.test.tsx`                      |
| Timeline: sides, markers, labels, paging slot states              | `apps/live/components/panels/home/HomeTimeline.test.tsx`                      |
| Switch keys and ARIA; columns on wide                             | `apps/live/components/panels/home/HomePane.test.tsx`                          |
| Routes, titles, crumbs                                            | `routes.test.ts`, `view-titles.test.ts`                                       |
| Telemetry charted and explained                                   | `apps/telemetry` `metric-emitters.test.ts`, `event-explanation.test.ts`       |
| Real browser: guest and signed in, desktop and phone, dark        | `apps/live/e2e/explorer-home.spec.ts`, `apps/live/e2e/clerk-stub/explorer-home.spec.ts` |

## Constants and configuration

| Constant                | Value                   | Where              | Provenance                               | Safe range      |
| ----------------------- | ----------------------- | ------------------ | ---------------------------------------- | --------------- |
| `HOME_WIDE_QUERY`       | `(min-width: 768px)`    | `HomePane.tsx`     | Spec (`md:`)                             | fixed           |
| `PAGING_ROOT_MARGIN`    | `400px`                 | `HomeTimeline.tsx` | `D85`: a page lands before it is reached | 200 to 800 px   |
| `STRIP_FADE_EPSILON_PX` | 1                       | `home-model.ts`    | Sub-pixel scroll widths                  | 1 to 2          |
| `SUMMARY_NAMES_MAX`     | 3                       | `home-copy.ts`     | Spec ("Priya, Sam and Lee")              | 2 to 4          |
| `AVATAR_STACK_MAX`      | 3                       | `HomeAvatar.tsx`   | `D86`                                    | 2 to 5          |
| Strip thumbnail         | 128 × 80 px             | `JumpBackIn.tsx`   | `D87`: "small", 16:10                    | 96 to 160 wide  |
| Timeline thumbnail      | 96 × 64, `lg:` 128 × 80 | `HomeTimeline.tsx` | `D87`: half the column less the gutter   | fixed by column |
| Timeline column         | 16 rem, `lg:` 20 rem    | `HomePane.tsx`     | `D88`                                    | 14 to 24 rem    |

## Defaults ledger

D81 to D91 in [DEFAULTS.md](DEFAULTS.md).
