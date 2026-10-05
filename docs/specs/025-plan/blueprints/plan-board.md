# Plan board blueprint

Derived from [Plan board](../plan-board.md). Contract for the `plan-board` and `plan-card` shape kinds and their
editor views.

## Domain and naming

| Spec term     | Identifier                                                                   |
| ------------- | ---------------------------------------------------------------------------- |
| Plan board    | `ShapeKind` `'plan-board'`; set-up field `ShapeElement.planBoard: PlanBoardSetup` |
| Plan card     | `ShapeKind` `'plan-card'`; field `ShapeElement.planCard: { itemId: string }` |
| board set-up  | `PlanBoardSetup` (`@livediagram/items` `board.ts`)                           |
| column        | `PlanColumn`                                                                 |
| swimlane      | `SwimlaneBy` + projected `lanes`                                             |
| WIP limit     | `PlanColumn.wipLimit`                                                        |
| unplaced      | projection `unplaced`                                                        |
| scope         | `PlanBoardSetup.scope: BoardScope`                                           |
| quick filter  | `QuickFilter` (per person, React state, never stored)                       |
| face-down     | `cardIsFaceDown(item, setup, viewerId)`                                      |
| board preset  | `PLAN_BOARD_PRESETS` (`@livediagram/items` `presets.ts`), id `PlanBoardPresetId` |

## Element model (`packages/document`)

- `shape-kind.ts`: add `'plan-board'`, `'plan-card'` (62 → 64; `shape-kind.test.ts` count, canvas-and-palette prose).
- `element-types.ts` `ShapeElement`: `planBoard?: PlanBoardSetup`, `planCard?: { itemId: string }`.
- `element-fields.ts`: both fields listed.
- `shape-factory.ts`: `SHAPE_DEFAULT_SIZE` board 1120×640, card 240×120; `createShape('plan-board')` seeds the
  `blank` preset set-up; `createShape('plan-card')` seeds `planCard: { itemId: '' }` (the caller sets it).
- `validate-shape.ts`: `planBoard` checked by `validateBoardSetup` (items package: 1..12 columns, unique ids and
  statuses, names ≤ 40, wip 1..99, cardFields known, budget 1..99); `planCard.itemId` by `ITEM_ID_PATTERN` or empty.
- Predicates: `isSelfDrawingShape` (both), `SELF_PAINTING_SHAPES` (both: board paints its own surfaces; card its
  type colour), `isSvgRenderedShape` exclusion (both), `SHAPE_LABELS` ("Plan board", "Plan card"), not markers,
  not containers.
- `svg-render.ts`: `svgBoxed` branches to `svg-render-plan.ts`: `svgPlanBoard(el, items?)`,
  `svgPlanCard(el, items?)`. `SvgRenderOptions.items?: ReadonlyMap<string, Item>`. Without items, columns draw
  with names and empty bodies; a card draws "Item".
- `edit-operations` `SHAPE_KIND_FIELDS`: `plan-board` → `planBoard`, `plan-card` → `planCard`.
- `document-views` `content-summary` / `find`: board → title + column names; card → item id.

## Editor components (`apps/live/components/plan/`)

```
PlanContext.tsx          context: items map, actions, viewer, readOnly, editorMode, presence, openItem
PlanBoardView.tsx        board body (ShapeContentRouter branch); projection memo; header + columns
PlanBoardHeader.tsx      title, count, progress, avatars, quick filter, unplaced chip, Reveal, set-up button
PlanColumnView.tsx       one column: head (name, count, WIP), lanes, cards, add field
PlanCardFace.tsx         a card face (shared by board cards and the Plan card element)
PlanQuickAdd.tsx         add field with token chips
PlanCardView.tsx         the plan-card element body
ItemPanel.tsx            item panel (side sheet), field editors per kind
item-field-editors.tsx   editors for person, priority, labels, date, checklist, number, text
BoardSetupPanel.tsx      set-up sheet: columns list, swimlanes, scope, card fields, voting, hide writing
UnplacedTray.tsx         popover listing unplaced items with Move to
```

Hooks (`apps/live/hooks/plan/`): `usePlanItems` (store), `usePlanCardDrag` (pointer drag within and out of a
board), `usePlanBoardKeyboard`, `usePlanPresence` (who drags / views which item), `usePlanSlice` (composes
into `useEditorState` with one call; provides `PlanContext` value).

## Behaviour and state

- **Input routing**: `PlanBoardView` receives `interactive = editorMode === 'plan' && !readOnly`. Interactive:
  card pointerdown stops propagation and starts `usePlanCardDrag`; header/border do not stop propagation (the
  generic box drag moves the board). Not interactive: nothing stops propagation; double-click on a card opens it.
- **Card drag states**: `idle → pressed` (pointerdown) `→ dragging` (moved ≥ `PLAN_DRAG_SLOP_PX`) `→ dropped |
  cancelled` (Escape, pointercancel). `pressed → idle` on pointerup without moving = open the item.
  - While dragging: a floating copy follows the pointer (screen space, transform only), a placeholder of the
    card's height marks the drop slot: column under the pointer, lane under the pointer, slot by the midpoint of
    the cards under it.
  - Drop inside the board: `moveItem(id, { status, after|before, set: laneField })`, pushed to undo.
  - Drop outside the board's rect: `onCardOut(itemId, canvasPoint)` adds a `plan-card` element there (one
    commit), item unchanged.
- **Plan card onto a board**: in the drag-end of `useBoxedDragHandlers`, a single moved `plan-card` whose centre
  lies in a `plan-board` → `planDropOnBoard(cardEl, boardEl, point)`: compute the column (and lane) at the point
  from the board's last layout (`planBoardHitTest`), move the item there, delete the card element; both in one
  undo group (external step + tabs commit).
- **Quick add**: Enter → `parseQuickAdd` → `createItem({ type, fields, place: { status, after: lastId } })`;
  the field stays open and empties. Escape closes. Type defaults to the board scope's first type, else `task`.
- **Item panel**: `openItemId` in `usePlanSlice`; opening broadcasts presence `viewing`; edits debounce 400 ms
  per field (`ITEM_EDIT_DEBOUNCE_MS`), flushed on close; each flush is one undo step.
- **Reveal**: sets `planBoard.hideWriting = false` (element commit).
- **Set-up edits**: element commits via `updateElement`; removing a column with items opens a choice "Move
  N items to …" (another column) before the commit, the moves pushed with it.
- **Face-down**: `setup.hideWriting && item.createdBy.id !== viewerId` → face shows the author's colour and
  "Hidden until reveal".
- **Presence**: room presence op `plan` `{ itemId | null, state: 'drag' | 'view' }`, ephemeral, throttled to
  one per 100 ms; peers render a ring and first name on that card.

## Presentation and UX

- Board: rounded 12 px surface, header 52 px, columns min 220 px wide sharing the width, gap 12 px, column body
  scrolls (`overflow-y: auto`, wheel stops propagating only when it can scroll).
- Card face: 8 px radius, 4 px type stripe on the left, glyph + `#key` muted 12 px, title 14 px semibold up to
  3 lines (`line-clamp`), chips row (priority dot, labels, estimate, due, votes, checklist `3/5`), assignee
  avatar bottom right. Done column cards draw at 70% opacity.
- WIP over: count chip uses `--warning` tokens, column head text "Over WIP limit".
- Empty board: first column shows the open add field with "Add your first item".
- Copy: "Add item", "Not on this board", "Move to", "Hidden until reveal", "Reveal", "Votes left: 3",
  "Item not found", "Remove card", "Board set-up", "Only mine".
- Item panel: right side sheet 380 px (phone: bottom sheet, 85% height), header with type picker + key, title
  input, field rows in the type's order, description textarea, checklist, footer "Made by X · Changed by Y, 2m".

## Accessibility

- Board is a `region` named by its title; each column a `list` labelled "In progress, 3 items, WIP limit 4";
  each card a `listitem` containing a `button` named "#12 Fix login, Bug, assigned to Sam, high priority".
- Keyboard per spec (`usePlanBoardKeyboard`); moves announced in a polite live region.
- Drag has the keyboard equivalent (Shift+arrows). Focus ring 2 px, contrast ≥ 3:1; text ≥ 4.5:1 on every
  type colour stripe (stripe is decorative).
- Reduced motion: no placeholder animation, no card lift shadow transition.

## Web Experience

- Cards are DOM inside the element; boards render only when the element is in view (existing culling).
- Drag moves a transformed overlay; no layout per pointermove beyond the placeholder slot change (INP).
- Board size fixed by the element; column scroll never shifts layout (CLS 0).

## Errors and edge cases

| Case                                         | Handling                                           |
| -------------------------------------------- | -------------------------------------------------- |
| Items not loaded yet                         | Columns draw with skeleton cards (3 per column)    |
| Item store failed to load                    | Header shows "Couldn't load items" + Retry         |
| Drop on the same slot                        | No write                                           |
| Column statuses duplicated by an agent       | Validation rejects; normalise keeps the first      |
| Board narrower than columns × 220            | Columns scroll horizontally inside the board       |
| Item moved by someone else during my drag    | My drop still applies (last write wins)            |

## Observability

`[plan]` log fingerprints: `plan.drop.board`, `plan.drop.out`, `plan.card.onto-board`, `plan.setup.column-removed`,
`plan.items.load-failed`.

## Testing

| Rule                                     | Test                                                  |
| ---------------------------------------- | ----------------------------------------------------- |
| Factory, validation, size, labels        | `packages/document/src/plan-shapes.test.ts`           |
| SVG render with and without items        | `svg-render-plan.test.ts` + coverage test kinds       |
| Projection drives the board              | `PlanBoardView.test.tsx`                              |
| Keyboard moves + announcement            | `usePlanBoardKeyboard.test.tsx`                       |
| Drag slot computation                    | `plan-drop-slot.test.ts`                              |
| Card onto board                          | `plan-drop-on-board.test.ts`                          |
| Quick add creates and keeps field        | `PlanQuickAdd.test.tsx`                               |
| Face-down                                | `face-down.test.ts`                                   |

## Constants and configuration

| Constant               | Value | Provenance / safe range                   |
| ---------------------- | ----- | ----------------------------------------- |
| `PLAN_DRAG_SLOP_PX`    | 4     | Matches the canvas drag threshold         |
| `PLAN_COLUMN_MIN_PX`   | 220   | A card's title reads in 3 lines; 180–320  |
| `PLAN_COLUMNS_MAX`     | 12    | Spec                                      |
| `ITEM_EDIT_DEBOUNCE_MS`| 400   | One undo step per pause in typing         |
| `PLAN_PRESENCE_MS`     | 100   | Presence throttle as cursors              |
