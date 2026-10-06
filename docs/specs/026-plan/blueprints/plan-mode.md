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

- Builders are element-only (`template-builders-plan.ts`) and make no items: a template comes with no cards.
- `BOARDS: Record<PlanTemplateKind, BoardSpec>`; `BoardSpec = { preset, setup?, width, height, title }`.
  `planTemplateSetup(kind)` is `presetSetup(preset)` with `setup` laid over it and the title set, so a template
  made for one use (Project Overview, Daily Standup, Content Calendar, Hiring Pipeline) carries its columns
  here over the `blank` preset rather than as a palette preset.
- Board width fits every column at `PLAN_COLUMN_MIN_PX` (220) plus the 12px gaps and 12px side padding.
- `HOW_WE_RUN_IT` holds the "How we run it" sticky for `team-retro` and `daily-standup`, placed 40px right of
  the board.
- Kinds: `blank-plan`, `kanban` (rebuilt), `sprint-board`, `bug-triage`, `team-retro`, `roadmap-board`,
  `weekly-planner`, `project-overview`, `daily-standup`, `content-calendar`, `hiring-pipeline`;
  `TEMPLATE_MODES` maps each to `'plan'`; previews in `packages/template-previews` (group 15).

## Testing

| Rule                           | Test                                             |
| ------------------------------ | ------------------------------------------------ |
| Mode catalogue order, cycle    | `editor-mode.test.ts`                            |
| Gate per mode                  | `offered-editor-modes.test.ts`                   |
| Plan palette layout            | `palette-layouts.test.ts`                        |
| Templates open in Plan         | `template-modes.test.ts`, `template-tab.test.ts` |
| Template set-ups validate, fit | `template-builders-plan.test.ts`                 |
| Shift+D wraps over four        | `e2e/editor-modes.spec.ts`                       |
| A board survives a mode switch | `e2e/editor-modes.spec.ts`                       |

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
