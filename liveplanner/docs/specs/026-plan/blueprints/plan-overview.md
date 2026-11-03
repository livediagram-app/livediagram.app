# Plan Overview blueprint

Derived from [Plan Overview](../plan-overview.md).

## Domain and naming

| Spec term          | Identifier                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Overview           | `OverviewPage` (the page), `overviewOpen` / `openOverview` / `closeOverview` (editor UI state)             |
| Overview entry     | `OverviewTabPill` (in the tab bar), `OVERVIEW_TAB_KEY` (`'overview'`, its strip id)                        |
| description        | `description` on `Project`, `plan.description` column, `PROJECT_DESCRIPTION_MAX`, `readProjectDescription` |
| tab tile           | `TabTileSummary` (`overview-tabs.ts`), `TabTile`, `TabTilePicture`                                         |
| card type tile     | `CardTypeTileSummary` (`overview-card-types.ts`), `CardTypeTile`                                           |
| activity           | `ActivityEntry` (`overview-activity.ts`), `OverviewActivity`; `ACTIVITY_SHOWN`, `ACTIVITY_MAX`             |
| people on the plan | `planPeopleOf` (`overview-people.ts`), `OverviewPeople`                                                    |
| Edit Details       | `EditDetailsDialog`                                                                                        |

## Files

| File                                                                         | Holds                                                                                                            |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `packages/api-schema/src/project-details.ts`                                 | `PROJECT_DESCRIPTION_MAX` (500), `readProjectDescription(raw)`, `ProjectDetailsResponse`, `ProjectDetailsRoomOp` |
| `packages/api-schema/src/index.ts`, `room-messages.ts`, `error-telemetry.ts` | `Project.description?`, `project-details` in `SYSTEM_OP_KINDS` and `RoomOp`, the `details` route word            |
| `apps/api/src/plan-room/plan-schema.ts`                                      | Step V14: `ALTER TABLE plan ADD COLUMN description TEXT NOT NULL DEFAULT ''`                                     |
| `apps/api/src/plan-room/plan-content.ts`                                     | `description` in the head columns and `PlanMeta`, `setPlanDescription`, the copy's `description`                 |
| `apps/api/src/routes/project-details-route.ts`                               | `PUT /api/projects/:id/details`                                                                                  |
| `apps/api/src/room-client.ts`                                                | `relayProjectDetails`                                                                                            |
| `apps/editor/lib/api/project-details.ts`                                     | `saveProjectDescription(scope, description)`: the api, or the offline record                                     |
| `apps/editor/lib/offline/offline-store.ts`                                   | `description?` on the record, `offlineSaveDescription`, `recordToProject` carries it                             |
| `apps/editor/app/project/[id]/editor-ui-state.ts`                            | `overviewOpen`, `openOverview`, `closeOverview`; `setActiveId` closes the Overview unless `{ keepOverview }`     |
| `apps/editor/app/project/[id]/editor-persistence.ts`                         | `projectDescription`, `projectDates` (`createdAt`, `savedAt` from the load)                                      |
| `apps/editor/components/chrome/OverviewTabPill.tsx`                          | The tab bar's first entry and its divider (the shared `TabFrame`)                                                |
| `packages/workbench/src/components/chrome/TabStrip.tsx`                      | `leading?: ReactNode`, drawn first inside the strip's toolbar                                                    |
| `apps/editor/components/overview/OverviewPage.tsx`                           | The page: layout, sections, the tab sweep, telemetry                                                             |
| `apps/editor/components/overview/OverviewHeader.tsx`                         | Eyebrow, name, description, dates, people, Edit Details, Share                                                   |
| `apps/editor/components/overview/OverviewPeople.tsx`                         | The overlapping discs and count                                                                                  |
| `apps/editor/components/overview/OverviewTabs.tsx`, `TabTilePicture.tsx`     | The tab tiles and their pictures                                                                                 |
| `apps/editor/components/overview/OverviewCardTypes.tsx`                      | The card type tiles                                                                                              |
| `apps/editor/components/overview/OverviewActivity.tsx`                       | The rail of entries, See All                                                                                     |
| `apps/editor/components/overview/EditDetailsDialog.tsx`                      | Edit Details                                                                                                     |
| `apps/editor/components/overview/overview-*.ts`                              | The pure derivations (tabs, card types, activity, people, dates), each with its tests                            |
| `apps/editor/components/overview/useOverviewModel.ts`                        | One memoised derivation of everything the page shows from the editor context                                     |

Wiring: `useEditorState` passes `canvasCovered || overviewOpen` to the keyboard shortcuts; `EditorView` draws
`OverviewPage` (lazy, `next/dynamic`) in the canvas's place while `overviewOpen`, and `TabBar` takes `overviewOpen`,
`onOpenOverview` and `showOverview` (false in an embed and a tab-scoped session). `EditorStartPanels` draws nothing
while the Overview is open.

## Behaviour and state

- `overviewOpen: boolean`, initially false; not stored, not in the address.
- `openOverview()`: sets it, clears the selection and any text edit, tracks `UI` · `Opened` · `Overview` (once per
  open, not when already open).
- `setActiveId(next, opts?)`: any tab switch closes the Overview, except the two fallbacks that only keep a valid
  active tab (the active tab removed by a peer, the active tab deleted from its menu), which pass
  `{ keepOverview: true }`.
- `TabBar`: the strip's `activeId` is `OVERVIEW_TAB_KEY` while the Overview is open, so no tab pill is the open one
  and the sliding card rests on the Overview entry; pressing the tab underneath (the plan's open tab) calls
  `onSelect` with its id even though it is `activeId`, which closes the Overview.
- On first open, `OverviewPage` calls `loadAllTabs()` once (the Search sweep). A tab is loading while it has no kind
  and no elements and is not in `loadedTabIds`.
- `EditDetailsDialog` Save: a changed name goes through `nameProject` (the header's rename path); a changed
  description through `saveDescription`, which sets `projectDescription` at once (optimistic), calls
  `saveProjectDescription`, keeps the stored answer, and on failure puts the previous value back and toasts.
- Room op `project-details` from `system`: sets `projectDescription`.

## Interfaces and contracts

- `PUT /api/projects/:id/details`, body `{ description: string }`.
  - 400 `expected { description }` when `description` is not a string.
  - 403 when the caller may not edit the whole plan (`gateEdit`; a tab-scoped grant is refused by it).
  - 404 for a plan the caller cannot see (`missingProject`).
  - 200 `{ description }`: the value as stored (`readProjectDescription`: trimmed, capped at
    `PROJECT_DESCRIPTION_MAX` code units, never cut inside a surrogate pair).
  - Relays `{ kind: 'project-details', description }` as an ordered system op (`relayProjectDetails`).
- `GET /api/projects/:id` carries `description` (empty string when none).
- Room scope: `project-details` is not tab-less, so a tab-scoped session never receives it (fail closed).

## Data and persistence

- `plan.description TEXT NOT NULL DEFAULT ''`, added by schema step V14; a plan made before it reads `''`.
- `setPlanDescription(env, planId, description, now)` writes the column and `saved_at`.
- A copy (`exportPlanCopy` / `importPlanCopy`) carries `description` when it copies the whole plan, never for a tab-
  scoped copy.
- An offline record keeps `description?: string`; sync to the cloud sends it on the create (`description` on the
  create body, stored by `initPlan`); taking a plan offline keeps it.
- Nothing about the Overview itself is stored.

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
- Cards are grouped by status once (`O(n)`), then each board reads its columns (`O(columns)` plus the cards it
  draws, at most `TILE_COLUMNS_MAX` × `TILE_CARDS_MAX` = 4 × 3).
- Board counts: one pass per board over the status groups it names (`O(n × boards)`, at most 2,000 × tabs).
- Activity: a bounded insertion into a list of at most `ACTIVITY_MAX` (30) entries, `O(n × 30)` worst case, no full
  sort.
- Budget test: 2,000 cards, 12 board tabs, 20 types derive in under 16 ms (`overview-model.perf.test.ts`).

## Presentation and UX

- Page: `flex-1 overflow-y-auto`, the app's chrome surface (`bg-slate-50 dark:bg-slate-950`); header band
  `bg-brand-50 dark:bg-brand-950/40` with `border-b`; content `px-4 sm:px-10 py-6`, grid
  `lg:grid-cols-[minmax(0,1fr)_340px] gap-8`, sections `gap-3`.
- Tab tiles: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5`; tile `rounded-xl border bg-white
dark:bg-slate-900`, picture 104 px.
- Card type tiles: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5`.
- Copy is final as in the spec. Title Case for headings, buttons and tile names; descriptive lines in sentence case.
- Empty states use the shared `EmptyState`.

## Accessibility

- The page is a `main`-less `region` named "Plan Overview" (the editor already has its `main`), headings `h1`/`h2`.
- Tiles are buttons with names that read in full ("Triage Board, Board, 17 Cards"); pictures are `aria-hidden`.
- The Overview entry is a tab button with `aria-current="page"` while open.
- Activity is a list (`ol`); See All is a button with `aria-expanded`.
- Contrast: every text pair in light and dark is a slate or brand step that the palette guards already pass.
- No motion beyond the shared loading pulse, which stops under reduced motion (`motion-reduce:animate-none`).

## Web Experience

- Lazy chunk: no first-load JS added to the editor route; the page shows nothing until its chunk lands (a plan opens
  as before). No layout shift in the canvas area: the page fills the same box.

## Observability

- `debugLog('[overview] opened', { tabs, cards })` on open; `console.info('[project-details] details.saved', { length })`
  and `details.rejected` in the route; the editor's save failure logs `[project-details] save failed`.

## Testing

| Spec rule                                                                              | Test                                                  |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Tab tiles: kinds, counts, pictures, loading                                            | `overview-tabs.test.ts`                               |
| Card type tiles: counts and where used                                                 | `overview-card-types.test.ts`                         |
| Activity: kinds, moves, bound, order, where                                            | `overview-activity.test.ts`                           |
| People: owner first, dedupe, newest                                                    | `overview-people.test.ts`                             |
| Dates line                                                                             | `overview-dates.test.ts`                              |
| Budget on 2,000 cards                                                                  | `overview-model.perf.test.ts`                         |
| Roles: Editor sees Edit Details, Add Tab, Add Card Type; Participant and Viewer do not | `OverviewPage.roles.test.tsx`                         |
| Empty states (one tab, no types, no activity)                                          | `OverviewPage.empty.test.tsx`                         |
| Edit Details saves name and description                                                | `EditDetailsDialog.test.tsx`                          |
| Overview entry, open state, select closes                                              | `TabBar.overview.test.tsx`, `editor-ui-state.test.ts` |
| Strip draws `leading` first                                                            | `TabStrip.test.tsx`                                   |
| Route: write, cap, refusals by role, relay                                             | `project-details-route.test.ts`                       |
| Description normaliser                                                                 | `project-details.test.ts` (api-schema)                |

## Constants and configuration

| Constant                  | Value | Why                                           |
| ------------------------- | ----- | --------------------------------------------- |
| `PROJECT_DESCRIPTION_MAX` | 500   | A few sentences; the spec's limit             |
| `DESCRIPTION_COUNT_FROM`  | 400   | The count shows once it is worth watching     |
| `ACTIVITY_SHOWN`          | 8     | What fits beside the Tabs section on a laptop |
| `ACTIVITY_MAX`            | 30    | The spec's bound                              |
| `PEOPLE_SHOWN`            | 5     | Discs before "+N"                             |
| `TILE_COLUMNS_MAX`        | 4     | Columns a board picture draws                 |
| `TILE_CARDS_MAX`          | 3     | Cards per column a board picture draws        |
| `TILE_BARS_MAX`           | 5     | Bars a view picture draws                     |

## Defaults ledger

Rows D80 to D83 in [DEFAULTS.md](DEFAULTS.md).
