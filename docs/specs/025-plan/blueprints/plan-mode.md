# Plan mode blueprint

Derived from [Plan mode](../plan-mode.md). Contract for wiring the `plan` editor mode, its gate, its palette
and its templates.

## Domain and naming

| Spec term        | Identifier                                                        |
| ---------------- | ----------------------------------------------------------------- |
| Plan mode        | `EditorMode` `'plan'` (`EDITOR_MODE_CATALOGUE`, 4th entry)        |
| Plan Mode switch | preference `planModeEnabled`; `EXPERIMENTAL_EDITOR_MODES`          |
| Plan palette     | `PLAN` layout in `palette-layouts.ts`; category id `plan`         |
| Plan mark        | `PlanModeIcon` in `packages/ui/src/icons/drawing-kinds.tsx`       |
| Blank Plan       | `TemplateKind` `'blank-plan'`                                     |
| seed items       | `TemplateBuild.items?: ItemCreate[]`                              |

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

- New category `plan` in `PALETTE_CATEGORIES` (label "Plan", glyph the Plan mark, band after Popular).
- Tiles (`palette-tile-defs.tsx`), action `{ type: 'plan-board', preset }` or `{ type: 'plan-card', itemType }`:
  `plan:board-kanban`, `plan:board-sprint`, `plan:board-retro`, `plan:board-roadmap`, `plan:board-blank`,
  `plan:card-<type>` for each of the 8 item types.
- `PLAN` layout: Popular (`plan:board-kanban`, `plan:board-retro`, `plan:card-task`, `plan:card-bug`,
  `plan:card-note`, `tools:sticky`, `tools:text`, `write:heading`, `tools:frame`, `tools:arrow`, `media:image`,
  `tools:checklist`; ids reconciled to the catalogue at build), `plan`, `write` (minus page, annotation),
  `shapes`, `icons`, `stickers`, `media` (image, avatar).
- Placing a board tile: `createShape('plan-board')` + preset set-up; a card tile: `createItem` then a
  `plan-card` element, title in edit (the item panel opens on the title).

## Templates

- `TemplateBuild` (what builders return) gains `items?: ItemCreate[]` (ids pre-made by the builder so cards and
  boards reference them).
- New document path: `apiCreateDocument` body `items`; template into an existing document (Quick Start new tab):
  `createItems` bulk after the tab is added.
- Kinds: `blank-plan`, `kanban` (rebuilt), `sprint-board`, `bug-triage`, `team-retro`, `roadmap`,
  `weekly-planner`; `TEMPLATE_MODES` maps each to `'plan'`; previews in `packages/template-previews`.

## Testing

| Rule                         | Test                                             |
| ---------------------------- | ------------------------------------------------ |
| Mode catalogue order, cycle  | `editor-mode.test.ts`                            |
| Gate per mode                | `offered-editor-modes.test.ts`                   |
| Plan palette layout          | `palette-layouts.test.ts`                        |
| Templates open in Plan, seed | `template-modes.test.ts`, `template-tab.test.ts` |
| Shift+D wraps over four      | `e2e/editor-modes.spec.ts`                       |
