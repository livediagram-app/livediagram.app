# The Page element: blueprint

Derived from [The Page element](../page-element.md). The body's formatting is the label runs model
([Canvas and palette](../../008-canvas/canvas-and-palette.md)); headings in it follow
[The block-type picker](../block-type-picker.md). The spec decides; this file only adds engineering
precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and
cited as `DDn`.

Scope, by file:

| File                                                 | Role                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| `packages/document/src/shape-kind.ts`                 | `ShapeKind` includes `'page'`                                       |
| `packages/document/src/shape-factory.ts`              | `SHAPE_DEFAULT_SIZE.page`; `createShape('page')` defaults           |
| `packages/document/src/element-types.ts`              | `ShapeElement.pageTitle`, `pageSubtitle`                            |
| `packages/document/src/data-shapes.ts`                | `PAGE_HEADING_MAX`                                                  |
| `packages/document/src/validate.ts`                   | `'page'` in the kind vocabulary; `isHeadingStr` bound on both lines |
| `packages/document/src/svg-render-body.ts`            | `shapeHasBespokeBody('page')`; dispatches `svgPageMasthead`         |
| `packages/document/src/svg-render-data.ts`            | `svgPageMasthead`: export title, subtitle, rule                     |
| `packages/document/src/themes.ts`                     | `themeColourFields`: page exempt from theme applies [Q15]           |
| `apps/live/lib/themes.ts`                            | `deriveNewBoxedColours` returns a page's own colours                |
| `apps/live/components/canvas/shape-svg-overlay.tsx`  | `isSvgRenderedShape('page')` is false: CSS box path                 |
| `apps/live/components/canvas/ElementFaceRouter.tsx`  | Stacks `PageMasthead` over the body region                          |
| `apps/live/components/canvas/PageMasthead.tsx`       | The masthead: two `InlineTextLine`s over a hairline rule            |
| `apps/live/components/canvas/InlineTextLine.tsx`     | One plain line edited in place                                      |
| `apps/live/components/canvas/PageCornerFold.tsx`     | The turned-back corner                                              |
| `apps/live/components/canvas/BoxedElementView.tsx`   | Mounts the fold                                                     |
| `apps/live/hooks/canvas/useDataShapeSetters.ts`      | `setPageHeading`, `MASTHEAD_SHAPES`                                 |
| `apps/live/components/palette/palette-tile-defs.tsx` | Tile `tools:page`, `toolGroup: 'write'`                             |
| `apps/live/lib/export-tab-text.ts`                   | Markdown outline [Q13]                                              |

## Domain and naming

| Term     | Identifier                          | Meaning                                                 |
| -------- | ----------------------------------- | ------------------------------------------------------- |
| Page     | `ShapeElement` with `shape: 'page'` | One paper-shaped writing surface                        |
| Body     | `label` + `richText`                | The prose; `label` is the plain-text mirror             |
| Masthead | `PageMasthead`                      | Title and subtitle above the body, over a hairline rule |
| Title    | `pageTitle?: string`                | First masthead line; absent when empty                  |
| Subtitle | `pageSubtitle?: string`             | Second masthead line; absent when empty                 |
| Fold     | `PageCornerFold`                    | The bottom-right turned-back corner                     |

Banned synonyms: "document" for a page (`'document'` is the flowchart shape), "sheet" in code,
"header" (a web component, `site-header`), "heading" for the masthead title in code (`pageTitle`).

## Behaviour and state

### Create

1. The Write tile `tools:page` arms draw-to-size for `{ type: 'shape', kind: 'page' }`; a tap drops
   `SHAPE_DEFAULT_SIZE.page`, a drag sizes it.
2. `createShape('page', x, y)` sets `textAlignX: 'left'`, `textAlignY: 'top'`, `fillColor:
'#ffffff'`, `strokeColor: '#d4d4d8'`, `shadow: { offsetX: 0, offsetY: 2, blur: 8, opacity: 0.18 }`,
   `textSize: 'sm'` (DD16), `padding: 'lg'`. No `aspectLocked`.
3. `deriveNewBoxedColours` returns the page's own colours unchanged, before backdrop derivation and
   theme overrides.
4. `track('Element', 'Added', 'Page')` via `shapeTelemetryToken`.

### Theme applies

A theme switch, reset or recolour leaves a page's fill, stroke and text alone: `themeColourFields`
returns no fields for a page [Q15]. The user recolours a page from the menu.

### Render

- `isSvgRenderedShape('page')` is false, so the page draws on the CSS box path like `square`.
- `ElementFaceRouter` renders an `absolute inset-0` column padded by `PADDING_PX[padding]`: the
  masthead (`shrink-0`, `border-b`, `pb-2`), then a `relative flex-1` body region holding the label
  node with the horizontal padding cancelled so the label's own padding applies once.
- `PageCornerFold` draws at the bottom-right in element px.

### Body

- Double-click opens the shared label editor (`RichTextEditor`) on `label` / `richText`.
- Past the page's height the body clips at rest with a bottom fade, and scrolls while editing [Q12].

### Masthead editing

States per line: at rest, editing (`focus` → `editing = true`).

1. A line is editable when the page is neither locked nor viewed read-only (DD19); otherwise it is
   inert and a press falls through to the page.
2. On an editable line, `pointerdown` and `dblclick` stop propagation; every `keydown` stops
   propagation.
3. Enter commits (blur). Escape restores the stored value, then blurs.
4. Blur commits: collapse whitespace runs to one space, trim, truncate to `PAGE_HEADING_MAX`
   (DD18); call `onCommit` only when the value changed.
5. `setPageHeading(id, field, value)` commits through history on `MASTHEAD_SHAPES` only; an empty
   value stores `undefined`.
6. `track('Element', 'Changed', 'PageHeading')` on a committed change [Q16].
7. An empty line shows its placeholder ("Title" / "Subtitle") at 40% opacity (DD17), so the
   masthead keeps its height.

Invariants:

- **I1:** a stored `pageTitle` / `pageSubtitle` is non-empty and at most `PAGE_HEADING_MAX` chars.
- **I2:** the masthead occupies the same height whether its lines are empty or written.
- **I3:** a page never takes backdrop- or theme-derived colours.

## Interfaces and contracts

```ts
// packages/document/src/element-types.ts (ShapeElement, abridged)
pageTitle?: string;
pageSubtitle?: string;

// packages/document/src/data-shapes.ts
export const PAGE_HEADING_MAX = 200;

// packages/document/src/svg-render-data.ts
export function svgPageMasthead(el: Data, padding: number, fontFamily?: string): string;

// apps/live/hooks/canvas/useDataShapeSetters.ts
setPageHeading(elementId: string, field: 'pageTitle' | 'pageSubtitle', value: string): void;

// apps/live/components/canvas/InlineTextLine.tsx
export function InlineTextLine(props: {
  value: string;
  placeholder: string;
  editable: boolean;
  onCommit: (next: string) => void;
  zoom: number;
  maxLength: number;
  className?: string;
  style?: CSSProperties;
  ariaLabel: string;
}): JSX.Element;
```

`isValidElement` (via `isValidTab`) rejects a tab whose element carries a `pageTitle` or
`pageSubtitle` that is not a string of at most `PAGE_HEADING_MAX` chars; the rejection is the
existing invalid-tab response.

## Data and persistence

- **Persisted:** the shape fields, `label`, `richText`, `pageTitle`, `pageSubtitle`.
- **Never persisted:** a line's `editing` state; the fold (derived).
- **Migration:** none; a page without masthead fields renders placeholders.
- **SVG / PNG export:** the box (rect, `rx` 6, fill and stroke), the masthead via `svgPageMasthead`,
  then the body label [Q13]. The fold is not drawn.
- **Markdown export:** the page's title as the item, the body indented beneath it, one line per
  body line [Q13].

## Errors and edge cases

| #   | Case                                   | Handling                                                  |
| --- | -------------------------------------- | --------------------------------------------------------- |
| E1  | Title pasted over 200 chars            | Truncated at commit (DD18); validation rejects longer     |
| E2  | Rich text pasted into a masthead line  | `contentEditable="plaintext-only"` keeps it plain         |
| E3  | Newline typed or pasted in a line      | Enter commits; pasted newlines collapse to spaces         |
| E4  | Line cleared                           | Stored as `undefined`                                     |
| E5  | Page smaller than the fold             | Fold `min(22, w/2, h/2)`; hidden at ≤ 2px (DD20)          |
| E6  | Body longer than the page              | Clip with fade at rest, scroll in the editor [Q12]        |
| E7  | Page on a locked tab or read-only view | Masthead inert; body not editable                         |
| E8  | Page recoloured dark                   | Masthead follows the page's text colour [Q14]             |
| E9  | Unknown shape kind in data             | Not a page; out of scope (`isSvgRenderedShape` routes it) |

## Security and trust

Masthead lines are plain strings rendered as text nodes; the export escapes them with `xmlEscape`.
The body follows the label runs model. `PAGE_HEADING_MAX` bounds each line at the trust boundary.

## Performance and limits

- The masthead adds two small nodes per page; no measurement on the hot path.
- Worst case per page: two 200-char lines plus a label bounded by the tab limit.

## Presentation and UX

- Paper: `420 × 594`, white body, `#d4d4d8` hairline, soft shadow, `padding: 'lg'` (24px), body
  top-left.
- Masthead (DD17): title 19px / 600, subtitle 12px / 500, both in the page's text colour, the
  subtitle at reduced emphasis [Q14]; `gap-0.5`; rule `border-b` in the page stroke; `pb-2`.
- Fold: a 22px triangle cut painted `var(--lvd-canvas-bg, #fff)`, a leaf in the page fill and
  stroke with a `rgba(15, 23, 42, 0.10)` overlay, and the diagonal in the stroke.
- A focused line: `focus:bg-brand-50/60`, outline width `1 / zoom`.
- Tile: caption "Page", description "A paper-sized surface for rich text. Double-click to write."
- No loading or error state.

## Accessibility

- Each line: `role="textbox"`, `aria-label` "Page title" / "Page subtitle", `tabIndex` 0 when
  editable, −1 otherwise. Placeholders are `aria-hidden`.
- The fold is `aria-hidden`.
- Contrast: body and masthead text in the page's text colour against its fill [Q14]; on the
  default white page slate-900 is 17.9:1 and slate-500 is 4.76:1.
- Motion: none.

## Web experience

- **CLS.** The masthead is always rendered at full height (I2); placeholders prevent collapse.
- **INP.** A masthead edit is one contentEditable; commit is one history write on blur.

## Observability

The code emits no log here (G1). Target fingerprint:

| #   | Where                             | Level           | Fingerprint                                          |
| --- | --------------------------------- | --------------- | ---------------------------------------------------- |
| O1  | `InlineTextLine` commit truncates | `console.debug` | `[page] heading truncated field=<f> from=<n> to=200` |

Telemetry: `Element` / `Added` / `Page`; `Element` / `Changed` / `PageHeading` [Q16].

## Testing

| Rule                                            | Test                                            | File                                                        |
| ----------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| Page has a body in exports                      | `every kind with a body draws one` lists `page` | `packages/document/src/export-consistency.test.ts`           |
| Page is found in palette search                 | palette search kinds                            | `apps/live/lib/palette-search.test.ts`                      |
| Masthead line commits through `onSetHeading`    | web component heading commit (shared line)      | `apps/live/components/canvas/web/WebComponentFace.test.tsx` |
| Size 420 × 594, alignment, padding, colours     | none                                            | (G7)                                                        |
| Exempt from new-element colour derivation (I3)  | none                                            | (G7)                                                        |
| Exempt from theme applies [Q15]                 | none                                            | (G7)                                                        |
| CSS box path                                    | none                                            | (G7)                                                        |
| `PAGE_HEADING_MAX` validated (I1)               | none                                            | (G7)                                                        |
| Empty line stores `undefined`                   | none                                            | (G7)                                                        |
| Enter commits, Escape restores, keys stay local | none                                            | (G7)                                                        |
| Fold clamps and hides                           | none                                            | (G7)                                                        |
| `svgPageMasthead` output                        | none                                            | (G7)                                                        |
| Markdown title + indented body [Q13]            | none                                            | (G7)                                                        |
| Body clips / scrolls [Q12]                      | none                                            | (G7)                                                        |

## Constants and configuration

| Name                      | Value                                                | Provenance / safe range                      | Home                                     |
| ------------------------- | ---------------------------------------------------- | -------------------------------------------- | ---------------------------------------- |
| `SHAPE_DEFAULT_SIZE.page` | `{ width: 420, height: 594 }`                        | Spec: √2, A-series; keep the ratio           | `shape-factory.ts`                       |
| `PAGE_HEADING_MAX`        | `200`                                                | Spec; one line                               | `data-shapes.ts`                         |
| `FOLD_PX`                 | `22`                                                 | Spec, element px; 16 to 32                   | `PageCornerFold.tsx`                     |
| `PADDING_PX.lg`           | `24`                                                 | Spec "wide margin"                           | `packages/document/src/index.ts`          |
| Page fill / stroke        | `#ffffff` / `#d4d4d8`                                | Spec "white body, hairline border"; zinc-300 | `shape-factory.ts`                       |
| Page shadow               | `{ offsetX: 0, offsetY: 2, blur: 8, opacity: 0.18 }` | DD16                                         | `shape-factory.ts`                       |
| Masthead sizes            | title 19px / 600, subtitle 12px / 500                | DD17                                         | `PageMasthead.tsx`, `svg-render-data.ts` |
| Export masthead offsets   | title `+19`, subtitle `+16`, rule `+10`              | DD21                                         | `svg-render-data.ts`                     |
| `MASTHEAD_SHAPES`         | `page`, `banner`, `callout`                          | Kinds carrying masthead lines                | `useDataShapeSetters.ts`                 |
