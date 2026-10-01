# Checklist

Checkable to-do rows as a first-class element. It gives agile/retro boards and assigned-action workflows ([Assigned actions](../012-collaboration/assigned-actions.md)) a visual home: a card of tasks whose boxes anyone with edit access can tick, live-synced like everything else.

## Model: a data shape

`ShapeKind` includes **`checklist`** (the [Timeline rail](timeline-rail.md) data-shape route), with one optional field on `ShapeElement`:

```ts
checklistItems?: { text: string; done: boolean }[];
// validate.ts bounds: ≤ 30 items, text ≤ 200 chars each
```

Everything else is inherited from the shape path: tap-to-drop AND draw-to-size, selection, resize, lock, layers, duplicate, copy/paste, history, sync, eraser. `checklist` joins `isSelfDrawingShape` (no centred label; the rows are the content). Default size 240×180; new checklists seed three unchecked starter rows, "First task", "Second task" and "Third task" (`CHECKLIST_DEFAULT_ITEMS`): concrete enough to show the affordance, cheap to overwrite.

## Visual treatment

A themed boxed card (fill/stroke/text follow the tab theme like any shape — unlike the code block, a checklist belongs to the diagram's palette). Each row: a rounded checkbox square + the row text, top-aligned, clipped to the card. Done rows tick the box (brand-coloured check), strike through the text, and mute it. A footer count ("2/5") renders bottom-right when at least one row is done.

## Interaction

- **Clicking a checkbox on the canvas toggles that row's `done`**. Edit-role only; locked elements, locked tabs, hidden/locked layers, and view-only sessions are gated. Each toggle is one `check` delta ([Collaboration race hardening](../012-collaboration/collab-race-hardening.md)), not undoable, and the menu's row toggles send the same delta.
- **Row text editing** follows the data-shape pattern: the element context menu has a **Checklist** section (`ElementDataSections.tsx`, inside the menu's Tools flyout, + `ChecklistRowsEditor` in `context-menu-data-editors.tsx`): one text input per row with its done toggle, an "Add row" button (capped at 30), and per-row remove. Same commit/undo semantics as the rail-label and chart-data editors.
- Double-click on the card is deliberately inert, matching the other self-drawing shapes: the on-canvas interaction is the checkbox itself, and row editing lives in the context menu's Checklist section.

## Ticking together

A tick is one `check` delta ([Collaboration race hardening](../012-collaboration/collab-race-hardening.md)) naming the row by index and text, so
two people ticking different rows both land, and a peer's whole-element
update (an added row, a retitle) keeps everyone's ticks. Ticks are not
undoable: like a dot or an answer, they are the room's, not an edit.

## Headless render (share thumbnails, MCP, exports)

`svg-render` has a `checklist` branch (`svgChecklistShape`): card + per-row square (filled + check path when done) + `<text>` row (with `text-decoration: line-through` when done), clipped to the box.

## Plumbing checklist

`SHAPE_KINDS` + field bounds in `validate.ts`, colour defaults in `colors.ts` (standard themed boxed element), kind label ("Checklist"), palette tile `tools:checklist` (Components category; favouritable, no letter shortcut), quick-connect excluded, OpenAPI regen, MCP schema prose (built from `SHAPE_KINDS`), AI-generate prompt vocabulary (include — "the AI may emit checklists for plan/retro asks" is genuinely useful), telemetry dashboard TOOLS label set.

## Telemetry

`track('Element', 'Added', 'Checklist')` at the add handler. Box toggles deliberately don't track (high-frequency, low-signal, matching [Session tools (timer + voting)](../012-collaboration/session-tools.md)'s vote-cast precedent).
