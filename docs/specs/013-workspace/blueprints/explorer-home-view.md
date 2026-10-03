# Explorer Home, view: blueprint

Derived from [Explorer Home](../explorer-home.md) (Route, Layout, Jump back in, What happened, Opens, States,
Telemetry, Accessibility), with the allocation of [Within reach](../../004-interface-design/within-reach.md), the
principle of [Design principles](../../004-interface-design/design-principles.md) (Calm by default), the page-title
rules of [Explorer structure](../explorer-structure.md) and the landing of [Timeline](../timeline.md) §8. The data,
its wire and its reads are [Explorer Home, data](explorer-home.md); this file is the view that renders them, the
browser's own opens of local documents, and the route. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                    | Role                                                                                    |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/api-schema/src/within-reach.ts`                               | `withinReach`, `utcDay`: the allocation shared with the api and the Shapes flyout       |
| `packages/api-schema/src/home.ts`                                       | `HOME_WITHIN_REACH_PER_ROW`, `WITHIN_REACH_USE_WINDOW_DAYS`, `windowStartOf`            |
| `apps/live/lib/offline/offline-opens.ts`                                | `LocalOpens`, `nextLocalOpens`, `localOpensOf`, `offlineRecordOpen`, `offlineListOpens` |
| `apps/live/lib/offline/offline-store.ts`                                | `OfflineDocumentRecord.opens`; `offlineCreateDocument(..., { markUsed })` starts them   |
| `apps/live/lib/api/tabs.ts`                                             | A marked load of a local document records a local open                                  |
| `apps/live/app/explorer/home/page.tsx`                                  | The `/explorer/home` route stub and its title                                           |
| `apps/live/app/explorer/home/home-model.ts`                             | Pure: Jump back in's set, the phone order, hrefs, What happened's days, the fade        |
| `apps/live/app/explorer/home/home-copy.ts`                              | Pure: every sentence, label and state copy                                              |
| `apps/live/app/explorer/home/useHome.ts`                                | The read, the local merge, retry, the unread clear                                      |
| `apps/live/app/explorer/entry-path.ts`                                  | `ENTRY_PATH`, `ARRIVED_ON_HOME`, `ARRIVED_ON_TIMELINE`: where the page load began       |
| `apps/live/lib/explorer-landing.ts`                                     | `EXPLORER_LANDING_PATH`, the one landing path                                           |
| `apps/live/components/panels/home/HomePane.tsx`                         | One column of two sections; the error state; the landing telemetry                      |
| `apps/live/components/panels/home/JumpBackIn.tsx`                       | The section: heading row, See more, the grid or the strip, the empty line               |
| `apps/live/components/panels/home/JumpBackInStrip.tsx`                  | The phone's strip, its fade and its See more tile                                       |
| `apps/live/components/panels/home/JumpBackInTile.tsx`                   | One document's tile (grid and strip) and the See more tile                              |
| `apps/live/components/panels/home/HomeSection.tsx`                      | `HomeSection` (wrapper, heading row, rule, quiet link) and `InAppLink`                  |
| `apps/live/components/panels/home/WhatHappened.tsx`                     | The section: day headings, See all activity, the entries                                |
| `apps/live/components/panels/home/WhatHappenedEntry.tsx`                | `ActionEntry` (one person) and `SummaryEntry` (the disclosure)                          |
| `apps/live/components/panels/home/HomeAvatar.tsx`                       | `HomeAvatar`, `AvatarStack`: people without presence rings                              |
| `apps/live/components/panels/home/home-icons.tsx`                       | The verb icons                                                                          |
| `apps/live/components/panels/home/HomeSkeletons.tsx`                    | The skeletons, sized as what replaces them                                              |
| `apps/live/components/panels/home/home-styles.ts`                       | The shared classes                                                                      |
| `apps/live/components/panels/home/home-test-utils.ts`                   | Test fixtures: a document, a person, an action, a group, a Jump back in item            |
| `apps/live/app/explorer/{views.tsx,routes.ts,view-titles.ts}`           | `{ kind: 'home' }`, `/explorer/home`, the default, the titles                           |
| `apps/live/app/explorer/{useExplorerPane.ts,ExplorerPane.tsx}`          | Crumbs (`Home › All activity`, `Home › Recent`), the dispatch, the header               |
| `apps/live/app/explorer/page.tsx`, `apps/live/src/worker.ts`            | The landing goes to `EXPLORER_LANDING_PATH`                                             |
| `scripts/e2e-stack.mjs`                                                 | The e2e stack's `/explorer` redirect reads the same constant                            |
| `apps/live/app/explorer/sidebar/OverviewGroup.tsx`                      | The Home row selects and opens Home                                                     |
| `apps/live/components/panels/explorer-tree/PanelOverviewGroup.tsx`      | The panel's Home row opens Home                                                         |
| `apps/live/app/explorer/useTimelineFeed.ts`                             | `Timeline·Opened·Landing` only for a load that started on `/explorer/timeline`          |
| `apps/live/app/explorer/useTimelineUnread.ts`                           | A clear outlives a count still in flight                                                |
| `packages/ui/src/timeline/useTimelineGrouping.ts`                       | `formatDay` exported, shared by the day headings                                        |
| `packages/api-schema/src/telemetry-schema.ts`                           | The `Home` category                                                                     |
| `apps/telemetry/app/{catalogue/collaboration.ts,event-explanations.ts}` | Home's charts and sentences                                                             |
| `apps/telemetry/app/event-vocab.ts`                                     | The `Home` category's description and colour                                            |
| `apps/help/app/explorer/timeline/page.mdx`, `packages/help-registry`    | The Home article: Home, then All activity                                               |
| `apps/live/e2e/home-seed.ts`                                            | e2e seeding through the api: drawn documents, opens, edits through a link               |

## Domain and naming

| Term          | Identifier                                       | Meaning                                                       |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| Home          | `{ kind: 'home' }`, `/explorer/home`, `HomePane` | The landing view                                              |
| All activity  | `{ kind: 'timeline' }`, `/explorer/timeline`     | The Timeline feed's page title; the kind keeps its name       |
| Jump back in  | `JumpBackIn`, `JumpBackInSet`, `JumpBackInItem`  | The section and its within-reach set of documents             |
| Group         | `JumpBackInGroup = 'mostUsed' \| 'recent'`       | Which half of the set an item belongs to; never shown         |
| Grid          | `JumpBackIn` wide branch                         | Desktop and tablet: 4 by 2, most used on top                  |
| Strip         | `JumpBackInStrip`                                | The phone's sideways row, alternating, ending in See more     |
| Phone order   | `phoneOrder(set)`                                | Most used, recent, alternating, then the rest                 |
| Tile          | `JumpBackInTile`, `SeeMoreTile`                  | One document's thumbnail and name; the strip's last tile      |
| See more      | `HOME_COPY.seeMore`, `recentHref`, `onSeeMore`   | The way to the Recent page                                    |
| Local open    | `LocalOpens`, `OfflineDocumentRecord.opens`      | This browser's record of opens of a document stored only here |
| Action entry  | `ActionEntry`                                    | One action of a one-person group, a link                      |
| Summary entry | `SummaryEntry`                                   | A group of several people, a disclosure                       |

Banned: "Most used" and "Recent" as visible copy or labels on Home (the groups carry no titles), "frecency",
"timeline" for anything on Home, "notification" for an action.

## Behaviour and state

### Route and landing

- `selectedFromRoute('/explorer/home')` → `{ kind: 'home' }`; the `default:` case and id-less `folder` / `team` links
  → `{ kind: 'home' }`. `explorerPathFor({ kind: 'home' })` → `/explorer/home`.
- `/explorer` → 302 `/explorer/home` (worker), `router.replace('/explorer/home')` (dev fallback).
- `VIEW_TITLES.home = 'Home'` (`SIDEBAR_LABELS.home`); `VIEW_TITLES.timeline = 'All activity'` (`D94`).
- Crumbs: `timeline` → `[{ Home, go home }, { All activity }]`; `recent` → `[{ Home, go home }, { Recent }]`
  (`D130`); `home` → `[{ Home }]` (one crumb, not shown).
- The sidebar Home row: `selected = kind === 'home'`; activation tracks `Sidebar.Home`, clears the unread badge, goes
  home. The panel's Home row opens `/explorer/home`.
- `SECTION_HELP.home = 'timeline'` (the Home article). `newDocument` applies to `home` (navigates to `/new`); no
  folder, no import toolbar, no view toggle.
- A team left (`onLeftTeam`) goes home.

### `useHome(ownerId, onSeen)`

State: `{ status: 'loading' | 'ready' | 'error', jumpBackIn: JumpBackInSet, whatHappened, lastSeenAt }`.

1. When `ownerId`: `status = 'loading'`; `Promise.all([apiReadHome(owner, { tz }), offlineListOpens()])` with
   `tz = Intl.DateTimeFormat().resolvedOptions().timeZone` (`D95`). A request id guards a stale response (owner
   change, retry).
2. Home `null` → `status = 'error'`. Otherwise `ready`; `jumpBackIn = jumpBackInSet(home.jumpBackIn, local,
Date.now())`; `whatHappened` as sent; call `onSeen()` (the unread clear: the read moved the mark).
3. `offlineListOpens` failing (no IndexedDB) resolves to `[]` and logs `[home] local-opens-unavailable`; it never
   fails the page.
4. `retry()`: tracks `Home·Loaded·Retry`, re-runs 1.
5. Once per `HomePane` mount: `Home·Opened·Landing` when the page load started on `/explorer` or `/explorer/home`
   (`ARRIVED_ON_HOME`, `entry-path.ts`, captured at module evaluation in the eager Explorer chunk), else
   `Home·Opened·Nav`.

### New

`useHome` keeps `lastSeenAt` from the first successful read of the mount (`undefined` when the api says `null`) and
never replaces it. `isNewEvent(at, lastSeenAt)` (`@livediagram/ui`, the Timeline's rule: none without a mark) marks an
`ActionEntry` by its action's `occurredAt` and a `SummaryEntry` by its `latestAt`. The pill is the Timeline card's:
`bg-brand-600` (`SOLID_BRAND_DARK` in dark), white 9 px semibold caps, "New", first in the entry's meta line, inside
the link or button so it is part of the accessible name.

### Jump back in

`jumpBackInSet(server, local, now, n = HOME_WITHIN_REACH_PER_ROW)` → `JumpBackInSet = { mostUsed, recent }`:

1. Each server item becomes a `JumpBackInItem` `{ documentId, name, href: homeDocumentHref(item), savedAt, empty,
shareCode (shared only), useDays, lastUsedAt, localOnly: false }`.
2. Each local document becomes one with `href: /document/<id>`, `shareCode: null`, `localOnly: true`,
   `useDays = opens.days.filter(d => d >= utcDay(windowStartOf(now))).length`,
   `lastUsedAt = max(opens.lastOpenedAt, document.savedAt)` (the record's save is its last edit; only the person
   edits a document stored here).
3. Concatenate, sort by `documentId` ascending (the stable order the merge property needs), then
   `withinReach(items, n, ({ useDays, lastUsedAt }) => ({ uses: useDays, lastUsedAt }))`.

`phoneOrder({ mostUsed, recent })` → `mostUsed[0], recent[0], mostUsed[1], recent[1], ...`, skipping a group once
it runs out; at most `2n` (8) items, each with the half it came from (`group`), for telemetry only.

### Local opens (`offline-opens.ts`)

- `LocalOpens = { days: string[]; lastOpenedAt: number }`: the UTC days (newest first) with an open, inside the use
  window, and the last open.
- `localOpensOf(raw)`: the stored value as `LocalOpens`. A record written before this shape
  (`{ openDays, lastOpenDay, lastOpenedAt, frecencyKey }`) reads as `{ days: [lastOpenDay], lastOpenedAt }`, the one
  day it can still vouch for (`D129`); anything unreadable reads as never opened.
- `nextLocalOpens(prev, now)`: `day = utcDay(now)`; `days` = `day` then `prev.days` without `day`, dropping days
  before `utcDay(windowStartOf(now))`; `lastOpenedAt = max(prev.lastOpenedAt, now)`. Always a value: every open moves
  the last open.
- `offlineRecordOpen(id, now)`: inside `serializeOfflineWrite`, read the record; absent or trashed → skip; put
  `{ ...rec, opens: nextLocalOpens(localOpensOf(rec.opens), now) }` (no `savedAt` change: an open is not an edit)
  and trace (`debugLog`) `[home] local-open-recorded days=<n>`. A thrown error logs `[home] local-open-failed` and
  resolves.
- `_apiLoadTab`: for a local id with `opts.open`, `void offlineRecordOpen(documentId, Date.now())` before reading the
  tab. The editor's first-tab read is the only marked one (data blueprint `D66`), so embeds never count.
- `offlineCreateDocument(d, now, { markUsed = true })`: a making (spec Making a document) writes the new record with
  `opens: { days: [utcDay(now)], lastOpenedAt: now }`, what `nextLocalOpens(undefined, now)` gives, unless
  `markUsed` is `false` (`D140`). Its callers are the makings only: the wizard, a local duplicate, the new-document
  import (`markUsed: importMarksUse(sources.length)`); Take Offline writes through `offlinePutRecord`, no making.
- `offlineListOpens()`: live records (no `trashedAt`) with readable `opens`, as
  `{ document: recordToSummary(rec), opens }`.

### Grid (desktop and tablet)

`JumpBackIn` reads `useMediaQuery(HOME_WIDE_QUERY)`. Wide: one `ul`, `grid grid-cols-4`, the most used then the
recent. The first recent item carries `col-start-1` when there is any most used item, so it opens the second row
whatever the first row's length. The list's minimum height is two tile rows (2 × 100 px + the 12 px gap), so the
grid keeps two rows' height with fewer items (`D131`).

### Strip (phone)

Narrow: a sideways scroller holding the `ul` of `phoneOrder(set)` tiles, then the See more tile outside the list.
`stripFade({ scrollLeft, clientWidth, scrollWidth })` → `true` while `scrollLeft + clientWidth < scrollWidth - 1`.
Read on mount, on `scroll` (passive) and on `ResizeObserver`; the fade is an overlay whose opacity toggles, so the
layout never changes.

### See more

The heading row's link (wide) and the strip's tile (narrow) are anchors to `recentHref` (`/explorer/recent`); a
plain click (no modifier, primary button) is prevented and calls `onSeeMore()`, which navigates in the app, so a new
tab or a copied link still work. Both track `Home·Selected·JumpBackIn.SeeMore`.

### What happened by day

`groupsByDay(groups, now)` → `[{ day, label, groups }]` in the order sent (newest group first), label `Today`,
`Yesterday`, else `formatDay(key).label` (`Tue, 29 Sep`), with the year appended when it is not the current year.
A group with `summary: false` renders one `ActionEntry` per action (newest first); `summary: true` one
`SummaryEntry`.

### Disclosure

`SummaryEntry` holds `expanded` (initially false, never persisted). Expanding tracks `Home·Opened·Group`; collapsing
tracks nothing. The list is rendered only while expanded.

## Interfaces and contracts

```ts
// packages/api-schema/src/home.ts (additions)
export const HOME_WITHIN_REACH_PER_ROW = 4;
export const WITHIN_REACH_USE_WINDOW_DAYS = 90;
export function windowStartOf(now: number): number; // UTC midnight, 89 days before today

// apps/live/app/explorer/home/home-model.ts
export type JumpBackInGroup = 'mostUsed' | 'recent';
export type JumpBackInItem = {
  documentId: string;
  name: string;
  href: string;
  savedAt: number;
  empty: boolean;
  shareCode: string | null;
  useDays: number;
  lastUsedAt: number;
  localOnly: boolean;
};
export type JumpBackInSet = WithinReach<JumpBackInItem>;
export function homeDocumentHref(
  doc: Pick<HomeDocument, 'documentId' | 'via' | 'shareCode'>,
): string;
export function jumpBackInSet(
  server: readonly HomeJumpBackInItem[],
  local: readonly LocalOpenDocument[],
  now: number,
  n?: number,
): JumpBackInSet;
export function phoneOrder(set: JumpBackInSet): { item: JumpBackInItem; group: JumpBackInGroup }[];
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
  jumpBackIn: 'Jump back in';
  whatHappened: 'What happened';
  seeMore: 'See more';
  seeAllActivity: 'See all activity';
  jumpBackInEmpty: 'The documents you use most and last will gather here.';
  whatHappenedEmpty: string;
  readFailed: string;
  tryAgain: 'Try again';
};
// VERB_PHRASES, personName, peopleList, verbList, summarySentence, actionPhrase, updatesLabel, locationLabel,
// clockTime, actionDetail: unchanged.
```

Component props:

- `HomePane({ ownerId, onSeen, allActivityHref, onSeeAll, recentHref, onSeeMore })`: owns `useHome`; `onSeen` is the
  unread badge's `clear`.
- `JumpBackIn({ ownerId, set, loading, recentHref, onSeeMore })`.
- `JumpBackInStrip({ ownerId, set, recentHref, onSeeMore, labelledBy })`.
- `JumpBackInTile({ ownerId, item, group, thumbClassName })`, `SeeMoreTile({ href, onSeeMore })`.
- `HomeSection({ id, title, link?, busy, children })`: the `section` (`aria-labelledby`, `aria-busy`,
  `data-home-section`), the heading row and its rule; `link` is `{ href, label, onNavigate, onActivate? }`.
- `InAppLink({ href, onNavigate, onActivate?, className, children })`: `onActivate` runs on every click
  (telemetry); a plain click is prevented and calls `onNavigate`.
- `WhatHappened({ groups, loading, lastSeenAt, allActivityHref, onSeeAll })`: the link keeps its href (new tab, copy
  link); a plain click navigates in the app.
- `ActionEntry({ group, action, isNew })`, `SummaryEntry({ group, isNew })`.
- Today and Yesterday are taken at mount (`useNow(false)`): a page left open past midnight keeps its headings.

## Data and persistence

- `OfflineDocumentRecord.opens?: LocalOpens`, optional: records written before it read as never opened, records of
  the earlier shape read through `localOpensOf`, and the next open writes the new shape. It lives and goes with the
  record (local Trash, purge, Sync Document, Take Offline's new record starts without it). Never sent.
- No new server storage on the view's side.
- View state (disclosures) is per mount, never stored.

## Errors and edge cases

| Case                                           | Handling                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Home read fails                                | The error state with Try again in place of the body                                               |
| No IndexedDB                                   | No local items; logged; Home renders the server's                                                 |
| Local document trashed or synced to the cloud  | Not listed (trashed skipped; the record is gone after Sync)                                       |
| Local record in the earlier `opens` shape      | Read as its last open day; rewritten in the new shape on its next open                            |
| Owner id changes mid-read (a guest signs in)   | The request id drops the stale answer; the read re-runs for the new id                            |
| A document in both groups                      | Most used only (`withinReach`)                                                                    |
| No most used document, some recent             | The recent take the grid's top row; the phone's strip is the recent alone                         |
| Fewer than 8 documents                         | Only what exists; the grid's minimum height keeps two rows                                        |
| No document at all                             | The empty line; on a phone the strip still ends in See more                                       |
| Group whose actor has no name                  | "Someone"                                                                                         |
| Group of more than three people                | "Priya, Sam, Lee and 2 others"                                                                    |
| Shared document                                | Opens through `?s=<code>`; location "Shared by <owner>" ("Shared with you" without an owner name) |
| Document name longer than the tile             | Truncated with an ellipsis; the full name is the accessible name and a `Tooltip`                  |
| A team document the person owns (`via: 'own'`) | Its location is the team: `locationLabel` reads `teamName` whatever the via                       |
| Nothing drawn (`empty`)                        | The thumbnail shows the undrawn sketch and sends no request                                       |
| Viewport crosses 768 px                        | Grid ↔ strip                                                                                      |
| Strip narrower than its items / wider          | Fade only while more lies to the right                                                            |

## Security and trust

- No new endpoint. Names, comments and team names render as text, never HTML.
- Hrefs are built from ids and share codes the api already gave the same reader; codes are URL-encoded.
- Local opens never leave the browser; telemetry carries only the closed types.

## Performance and limits

- One request draws the first screen (`GET /api/home`); `offlineListOpens` reads IndexedDB in parallel.
- Thumbnails: at most 8 in Jump back in, each lazily fetched on intersection by `DocumentThumbnail`, cached
  page-wide.
- `jumpBackInSet` is `O(k log k)` over at most 8 server items plus this browser's opened local documents.

## Presentation and UX

- Body: one column, `flex flex-col gap-7` (28 px between sections); each section a `section` wrapper
  (`data-home-section="jump-back-in"` / `"what-happened"`), with no background or card.
- Heading row (`SECTION_HEADER`): `flex items-baseline justify-between gap-4 border-b border-slate-200 pb-2
dark:border-slate-700` (the page's line colour), 12 px above the section's body. The heading (`h2`,
  `SECTION_HEADING`): `text-base font-semibold text-slate-900 dark:text-slate-100`. The quiet link at the end (See
  more, See all activity): `text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline`.
- Grid: `ul grid min-h-[13.25rem] grid-cols-4 gap-3`, the section's full width (`D128`). Tile: a link, the
  thumbnail `h-20 w-full rounded-md` (slate border), the name below (`mt-1 block h-4 truncate text-xs leading-4`). Local only: `LocalOnlyPill asLabel`
  absolutely in the thumbnail's bottom-left corner (4 px inset).
- Strip: a scroller `scrollbar-slim -mx-1 flex h-28 snap-x gap-3 overflow-x-auto px-1 pb-2 pt-1`; the `ul` inside it
  `flex gap-3`; tiles `w-32 shrink-0 snap-start` with a 128 × 80 thumbnail. See more tile: the same 128 × 80 box,
  dashed slate border, a chevron-right icon over "See more" (`text-xs font-medium`), the label also as its name.
  Fade: 48 px `bg-gradient-to-l from-slate-50 dark:from-slate-900` (the page), `pointer-events-none`, opacity
  transition.
- Empty line: `text-sm text-slate-500 dark:text-slate-400`, at the top of the grid's reserved box; on a phone in the
  strip, before the See more tile.
- What happened: day heading (`h3`, `text-xs font-medium text-slate-500`), entries in a `ul` with 4 px between.
  `ActionEntry`: a link row, 28 px avatar, text column: "**Priya** commented on **Payments architecture**"
  (`text-sm`), the detail in quotes (`text-xs`, muted, truncated), then "location · time" (`text-xs`, muted,
  wrapping). `SummaryEntry`: a full-width button, overlapped 24 px avatars (`-ml-2`, a 2 px ring in the page colour,
  at most 3 plus a `+N` disc), the sentence, then "location · N updates · time" (wrapping), and a 16 px chevron at the
  end rotating 180° when open (`motion-safe:transition-transform`). Expanded list indented under the sentence: each a
  link row with a 20 px avatar, "**Sam** edited", the verb icon (14 px), the time. Rows hover
  `bg-slate-100 dark:bg-slate-800/70`, `rounded-lg`, padding 8 px.
- Skeletons: the grid's 2 rows of 4 tile boxes (the phone's strip: 4 boxes `h-20 w-32` with name bars); What happened
  3 rows of 56 px; `motion-safe:animate-pulse`, `bg-slate-200/70 dark:bg-slate-800`.
- Error state: a centred block, `text-sm`, copy plus a secondary Try again button.
- Copy is final as in the spec's States table and Jump back in.

## Accessibility

- Each section is a `section aria-labelledby` its `h2` (**Jump back in**, **What happened**): two region landmarks.
- Jump back in: one `ul aria-labelledby` the heading, grid or strip; each `li` one link whose accessible name is the
  document name ("Payments architecture", plus ", Local only" for a local one, from the pill label); a `Tooltip`
  shows the full name. No row, group or sub-label is exposed (Calm by default). The heading rule is a border,
  never content.
- See more: a link named "See more" in the heading row (wide) or as the tile after the list (narrow), never both.
- Summary: `button aria-expanded aria-controls=<list id>`; the list `ul id` follows it. Avatars `aria-hidden`; the
  sentence names everyone.
- Focus: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500` on every link and
  button. Targets ≥ 24 × 24 px (the See more link's line box is padded to 24 px; tiles are larger).
- Contrast: body text slate-900 / slate-100; muted slate-500 on the slate-50 page (4.5:1) and slate-400 on the
  slate-900 page (6.9:1); the See more link brand-700 / brand-300.
- Reduced motion: `motion-safe:` on the pulse, the chevron and the fade's transition; `scroll-behavior` untouched.

## Web Experience

- LCP: the first screen is one api read; the largest element is a heading or the skeleton, both painted at once.
- CLS 0: headings and their rules render with the skeletons; the grid, its skeleton and its empty state share one
  fixed height at every width (`min-h-[13.25rem]`; tiles are a fixed 100 px high); the strip, its skeleton and its empty state share `h-28`; What
  happened is last on the page; thumbnails keep their box (`DocumentThumbnail`); the fade and the chevron change
  opacity / transform only. Expanding a group is a user-initiated change.
- INP: handlers are one state set or one navigation each.
- The pane is lazy-loaded (`next/dynamic`, `ssr: false`) like the other panes.

## Observability

| Fingerprint                                                                                                    | Where                                   |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `[home] read failed status=<n/thrown/unparseable>`                                                             | editor, warn                            |
| `[home] local-open-recorded days=<n>`                                                                          | editor, `debugLog` trace (scope `home`) |
| `[home] local-open-failed` + error                                                                             | editor, warn                            |
| `[home] local-opens-unavailable` + error                                                                       | editor, warn                            |
| `Home·Opened·Landing/Nav`, `Home·Selected·JumpBackIn.*/WhatHappened`, `Home·Opened·Group`, `Home·Loaded·Retry` | telemetry                               |

## Testing

| Rule                                                                               | Test                                                                                    |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| The allocation                                                                     | `packages/api-schema/src/within-reach.test.ts`                                          |
| The use window                                                                     | `packages/api-schema/src/home.test.ts`                                                  |
| Local opens: first, same day, next day, window, legacy shape, trashed, failure     | `apps/live/lib/offline/offline-opens.test.ts`                                           |
| A local making starts the record; one with `markUsed: false` has none              | `apps/live/lib/offline/offline-store.test.ts`                                           |
| A marked local load records; an unmarked one does not                              | `apps/live/lib/api/tabs-local-open.test.ts`                                             |
| Set: merge, dedupe, local measures, ties; phone order; hrefs; days; fade           | `apps/live/app/explorer/home/home-model.test.ts`                                        |
| Sentences, people, verbs, updates, location                                        | `apps/live/app/explorer/home/home-copy.test.ts`                                         |
| Read, error, retry, stale owner, unread clear, mark kept                           | `apps/live/app/explorer/home/useHome.test.tsx`                                          |
| A clear outlives an unread count still in flight                                   | `apps/live/app/explorer/useTimelineUnread.test.tsx`                                     |
| Grid and strip: names, no group labels, row break, pill, fade, See more, telemetry | `apps/live/components/panels/home/JumpBackIn.test.tsx`                                  |
| Headings with a rule: the heading row and its link, per section                    | `apps/live/components/panels/home/HomePane.test.tsx`                                    |
| Entries: one-person links, summary disclosure, telemetry, See all                  | `apps/live/components/panels/home/WhatHappened.test.tsx`                                |
| One column, two sections, no Timeline, the error state                             | `apps/live/components/panels/home/HomePane.test.tsx`                                    |
| Routes, titles, crumbs (Recent and All activity under Home), the landing 302       | `routes.test.ts`, `view-titles.test.ts`, `apps/live/src/worker.test.ts`                 |
| Telemetry charted and explained                                                    | `apps/telemetry` `metric-emitters.test.ts`, `event-explanation.test.ts`                 |
| Real browser: guest and signed in, desktop and phone, dark                         | `apps/live/e2e/explorer-home.spec.ts`, `apps/live/e2e/clerk-stub/explorer-home.spec.ts` |

## Constants and configuration

| Constant                | Value                | Where            | Provenance                          | Safe range     |
| ----------------------- | -------------------- | ---------------- | ----------------------------------- | -------------- |
| `HOME_WIDE_QUERY`       | `(min-width: 768px)` | `JumpBackIn.tsx` | Spec (`md:`: desktop and tablet)    | fixed          |
| `STRIP_FADE_EPSILON_PX` | 1                    | `home-model.ts`  | Sub-pixel scroll widths             | 1 to 2         |
| `SUMMARY_NAMES_MAX`     | 3                    | `home-copy.ts`   | Spec ("Priya, Sam and Lee")         | 2 to 4         |
| `AVATAR_STACK_MAX`      | 3                    | `HomeAvatar.tsx` | `D99`                               | 2 to 5         |
| Grid tile height        | 100 px (80 + 4 + 16) | `home-styles.ts` | `D128`: the strip's 80 px thumbnail | 64 to 120 px   |
| Section gap             | 28 px (`gap-7`)      | `HomePane.tsx`   | Spec ("about 28 px")                | 24 to 40 px    |
| Strip thumbnail         | 128 × 80 px          | `home-styles.ts` | `D100`: "small", 16:10              | 96 to 160 wide |

## Defaults ledger

D94 to D104, D128 to D132 and D140 in [DEFAULTS.md](DEFAULTS.md); D96, D97, D98 and D101 are retired there.
