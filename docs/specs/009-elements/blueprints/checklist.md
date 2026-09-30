# Checklist: blueprint

Derived from [Checklist](../checklist.md), with the tick rules of
[Collaboration race hardening](../../012-collaboration/collab-race-hardening.md). The spec
decides; this file only adds engineering precision. Defaults applied where the spec is silent are
ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                         | Role                                                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `packages/diagram/src/data-shapes.ts`                        | `ChecklistItem`, `CHECKLIST_MAX_ITEMS`, `CHECKLIST_MAX_TEXT`, `CHECKLIST_DEFAULT_ITEMS`, `isChecklistShape` |
| `packages/diagram/src/shape-factory.ts`                      | Size 240 × 180; seeds the three rows                                                                        |
| `packages/diagram/src/validate.ts`                           | Row count, row text and `done` type checks                                                                  |
| `packages/diagram/src/element-deltas.ts`                     | The `check` delta, `checklistDeltaFor`, `keepLocalTicks`, `mergeIncomingElement`                            |
| `packages/diagram/src/collab-ledger.ts`                      | Wire validation of an incoming `check` delta                                                                |
| `packages/diagram/src/svg-render-shapes.ts`                  | `svgChecklistShape`: the headless render                                                                    |
| `apps/live/components/canvas/ChecklistView.tsx`              | Canvas card, row buttons, footer count                                                                      |
| `apps/live/components/canvas/ShapeContentRouter.tsx`         | Routes the kind; `editable = !readOnly && !isLocked`                                                        |
| `apps/live/hooks/canvas/useCollabElements.ts`                | `toggleChecklistItem`: builds and applies the delta                                                         |
| `apps/live/hooks/canvas/useDataShapeSetters.ts`              | `setChecklistItemsSelected`: whole-array row edits                                                          |
| `apps/live/components/palette/ElementDataSections.tsx`       | The Checklist section (Tools flyout)                                                                        |
| `apps/live/components/palette/context-menu-data-editors.tsx` | `ChecklistRowsEditor`                                                                                       |
| `apps/live/components/palette/palette-tile-defs.tsx`         | Tile `tools:checklist`, section `components`                                                                |
| `apps/api/src/ai-prompt.ts`                                  | AI vocabulary entry for `checklist`                                                                         |

## Domain and naming

| Term         | Identifier                                            | Meaning                                             |
| ------------ | ----------------------------------------------------- | --------------------------------------------------- |
| Checklist    | `ShapeKind` `'checklist'`                             | The to-do card                                      |
| Row          | `ChecklistItem = { text, done }`                      | One task; no id                                     |
| Tick         | `ElementDelta` `{ kind: 'check', index, text, done }` | One row's new `done` state, named by index and text |
| Row edit     | `setChecklistItemsSelected(items)`                    | Whole-array replace: add, remove, retitle           |
| Footer count | `done/total`                                          | Shown when at least one row is done                 |
| Accent       | the element's stroke colour                           | Card border, box border, filled box [Q10]           |

Banned synonyms: "todo item" (say row), "check" for a row edit (a check is only a tick), "task
list".

## Behaviour and state

### Create

`createShape('checklist', x, y)`: 240 × 180 with `CHECKLIST_DEFAULT_ITEMS` (First task, Second task,
Third task, all unchecked). Telemetry `Added Checklist`.

### Render

1. Card: `rounded-lg` border in the accent, background the element fill (`defaultFillColor` when
   unset), font the tab's label font.
2. Rows stack from the top, 4 px apart, at least 24 px tall, clipped by the card; text 13 px,
   truncated to one line with an ellipsis.
3. Box: 16 px, border in the accent; done fills the accent and draws a white tick.
4. Done text: `line-through`, opacity 0.55.
5. Footer `done/total` at 10 px, opacity 0.6, bottom-right, only when `done > 0`.

### Tick (the `check` delta)

1. A click on a box, or on a row checkbox in the menu, calls `toggleChecklistItem(id, index)`.
2. Guards, in order: canvas button `disabled` unless `editable` (not read-only, not user-locked,
   tab not locked); handler returns when `editsBlocked` (tab locked, read-only, tab not loaded).
   Neither path checks a locked or hidden layer, and the menu path does not check the element lock
   [G6].
3. `checklistDeltaFor(el, index)` returns `{ kind: 'check', index, text: item.text, done: !done }`
   or null for a missing row.
4. `applyElementDelta` applies it locally and sends it; it is not pushed onto the undo stack and
   is not tracked.
5. Applying (`applyElementDelta` case `check`): use `index` when that row's text matches, else the
   first row with that text; no match, or already in the requested state → unchanged.

### Merge

`mergeIncomingElement` keeps local ticks on a peer's whole-element copy via
`keepLocalTicks(local, incoming)`: rows come from the peer, `done` from the local copy, matched by
position and text. `elementChangeIsDeltaOnly` compares rows by text only, so a tick-only change
sends no whole-element update.

### Row edit

1. `ChecklistRowsEditor` keeps a local draft, reseeded when the element's rows change.
2. Text inputs (`maxLength` 200, placeholder "Task") commit the whole draft on blur.
3. `+ Add row` appends `{ text: '', done: false }`, disabled at 30 rows. `×` removes a row,
   disabled at one row (`DE6`).
4. `setChecklistItemsSelected` slices to 30 rows and 200 characters each, writes every selected
   checklist, one undo step, `track('Element', 'Changed', 'Checklist')`.
5. Double-click on the card does nothing (`isSelfDrawingShape`).

## Interfaces and contracts

```ts
export type ChecklistItem = { text: string; done: boolean };
export const CHECKLIST_MAX_ITEMS = 30;
export const CHECKLIST_MAX_TEXT = 200;
export function checklistDeltaFor(el: Element, index: number): ElementDelta | null;
export function keepLocalTicks(local: ChecklistItem[], incoming: ChecklistItem[]): ChecklistItem[];
export function svgChecklistShape(
  el: BoxedElement & { type: 'shape' },
  fill: string,
  stroke: string,
  textColor: string,
): string;
```

Validation: `checklistItems` bounded to 30; each row an object with a string `text` of at most
200 and a boolean `done`, else `isValidElement` rejects. An incoming `check` delta whose `text`
exceeds 200 or whose `done` is not boolean is dropped by `collab-ledger.ts`.

## Data and persistence

`checklistItems` is persisted; absent renders an empty card. Ticks persist through the element
like any field once applied. No migration.

## Errors and edge cases

| #   | Case                                 | Handling                                                        |
| --- | ------------------------------------ | --------------------------------------------------------------- |
| E1  | Two people tick different rows       | Both deltas land                                                |
| E2  | Peer reordered or retitled meanwhile | Delta finds the row by text, or does nothing                    |
| E3  | Duplicate row texts                  | Index first; otherwise the first row with that text (`DE7`)     |
| E4  | Peer's whole copy lacks a tick       | `keepLocalTicks` keeps ours                                     |
| E5  | More rows than fit                   | Clipped on the canvas; export draws `floor((h - 24) / 26)` rows |
| E6  | Long row text                        | Ellipsis on the canvas; export cuts at the width in 7 px chars  |
| E7  | Locked layer or user-locked (menu)   | Tick still applies [G6]                                         |

## Security and trust

Row text is untrusted: React text on the canvas, `xmlEscape` in the export. The delta is
validated at the ledger and bounded like the element. Any edit-role participant may tick.

## Performance and limits

At most 30 rows of at most 200 characters; a tick is one small delta, not a whole element.

## Presentation and UX

Themed card that follows the tab theme. Palette: Components category, caption "Checklist",
blurb "Tickable to-do rows". AI vocabulary includes it with `checklistItems` (max 30 rows).

## Accessibility

- Each canvas box is a `button` with `aria-pressed` and `aria-label` "Mark "text" done" / "not
  done"; disabled when not editable.
- Menu rows use native checkboxes labelled "Row n done".
- Box target 16 px inside a 24 px row; done text at opacity 0.55 and the footer at 0.6 lower
  contrast against the card and are not contrast-checked (`DE3`).
- No motion.

## Web experience

Canvas-space only (CLS 0). A tick applies locally before the network (INP).

## Observability

Ticks are deliberately untracked. Row edits track `Changed Checklist`. No log fingerprints; a
dropped delta (no match) is silent [G12].

## Testing

| Rule                                   | Test                                                    | File                                          |
| -------------------------------------- | ------------------------------------------------------- | --------------------------------------------- |
| Guard matches only `checklist`         | checklist matches only its own kind                     | `packages/diagram/src/data-shapes.test.ts`    |
| Bounds                                 | bounds the code block + checklist fields                | `packages/diagram/src/validate.test.ts`       |
| Two ticks on different rows both land  | ticks different checklist rows from two people          | `packages/diagram/src/element-deltas.test.ts` |
| Row found by text after a move         | finds a checklist row by its text when the rows moved   | `packages/diagram/src/element-deltas.test.ts` |
| Whole-element update keeps ticks       | keeps our ticks and our comments, takes their row edits | `packages/diagram/src/element-deltas.test.ts` |
| Tick-only change is delta-only         | is true for an answer, a tick or a comment alone        | `packages/diagram/src/element-deltas.test.ts` |
| Export: rows, strike-through, footer   | renders a checklist as rows with ticked boxes           | `packages/diagram/src/svg-render.test.ts`     |
| Starter rows all unchecked, no footer  | none [G11]                                              |                                               |
| Lock and layer gating of ticks         | none [G6]                                               |                                               |
| Ticks are not undoable and not tracked | none [G11]                                              |                                               |

## Constants and configuration

| Name                  | Value              | Provenance / safe range                    |
| --------------------- | ------------------ | ------------------------------------------ |
| `CHECKLIST_MAX_ITEMS` | 30                 | Spec                                       |
| `CHECKLIST_MAX_TEXT`  | 200                | Spec                                       |
| Size                  | 240 × 180          | Spec                                       |
| `CHECK_ROW_HEIGHT`    | 26                 | Export row pitch; canvas uses 24 + 4 [G13] |
| `CHECK_BOX_SIZE`      | 14                 | Export box; canvas box 16 [G13]            |
| `CHECK_PAD`           | 12                 | Matches `p-3`                              |
| Done text opacity     | 0.55               | Canvas and export                          |
| Footer                | 10 px, opacity 0.6 | Canvas and export                          |
