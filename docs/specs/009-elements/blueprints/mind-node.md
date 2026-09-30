# Mind node: blueprint

Derived from [The mind node](../mind-node.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `Dn`.

Scope, by file:

| File                                                         | Role                                                                  |
| ------------------------------------------------------------ | --------------------------------------------------------------------- |
| `packages/document/src/mind-map.ts`                           | Tree walks, placement, `makeRoom`, `growMindChild`, `growMindSibling` |
| `packages/document/src/mind-flow.ts`                          | `MindFlow`, per-flow placement, gaps                                  |
| `packages/document/src/anchor-choice.ts`                      | `bestAnchorTowards`: the connector's faces                            |
| `packages/document/src/shape-factory.ts`                      | `SHAPE_DEFAULT_SIZE['mind-node']` (250 × 80)                          |
| `packages/document/src/element-types.ts`                      | `mindParentId`, `mindFlow`                                            |
| `packages/document/src/validate.ts`                           | `mindParentId` is a string; `mindFlow` a known flow                   |
| `packages/document/src/duplicate.ts`                          | Re-parents copied children onto copied parents                        |
| `apps/live/app/document/[id]/useElementCreation.ts`           | `canGrowMindNode`, `growMindNode`                                     |
| `apps/live/app/document/[id]/useElementHelpers.ts`            | `placePrebuilt`: add + shifts in one commit                           |
| `apps/live/hooks/canvas/useEditorKeyboardShortcuts.ts`       | Tab / Enter on a selected node                                        |
| `apps/live/hooks/canvas/useCanvasA11y.ts`                    | `ownsTabKey`: traversal stands aside                                  |
| `apps/live/components/canvas/RichTextEditor.tsx`             | Tab / Enter inside the label editor                                   |
| `apps/live/components/canvas/MindGrowContext.tsx`            | `useMindGrow`: the grower, editor canvas only                         |
| `apps/live/components/canvas/quick-connect-options.tsx`      | `MIND_CHILD_OPTION`, `MIND_SIBLING_OPTION`                            |
| `apps/live/components/canvas/QuickConnectRing.tsx`           | Leads with the two growth options                                     |
| `apps/live/hooks/canvas/useDataShapeSetters.ts`              | `setMindFlowSelected`                                                 |
| `apps/live/components/palette/context-menu-data-editors.tsx` | `MindFlowTiles`                                                       |

## Domain and naming

| Term           | Identifier                                  | Meaning                                                 |
| -------------- | ------------------------------------------- | ------------------------------------------------------- |
| Mind node      | `shape: 'mind-node'`, `isMindNode`          | The element kind                                        |
| Parent pointer | `mindParentId`                              | The owning node's id; absent or dangling means a root   |
| Root           | `mindRootOf(elements, node)`                | The topmost node reachable by parent pointers           |
| Tree / map     | `mindTrees` (internal)                      | A root and every node under it                          |
| Children       | `mindChildren(elements, id)`                | Direct children, document order                         |
| Subtree        | `mindSubtree(elements, id)`                 | Every node under `id`, excluding it                     |
| Flow           | `MindFlow`: `tree balanced downward bubble` | The shape a map grows in, stored on the root            |
| Growth         | `MindGrowth = { node, arrow, shifts }`      | One grown node, its connector, and what moves to fit it |
| Shift          | `MindShift = { id, dy }`                    | A vertical move of an existing node                     |
| Outward        | `outwardAngle(parent, node)`                | The direction a branch already runs, radians            |
| Relation       | `'child' \| 'sibling'`                      | What Tab / Enter asks for                               |

Banned synonyms: "branch" as an identifier (fine in prose for a subtree), "layout" for a flow
(Auto Layout is a different feature), "topic", "bubble" for a node.

## Behaviour and state

Growth is a pure function of the element list; the editor applies its result in one commit.

### Growing a child (`growMindChild(elements, parent, sizeFrom = parent)`)

1. **Size.** The new node takes `sizeFrom`'s width and height [Q15].
2. **Flow.** `mindFlowOf(elements, parent)`: the root's `mindFlow` if valid, else `'tree'`.
3. **Natural slot** (`placeMindChild`), with `subtree = mindSubtree(parent)` and
   `children = mindChildren(parent)`:
   - **tree:** `x = parent.x + parent.width + MIND_CHILD_GAP_X`; `y` centred on the parent when the
     subtree is empty [Q14], else `bottom(subtree) + MIND_SIBLING_GAP_Y`. Axis `y`.
   - **downward:** `y = parent.y + parent.height + MIND_SIBLING_GAP_Y + MIND_CHILD_GAP_X / 2`
     (`DA23`); `x` centred when empty, else `right(subtree) + MIND_SIBLING_GAP_Y`. Axis `x`.
   - **balanced:** side is left when `outward === 0` and the child count is odd, or when
     `cos(outward) < 0` (`DA24`); `x` mirrors the tree rule on that side; `y` stacks against the
     same-side part of the subtree only. Axis `y`.
   - **bubble:** index `k = children.length`, step `ceil(k / 2) * (k odd ? 1 : -1)`, angle
     `outward + step * BUBBLE_STEP`, radius `hypot(parent) / 2 + MIND_CHILD_GAP_X + hypot(node) / 2`
     (`DA25`). When `|step * BUBBLE_STEP|` passes 150°, the next ring starts one node diagonal
     further out, so siblings never overlap [Q16]. Axis `y`.
4. **Give way inside its own tree** (`clearOfFixedNodes`): while the slot overlaps a node of the
   same tree, move it past that node along the flow's axis, plus `MIND_SIBLING_GAP_Y`. At most
   `blockers.length + 1` passes.
5. **Connector.** `createPinnedArrow(parent.id, from, node.id, to)` with
   `[from, to] = [bestAnchorTowards(parent, centre(node)), bestAnchorTowards(node, centre(parent))]`.
6. **Make room** (`makeRoom`): the other trees, sorted by top edge, each slide **down** (never
   sideways) just past any obstacle they overlap, starting from the new node's box; a moved tree
   becomes an obstacle for the ones below [Q13]. Trees holding a locked node do not move; the new
   node gives way instead [G10].

### Growing a sibling (`growMindSibling(elements, node)`)

- With a parent in the list: `growMindChild(elements, parent, node)`.
- Without one (a root, or a dangling pointer): a new root at `x = node.x`,
  `y = max(bottom of every tree overlapping [node.x, node.x + width), node bottom) +
MIND_SIBLING_GAP_Y`, no arrow, no shifts, no `mindFlow` (`DA27`).

### Applying a growth (`growMindNode(id, relation)`)

1. Guard: `!editsBlocked` and the element is a mind node.
2. `placePrebuilt([node, arrow?], node.id, shifts)`: theme colours and the tab's default text size
   on the node, shifts applied, all appended in one `commitTabs` updater against the current tab.
3. The node is selected and `setEditingId(node.id)` opens its label editor.
4. `track('Element', 'Added', 'MindNode')`.

### Keys

| Where                            | Key         | Result                              |
| -------------------------------- | ----------- | ----------------------------------- |
| Canvas, one mind node, no editor | Tab         | Child                               |
| Canvas, one mind node, no editor | Enter       | Sibling                             |
| Canvas                           | Shift+Tab   | Element traversal (`useCanvasA11y`) |
| Label editor on a mind node      | Tab         | Commit label, then child            |
| Label editor on a mind node      | Enter       | Commit label, then sibling          |
| Label editor on a mind node      | Shift+Enter | Newline                             |
| Label editor on a mind node      | Shift+Tab   | Nothing mind-specific [G9]          |

Canvas guards: not in a text field, no modifier, no Shift, not read-only, `editingId === null`,
exactly one selected element (`DA29`), `canGrowMindNode`. `useCanvasA11y` returns early for plain
Tab when `ownsTabKey(selectedId)`.

### Flow pick (`setMindFlowSelected(flow)`)

Inside one commit: collect the roots of every selected mind node, write `mindFlow` on each root
once; tracks `Element·Changed·MindFlow`.

### Delete

Deleting a node removes its arrows (existing arrow cleanup) and nothing else; its children keep a
dangling `mindParentId`, so they are roots, with the default `tree` flow [Q18].

Invariants:

- **I1:** a growth never moves a node of the tree it grows in.
- **I2:** a growth is one commit: add, connector and shifts together.
- **I3:** every walk terminates on a cyclic `mindParentId` (seen-sets) (`DA28`).
- **I4:** the flow is read only from the root.

## Interfaces and contracts

```ts
// packages/document/src/element-types.ts (ShapeElement)
mindParentId?: ElementId;
mindFlow?: MindFlow;

// packages/document/src/mind-flow.ts
export type MindFlow = 'tree' | 'balanced' | 'downward' | 'bubble';
export const MIND_FLOWS: readonly MindFlow[];
export const DEFAULT_MIND_FLOW: MindFlow; // 'tree'
export const MIND_CHILD_GAP_X = 64;
export const MIND_SIBLING_GAP_Y = 18;
export type MindPlacement = { x: number; y: number; axis: 'x' | 'y' };
export function placeMindChild(
  flow: MindFlow,
  parent: ShapeElement,
  size: { width: number; height: number },
  subtree: readonly ShapeElement[],
  children: readonly ShapeElement[],
  outward: number,
): MindPlacement;

// packages/document/src/mind-map.ts
export type MindGrowth = { node: ShapeElement; arrow: ArrowElement | null; shifts: MindShift[] };
export type MindShift = { id: ElementId; dy: number };
export function growMindChild(
  elements: Element[],
  parent: ShapeElement,
  sizeFrom?: ShapeElement,
): MindGrowth & { arrow: ArrowElement };
export function growMindSibling(elements: Element[], node: ShapeElement): MindGrowth;
export function mindRootOf(elements: Element[], node: ShapeElement): ShapeElement;
export function mindFlowOf(elements: Element[], node: ShapeElement): MindFlow;
```

Validation: `mindParentId`, when present, is a string (a dangling id is legal); `mindFlow`, when
present, is one of `MIND_FLOWS`, else the element and its tab are rejected (`invalid tab`, 400).
`mindFlow` on a non-root is stored and ignored [Q17].

## Data and persistence

| Field          | Class     | Notes                                                     |
| -------------- | --------- | --------------------------------------------------------- |
| `mindParentId` | persisted | Remapped by `duplicate.ts` when the parent is copied too  |
| `mindFlow`     | persisted | Meaningful on a root only                                 |
| Connector      | persisted | An ordinary pinned `ArrowElement`, no mind-specific field |

No migration: absent fields mean root and `tree`.

## Errors and edge cases

| #   | Case                                   | Handling                                                   |
| --- | -------------------------------------- | ---------------------------------------------------------- |
| E1  | Dangling `mindParentId`                | A root; Enter makes another root                           |
| E2  | Cyclic `mindParentId`                  | Walks stop at the first repeat (I3)                        |
| E3  | Invalid stored `mindFlow`              | Rejected on write; `mindFlowOf` defaults to `tree` on read |
| E4  | Cousin in the same tree holds the slot | The new node moves along the flow axis                     |
| E5  | Another tree holds the slot            | That tree slides down, cascading [Q13]                     |
| E6  | A locked tree holds the slot           | Treated as fixed; the new node gives way [G10]             |
| E7  | A non-mind element holds the slot      | Ignored; the node may overlap it (`DA26`)                  |
| E8  | Many bubble children                   | Second ring beyond ±150° [Q16]                             |
| E9  | Several nodes selected                 | Tab / Enter do not grow (`DA29`)                           |
| E10 | Read-only, share view, embed, export   | No grower: `canGrowMindNode` false, no ring options        |

## Security and trust

No new trust boundary: growth builds ordinary elements that pass `isValidTab` at the api. The
walks are iterative, so a hostile `mindParentId` graph cannot exhaust the stack.

## Performance and limits

- `mindRootOf` is `O(depth * n)` (a `find` per step); `mindTrees` calls it per node, so one growth
  is `O(n^2)` worst case. At `MAX_ELEMENTS_PER_TAB` (10 000) that is too slow for a keystroke;
  real maps are hundreds of nodes, where it is well under a frame. A parent-index map would make it
  `O(n)`. Not covered.
- `makeRoom` is `O(t^2)` in trees `t`.

## Presentation and UX

- Palette: tile `tools:mind-node` in the Build tab; drops 250 × 80.
- Shape: CSS box with a 12px radius (`element-variant.ts`), `rx="12"` in export.
- Ring: a selected mind node's quick-connect ring leads with "Add child" ("Shortcut: Tab.") and
  "Add sibling" ("Shortcut: Enter."), then the standard options.
- Menu: "Mind Map" section with `MindFlowTiles` (Tree, Balanced, Downward, Bubble, with
  `MIND_FLOW_HINT` hints).
- After growth the new node is selected and in label editing.

## Accessibility

- Every growth action is reachable by keyboard (Tab / Enter) and by pointer (the ring).
- Shift+Tab keeps element traversal on the canvas; inside the label editor it grows nothing [G9].
- Tooltips name the shortcuts. No motion is added.

## Web experience

One commit per keystroke; the label editor opens on the new node in the same interaction (INP).

## Observability

None in code today [G1].

## Testing

| Rule                                           | Test                                                           | File                                                          |
| ---------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| Children / subtree walks, cycle-safe (I3)      | mindChildren; mindSubtree (terminates on a cycle)              | `packages/document/src/mind-map.test.ts`                       |
| First child right, centred [Q14]               | puts a first child to the right, vertically centred            | `packages/document/src/mind-map.test.ts`                       |
| Stack against the subtree                      | stacks a second child; clears a GRANDCHILD                     | `packages/document/src/mind-map.test.ts`                       |
| Cousin in own tree: new node gives way (I1)    | gives way to a cousin in the same tree                         | `packages/document/src/mind-map.test.ts`                       |
| Connector east to west, pinned                 | parents the node and connects it east to west                  | `packages/document/src/mind-map.test.ts`                       |
| Sibling, root sibling at end of the column     | growMindSibling (five cases)                                   | `packages/document/src/mind-map.test.ts`                       |
| Size inheritance [Q15]                         | size inheritance (three cases)                                 | `packages/document/src/mind-map.test.ts`                       |
| Make room: whole tree, cascade, own tree fixed | making room (four cases)                                       | `packages/document/src/mind-map.test.ts`                       |
| Four flows, read from the root (I4)            | mind flows (tree, downward, balanced, bubble)                  | `packages/document/src/mind-flow.test.ts`                      |
| Traversal stands aside for plain Tab only      | useCanvasA11y Tab ownership                                    | `apps/live/hooks/canvas/useCanvasA11y.tab-ownership.test.tsx` |
| Copy re-parents children                       | re-parents a copied mind child; leaves an outside parent alone | `packages/document/src/factories.test.ts`                      |
| Duplicate re-parents                           | re-parents a copied mind-map child                             | `apps/live/hooks/canvas/useElementDuplication.test.tsx`       |
| Export rounds the node                         | rounds a mind node the way the canvas does                     | `packages/document/src/svg-render.test.ts`                     |
| Canvas Tab / Enter grow, guards                | none [G14]                                                     |                                                               |
| Editor Tab / Enter commit then grow            | none [G14]                                                     |                                                               |
| Ring leads with the two options                | none [G14]                                                     |                                                               |
| Flow set once per root                         | none [G14]                                                     |                                                               |
| One commit per growth (I2)                     | none [G14]                                                     |                                                               |
| Delete leaves orphans as roots                 | none [G14]                                                     |                                                               |
| Bubble second ring                             | none [Q16]                                                     |                                                               |

## Constants and configuration

| Name                 | Value    | Provenance / safe range                             |
| -------------------- | -------- | --------------------------------------------------- |
| `MIND_CHILD_GAP_X`   | 64       | Parent to child along the flow; 32 to 120           |
| `MIND_SIBLING_GAP_Y` | 18       | Between stacked siblings and shifted trees; 8 to 40 |
| `BUBBLE_STEP`        | 50°      | Fan step; 30° to 60° (`mind-flow.ts`, not exported) |
| `DEFAULT_MIND_FLOW`  | `'tree'` | Maps drawn before flows keep their shape            |
| Default size         | 250 × 80 | `SHAPE_DEFAULT_SIZE['mind-node']`; a phrase fits    |
| Corner radius        | 12px     | Canvas and export                                   |
