# The quote: blueprint

Derived from [The quote](../quote.md). The spec decides; this file only adds engineering precision. Defaults
applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                                                                                                         | Role                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `packages/document/src/quote.ts`                                                                                                                             | `QuoteLook`, `quoteLookOf`, `quotePortraitOf`, `quoteLayout`, `withQuoteLook`, `withQuotePortrait` |
| `packages/document/src/element-images.ts`                                                                                                                    | `elementImageId(el)`: the gallery picture an element places (an image's, a quote's photo)          |
| `packages/document/src/shape-kind.ts`, `validate.ts`                                                                                                         | `'quote'` in `ShapeKind` and `SHAPE_KINDS`                                                         |
| `packages/document/src/web-components.ts`                                                                                                                    | `'quote'` in `WebComponentShape`                                                                   |
| `packages/document/src/element-types.ts`, `element-fields.ts`                                                                                                | `quoteLook`, `imageId` on a shape                                                                  |
| `packages/document/src/validate-shape.ts`                                                                                                                    | `quoteLook`, `imageId` (string)                                                                    |
| `packages/document/src/shape-factory.ts`                                                                                                                     | Size 460 × 220 and starting content (`D227`)                                                       |
| `packages/document/src/shape-variants.ts`                                                                                                                    | The `pull` variant                                                                                 |
| `packages/document/src/colors.ts`                                                                                                                            | `SELF_PAINTING_SHAPES`, `RADIUS_SHAPES`; no inline icon                                            |
| `packages/document/src/svg-render-quote.ts`                                                                                                                  | The export face, the photo embedded through `resolveImageHref`                                     |
| `packages/api-kit/src/image-refs.ts`                                                                                                                         | `imageRefIds` counts a shape's `imageId`                                                           |
| `apps/editor/components/canvas/web/QuoteFace.tsx`                                                                                                            | The canvas face; the photo through `useImageBlobUrl`                                               |
| `apps/editor/components/palette/QuoteMenuSection.tsx`                                                                                                        | The Quote section: Look and Portrait                                                               |
| `apps/editor/hooks/canvas/useEditorImages.ts`                                                                                                                | The picker's apply / remove land on a quote's photo                                                |
| Image collectors (`export-tab-images.ts`, `thumb-images.ts`, `offline-images.ts`, `packages/api-schema/src/embed-images.ts`, `InfographicLayoutPreview.tsx`) | Read `elementImageId`                                                                              |
| `packages/templates/src/slide-layouts-pictures.ts`, `slide-layouts-proof.ts`                                                                                 | Quote and Picture on the element; the Testimonials slide                                           |

## Domain and naming

| Term      | Identifier                                            | Meaning                                         |
| --------- | ----------------------------------------------------- | ----------------------------------------------- |
| Quote     | `ShapeKind` `'quote'`                                 | The element                                     |
| The words | `label` / `richText`                                  | What was said                                   |
| Name      | `pageTitle`                                           | Who said it                                     |
| Role      | `pageSubtitle`                                        | Their role and company                          |
| Portrait  | `quotePortraitOf(el)`: `'photo' \| 'initial' \| null` | `imageId` set wins; else `cardMedia: 'initial'` |
| Look      | `quoteLookOf(el)`: `'card' \| 'plain'`                | `quoteLook`, absent is card                     |

Banned synonyms: "testimonial element" in code (the palette names it Quote), "avatar" for the portrait, "author".

## Behaviour and state

### Layout

`quoteLayout(width, height, { look, portrait, name, role })` (element-relative rects):

1. Padding `pad = look === 'card' ? clamp(min(w, h) * 0.08, 12, 32) : 0`; inner box `(pad, pad, w - 2pad, h - 2pad)`.
2. Quote mark size `markPx = clamp(min(h * 0.22, w * 0.16), 24, 120)`; `mark` rect at the inner top-left,
   `markPx` square. The mark's glyph is `“`, drawn at `markPx * 1.6` font size so its ink fills the square.
3. Source: `namePx = clamp(h * 0.075, 12, 22)`, `rolePx = round(namePx * 0.82)`; lines `namePx * 1.3` and
   `rolePx * 1.3`; `sourceH = name + (role ? role line : 0)`; `portraitD = max(2 * namePx, sourceH)` when a portrait shows (so dropping the role frees room).
   The source band is the bottom `max(sourceH, portraitD)` of the inner box; the portrait at its left, the name and
   role beside it after a `portraitD * 0.3` gap.
4. The body (the label) is between the mark (`mark.bottom + 4`) and the source band less a gap of `namePx`.
5. Too small: while the body is under `max(24, 1.4 * labelPx)` tall, drop the role, then the portrait, then the mark
   (the mark's room goes to the body). The quote never drops.

### Faces

- **Card** look: a rect of the element's fill with a 1 px accent border, radius `cornerRadiusPx(borderRadius, w, h,
BORDER_RADIUS_PX.lg)`, then the slots. **Plain**: the slots alone.
- The mark is the accent, bold. The name the ink, weight 600; the role the ink at 0.7.
- Portrait photo: `<img>` (canvas) / `<image>` with a circular `clipPath` (export), `object-fit: cover` /
  `preserveAspectRatio="xMidYMid slice"`. Initial: a disc washed 16% of the accent with the name's first letter in
  the accent (`?` with no name), the card's initial. A photo that fails to load (or an export with no bytes) draws the
  initial instead.

### Edit

- The label edits with the shared label editor in the body region (`LabelRegion`).
- The name and role are `InlineTextLine`s (`placeholder` "Name" / "Role", `maxLength` `PAGE_HEADING_MAX`) written
  through `onSetHeading`. Empty and unselected, a line is not drawn.
- The Quote section (`QuoteMenuSection`, Tools flyout): Look (Card, Plain) and Portrait (None, Initial, Photo) as
  `SizeButton` grids with hover previews through `ops.preview`; **Photo** with no photo opens the picker
  (`onOpenPicker(target.id)`); with a photo the section shows **Change Photo** and **Remove Photo** buttons.
- The picker: `applyImageToElement` on a quote writes `imageId` (and nothing else); `removeImageFromElement` drops it.
  `currentImageId` reads `elementImageId`.

### Images

`elementImageId(el)`: `el.type === 'image' ? el.imageId : el.type === 'shape' && el.shape === 'quote' ? el.imageId ?? null : null`.
Every collector that gathered `type === 'image'` ids gathers through it, and the offline mapping rewrites a quote's
`imageId` as it rewrites an image's. `imageRefIds` (api-kit) counts a top-level element of `type: 'shape'` with a
gallery `imageId` as it counts an image, so the reference index keeps the picture.

## Interfaces and contracts

- Validation: `quoteLook` one of `card`, `plain`; `imageId` on a shape a string of at most `IMAGE_REF_ID_MAX_LENGTH`
  (a gallery id or a `data:` URI in a This Browser document). The MCP validator refuses an `imageId` not in the
  gallery as it does for an image.

## Security and trust

- A quote's photo goes through the same image read as an image element (`useImageBlobUrl`, the share code, the
  placement grants), so a quote cannot show a picture the reader may not see.

## Performance and limits

- `quoteLayout` is arithmetic; the face renders once per change. The photo is one blob URL per quote, revoked on
  unmount as an image's is.

## Accessibility

- The quote is one `img` to a screen reader with `aria-label` "Quote: `words` `name`, `role`"; the in-place lines
  are focusable only while editable (the card's rule).

## Testing

| Rule                                            | Test                                      |
| ----------------------------------------------- | ----------------------------------------- |
| Layout slots, drop order, look padding          | `quote.test.ts`                           |
| Portrait choice and the look / portrait writers | `quote.test.ts`                           |
| `elementImageId` and the collectors             | `element-images.test.ts`, collector tests |
| `imageRefIds` counts a quote photo              | `api-kit` `image-refs.test.ts`            |
| Validation                                      | `validate-shape.test.ts`                  |
| Export face, photo and initial                  | `svg-render-quote.test.ts`                |
| Canvas face: lines edit only when editable      | `QuoteFace.test.tsx`                      |
| Menu: Editor sees the section, Viewer does not  | `QuoteMenuSection.test.tsx`               |

## Defaults ledger

D226, D227.
