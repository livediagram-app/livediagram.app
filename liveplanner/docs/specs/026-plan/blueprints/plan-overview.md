# Plan Overview blueprint

Derived from [Plan Overview](../plan-overview.md).

## Domain and naming

| Spec term          | Identifier                                                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview           | `OverviewPage` (the page), `overviewOpen` / `openOverview` (editor UI state)                                                                                |
| Overview entry     | `OverviewTabPill` (in the tab bar), `OVERVIEW_TAB_KEY` (`'overview'`, its strip id)                                                                         |
| description        | `description` on `Project`, `plan.description` column, `PROJECT_DESCRIPTION_MAX`, `readProjectDescription`                                                  |
| Overview's style   | `OverviewStyle`, `overviewStyle` on `Project` and `ProjectDetails`, `plan.overview_style`, `readOverviewStyle`                                              |
| what it wears      | `overviewLookOf` (`overview-look.ts`); the page's `OverviewSurface` (`overviewSurfaceOf`, `overview-style.ts`)                                              |
| Overview Style     | `OverviewStyleDialog` (the shared `CanvasThemeDialog` with `heading`, `noFinish`)                                                                           |
| the dock           | `CanvasChrome`'s bottom-right cluster with `overviewOpen`; `overviewStyleOpener` (`overview-dock.ts`)                                                       |
| tab tile           | `TabTileSummary` (`overview-tabs.ts`), `OverviewTabs`; its preview `TabPreview` (`TabPreview.tsx`)                                                          |
| card type tile     | `CardTypeTileSummary`, `TypeStatusShare`, `TypeBoardLink` (`overview-card-types.ts`), `CardTypeTile`; its chip `CardTypeChip` (`plan/CardTypeChipFace.tsx`) |
| sample card        | `sampleCard(type)`, `fieldIcon`, `fieldLabel` (`plan/card-type-sample.tsx`, shared with the type editor's Display)                                          |
| quick actions      | `addField` (`editType({ id, addField: true })` → `openAddField`), `addCard` (`addCardOfType`), `addTypeToBoard`                                             |
| activity           | `ActivityEntry`, `ActivityDay` (`overview-activity.ts`), `OverviewActivity`; `ACTIVITY_SHOWN`, `ACTIVITY_MAX`                                               |
| Opening            | `useOverviewEntrance`, `OVERVIEW_ENTRANCE_MS`, `data-overview-entering` (`useOverviewEntrance.ts`)                                                          |
| fan in             | `useActivityEnter`, `activityEnterOf`, `ACTIVITY_ENTER_STEP_MS` (`useActivityEnter.ts`)                                                                     |
| Add Tab tile       | `AddTabTile`, `ADD_TAB_KINDS`; `requestStartCategory` / `takeStartCategory` (`plan/start/start-request.ts`)                                                 |
| people on the plan | `planPeopleOf` (`overview-people.ts`), `OverviewPeople`                                                                                                     |
| editing in place   | `EditInPlace` (`EditInPlace.tsx`); `may.editPlan`; `actions.rename`, `actions.describe`                                                                     |

## Files

| File                                                                         | Holds                                                                                                                       |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `packages/api-schema/src/project-details.ts`                                 | `PROJECT_DESCRIPTION_MAX` (500), `readProjectDescription(raw)`, `ProjectDetailsResponse`, `ProjectDetailsRoomOp`            |
| `packages/api-schema/src/index.ts`, `room-messages.ts`, `error-telemetry.ts` | `Project.description?`, `project-details` in `SYSTEM_OP_KINDS` and `RoomOp`, the `details` route word                       |
| `apps/api/src/plan-room/plan-schema.ts`                                      | Step V14: `ALTER TABLE plan ADD COLUMN description TEXT NOT NULL DEFAULT ''`                                                |
| `apps/api/src/plan-room/plan-content.ts`                                     | `description` in the head columns and `PlanMeta`, `setPlanDescription`, the copy's `description`                            |
| `apps/api/src/routes/project-details-route.ts`                               | `PUT /api/projects/:id/details`                                                                                             |
| `apps/api/src/room-client.ts`                                                | `relayProjectDetails`                                                                                                       |
| `apps/editor/lib/api/project-details.ts`                                     | `saveProjectDescription(scope, description)`: the api, or the offline record                                                |
| `apps/editor/lib/offline/offline-store.ts`                                   | `description?` on the record, `offlineSaveDescription`, `recordToProject` carries it                                        |
| `apps/editor/app/project/[id]/editor-ui-state.ts`                            | `overviewOpen`, `openOverview`; `setActiveId` closes the Overview unless `{ keepOverview }`                                 |
| `apps/editor/lib/overview-address.ts`                                        | `OVERVIEW_HASH`, `landingOf` (where a plan opens), `NEW_PLAN_KEY` / `isNewPlanEntry`, `hashTabId`, `pinHash`                |
| `apps/editor/app/project/[id]/useOverviewHistory.ts`                         | Back and Forward over `#overview` and the tab pin                                                                           |
| `apps/editor/components/overview/OverviewLoadingCover.tsx`                   | The plain cover drawn while the Overview's chunk loads                                                                      |
| `apps/editor/app/project/[id]/editor-persistence.ts`                         | `ProjectDetails` (`description`, `createdAt`, `savedAt` from the load), `projectDetails` / `setProjectDetails`              |
| `apps/editor/components/chrome/OverviewTabPill.tsx`                          | The tab bar's first entry and its divider (the shared `TabFrame`)                                                           |
| `packages/workbench/src/components/chrome/TabStrip.tsx`                      | `leading?: ReactNode`, drawn first inside the strip's toolbar                                                               |
| `apps/editor/components/overview/OverviewPage.tsx`                           | Reads the editor context, the tab sweep, abilities, saves, telemetry; portals into the canvas root                          |
| `apps/editor/components/overview/OverviewView.tsx`, `OverviewSection.tsx`    | The layout from plain data and actions (`OverviewAbilities`, `OverviewActions`); section frame and Add tiles                |
| `apps/editor/components/overview/OverviewHeader.tsx`                         | Eyebrow, name (edited in place), description or Add a Description, dates; the people row                                    |
| `apps/editor/components/overview/overview-header-paint.ts`                   | The header's colours from the theme: `planPalette` over its element colours, washes, readable inks, the rule; `--ov-head-*` |
| `apps/editor/components/overview/OverviewPeople.tsx`                         | The people on the plan: discs with names, More                                                                              |
| `apps/editor/components/overview/EditInPlace.tsx`                            | The name and description edited where they stand; `DESCRIPTION_COUNT_FROM`                                                  |
| `apps/editor/components/overview/OverviewTabs.tsx`                           | The tab tiles                                                                                                               |
| `apps/editor/components/overview/TabPreview.tsx`                             | A tile's preview: near-screen gate, start queue, loading / failed / empty states, its error boundary                        |
| `apps/editor/components/overview/LivePlanPreview.tsx`                        | A Board or Sheet tab's own view (`PlanBoardView` / `PlanSheetView`) at 960 × 600, its id suffixed, scaled                   |
| `apps/editor/components/overview/PreviewBoundary.tsx`                        | One tile's error boundary: "Couldn't load preview", `Error · Client · Render·Overview·…`                                    |
| `apps/editor/components/overview/tab-preview-svg.ts`                         | `previewTabOf` (a Board or Sheet sized to the 1440 × 900 window), `previewFit` (scale and offset into a tile)               |
| `apps/editor/components/overview/useTabPreviewSvg.ts`                        | Any other tab's export SVG (`usePlanImageExport` + `renderTabDrawingSvg`), memoised on what it shows                        |
| `apps/editor/components/overview/preview-queue.ts`, `useNearScreen.ts`       | One preview started per frame; IntersectionObserver gate (300 px margin), latched                                           |
| `apps/editor/components/overview/OverviewCardTypes.tsx`                      | The Card Types section: the grid, the palette for the samples, the Add Card Type tile                                       |
| `apps/editor/components/overview/CardTypeTile.tsx`                           | One type's tile (memoised): chip, quick actions, sample, field chips, count and status bar, used-on links, Add to a Board   |
| `apps/editor/components/overview/overview-add-card.ts`                       | `addCardOfType`: the card the type's first taking board's header chip would add (`chipClickCell` on `projectBoard`)         |
| `apps/editor/components/plan/card-type-sample.tsx`                           | A type's example card and its fields' names and icons (moved out of `ItemTypeDisplay`)                                      |
| `apps/editor/components/plan/CardTypeChipFace.tsx`                           | `cardTypeChipClass(size, named)`, `CardTypeChipFace`, `CardTypeChip`: the board header's chip at `sm` / `md` / `lg`         |
| `apps/editor/components/overview/AddTabTile.tsx`                             | The Add Tab tile and its kind chips                                                                                         |
| `apps/editor/components/plan/start/start-request.ts`                         | The one-shot Start Planning category a kind chip asks for; `StartPlanning` takes it on mount                                |
| `apps/editor/components/overview/useActivityEnter.ts`                        | The entries' fan in and arrival (Web Animations, mount only)                                                                |
| `apps/editor/components/overview/OverviewActivity.tsx`                       | The day groups, the rail, memoised entries (`ActivityItem`), See All                                                        |
| `apps/editor/components/overview/overview-*.ts`                              | The pure derivations (boards, tabs, card types, activity, people, dates, `overviewModelOf`)                                 |
| `apps/editor/components/overview/useOverviewModel.ts`                        | One memoised derivation of everything the page shows from the editor context                                                |

Errors: `OverviewPage` is a shell that portals the cover and wraps `OverviewContent` (which reads the context and
derives everything) in `AreaErrorBoundary area="Overview"` inside the cover. The boundary around `OverviewPage` in
`EditorView` sits in the editor's column, so a fault caught there drew its notice at the foot of the editor with the
cover gone and the tab showing; it now only meets a chunk that fails to load.

Wiring: `useEditorState` passes `canvasCovered || overviewOpen` to the keyboard shortcuts; `EditorView` draws
`OverviewPage` (lazy, `next/dynamic`, inside `AreaErrorBoundary area="Canvas"`) while `overviewOpen`; it portals a
`data-canvas-cover` layer at `z-[var(--z-chrome)]` into the canvas root (`CANVAS_ROOT_SELECTOR`), over the canvas and
its chrome, under modals and the card sheet. `TabBar` takes `overview?: { open, onOpen }`, left out in an embed and a
tab-scoped session. `EditorStartPanels` draws nothing
while the Overview is open.

## Behaviour and state

- `overviewOpen: boolean`, initially false; not stored. Its address is `#overview` (`OVERVIEW_HASH`,
  `lib/overview-address.ts`).
- Opening a plan: `seed-fetched-project.ts` reads the address when it picks the first active tab and calls
  `landingOf({ hash, tabIds, newPlan, overviewAllowed })` (`lib/overview-address.ts`): a valid `#t=` (not out of
  scope) lands on that tab; otherwise the first tab, with the Overview open unless the session has none
  (`overviewAllowed`: not an embed, no tab scope) or the plan was just made (`newPlan`). On `overview` the seed calls
  `showOverviewOnOpen()` (sets `overviewOpen` with no telemetry and nothing to clear) after `setActiveId`, in the same
  batch. A workbench hydrates through `workbench-bootstrap.ts`, which does not open it.
- New plan: `/new` hands off with `history.replaceState({ [NEW_PLAN_KEY]: true }, '', '/project/<id>')`;
  `isNewPlanEntry(history.state)` is `newPlan`. The tab pin's first `replaceState` drops the mark, so a reload of
  the new plan is an ordinary reload (its `#t=` keeps the tab).
- The address: `useTabEntryEffects` and `useCardAddress` both take `overviewOpen`; with no card shown the hash is
  `OVERVIEW_HASH` while it is open, else `#t=<activeId>`; a shown card always writes `cardHash(activeId, card)`.
  Both replace the entry (a card's first open pushes, as before). `useOverviewHistory` listens to `popstate`: a hash
  of `OVERVIEW_HASH` opens the Overview (`showOverviewOnOpen`); a `#t=` with no `item` naming a real tab other than
  what is shown selects it (closing the Overview).
- Preload: `editor-page.tsx` calls `loadOverviewPage()` (`lib/editor-deferred-code.ts`) on mount for any surface but
  the embed, beside the project request; `EditorView`'s `next/dynamic` uses the same loader, with
  `OverviewLoadingCover` as its `loading` (a portal of the plain page background into the canvas root), so the
  canvas is never drawn first.
- `openOverview()`: sets it, clears the selection and any text edit, tracks `UI` · `Opened` · `Overview` (once per
  press, not when already open). The automatic opens (plan open, Back / Forward) do not track.
- `setActiveId(next, opts?)`: any tab switch closes the Overview, except the two fallbacks that only keep a valid
  active tab (the active tab removed by a peer, the active tab deleted from its menu), which pass
  `{ keepOverview: true }`.
- `TabBar`: the strip's `activeId` is `OVERVIEW_TAB_KEY` while the Overview is open, so no tab pill is the open one
  and the sliding card rests on the Overview entry; pressing the tab underneath (the plan's open tab) calls
  `onSelect` with its id even though it is `activeId`, which closes the Overview.
- On first open, `OverviewPage` calls `loadAllTabs()` once (the Search sweep). A tab is loading while it has no kind
  and no elements and is not in `loadedTabIds`.
- Editing in place (`EditInPlace`, one per field, `editing` held by `OverviewHeader` so Add a Description can start
  the description's): idle, the text is drawn as before (`h1` / `p`) with an `aria-hidden` pencil, and a transparent
  button laid over it (`aria-label` and Tooltip **Rename** / **Edit Description**) starts editing on a click, Enter
  or F2. Editing, a `textarea` in the same box and type (`useAutoHeight`, `rows=1`) takes focus (the name's text
  selected, the description's caret at the end). Name: Enter or blur saves, newlines typed or pasted become spaces,
  `maxLength` `NAME_MAX_LENGTH`. Description: Cmd/Ctrl + Enter or blur saves, `maxLength` `PROJECT_DESCRIPTION_MAX`,
  the count `{n} / 500` once past `DESCRIPTION_COUNT_FROM`. Escape cancels. A finish runs once (a `closed` ref, so
  the blur after Enter or Escape does nothing); a finish by key puts focus back on the button. Only a changed,
  trimmed value is handed on; an empty name is never handed on. An open edit commits when the page goes
  (`useCommitOnLeave`). Keys never reach the editor's shortcuts (`stopPropagation`).
- `OverviewPage.saveName(name)`: `truncateName`, and when it differs from `projectName`, `nameProject` (the header's
  rename path) and `track('Project', 'Renamed')`. `OverviewPage.saveDescription(description)`: when it differs,
  `projectDetails.description` is set at once (optimistic), `saveProjectDescription` keeps the stored answer and
  tracks `Project` · `Changed` · `Description`, and on failure puts the previous value back and toasts. These two are
  the only ways the Overview writes the name and description.
- Room op `project-details` from `system`: applies what it carries, `description` and/or `overviewStyle`, each through
  its normaliser (`receiveProjectDetails` -> `withDetailsChange`, which keeps the same object for an echo).
- **The dock**: the cover sits at `z-[var(--z-chrome)]` over the canvas root, and the bottom-right cluster lives in
  that root at `z-[var(--z-panel)]`, so the cover hid it. `EditorCanvasHost` passes `overviewOpen` to `CanvasChrome`,
  which then draws the same cluster at `z-[calc(var(--z-chrome)+1)]` (`OVER_OVERVIEW_Z`) with: Undo / Redo (same
  gate), `PlanCardsClusterStrip` with `finder={false}` (Trash and Card Types, whether or not the tab shows cards),
  `LayersThemeStrip` (Style), and `ViewZoomControls` only in Zen; no Session strip, Collaborate, offscreen hint or
  covered-element inset. The Card Types and Trash popovers render in a `pointer-events-none absolute inset-0` layer
  at the same z (the canvas root's own box, so their anchors are unchanged); Find a Card is not offered.
- **Style**: the dock's Style calls `overviewStyleOpener` (Editor only on the Overview, `UI` · `Opened` ·
  `OverviewStyle`), which sets the editor's `canvasThemeTab`; `EditorModals` draws Tab Style only while the Overview
  is closed, and `OverviewContent` draws `OverviewStyleDialog` while it is open. Each pick runs the tab transform
  (`withThemeApplied`, `withLookApplied`, `withTabPattern`, `withTabFont`, `withTabTextSize`, plain colour and slider
  fields) on a stand-in tab wearing the look (`withOverviewChange`) and reads the style back through
  `readOverviewStyle` (so Finish never lands).
- **The look**: `overviewLookOf(projectDetails.overviewStyle, tabs[0])`, memoised in `OverviewContent` on the style
  and the first tab's nine style fields only; `overviewSurfaceOf(look, appearance)` memoised on the look and the
  viewer's appearance. `EditorView` retints the accent from the look's theme while the Overview is open
  (`useEditorAccent`).
- **Writes and undo** (`useOverviewEdits`): `rename` names the plan (`nameProject`) and pushes
  `{ undo: name back, redo: name again }` onto the editor's undo journal (`pushUndo`, the item undo journal exposed on
  the context); `describe` writes optimistically and pushes a step whose undo and redo write again
  (`saveProjectDescription`), each putting the other value back with the toast on failure; `restyle` sets the style
  at once and (re)starts a `OVERVIEW_STYLE_SAVE_MS` timer whose end saves the run's last style
  (`saveOverviewStyle`) and pushes one step from the style before the run; unmounting flushes a waiting run. Steps
  read the editor through `useLatest`, as they run later.

## Interfaces and contracts

- `PUT /api/projects/:id/details`, body `{ description?: string, overviewStyle?: OverviewStyle | null }`, at least
  one.
  - 400 `expected { description } or { overviewStyle }` when neither is present, `description` is not a string or
    `overviewStyle` is neither an object nor null.
  - 403 when the caller may not edit the whole plan (`gateEdit`; a tab-scoped grant is refused by it).
  - 404 for a plan the caller cannot see (`missingProject`).
  - 200 `{ description }`: the value as stored (`readProjectDescription`: trimmed, capped at
    `PROJECT_DESCRIPTION_MAX` code units, never cut inside a surrogate pair).
  - With `overviewStyle`: 200 carries it as stored (`readOverviewStyle`; null when nothing is left).
  - Relays `{ kind: 'project-details', description?, overviewStyle? }` (what it wrote) as an ordered system op
    (`relayProjectDetails`).
- `GET /api/projects/:id` carries `description` only when it is not empty, `overviewStyle` only when set; the editor
  reads a missing one as `''` / null.
- Room scope: `project-details` is not tab-less, so a tab-scoped session never receives it (fail closed).

## Data and persistence

- `plan.description TEXT NOT NULL DEFAULT ''`, added by schema step V14; a plan made before it reads `''`.
- `setPlanDescription(env, planId, description, now)` writes the column and `saved_at`.
- A copy (`exportPlanCopy` / `importPlanCopy`) carries `description` when it copies the whole plan, never for a tab-
  scoped copy.
- An offline record keeps `description?: string`; sync to the cloud sends it on the create (`description` on the
  create body, stored by `initPlan`); taking a plan offline keeps it.
- `plan.overview_style TEXT NULL` (JSON), added by schema step V15 (runs as each plan's store opens; locally only
  until a deploy); `setPlanOverviewStyle(env, planId, style, now)` writes it and `saved_at`; the head read parses it
  through `readOverviewStyle` (a broken row reads as none). A whole-plan copy carries it (`PlanCopy.overviewStyle`,
  the stored JSON, normalised again on import). An offline record keeps `overviewStyle?` (`offlineSaveOverviewStyle`);
  the cloud sync of an offline plan does not send it yet.
- Nothing else about the Overview is stored.

## Errors and edge cases

- A plan with no `createdAt` known (0): the created part is left out. No owner name: "Created on {date}".
- A tab with no name: shown as its stored name (never empty in practice; the bar's own fallback applies).
- A board tab whose board element is missing or unreadable: drawn as a not-started tab.
- A card type id no card or board names: still tiled, "0 Cards", "Not on any board yet".
- An item whose title is empty: named "Untitled".
- Activity tie at the same moment: the later key first (deterministic).
- A description save while offline (the api unreachable): toast "Couldn’t save the description", value restored.

## Security and trust

- The description is plain text, rendered as text (never HTML); `whitespace-pre-line` keeps line breaks.
- Only the api sends `project-details` (system op kind); the room drops it from a client socket.
- `gateEdit` checks the whole-plan edit grant; Participants and Viewers are refused (role tests in the route test).

## Performance and limits

- `useOverviewModel` derives in one `useMemo` per input change; inputs are the store's `items` map, `types`, `tabs`,
  `statusNames`, `loadedTabIds`, presence. Never per render of an unrelated slice.
- Cards are grouped by status once (`O(n)`) for the counts.
- Tab previews: `TabPreview` mounts its SVG only once `useNearScreen` has seen the tile (rootMargin 300 px, latched),
  then waits its turn in `preview-queue.ts` (one start per animation frame). `useTabPreviewSvg` memoises the markup on
  the tab object, the cards, types, done phases, thread counts, the Sheets read and the appearance; a Dashboard also
  on the plan's tabs (its slots draw them). `TabPreview` is `memo`'d on its props. The SVG is the export's, which
  draws only what is inside the board's or Sheet's frame, so its size is bounded by the window, not the card count.
- A Board or Sheet preview's element carries the id `{element id}:overview-preview`: keyed by its own id the board
  would fill its tab (`useFillsTab`, a portal over the canvas area, so the open tab's tile drew empty) and publish
  and then withdraw its tab's CSV actions (`usePublishBoardCsv`).
- Measured in the browser, not in a unit budget (a jsdom board is not the browser's): see the PR's Performance.
- Board counts: one pass per board over the status groups it names (`O(n × boards)`, at most 2,000 × tabs).
- Card types: one pass over the cards for every type together (`cardTypeTilesOf`): live count, count per status,
  overdue (a `due` before today, not in a done column by `statusPhasesOf`), and the latest-changed card as the sample;
  then per type a pass over the boards. `O(n + types × boards)`. Each tile is `memo`; its example card is memoised on
  the type.
- Activity: a bounded insertion into a list of at most `ACTIVITY_MAX` (30) entries, `O(n × 30)` worst case, no full
  sort.
- Budget test: 2,000 cards and 9 tabs derive in under 16 ms of CPU (measured 7 ms) (`overview-model.perf.test.ts`).

## Presentation and UX

- Page: `flex-1 overflow-y-auto`, on the app's chrome surface (`bg-slate-50 dark:bg-slate-950`) under the
  `OverviewSurface`: its inline backdrop (`tabBackgroundStyle` of `resolveViewBackdrop`, its colour made opaque with
  `color-mix` over that surface), `fontFamily`, the `--text-*` steps scaled, and the class `dark` or `light` (theme.css's
  `dark` variant honours both) so every pair below is the one matching the backdrop. The content's bottom padding is
  `6rem` plus the safe area, clearing the dock (on the last band, and on the Card Types band and the panel from
  `lg`).
- Bands (`OverviewBand`, `OverviewSection.tsx`): `tone="plain"` is transparent over the backdrop; `tone="wash"` is
  `bg-brand-50/70 dark:bg-brand-400/[0.06]` with `border-y border-brand-100 dark:border-brand-400/15` (the brand ramp
  is the theme's accent while the Overview is open, useEditorAccent); `tone="panel"` (Recent Activity) is plain below
  `lg` and from `lg` `bg-white/70 dark:bg-slate-900/60` with `border-l border-slate-200 dark:border-slate-800`.
  Padding `px-4 py-8 sm:px-10 sm:py-10`. `OverviewSection` takes a `subtitle` (`text-[13px] text-slate-500
dark:text-slate-400`) under its heading (`text-base font-semibold`). Grid: `lg:grid-cols-[minmax(0,1fr)_380px]`,
  the panel stretched to the content's height; header band
  `bg-brand-50 dark:bg-brand-950/40` with `border-b`; content `px-4 sm:px-10 py-6`, grid
  `lg:grid-cols-[minmax(0,1fr)_340px] gap-8`, sections `gap-3`.
- Tab tiles: `grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-4`; tile `rounded-xl border bg-white
dark:bg-slate-900`; preview `aspect-[16/10]` on the tab's paper, a hairline under it; the SVG is laid out at its
  own size and scaled with `transform: scale(k)` from the top left (`previewFit`), `inert`, `aria-hidden`,
  `pointer-events-none`. Loading: the shared loading sweep; failed: "Couldn't load preview"; not started: "Nothing on
  this tab yet", both a quiet pill on the paper.
- Card type tiles: the tab grid's `grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4`; a tile
  (`TILE_CLASS`, `p-3.5`, `gap-3`, a `div`, never a button) holds, top to bottom:
  - `CardTypeChip size="lg"` (28 px card art, 15 px medium name, `h-10`, `-ml-2` so its card lines up), and on its
    right an Editor's quick actions, a `group` named "{Type} Actions" of 28 px icon buttons with Tooltips: Edit {Type}
    (pencil), Add Field (text cursor), Add a {Type} (square plus, only when a board takes it). Shown always on a
    coarse pointer, else on hover and focus within (`pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100`).
  - The sample (`data-card-type-sample` `card` / `example`): 124 px on the palette's column colour, the real
    `PlanCardFace` at Detailed size, 125 % wide and `scale-[0.8]` from the top left, faded out at its foot by a mask;
    `inert`, `aria-hidden`, `pointer-events-none`; an "Example" pill on an example. Drawn in `planPalette(scheme)`, the
    page's light or dark.
  - Field chips (`ul` "Fields"): 24 px, slate, the field's icon at 12 px and its name, title left out, at most
    `TYPE_FIELDS_SHOWN` (5), then "+{n} More" with a HoverCard naming the rest.
  - "{n} Cards" (`cardCountLine`), an "{n} Overdue" red pill, and a 6 px bar (`role="img"`, its label every share)
    of `HoverCard` segments, `flex-grow` by count, `gap-px`, in the column's colour else by phase (slate-300 / brand-500
    / emerald-500, dark slate-600 / brand-400 / emerald-400).
  - "On" and a 24 px outlined link per board (`aria-label` "Open {Tab}", up to `TYPE_BOARDS_SHOWN`, then "+{n} More");
    or "Not on any board yet" (amber) and an Editor's Add to a Board: one choice adds at once, several open a
    `PortalMenu` of the boards (`canAddTo`: boards whose `addTypes` leave it out).
    The board's header draws the chip at `md` (22 px, 13 px, `h-8`), so `BoardCardTypeChips` and the Overview share one
    class source.
- Add Field from the Overview: `plan.editType({ id, addField: true })`; `PlanSheetsHost` passes `openAddField` through
  `ItemTypeEditor` and `ItemTypeConfiguration` to `ItemTypeLayoutEditor`, which on mount opens Details' Add Field
  popover from its button. Add Card: `addCardOfType` then `addItem`, `openNewItem`, `announce` "{Type} added to
  {Column}", as the board's chip. Add to a Board: `ctx.plan.addTypeToBoard(boardElementId, typeId)` (one undoable edit
  of that board's `addTypes`). `OverviewBoard` carries the board `elementId` for it.
- Add tiles (`AddTile`): `border-[1.5px] border-dashed` on a faint wash, a 40 px brand circle with the plus over the
  label (and a hint); hover and focus within brighten the border and wash (`hover:border-brand-400
hover:bg-brand-50/70`, dark `brand-500/60` and `/10`), nothing moves. The whole face is one button; `below` holds
  controls outside it. `AddTabTile` gives the face `aspect-[16/10]` and under it a 44 px row of four icon chips
  (`ADD_TAB_KINDS`: Board, Sheet, Dashboard, Form, the Start Planning rail's icons), each a Tooltip'd button that
  calls `addTab(start)`; the page calls `requestStartCategory(start)` then `ctx.addTab()`, and the new tab's
  `StartPlanning` opens on that category (falling back to Recommended when it has none). Add Card Type: the same
  tile, `min-h-[100px]`.
- Copy is final as in the spec. Title Case for headings, buttons and tile names; descriptive lines in sentence case.
- Empty states (no card types, no activity) are a glyph and a line inside the section (`LayoutGrid`, `History`).
- No description: an Editor sees an **Add a Description** link that starts editing it in place; others see nothing.
- Editable name and description: idle `-mx-2 px-2 rounded-lg`; on hover or focus a soft `bg-brand-100/70`
  (`dark:bg-brand-900/50`) and the pencil; editing, the same box `bg-white dark:bg-slate-900` with a brand ring
  (box-shadow, no layout change). On a touch screen (no hover) the pencil always shows, faintly.
- People (`OverviewPeople.tsx`): a `ul` row (`gap-1`) of columns `w-16`, each a 32 px disc and its name under it
  (`text-[11px] truncate`), the column focusable (`role="img"`, `aria-label` the name) with a Tooltip of the name. At
  most `PEOPLE_SHOWN` (5), `PEOPLE_SHOWN_NARROW` (3) under `sm` (the people past it `max-sm:hidden`), then a **+N**
  column captioned More, its Tooltip the rest's names (`aria-label` "More: {names}"); two are drawn, one per width
  (`sm:hidden` / `max-sm:hidden`), each counting the rest at its width. The band is
  `flex flex-wrap items-end justify-between`: the text column `flex-1 basis-[min(100%,16rem)]`, the row `ml-auto`,
  so it sits in the bottom right, its foot level with the dates line, and wraps onto its own line (still right) only
  when the two cannot share one.
- Activity: one tile (`TILE_CLASS`, `p-2`) of day groups (`activityDaysOf`: Today, Yesterday, `shortDate`), each a
  `section` named by its day with an `ol` and a 1 px rail through the discs' column. An entry is a grid `28px | 1fr`:
  the person's `PersonDisc` (28 px, `ring-2` in the tile's colour so it cuts the rail) with a 16 px kind badge
  (`data-dot`: `setup` brand-700 / dark brand-600 with white glyph, `card` slate-100 / dark slate-700), or, when the
  entry above is the same person's (`samePerson`: id, else name and colour), the 20 px badge alone on the rail. Then
  the sentence (person and title `font-semibold`), the type's `CardTypeChip size="sm"` on slate-100 and, for a move,
  an arrow and the column's pill (`data-moved-to`), then `{where} · {when}` (`formatRelativeTime`, the exact time in a
  `HoverCard`, which states supplementary text a Tooltip may not). A card's entry is one button
  (`hover:bg-slate-50 hover:shadow-sm hover:ring-1`, focus outline brand-600, its `aria-label` the whole line).
  Entries are keyed `{key}@{at}`, so a card's newer change remounts at the top and arrives.
- Activity motion (`useActivityEnter`): on an entry's first frame, `el.animate` with `fill: 'backwards'`, opacity and
  transform only. Fan in: from `translateY(6px) scale(0.98)` over `micro` (150 ms), delay `index ×
ACTIVITY_ENTER_STEP_MS` (14 ms) capped at `MOTION_CASCADE_CAP_MS` (100 ms), so the last lands by 250 ms; entries
  See All reveals count from the first revealed. Arrival (mounted after the list was on screen, among the first
  eight): from `translateY(-8px)` over `short`. None under reduced motion (`prefersReducedMotion`).
- A tab still loading keeps Loading…; one whose load failed (`loadAllTabs`' failures) shows Couldn't load preview.

- Opening (`useOverviewEntrance`): `OverviewView` sets `data-overview-entering` for `OVERVIEW_ENTRANCE_MS` (the
  250 ms ceiling plus 50 ms) after it mounts; while it is set, globals.css ("The Plan Overview's entrance") runs
  `overview-rise` (from `translateY(6px)`, opacity 0; `micro`, `cubic-bezier(0.16, 1, 0.3, 1)`, `both`) on the
  header's children, each section's heading row and the children of the Tabs and Card Types bodies (the tiles),
  selected by the sections' `aria-labelledby` ids so no component carries a class for it. Delays: header text 0;
  people, Tabs and Recent Activity headings 25 ms; first tab tile and Card Types heading 50 ms; second tab tile and
  first card type tile 75 ms; the rest `--motion-cascade-cap` (100 ms). Bands never animate. Once the attribute
  clears, the rules stop matching, so later mounts and re-renders are still. A drawn preview (`Drawing`'s span, and
  `LivePlanPreview` in a `data-tab-preview-live` span) carries `animate-fade-in`, which runs once on mount.

## Accessibility

- The page is a `main`-less `region` named "Plan Overview" (the editor already has its `main`), headings `h1`/`h2`.
- Tiles are buttons with names that read in full ("Triage Board, Board, 17 Cards"); previews are `aria-hidden` and
  `inert`, so nothing inside them is focusable or read out.
- The Overview entry is a tab button with `aria-current="page"` while open.
- Activity: a `section` per day named by its heading, each an `ol`; See All is a button with `aria-expanded`. A card's
  entry is a button named by its whole line ("Ana Moreno moved Fix login to Done, Triage, 8 mins ago"); discs and
  badges are `aria-hidden`. The Add Tab kinds are a `group` named "Start a Tab As", each chip named "Add a {Kind}".
- Contrast: every text pair in light and dark is a slate or brand step that the palette guards already pass.
- Motion: the shared loading pulse (stops under reduced motion, `motion-reduce:animate-none`) and Activity's fan in,
  skipped under reduced motion.

## Web Experience

- Lazy chunk: no first-load JS added to the editor route (`project-lazy-load.test.ts` guards `EditorView`); the
  chunk is fetched on mount beside the project request, and until it lands `OverviewLoadingCover` fills the
  canvas's box with the page background. No layout shift in the canvas area: the page fills the same box.

## Observability

- `debugLog('[overview] opened', { tabs, cards })` on open; `console.info('[project-details] details.saved', { length })`
  and `details.rejected` in the route; the editor's save failure logs `[project-details] save failed`.

## Testing

| Spec rule                                                                                                           | Test                                                    |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Tab tiles: kinds, counts, loading                                                                                   | `overview-tabs.test.ts`                                 |
| Previews: window sizing, fit, inert for every role, loading / failed / empty, queue                                 | `TabPreview.test.tsx`, `tab-preview-svg.test.ts`        |
| Preview budget on 2,000 cards                                                                                       | `tab-preview.perf.test.ts`                              |
| Card types, activity (kinds, bound, order, where, parts, days, runs), people, dates line                            | `overview-sections.test.ts`                             |
| Opening: entering while it settles, then never again                                                                | `useOverviewEntrance.test.tsx`, `motion-budget.test.ts` |
| Activity fan in inside the motion budget; arrival                                                                   | `useActivityEnter.test.ts`, `motion-budget.test.ts`     |
| Chips: a tile's and an entry's type chip; the Add Tab kinds (Editor only, start on a kind)                          | `OverviewView.roles.test.tsx`, `start-request.test.ts`  |
| Card type tiles: per-status shares, overdue, sample, Add to a Board's choices                                       | `overview-sections.test.ts`                             |
| Card type tiles by role: sample, fields, bar, links; Editor's quick actions and Add to a Board, nobody else's       | `OverviewView.roles.test.tsx`                           |
| Add Field opens the gallery at once                                                                                 | `ItemTypeLayoutEditor.rows.test.tsx`                    |
| The board header's chips unchanged                                                                                  | `BoardCardTypeChips.test.tsx`                           |
| One derive per input change; presence moves derive nothing                                                          | `useOverviewModel.test.tsx`                             |
| Budget on 2,000 cards                                                                                               | `overview-model.perf.test.ts`                           |
| Roles: Editor edits name and description in place, Add Tab, Add Card Type; Participant and Viewer do not, no Share  | `OverviewView.roles.test.tsx`                           |
| Empty states (one tab, no types, no activity)                                                                       | `OverviewView.roles.test.tsx`                           |
| Editing in place: start (click, Enter, F2), save (Enter, Cmd/Ctrl + Enter, blur), Escape, empty name, cap and count | `EditInPlace.test.tsx`                                  |
| Overview entry, open state, select closes                                                                           | `TabBar.overview.test.tsx`, `editor-ui-state.test.ts`   |
| Opening lands: plain address, `#t=`, `#overview`, missing tab, embed / tab scope, new plan                          | `overview-address.test.ts`                              |
| The address while open, on a card, Back and Forward                                                                 | `overview-history.test.tsx`                             |
| Strip draws `leading` first                                                                                         | `TabStrip.test.tsx`                                     |
| Route: write, cap, refusals by role, relay                                                                          | `project-details-route.test.ts`                         |
| Description normaliser                                                                                              | `project-details.test.ts` (api-schema)                  |
| Style normaliser: keeps, checks and drops settings                                                                  | `project-details.test.ts` (api-schema)                  |
| Route: style write, both at once, clear, relay, refusals by role, copy                                              | `project-details-route.test.ts`                         |
| Style: first tab default, tab transforms, scheme from backdrop, type scale, font                                    | `overview-style.test.ts`                                |
| Header in the theme: every built-in theme, light and dark, reads at 4.5:1 on paper and washes; multicolour rule     | `overview-header-paint.test.ts`                         |
| Dock Style: Editor on the Overview; none for a Participant or Viewer; Tab Style on a tab                            | `overview-dock.test.ts`                                 |
| Dock on the Overview: Trash and Card Types, no Find a Card                                                          | `PlanCardsClusterStrip.test.tsx`                        |
| Undo of the name, description (incl. refused) and a style run; one save per run; flush on close; room echo          | `useOverviewEdits.test.tsx`                             |
| Overview Style panel: named, no Finish                                                                              | `CanvasThemeDialog.test.tsx`                            |

## Constants and configuration

| Constant                  | Value      | Why                                                                     |
| ------------------------- | ---------- | ----------------------------------------------------------------------- |
| `PROJECT_DESCRIPTION_MAX` | 500        | A few sentences; the spec's limit                                       |
| `DESCRIPTION_COUNT_FROM`  | 400        | The count shows once it is worth watching                               |
| `OVERVIEW_STYLE_SAVE_MS`  | 400        | A slider's drag saves once and undoes in one step                       |
| `ACTIVITY_SHOWN`          | 8          | What fits beside the Tabs section on a laptop                           |
| `ACTIVITY_MAX`            | 30         | The spec's bound                                                        |
| `TYPE_FIELDS_SHOWN`       | 5          | Field chips that fit two short rows on a 280 px tile                    |
| `TYPE_BOARDS_SHOWN`       | 3          | Board links before "+N More"                                            |
| `ACTIVITY_ENTER_STEP_MS`  | 14         | The first eight spread across the 100 ms cascade cap                    |
| `PEOPLE_SHOWN`            | 5          | People before More                                                      |
| `PEOPLE_SHOWN_NARROW`     | 3          | People before More on a phone (under `sm`)                              |
| `PREVIEW_WINDOW`          | 1440 × 900 | The window a preview shows (the Dashboard export's width)               |
| `PREVIEW_MARGIN_PX`       | 300        | How near the screen a tile starts its preview                           |
| `PREVIEW_CELL_CARDS_MAX`  | 10         | Cards a previewed board draws per cell (`PlanBoardView` `cellCardsMax`) |

## Defaults ledger

Rows D80 to D83 in [DEFAULTS.md](DEFAULTS.md).
