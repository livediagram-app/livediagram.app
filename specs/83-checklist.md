# 83 — Checklist

Checkable to-do rows as a first-class element. It gives agile/retro boards and assigned-action workflows (spec/68) a visual home: a card of tasks whose boxes anyone with edit access can tick, live-synced like everything else.

## Model: a data shape

`ShapeKind` gains **`checklist`** (the spec/51/53 data-shape route), with one optional field on `ShapeElement`:

```ts
checklistItems?: { text: string; done: boolean }[];
// validate.ts bounds: ≤ 30 items, text ≤ 200 chars each
```

Everything else is inherited from the shape path: tap-to-drop AND draw-to-size, selection, resize, lock, groups, layers, duplicate, copy/paste, history, sync, eraser. `checklist` joins `isSelfDrawingShape` (no centred label; the rows are the content). Default size 240×180; new checklists seed three empty-ish starter rows ("First task" unchecked etc. — concrete enough to show the affordance, cheap to overwrite).

## Visual treatment

A themed boxed card (fill/stroke/text follow the tab theme like any shape — unlike the code block, a checklist belongs to the diagram's palette). Each row: a rounded checkbox square + the row text, top-aligned, clipped to the card. Done rows tick the box (brand-coloured check), strike through the text, and mute it. A footer count ("2/5") renders bottom-right when at least one row is done.

## Interaction

- **Clicking a checkbox on the canvas toggles that row's `done`** — the rating shape's interactive-stars precedent. Edit-role only; locked elements, hidden/locked layers, and view-only sessions are gated exactly as rating is. Each toggle is one undoable history entry and syncs as a normal element op.
- **Row text editing** follows the data-shape pattern: the element context menu gains a **Checklist** section (`ElementDataSections.tsx` + a rows component): one text input per row with its done toggle, an "Add row" button (capped at 30), and per-row remove. Same commit/undo semantics as the rail-label and chart-data editors.
- Double-click on the card opens the context menu at the Checklist section (matching how self-drawing shapes otherwise ignore double-click; this one has an obvious edit intent).

## Headless render (share thumbnails, MCP, exports)

`svg-render` gains a `checklist` branch: card + per-row square (filled + check path when done) + `<text>` row (with `text-decoration: line-through` when done), clipped to the box.

## Plumbing checklist

`SHAPE_KINDS` + field bounds in `validate.ts`, colour defaults in `colors.ts` (standard themed boxed element), kind label ("Checklist"), palette tile `tools:checklist` (Tools section, next to Table; favouritable, no letter shortcut), quick-connect excluded, OpenAPI regen, MCP schema prose if hand-listed, AI-generate prompt vocabulary (include — "the AI may emit checklists for plan/retro asks" is genuinely useful), telemetry dashboard TOOLS label set.

## Telemetry

`track('Element', 'Added', 'Checklist')` at the add handler. Box toggles deliberately don't track (high-frequency, low-signal, matching spec/39's vote-cast precedent).
