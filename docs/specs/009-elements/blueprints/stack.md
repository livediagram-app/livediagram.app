# Stack: blueprint

Derived from [The stack](../stack.md). Defaults in [DEFAULTS.md](DEFAULTS.md) as `Dn`.

| File                                                | Role                                                   |
| --------------------------------------------------- | ------------------------------------------------------ |
| `packages/document/src/stack.ts`                    | Fields, bounds, children, the layout, `settleStacks`   |
| `packages/document/src/containment.ts`              | `stack` joins `CONTAINER_KINDS`                        |
| `apps/live/lib/settle-tabs.ts`                      | Settles stacks per changed tab (before chips and keys) |
| `packages/document/src/stored-tab.ts`               | Settles stacks on read                                 |
| `apps/live/components/palette/StackMenuSection.tsx` | Arrangement, columns, gap, padding, align              |
| `apps/live/app/canvas-motion.css`                   | The reflow glide                                       |

## Domain and naming

| Term        | Identifier                                    | Meaning                                                 |
| ----------- | --------------------------------------------- | ------------------------------------------------------- |
| Stack       | `shape: 'stack'`, `isStack`                   | The element                                             |
| Arrangement | `stackDirection: 'row' \| 'column' \| 'grid'` | Absent = row                                            |
| Children    | `stackChildren(elements, stack)`              | Elements whose derived container is the stack, in order |

## Behaviour and state

- `stackChildren(elements, stack)`: `deriveContainers(elements).get(id) === stack.id`, boxed, not arrows; sorted by
  centre: row by x (then y), column by y (then x), grid by row band then x, a row band being centres within half the
  tallest child's height of each other.
- `layoutStack(stack, children)`: with `g = gap`, `p = padding`:
  - Row: `x` runs from `stack.x + p`, each child at the running `x`, then `x += w + g`; cross axis: `y = stack.y + p +
align(innerH - h)` where `innerH` is the tallest child; `width = p * 2 + Σw + g * (n - 1)`, `height = p * 2 + innerH`.
  - Column: the same on the other axis.
  - Grid with `c` columns: cell `cw = max w`, `ch = max h`; child `i` at column `i % c`, row `floor(i / c)`, placed at
    the cell origin plus `align` in both axes; `width = p * 2 + c' * cw + g * (c' - 1)` with `c' = min(c, n)`, height
    likewise over the rows.
  - `align(free)`: start 0, centre `free / 2`, end `free`. Every position rounds to a whole pixel.
  - A titled stack (non-empty label) lays its body out `STACK_TITLE_H` (22) lower and adds 22 to its height.
- `settleStacks(elements)`: stacks innermost first (ascending area); for each with children, write each child's new
  `x / y` (moving its own children, attached chips and pointer notes by the same delta, as a drag would) and the
  stack's hugged `width / height` (its `x / y` stay). An empty stack is untouched. Returns the input when nothing moved.

### Invariants

- I1: after a commit, every non-empty stack's children sit at `layoutStack` and the stack hugs them.
- I2: order follows position, so moving a child past a sibling reorders.
- I3: settling twice changes nothing.

## Interfaces and contracts

```ts
export type StackDirection = 'row' | 'column' | 'grid';
export type StackAlign = 'start' | 'center' | 'end';
export function isStack(el: Element): el is ShapeElement & { shape: 'stack' };
export function stackChildren(elements: readonly Element[], stack: ShapeElement): Boxed[];
export function layoutStack(
  stack: ShapeElement,
  children: readonly Box[],
): { width: number; height: number; at: { x: number; y: number }[] };
export function settleStacks(elements: Element[]): Element[];
```

Validation: direction and align one of their lists; columns an integer 2 to 6; gap and padding integers 0 to 64.

## Data and persistence

| Field                                                                      | Class           |
| -------------------------------------------------------------------------- | --------------- |
| `stackDirection`, `stackColumns`, `stackGap`, `stackPadding`, `stackAlign` | persisted       |
| Children's `x / y`, the stack's `width / height`                           | derived, stored |

## Errors and edge cases

| #   | Case                          | Handling                                                          |
| --- | ----------------------------- | ----------------------------------------------------------------- |
| E1  | A child bigger than the stack | Not contained (strictly greater area rule); it stays outside      |
| E2  | Locked child                  | Laid out like any other (the lock stops the user, not the layout) |
| E3  | Child is a container          | Moves with its own contents                                       |
| E4  | Rotated child                 | Laid out by its unrotated box                                     |

## Security and trust

Numbers bounded by validation; no text of its own beyond the label.

## Performance and limits

`deriveContainers` once per settle (O(n log n)); a tab with no stack costs one `some` scan. Measured in the perf test:
a 2,000-element board with 20 stacks of 10 settles within budget (`stack.perf.test.ts`).

## Presentation and UX

- Starting content (D192): 360 × 160 row, gap 16, padding 16, centre aligned, empty label; drawn with a 1 px dashed
  outline at 50% of the border colour and no fill.
- Reflow glide: elements carry `data-stacked` while a stack holds them; CSS transitions `left` and `top` over 160 ms
  ease-out, none under reduced motion or while dragging.

## Accessibility

Menu tiles named "Row Stack", "Column Stack", "Grid Stack", "Align Start / Centre / End"; sliders labelled.

## Observability

`Element·Added·Stack`; `Element·Changed·StackDirection`, `StackColumns`, `StackGap`, `StackPadding`, `StackAlign`.

## Testing

| Rule                              | Test file                                                |
| --------------------------------- | -------------------------------------------------------- |
| Children, layout per arrangement  | `packages/document/src/stack.test.ts`                    |
| Settle (I1 to I3), nesting, carry | same                                                     |
| Budget                            | `packages/document/src/stack.perf.test.ts`               |
| Menu section                      | `apps/live/components/palette/StackMenuSection.test.tsx` |

## Constants and configuration

| Name            | Value  | Provenance / safe range |
| --------------- | ------ | ----------------------- |
| Gap default     | 16     | D192; 0 to 64           |
| Padding default | 16     | D192; 0 to 64           |
| Columns default | 2      | D192; 2 to 6            |
| Glide           | 160 ms | D192                    |
