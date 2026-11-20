# The logo strip: blueprint

Derived from [The logo strip](../logo-strip.md). The spec decides; this file only adds engineering precision.
Defaults are ledgered in [DEFAULTS.md](DEFAULTS.md) as `Dn` (D254).

Scope, by file:

| File                                                   | Role                                                                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/logo-strip.ts`                  | `LOGO_STRIP_*` constants, `createLogoStrip(box)`, `stackPicturesGreyscale`, `withStackPicturesGreyscale`                                     |
| `packages/document/src/component-factories.ts`         | `ComponentKind` `'logo-strip'`, its `COMPONENT_SIZE`; `createComponent` gives the strip's stack alone (the draw path places the whole strip) |
| `packages/templates/src/slide-layouts-logos.ts`        | `logoStripSlide`                                                                                                                             |
| `packages/templates/src/slide-layouts.ts`              | `'slide-logos'` in the Content category                                                                                                      |
| `apps/editor/lib/draw-commit.ts`                       | `buildDrawnLogoStrip`                                                                                                                        |
| `apps/editor/hooks/canvas/useShapeDrawing.ts`          | The component branch commits the strip's elements together                                                                                   |
| `apps/editor/components/palette/palette-tile-defs.tsx` | Tile `media:logo-strip`                                                                                                                      |
| `apps/editor/components/palette/StackMenuSection.tsx`  | The Greyscale Pictures row                                                                                                                   |

## Domain and naming

| Term               | Identifier                        | Meaning                                                |
| ------------------ | --------------------------------- | ------------------------------------------------------ |
| Logo strip         | `createLogoStrip`, `'logo-strip'` | The stack and its logos, as placed                     |
| Logo               | an `ImageElement` child           | One picture slot                                       |
| Greyscale Pictures | `stackPicturesGreyscale`          | Whether every picture the stack directly holds is grey |

Banned synonyms: "logo wall" (the layout is a strip), "brand bar".

## Behaviour and state

- `createLogoStrip({ x, y, width, height } | { cx, cy }, count = LOGO_STRIP_COUNT)`: a stack (`createShape('stack')`
  then `stackGap: 40`, `strokeWidth: 'none'`, label empty) and `count` images (`createImage`, `width/height`,
  `objectFit: 'contain'`, `greyscale: true`, `aspectLocked: false`, `alt: 'Logo'`), the images placed in slots by
  `layoutStack` so the result is already settled. Natural size: `count * 160 + (count - 1) * 40 + 32` by `64 + 32`.
  A box shares `width - 32 - (count - 1) * 40` among the logos, each at least `LOGO_MIN_W = 48` wide and
  `LOGO_MIN_H = 24` tall.
- Draw: `buildDrawnLogoStrip(startX, startY, endX, endY)`: a tap centres the natural strip on the tap; a drag
  passes `drawnDragBox`'s box. `useShapeDrawing` commits `[...els, ...strip]`, selects the stack, tracks
  `Element / Added / LogoStrip`.
- Greyscale Pictures: shown when `stackChildren(elements, stack)` holds an image. `checked` =
  `stackPicturesGreyscale(elements, stack)` (every held image has `greyscale`). Pressing commits
  `withStackPicturesGreyscale(elements, stackId, !checked)` through `ops.commitTab` with telemetry
  `ImageGreyscale`; it sets or deletes `greyscale` on each held image and returns the same array when nothing moved.
- Slide layout `slide-logos`: eyebrow, title, lead, then `createLogoStrip` over the content box's width at a logo
  height of `u * 12`, six logos, centred in the lower half; the layout's own colours are none (themed by
  `themedForTab`).

## Interfaces and contracts

No new wire field: a strip is a stack and images. The palette tile is `{ type: 'component', kind: 'logo-strip' }`.

## Data and persistence

Nothing new is stored beyond the images' `greyscale` ([Picture crop, mask and greyscale](picture-crop-and-mask.md)).

## Errors and edge cases

| Case                            | Handling                                                   |
| ------------------------------- | ---------------------------------------------------------- |
| A drag too small for five logos | Logos clamp to their minimum; the strip grows past the box |
| A stack with no pictures        | No Greyscale Pictures row                                  |
| Mixed greyscale in a stack      | Unchecked; a press turns every picture grey                |

## Security and trust

Nothing new: the same image placeholders as the Image tile.

## Performance and limits

`withStackPicturesGreyscale` is one `deriveContainers` pass (`O(n log n)`, the stack's own cost) per press; the
menu reads `stackChildren` once per open.

## Presentation and UX

The tile's glyph is five small rounded bars of varied widths in a row. Tooltip and hover card read the spec's line.

## Accessibility

The Greyscale Pictures row is the menu's `MenuToggleRow` (a switch with its description).

## Observability

`Element / Added / LogoStrip`, `Element / Changed / ImageGreyscale`.

## Testing

| Rule                           | Test                                                       |
| ------------------------------ | ---------------------------------------------------------- |
| Factory: parts, sizes, settled | `packages/document/src/logo-strip.test.ts`                 |
| Greyscale over a stack         | `packages/document/src/logo-strip.test.ts`                 |
| Draw commit                    | `apps/editor/lib/draw-commit.test.ts`                      |
| Stack row                      | `apps/editor/components/palette/StackMenuSection.test.tsx` |
| Layout fits 16:9 and 4:3       | `packages/templates` slide layout tests                    |

## Constants and configuration

| Name                        | Value    | Provenance        |
| --------------------------- | -------- | ----------------- |
| `LOGO_STRIP_COUNT`          | 5        | Spec "The logos"  |
| `LOGO_W` / `LOGO_H`         | 160 / 64 | Spec "The logos"  |
| `LOGO_STRIP_GAP`            | 40       | Spec "The strip"  |
| `LOGO_MIN_W` / `LOGO_MIN_H` | 48 / 24  | Spec "Making one" |

## Defaults ledger

D254.
