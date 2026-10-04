# Mind node: blueprint

Derived from [The mind node](../mind-node.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                         | Role                                                                                |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `packages/document/src/mind-map.ts`                          | Tree walks, free placement (`nextMindChildPosition`), `makeRoom`, root sibling      |
| `packages/document/src/mind-flow.ts`                         | `MindFlow`, per-flow free placement, gaps, `mindConnectorAnchors`                   |
| `packages/document/src/mind-layout.ts`                       | `layoutMindTree`, `isMindTreeTidy`, `reanchorMindConnectors`                        |
| `packages/document/src/mind-grow.ts`                         | `planMindGrowth`, `relayoutMindMap`, `mindStyleSource`, `applyMindMoves`            |
| `packages/document/src/mind-outline-text.ts`                 | `mindOutlineText`, `parseMindOutline`, `mindOutlineLine`: outline to and from text  |
| `packages/document/src/mind-outline.ts`                      | `summariseMindOutline`, `applyMindOutline`: match lines to nodes, apply, re-lay out |
| `packages/document/src/anchor-choice.ts`                     | `bestAnchorTowards`: the bubble flow's connector faces                              |
| `packages/document/src/shape-factory.ts`                     | `SHAPE_DEFAULT_SIZE['mind-node']` (250 × 80)                                        |
| `packages/document/src/element-types.ts`                     | `mindParentId`, `mindFlow`                                                          |
| `packages/document/src/validate.ts`                          | `mindParentId` is a string; `mindFlow` a known flow                                 |
| `packages/document/src/duplicate.ts`                         | Re-parents copied children onto copied parents                                      |
| `packages/document/src/svg-render.ts`                        | The export's corner radius                                                          |
| `apps/live/app/document/[id]/useMindGrowth.ts`               | `canGrowMindNode`, `growMindNode`, `abandonMindNode`: one commit each               |
| `apps/live/app/document/[id]/useMindOutline.ts`              | `MindOutlineApi`: the open root, `canEdit`, `save` as one commit                    |
| `apps/live/lib/mind-dress.ts`                                | `dressMindNode`, `dressMindConnector`: one look for growth and outline saves        |
| `apps/live/components/dialogs/MindOutlineDialog.tsx`         | The Edit Outline dialog: text area, count line, remove confirm                      |
| `apps/live/lib/mind-handoff.ts`                              | Typing ahead: `beginMindHandoff`, `claimMindHandoff`, `applyHandoffKey`             |
| `apps/live/lib/format-painter.ts`                            | `paintableBoxedFields`, `paintableArrowFields`: the look a new node copies          |
| `apps/live/hooks/canvas/useEditorKeyboardShortcuts.ts`       | Tab / Enter on a selected node                                                      |
| `apps/live/hooks/canvas/useCanvasA11y.ts`                    | `ownsTabKey`: traversal stands aside                                                |
| `apps/live/components/canvas/useMindLabelKeys.ts`            | Tab / Enter / Escape in the label editor; claims the handoff                        |
| `apps/live/components/canvas/RichTextEditor.tsx`             | Hands its key events to `useMindLabelKeys`                                          |
| `apps/live/components/canvas/MindGrowContext.tsx`            | `useMindGrow`: grow and abandon, editor canvas only                                 |
| `apps/live/components/canvas/quick-connect-options.tsx`      | `MIND_CHILD_OPTION`, `MIND_SIBLING_OPTION`                                          |
| `apps/live/components/canvas/QuickConnectRing.tsx`           | Leads with the two growth options                                                   |
| `apps/live/components/canvas/SelectionPopover.tsx`           | `onAddMindChild`, `onAddMindSibling`: the toolbar buttons                           |
| `apps/live/components/canvas/CanvasSelectionToolbars.tsx`    | Offers the toolbar buttons on an editable, unlocked mind node                       |
| `apps/live/hooks/canvas/useMindMapSetters.ts`                | `setMindFlowSelected`, `tidyMindMapSelected`                                        |
| `apps/live/components/palette/context-menu-data-editors.tsx` | `MindFlowTiles`, with Tidy Map                                                      |
| `apps/live/hooks/canvas/useBoxedDragHandlers.ts`             | A drag carries the subtree (`withMindSubtrees`)                                     |
| `apps/live/components/canvas/element-variant.ts`             | The canvas corner radius                                                            |
| `apps/live/hooks/canvas/useEditorViewport.ts`                | `scrollIntoView` with a side margin                                                 |
| `packages/templates/src/template-builders-mindmaps.ts`       | The three live mind-map templates                                                   |

## Domain and naming

| Term           | Identifier                                  | Meaning                                                           |
| -------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| Mind node      | `shape: 'mind-node'`, `isMindNode`          | The element kind                                                  |
| Parent pointer | `mindParentId`                              | The owning node's id; absent or dangling means a root             |
| Root           | `mindRootOf(elements, node)`                | The topmost node reachable by parent pointers                     |
| Tree / map     | `mindTrees` (internal), `treeIds`           | A root and every node under it                                    |
| Children       | `mindChildren(elements, id)`                | Direct children, document order                                   |
| Subtree        | `mindSubtree(elements, id)`                 | Every node under `id`, excluding it                               |
| Flow           | `MindFlow`: `tree balanced downward bubble` | The shape a map grows in, stored on the root                      |
| Tidy map       | `isMindTreeTidy(elements, rootId, flow)`    | Every node within `MIND_TIDY_TOLERANCE` of its laid-out slot      |
| Layout         | `MindLayout`, `layoutMindTree`              | Top-left per node of one map, laid out in a flow                  |
| Order hint     | `MindOrderHint = { id, after? }`            | Where a node not yet drawn slots into its siblings                |
| Growth plan    | `MindGrowthPlan`                            | New node, connector, moves, re-anchored connectors, looks to copy |
| Move           | `MindMove = { id, x, y }`                   | An existing node's new top-left                                   |
| Shift          | `MindShift = { id, dy }`                    | A downward slide of another tree's node (`makeRoom`)              |
| Relayout       | `MindRelayout`, `relayoutMindMap`           | Tidy Map or a flow change for one map                             |
| Level look     | `mindStyleSource`                           | The node whose look a new node copies                             |
| Outward        | `outwardAngle(parent, node)`                | The direction a branch already runs, radians                      |
| Relation       | `'child' \| 'sibling'`                      | What Tab / Enter asks for                                         |
| Handoff        | `beginMindHandoff`, `HandoffSegment`        | Keys held for a node whose editor has not mounted                 |
| Abandon        | `abandonMindNode`                           | Escape removing an empty new leaf                                 |

Banned synonyms: "branch" as an identifier (fine in prose for a subtree), "layout" for a flow (a
flow is the shape; the layout is where one flow puts the nodes; Auto Layout is a different
feature), "topic", "bubble" for a node, "relayout" for growth.

## Behaviour and state

Every plan is a pure function of the element list; the editor applies it in one commit.

### Planning a growth (`planMindGrowth(elements, fromId, kind, ids)`)

1. **Source.** `from` must be a mind node, else `null`. `parent` is `from` for a child and
   `from`'s parent for a sibling.
2. **New root.** No parent (Enter on a root, or a dangling pointer): `growMindSibling` gives a
   root at `x = from.x` and `y` one `MIND_SIBLING_GAP_Y` below the lowest of `from`'s bottom
   and the bottom of every tree overlapping `[from.x, from.x + width)`; `from`'s size, no arrow,
   no moves, `styleFrom: from`, no `mindFlow` (`D30`). Nothing else below applies.
3. **Level look** (`mindStyleSource(elements, parent, from)`): a sibling (the one Enter was
   pressed on, else the last child), else the first node at the same depth in the map
   (breadth-first), else the parent, except that a root's first child gets `null`, the element
   defaults (`D134`).
4. **Size.** `styleFrom`'s size; with `null`, `min(250, parent.width)` × `min(80, parent.height)`
   (`D133`).
5. **Flow.** `mindFlowOf(elements, parent)`: the root's `mindFlow` if valid, else `'tree'`.
6. **Tidy growth**, when `isMindTreeTidy(elements, root.id, flow)`:
   - `layoutMindTree([...elements, base], root.id, flow, { id, after })`, `after = from.id` for a
     sibling and absent for a child; the new node takes its slot.
   - Moves: every node of the map not at its slot (the root never moves).
   - `makeRoom(elements, mapIds, [node, ...moved rects])`: other trees slide down (below).
   - `reanchorMindConnectors` re-faces every parent-child connector of the map for the flow.
7. **Free placement**, otherwise (`nextMindChildPosition`): the natural slot (`placeMindChild`),
   with `subtree = mindSubtree(parent)` and `children = mindChildren(parent)`:
   - **tree:** `x = parent.x + parent.width + MIND_CHILD_GAP_X`; `y` centred on the parent when
     the subtree is empty [QA14], else `bottom(subtree) + MIND_SIBLING_GAP_Y`. Axis `y`.
   - **downward:** `y = parent.y + parent.height + MIND_CHILD_GAP_Y` (`D26`); `x` centred when
     empty, else `right(subtree) + MIND_SIBLING_GAP_Y`. Axis `x`.
   - **balanced:** side is left when `outward === 0` and the child count is odd, or when
     `cos(outward) < 0` (`D27`); `x` mirrors the tree rule on that side; `y` stacks against the
     same-side part of the subtree only. Axis `y`.
   - **bubble:** index `k = children.length`, step `ceil(k / 2) * (k odd ? 1 : -1)`, angle
     `outward + step * BUBBLE_STEP`, radius `hypot(parent) / 2 + MIND_CHILD_GAP_X + hypot(node) / 2`
     (`D28`). Axis `y`.
   - **Give way inside its own tree** (`clearOfFixedNodes`): while the slot overlaps a node of the
     same tree, move it past that node along the axis, plus `MIND_SIBLING_GAP_Y`; at most
     `blockers.length + 1` passes. A bubble slot that lands on a sibling therefore moves down.
   - `makeRoom(elements, treeIds(parent), node)`: other trees slide down; the own tree never
     moves.
8. **Making room** (`makeRoom`): the other trees, sorted by top edge, each slide **down** (never
   sideways) just past every obstacle they overlap, starting from the growth's rects; a moved tree
   becomes an obstacle for the ones below [QA13]. Trees holding a locked node do not move; the
   growth gives way instead [GA10]. Non-mind elements are neither obstacles nor moved (`D29`).
9. **Connector.** `mindConnectorAnchors(flow, parentAt, node)`, with the parent at its laid-out
   position: tree and balanced join east-west by the side the child is on, downward south-north,
   bubble asks `bestAnchorTowards` for both ends. `connectorStyleFrom` is the connector to the
   first child that has one, else the parent's own connector in (`D135`).

### Tidy layout (`layoutMindTree(elements, rootId, flow, hint?, orderFlow = flow)`)

- The root keeps its position; every other position is rounded, so a laid-out map is a fixed
  point and reads back as tidy (I5).
- **Sibling order** is read from the drawing in `orderFlow` (`orderKeyFor`): centre `y` for tree
  and balanced, centre `x` for downward, and for bubble the clockwise angle around the root from
  the seam opposite the parent's direction (`BUBBLE_SEAM`, west for the root's children). Ties
  keep document order (`D140`). A hinted node goes after `hint.after`, else at the end.
- **Stacked flows** (`stackLayout`): levels run along `x` (tree, balanced) or `y` (downward), one
  `MIND_CHILD_GAP_X` / `MIND_CHILD_GAP_Y` apart; a subtree's span across the axis is the larger of
  its own extent and its children's spans plus `MIND_SIBLING_GAP_Y` between them; every parent is
  centred on its children's block.
- **Balanced sides** (`balancedSides`): read from where each branch is drawn (centre `x` against
  the root's); on a switch to balanced from another flow, each root child is dealt to the side
  with less total node height, a tie going right (`D136`). A hinted node joins the side of
  `after`, else the side with less.
- **Bubble** (`bubbleLayout`): the root's children share the full circle equally, clockwise from
  the seam; deeper wedges split their parent's by leaf count; each depth sits on one ring around
  the root, radius `max(clear, around)` (`D137`).

### Applying a growth (`growMindNode(id, kind, label?)`)

1. Guard: `!editsBlocked` [GA10].
2. `planMindGrowth(activeTab.elements, id, kind, { node, arrow })`, ids minted by
   `crypto.randomUUID()`; `null` does nothing. The plan reads the tab as it stands in the commit
   [QA19].
3. **Dress** the node: `deriveNewBoxedColours` against the tab's theme, the tab's
   `defaultTextSize`, then `paintableBoxedFields(styleFrom)` on top.
4. **Connector look:** `paintableArrowFields(connectorStyleFrom)`, else `MIND_CONNECTOR_LOOK`
   (`arrowEnds: 'none'`, `arrowStyle: 'curved'`).
5. **One commit** (`commitTabs`, active tab, `templateChosen: true`): write `label` on `id` when
   given, `applyMindMoves` (positions and connector faces as patches over the elements in the
   commit), then append the node and its connector.
6. Select the node, `setEditingId(node.id)`, `beginMindHandoff(node.id, handoffActions)`, and
   `scrollIntoView(node, { sideMargin: MIND_REVEAL_SIDE_MARGIN })` (`D139`).
7. `console.debug('[mind-grow] ...')`, `track('Element', 'Added', 'MindNode')`.

### Typing ahead (`apps/live/lib/mind-handoff.ts`)

States: **idle** (no pending handoff), **capturing** (pending for a node id), **carrying**
(pending, id `null`: the keys belong to a node not yet grown).

1. `beginMindHandoff(id, actions)`: releases any pending handoff; a carrying one hands its segments
   on, a capturing one never claimed `settle`s its first segment's text. Adds a capture-phase
   `keydown` listener on `window` and a `MIND_HANDOFF_TIMEOUT_MS` timer.
2. Each key (`applyHandoffKey`): Cmd / Ctrl / Alt and IME composition pass through; after Escape
   everything passes. Tab ends the open segment as `child`, Enter (no Shift) as `sibling`, each
   opening a new segment; Shift+Enter appends a newline; Escape ends it as `escape`; Backspace
   deletes; a one-character key appends; any other key is swallowed (`D138`). A taken key is
   `preventDefault` + `stopImmediatePropagation`.
3. `claimMindHandoff(id)`, from the new label editor's mount (`useMindLabelKeys`):
   - no handoff for `id`: `null`, edit as normal;
   - first segment ended by Tab / Enter: carrying, the rest stays queued, and a task later
     `actions.grow(id, end, text)` writes the label and grows the next node in one commit; the
     editor closes without committing;
   - ended by Escape: released; a task later an empty text abandons the node, else settles it;
   - still open: released; the editor types the text in and carries on.
4. Timeout: release and settle the first segment's text on the label (`[mind-handoff] unclaimed`).

### Keys

| Where                            | Key         | Result                                         |
| -------------------------------- | ----------- | ---------------------------------------------- |
| Canvas, one mind node, no editor | Tab         | Child                                          |
| Canvas, one mind node, no editor | Enter       | Sibling                                        |
| Canvas                           | Shift+Tab   | Element traversal (`useCanvasA11y`)            |
| Label editor on a mind node      | Tab         | Commit label, then child                       |
| Label editor on a mind node      | Enter       | Commit label, then sibling                     |
| Label editor on a mind node      | Shift+Enter | Newline                                        |
| Label editor on a mind node      | Escape      | Commit; an empty new leaf is abandoned instead |
| Label editor on a mind node      | Shift+Tab   | Nothing mind-specific [GA9]                    |
| Between growth and editor mount  | any         | Captured by the handoff (typing ahead, above)  |

Canvas guards: not in a text field, no modifier, no Shift, not read-only, `editingId === null`,
exactly one selected element (`D32`), `canGrowMindNode`. `useCanvasA11y` returns early for plain
Tab when `ownsTabKey(selectedId)`; `ownsTabKey` is `canGrowMindNode`.

### Toolbar and ring

- **Toolbar:** Add child and Add sibling (`MIND_CHILD_OPTION` / `MIND_SIBLING_OPTION` labels and
  hover cards) after Edit text, passed only when `!readOnly && !selectedLocked` and the selection
  is a mind node.
- **Ring:** `showPlus` is false on a locked element, read-only and a locked tab; on a mind node
  with a grower the ring leads with the two options, then the standard ones.

### Escape on an empty new leaf (`abandonMindNode(id)`)

Guards: not `editsBlocked`; a mind node with a parent and no children; its label empty now and at
the edit's start (`useMindLabelKeys`). One commit removes the node and every arrow pinned to it;
if the map was tidy before, `relayoutMindMap(next, root.id)` closes the gap in the same commit.
The editor closes, the parent is selected, `track('Element', 'Deleted', 'MindNode')`.

### Flow pick and Tidy Map (`useMindMapSetters`)

Inside one commit: the roots of every selected mind node, once each; per root
`relayoutMindMap(next, rootId, flow?)` with sibling order read in the current flow, its moves and
re-anchors applied, other trees pushed down by `makeRoom`, and `mindFlow` written on the root when
a flow is picked. Logs `[mind-layout] relayout`; tracks `Element·Changed·MindFlow` or
`Element·Changed·MindTidy`.

### Edit Outline (`useMindOutline`)

`canEdit(id)`: not `editsBlocked`, the tab unlocked, and `id` a mind node that is its own
`mindRootOf`. Opening tracks `UI·Opened·MindOutline`; the dialog takes
`mindOutlineText(elements, rootId, mindFlowOf(root))`. Save parses with `parseMindOutline` (null:
Save disabled), then `applyMindOutline` matches lines to nodes in three passes (same text under the
same parent; else the same text anywhere in the map, a move; else the same place under the same
parent, a rename), removes unmatched nodes and every arrow pinned to them, creates new nodes dressed
by `dressMindNode` from their level's look, and re-lays out with `relayoutMindMap(next, rootId,
undefined, order)` where `order` is the outline's line order. Null (no change) commits nothing.
Otherwise one commit, `[mind-outline] saved root=`, `track('Element', 'Changed', 'MindOutline')`.
Removals ask first in the dialog (`summariseMindOutline(...).removed`).

### Moving a branch

A drag of a mind node carries its whole subtree: the drag set is
`withMindSubtrees(elements, withFrameContents(elements, ids))`. A resize touches one node.

### Delete

Deleting a node removes its arrows (existing arrow cleanup) and nothing else; its children keep a
dangling `mindParentId`, so they are roots, with the default `tree` flow [QA18].

Invariants:

- **I1:** free placement never moves a node of the tree it grows in; no growth moves the root.
- **I2:** a growth, an abandon and a relayout are each one commit: nodes, connectors and moves
  together.
- **I3:** every walk terminates on a cyclic `mindParentId` (seen-sets) (`D31`).
- **I4:** the flow is read only from the root.
- **I5:** `layoutMindTree` is a fixed point: a map just laid out is tidy.

## Interfaces and contracts

```ts
// packages/document/src/element-types.ts (ShapeElement)
mindParentId?: ElementId;
mindFlow?: MindFlow;

// packages/document/src/mind-flow.ts
export type MindFlow = 'tree' | 'balanced' | 'downward' | 'bubble';
export const MIND_FLOWS: readonly MindFlow[];
export const DEFAULT_MIND_FLOW: MindFlow; // 'tree'
export const MIND_CONNECTOR_LOOK = { arrowEnds: 'none', arrowStyle: 'curved' } as const;
export const MIND_CHILD_GAP_X = 64;
export const MIND_SIBLING_GAP_Y = 18;
export const MIND_CHILD_GAP_Y = MIND_SIBLING_GAP_Y + MIND_CHILD_GAP_X / 2; // 50
export type MindPlacement = { x: number; y: number; axis: 'x' | 'y' };
export function placeMindChild(
  flow: MindFlow,
  parent: ShapeElement,
  size: { width: number; height: number },
  subtree: readonly ShapeElement[],
  children: readonly ShapeElement[],
  outward: number,
): MindPlacement;
export function mindConnectorAnchors(
  flow: MindFlow,
  parent: ShapeElement,
  child: ShapeElement,
): [Anchor, Anchor];

// packages/document/src/mind-map.ts
export type MindShift = { id: ElementId; dy: number };
export function makeRoom(
  elements: Element[],
  fixed: Set<ElementId>,
  room: Rect | readonly Rect[],
): MindShift[];
export function nextMindChildPosition(
  elements: Element[],
  parent: ShapeElement,
  size: { width: number; height: number },
): { x: number; y: number };
export function growMindSibling(elements: Element[], node: ShapeElement): MindGrowth;
export function mindRootOf(elements: Element[], node: ShapeElement): ShapeElement;
export function mindFlowOf(elements: Element[], node: ShapeElement): MindFlow;

// packages/document/src/mind-layout.ts
export const MIND_TIDY_TOLERANCE = 1;
export type MindOrderHint = { id: ElementId; after?: ElementId };
export type MindLayout = Map<ElementId, { x: number; y: number }>;
export function layoutMindTree(
  elements: Element[],
  rootId: ElementId,
  flow: MindFlow,
  hint?: MindOrderHint,
  orderFlow?: MindFlow,
): MindLayout;
export function isMindTreeTidy(elements: Element[], rootId: ElementId, flow: MindFlow): boolean;

// packages/document/src/mind-grow.ts
export type MindMove = { id: ElementId; x: number; y: number };
export type MindGrowthPlan = {
  node: ShapeElement;
  arrow: ArrowElement | null;
  moves: MindMove[];
  reanchored: ArrowElement[];
  styleFrom: ShapeElement | null;
  connectorStyleFrom: ArrowElement | null;
};
export function planMindGrowth(
  elements: Element[],
  fromId: ElementId,
  kind: 'child' | 'sibling',
  ids: { node: ElementId; arrow: ElementId },
): MindGrowthPlan | null;
export function relayoutMindMap(
  elements: Element[],
  nodeId: ElementId,
  flow?: MindFlow,
): MindRelayout | null;
export function applyMindMoves(
  elements: Element[],
  moves: readonly MindMove[],
  reanchored?: readonly ArrowElement[],
): Element[];

// apps/live/lib/mind-handoff.ts
export const MIND_HANDOFF_TIMEOUT_MS = 1500;
export function beginMindHandoff(id: string, actions: HandoffActions): void;
export function claimMindHandoff(
  id: string,
): null | { type: 'text'; text: string } | { type: 'finished' };
```

Validation: `mindParentId`, when present, is a string (a dangling id is legal); `mindFlow`, when
present, is one of `MIND_FLOWS`, else the element and its tab are rejected (`invalid tab`, 400).
`mindFlow` on a non-root is stored and ignored [QA17].

## Data and persistence

| Field          | Class     | Notes                                                     |
| -------------- | --------- | --------------------------------------------------------- |
| `mindParentId` | persisted | Remapped by `duplicate.ts` when the parent is copied too  |
| `mindFlow`     | persisted | Meaningful on a root only                                 |
| Connector      | persisted | An ordinary pinned `ArrowElement`, no mind-specific field |
| Handoff queue  | ephemeral | Module state in `mind-handoff.ts`, one per window         |

No migration: absent fields mean root and `tree`. Tidiness is derived, never stored.

## Errors and edge cases

| #   | Case                                   | Handling                                                         |
| --- | -------------------------------------- | ---------------------------------------------------------------- |
| E1  | Dangling `mindParentId`                | A root; Enter makes another root                                 |
| E2  | Cyclic `mindParentId`                  | Walks stop at the first repeat (I3)                              |
| E3  | Invalid stored `mindFlow`              | Rejected on write; `mindFlowOf` defaults to `tree` on read       |
| E4  | Cousin in the same tree holds the slot | Free placement: the new node moves along the flow axis           |
| E5  | Another tree holds the slot            | That tree slides down, cascading [QA13]                          |
| E6  | A locked tree or node in the way       | Treated as fixed; the growth gives way [GA10]                    |
| E7  | A non-mind element holds the slot      | Ignored; the node may overlap it (`D29`)                         |
| E8  | Bubble child past ±150° (free)         | Lands on or behind a sibling, then gives way downward            |
| E9  | Several nodes selected                 | Tab / Enter do not grow (`D32`)                                  |
| E10 | Read-only, share view, embed, export   | No grower: `canGrowMindNode` false, no ring or toolbar options   |
| E11 | Keys typed before the editor mounts    | Held by the handoff and replayed or finished in order            |
| E12 | Handoff never claimed (peer deleted)   | After `MIND_HANDOFF_TIMEOUT_MS` the text is written to the label |
| E13 | Escape on an empty new leaf            | Removed with its connector; a tidy map closes the gap            |
| E14 | Map dragged out of tidy                | Growth falls back to free placement until Tidy Map               |
| E15 | Two growths from one rendered frame    | Each plans against the tab in its own commit [QA19]              |
| E16 | Round node wanted                      | Radius from `borderRadius`; offered only via templates [QA20]    |

## Security and trust

No new trust boundary: growth builds ordinary elements that pass `isValidTab` at the api. The
walks are iterative, so a hostile `mindParentId` graph cannot exhaust the stack. The handoff
listener only reads keys while a growth it opened is pending, and lets modified keys through.

## Performance and limits

- `mindRootOf` is `O(depth * n)` (a `find` per step); `mindTrees` calls it per node, so free
  placement is `O(n^2)` worst case. `isMindTreeTidy` and `layoutMindTree` run `mindChildren` (an
  `O(n)` filter) per map node, `O(n * m)` for a map of `m` nodes; `mindStyleSource`'s cousin search
  is `O(m * depth * n)`. At `MAX_ELEMENTS_PER_TAB` (10 000) that is too slow for a keystroke;
  real maps are hundreds of nodes, where it is well under a frame. A parent-index map would make
  each `O(n)`. Not covered.
- `makeRoom` is `O(t^2)` in trees `t`.

## Presentation and UX

- Palette: tile `tools:mind-node` in the Build tab; drops 250 × 80.
- Shape: CSS box with `BORDER_RADIUS_PX[borderRadius]` when set, else 12px
  (`element-variant.ts`); export `rx` is the same, capped at half the shorter side.
- The Radius control does not offer mind nodes (`supportsBorderRadius`), so a round node comes
  from a template or the format painter [QA20].
- Toolbar: Add child and Add sibling after Edit text, each naming its shortcut in its hover card.
- Ring: a selected mind node's quick-connect ring leads with "Add child" ("Shortcut: Tab.") and
  "Add sibling" ("Shortcut: Enter."), then the standard options.
- Menu: "Mind Map" section with `MindFlowTiles` (Tree, Balanced, Downward, Bubble, with
  `MIND_FLOW_HINT` hints) and Tidy Map.
- After growth the new node is selected, in label editing, and scrolled clear of the side panels.
- Templates: `mindmap` (bubble, a round root, four branches of two leaves), `mindmap-tree` (tree,
  a bold root, four tinted branches, two small leaves each), `mindmap-bubble` (bubble, round
  nodes, one ring), built by `buildMindTemplate` with parent pointers, the root's `mindFlow`,
  `layoutMindTree` and `MIND_CONNECTOR_LOOK` connectors.

## Accessibility

- Every growth action is reachable by keyboard (Tab / Enter), toolbar button and ring option.
- Shift+Tab keeps element traversal on the canvas; inside the label editor it grows nothing [GA9].
- Hover cards name the shortcuts. Scrolling a grown node into view is the only motion.

## Web experience

One commit per keystroke; the label editor opens on the new node in the same interaction, and
keys typed before it mounts are held, not dropped (INP).

## Observability

| Fingerprint                                                  | Where                  | When                              |
| ------------------------------------------------------------ | ---------------------- | --------------------------------- |
| `[mind-grow] <kind> from= node= moves= style=level\|default` | `useMindGrowth.ts`     | Every applied growth              |
| `[mind-handoff] begin id= carried=`                          | `mind-handoff.ts`      | A handoff opens                   |
| `[mind-handoff] claim id= chars= end= queued=`               | `mind-handoff.ts`      | The new editor claims it          |
| `[mind-handoff] unclaimed id= timeout=`                      | `mind-handoff.ts`      | The timeout settles it            |
| `[mind-layout] relayout root= flow= moves=`                  | `useMindMapSetters.ts` | Tidy Map or a flow pick, per root |
| `[mind-outline] saved root=`                                 | `useMindOutline.ts`    | An outline save changed the map   |

Abandon, the canvas key guards and `makeRoom` emit nothing [GA1].

## Testing

| Rule                                            | Test                                                                                                     | File                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Children / subtree walks, cycle-safe (I3)       | mindChildren; mindSubtree (terminates on a cycle)                                                        | `packages/document/src/mind-map.test.ts`                      |
| Free: first child right, centred [QA14]         | puts a first child to the right, vertically centred on the parent                                        | `packages/document/src/mind-map.test.ts`                      |
| Free: stack against the subtree                 | stacks a second child; clears a GRANDCHILD                                                               | `packages/document/src/mind-map.test.ts`                      |
| Free: cousin in own tree gives way (I1)         | gives way to a cousin in the same tree, which cannot be moved                                            | `packages/document/src/mind-map.test.ts`                      |
| Root sibling at the end of the column           | growMindSibling (six cases)                                                                              | `packages/document/src/mind-map.test.ts`                      |
| Make room: whole tree, cascade, own tree fixed  | making room (four cases)                                                                                 | `packages/document/src/mind-map.test.ts`                      |
| Tidy growth: centred, root fixed, sibling after | planMindGrowth: a tidy map stays tidy (five cases)                                                       | `packages/document/src/mind-grow.test.ts`                     |
| Growth is one plan (I2)                         | lands the growth as moves in the same plan, not a second step                                            | `packages/document/src/mind-grow.test.ts`                     |
| Hand-arranged map: free placement               | planMindGrowth: a hand-arranged map (two cases)                                                          | `packages/document/src/mind-grow.test.ts`                     |
| Level look and connector look                   | planMindGrowth: the level look (five cases)                                                              | `packages/document/src/mind-grow.test.ts`                     |
| Connector faces by flow; root has none          | planMindGrowth: connectors (three cases)                                                                 | `packages/document/src/mind-grow.test.ts`                     |
| Tidy Map and a flow change                      | relayoutMindMap (two cases)                                                                              | `packages/document/src/mind-grow.test.ts`                     |
| A drag carries the branch                       | withMindSubtrees (two cases)                                                                             | `packages/document/src/mind-grow.test.ts`                     |
| Tidy layout per flow, fixed point (I5)          | layoutMindTree: tree flow; other flows                                                                   | `packages/document/src/mind-layout.test.ts`                   |
| Tidiness check                                  | isMindTreeTidy (three cases)                                                                             | `packages/document/src/mind-layout.test.ts`                   |
| Re-anchoring                                    | reanchorMindConnectors (three cases)                                                                     | `packages/document/src/mind-layout.test.ts`                   |
| Four flows, read from the root (I4)             | mind flows (tree, downward, balanced, bubble)                                                            | `packages/document/src/mind-flow.test.ts`                     |
| Edit Outline: write, parse, match, apply        | mindOutlineText; parseMindOutline; applyMindOutline                                                      | `packages/document/src/mind-outline.test.ts`                  |
| Edit Outline dialog: indent, save, confirm      | MindOutlineDialog (five cases)                                                                           | `apps/live/components/dialogs/MindOutlineDialog.test.tsx`     |
| Typing ahead                                    | applyHandoffKey; beginMindHandoff / claimMindHandoff                                                     | `apps/live/lib/mind-handoff.test.ts`                          |
| Toolbar buttons on a mind node only             | SelectionPopover mind-node growth (two cases)                                                            | `apps/live/components/canvas/SelectionPopover.test.tsx`       |
| Traversal stands aside for plain Tab only       | useCanvasA11y Tab ownership                                                                              | `apps/live/hooks/canvas/useCanvasA11y.tab-ownership.test.tsx` |
| Copy re-parents children                        | re-parents a copied mind child onto its copied parent; leaves a mind parent OUTSIDE the copied set alone | `packages/document/src/factories.test.ts`                     |
| Duplicate re-parents                            | re-parents a copied mind-map child onto the copied parent                                                | `apps/live/hooks/canvas/useElementDuplication.test.tsx`       |
| Export rounds the node                          | rounds a mind node the way the canvas does                                                               | `packages/document/src/svg-render.test.ts`                    |
| Canvas Tab / Enter grow, guards                 | none [GA14]                                                                                              |                                                               |
| Editor Tab / Enter commit then grow; Escape     | none [GA14]                                                                                              |                                                               |
| Ring leads with the two options                 | none [GA14]                                                                                              |                                                               |
| Flow set and relayout once per root             | none [GA14]                                                                                              |                                                               |
| Abandon removes the leaf, re-tidies             | none [GA14]                                                                                              |                                                               |
| Delete leaves orphans as roots                  | none [GA14]                                                                                              |                                                               |
| Templates are tidy, live maps                   | none [GA14]                                                                                              |                                                               |

## Constants and configuration

| Name                      | Value    | Provenance / safe range                                         |
| ------------------------- | -------- | --------------------------------------------------------------- |
| `MIND_CHILD_GAP_X`        | 64       | Parent to child along the flow; 32 to 120                       |
| `MIND_SIBLING_GAP_Y`      | 18       | Between stacked siblings and shifted trees; 8 to 40             |
| `MIND_CHILD_GAP_Y`        | 50       | Parent to child in the downward flow; derived                   |
| `BUBBLE_STEP`             | 50°      | Free-placement fan step; 30° to 60° (`mind-flow.ts`, private)   |
| `BUBBLE_SEAM`             | π (west) | Where the tidy bubble circle starts (`mind-layout.ts`, private) |
| `MIND_TIDY_TOLERANCE`     | 1        | Rounding is the only drift a tidy map has; fixed                |
| `MIND_HANDOFF_TIMEOUT_MS` | 1500     | Longer than any render, short enough to go unnoticed; 500+      |
| `MIND_REVEAL_SIDE_MARGIN` | 300      | Screen px clear of the side panels (`useMindGrowth.ts`)         |
| `DEFAULT_MIND_FLOW`       | `'tree'` | Maps drawn before flows keep their shape                        |
| Default size              | 250 × 80 | `SHAPE_DEFAULT_SIZE['mind-node']`; a phrase fits                |
| Corner radius             | 12px     | Canvas and export, when `borderRadius` is unset                 |

Telemetry: `Element·Added·MindNode` per growth, `Element·Deleted·MindNode` per abandon,
`Element·Changed·MindFlow` and `Element·Changed·MindTidy` from the menu.
