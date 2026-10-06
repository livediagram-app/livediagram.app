# Plan mode blueprint

Derived from [Plan mode](../plan-mode.md). Contract for wiring the `plan` editor mode, its gate, its palette
and its templates.

## Domain and naming

| Spec term        | Identifier                                                                             |
| ---------------- | -------------------------------------------------------------------------------------- |
| Plan mode        | `EditorMode` `'plan'` (`EDITOR_MODE_CATALOGUE`, 4th entry)                             |
| Plan Mode switch | preference `planModeEnabled`; `EXPERIMENTAL_EDITOR_MODES`                              |
| Plan palette     | `PLAN` layout in `palette-layouts.ts`; categories `plan-boards`, `plan-cards` (band 4) |
| Plan mark        | `PlanModeIcon` in `packages/ui/src/icons/drawing-kinds.tsx`                            |
| Blank Plan       | `TemplateKind` `'blank-plan'`                                                          |

## Mode wiring

- `packages/document/src/editor-mode.ts`: catalogue entry `{ id: 'plan', label: 'Plan', description: 'Boards of
items: columns, cards and the work moving through them' }`; `hasPlanLook(mode)`.
- Every `Record<EditorMode, …>` the compiler flags: `MODE_EVENT` (`ModePlan`), `OPENS_IN_EVENT` (`OpensInPlan`),
  template filter (`TemplateModePlan`), `BLANK_TEMPLATE_FOR_MODE` (`blank-plan`), `MODE_WORDS` (Plan, "Plan
  boards"), marketing `MODE_BEST`, `EDITOR_MODE_ICONS` (widened to `Record<EditorMode, …>`).
- By hand: explorer lens `VALUE_LABELS['opens-in'].plan`, `paletteLayoutFor` (switch on mode), OpenAPI
  regeneration, marketing hero/gallery mode unions, telemetry explanations and catalogue `types`.

## Gate

- `offeredModesFor(enabled: ExperimentalModeFlags)` with `ExperimentalModeFlags = { illustrate: boolean; plan:
boolean }`; `setExperimentalModeEnabled(mode, on)`. `EXPERIMENTAL_EDITOR_MODES = ['illustrate', 'plan']`.
- `planModeEnabled` preference read as `!== false`; Settings › Experimental row "Plan Mode", telemetry
  `PlanModeOn` / `PlanModeOff` fired before persisting.

## Palette

- Two categories in `PALETTE_CATEGORIES`, both in band 4 (`CATEGORY_BANDS[4] = 'Plan'`), listed first, Cards
  before Boards: `plan-boards` (label "Boards", glyph `PlanIcon`) and `plan-cards` (label "Cards", glyph
  `PlanCardsIcon`). Tile sections of the same ids.
- Tiles (`palette-plan-tiles.tsx`, spread into `PALETTE_TILES`), a `shape` action whose creation-time choice
  `plan` is the preset or the item type (threaded like `estimateScale` through the tile grid, drag payload, search,
  draw intent and drop): `plan:board-<preset>` for the 7 presets, `plan:card-<type>` (caption "<Type> card") for the
  8 item types, in `plan-cards`; boards in `plan-boards`.
- `PLAN` layout: `plan-cards`, `plan-boards`, landing on `plan-cards`; no Popular. The Cards body is
  `PalettePlanCardsTab` (the document's types, then Edit Cards); the Toolbar strip draws the same tiles and ends
  with `EditCardsStripButton`. Both call `openCardTypes()` (`hooks/plan/card-types-opener.ts`), which
  `useCardTypesOpener` in `CanvasChrome` registers against the Card Types cluster button. Draw's shape dock excludes both categories.
- A palette card drag: `PaletteIconButton` publishes `planType` on the drag preview; `usePaletteDrop.onDragOver`
  calls `planCardDragOver(x, y)` (`plan-card-drop.ts`), which has the board under the pointer `hover` a gap of
  `PLAN_PALETTE_GAP_PX` (56) at the slot, cleared on leaving, on drop and when the preview clears;
  `PaletteDragGhost` draws nothing for `plan-card`.
- Placing a board tile: `buildDrawnBoxed` / the drop path set `planBoard: presetSetupOrBlank(plan)`; a card tile
  makes no element: `dropPaletteItem` and `useShapeDrawing` hand it to `onPlanCardPlace(type, x, y)`, which maps
  the canvas point through the board under it (`boardClientPoint`) and lands it with `dropPlanCardAt`
  (`hooks/plan/plan-card-drop.ts`): the board's registered `addCard(type, slot)` makes the item there and opens
  it; a miss or a refusal is a toast.

## Templates

Derived from [Plan templates](../plan-templates.md).

- Builders are element-only and make no items: a template comes with no cards.
- `plan-template-catalogue.ts` (pure data): `PLAN_TEMPLATE_KINDS`; `PLAN_TEMPLATE_TABS:
Record<PlanTemplateKind, PlanTabSpec[]>`; `PlanTabSpec = { name, board?, metrics?, charts?, rail? }`;
  `BoardSpec = { preset, setup?, width, height, title }`; `RailItem` is a `sticky` (text), `timer` (minutes, a
  `session-button`), `picker` (label) or `temperature` (label). Hand-off columns name the same status and name
  on each board that shares them.
- `template-builders-plan.ts`: `boardSetup(spec)` is `presetSetup(preset)` with `setup` over it, the title set,
  card fields in `CARD_FIELDS` order and an explicit `doneColumnId: undefined` dropped. `buildPlanTab(spec, cx,
cy)` lays the board at the origin, then metrics (`PLAN_METRIC_SIZE`, 20px gaps, wrapping at the board width)
  40px under it, then charts two to a row (`PLAN_CHART_SIZE` height, 24px gaps; the Gantt, 440 high, and a
  last odd chart take the full width), and the rail (280 wide, 24px gaps) 40px right of the board; a tab with
  no board is 1464 wide (two charts). The whole is centred on (cx, cy). `planTemplateTabs(kind)` names each
  tab (null for a one-tab template); `buildPlanTemplate` is the first tab's elements.
- `templateTabs(kind)` (`build-template.ts`) is the generic list: Plan kinds give theirs, every other kind one
  unnamed tab of `buildTemplate`. `buildTemplateTabs(first, kind, newId, themeId?)` (`template-tab.ts`) makes
  them as `buildTemplateTab` makes one.
- Consumers: `/new` (`buildTemplatedTabs` in `apps/live/lib/template-builders.ts`), Quick Start
  (`useTemplateFlow` with `template-tab-set.ts`: the followers take `newTabSeed(landed)` and the canvas
  overrides, inserted after the active tab, each `markTabLoaded`), the MCP's `create_document` and the api's
  `compileSeededTabs` (the followers after the compiled tab, fresh ids). A replace fills its one tab with the
  first.
- Statuses: `usePlanStatuses(tabs, activeId, enabled)` returns the `names` and `phases` maps from
  `documentStatusSignatures(tabs, activeId)`: each tab's board set-ups are cached in a `WeakMap` by its
  elements array, each set-up list gets a numeric id, and the two JSON signatures are cached by the joined ids
  (the open tab's first), at most `STATUS_SIGNATURE_CACHE_MAX` (8) entries. Measured on 20 tabs of 2,001
  elements: 87 ms the first read, 0.11 ms a render after. `PlanSheetsHost`'s status picker reads
  `statusNames`. `usePlanTabSweep` calls `loadAllTabs` once a session when Plan is in play and the document
  has 2 to `PLAN_SWEEP_MAX_TABS` (12) tabs.
- `TEMPLATE_MODES` maps each kind to `'plan'`; previews in `packages/template-previews` (group 15), a tab strip
  for a template of several tabs and a Gantt panel under a board of projects.

## Testing

| Rule                           | Test                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| Mode catalogue order, cycle    | `editor-mode.test.ts`                                                                         |
| Gate per mode                  | `offered-editor-modes.test.ts`                                                                |
| Plan palette layout            | `palette-layouts.test.ts`                                                                     |
| Templates open in Plan         | `template-modes.test.ts`, `template-tab.test.ts`                                              |
| Template set-ups validate, fit | `template-builders-plan.test.ts`                                                              |
| Hand-offs, tab layout          | `template-builders-plan.test.ts`                                                              |
| Template tabs on create        | `document-create-seeded.test.ts`, `create-document-placement.test.ts`, `template-tab.test.ts` |
| Quick Start adds the tabs      | `template-tab-set.test.ts`                                                                    |
| Document-wide statuses, sweep  | `usePlanStatusNames.test.ts`, `usePlanTabSweep.test.ts`                                       |
| Shift+D wraps over four        | `e2e/editor-modes.spec.ts`                                                                    |
| A board survives a mode switch | `e2e/editor-modes.spec.ts`                                                                    |

## Tabs and tools

- No mode lock ([Switching modes keeps the tab](../plan-mode.md#switching-modes-keeps-the-tab)): the mode switch
  and Shift+D (`editorModeShortcut`) call `setMode` straight, whatever the tab holds. Outside Plan,
  `usePlanSlice` sets `planInput: false`, so `PlanBoardView`, `PlanCardView` and the views draw read-only and the
  board is selected and moved as an element; items keep loading by content (`hasPlanContent`), not by mode.
- `useModeDefaultTool` (`hooks/editor/useModeDefaultTool.ts`): `modeDefaultTool(mode, mobile)` is `pan` for Plan
  or a phone, else `select`, picked when the mode changes (embeds keep `pan`); `PLAN_LEFT_OUT_TOOLS` (Eraser,
  Format) fall back to `pan` in Plan, are refused by `pickCanvasTool`, and `buildCanvasToolOptions({ planMode })`
  leaves them out of the picker.
- `canvas-selection.ts`: no quick-connect pluses on `plan-board` or `plan-card`.
