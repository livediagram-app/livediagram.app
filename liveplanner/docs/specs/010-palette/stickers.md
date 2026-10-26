# Stickers

A **sticker** (`shape: 'sticker'`) is a die-cut plate with a soft shadow, in colours that are its own: an emoji on a
white plate, or a word pill (APPROVED, BLOCKED, WIP, P0, ...) coloured by what it means. The catalogue and the art
are the platform's (`@liveworkspace/icons`: `sticker-catalog.ts`, `stickerArt`). In liveplanner a sticker is a model
kind: no Plan surface places one, it arrives with a tab (an import, a paste), and every export draws it. The canvas
has no face for it ([Elements](../009-elements/README.md)), so it shows as an empty box with its selection ring.

## A sticker is not an icon

An icon is a glyph you tint, caption and fold into a shape's label. A sticker is an object stuck on the canvas, so
it is its own shape kind carrying its own `stickerId`:

|                     | Icon                            | Sticker                        |
| ------------------- | ------------------------------- | ------------------------------ |
| Artwork             | line art, one colour            | die-cut plate + shadow + art   |
| Theme tint          | takes the element stroke colour | never: its colours are its own |
| Caption             | a label band under the glyph    | none, ever                     |
| Fold into a shape   | yes, becomes an inline glyph    | never                          |
| Colours / Border UI | stroke + text swatches          | none (nothing to recolour)     |

Mechanically: `'sticker'` in `ShapeKind`, `stickerId` on `ShapeElement` (a string of at most 256 characters,
`malformed-ids.ts`), `supportsColours` false (`colors.ts`), membership in `SELF_PAINTING_SHAPES` (no wrapper border)
and in `isSelfDrawingShape` (no label editor, no markers, no text alignment, no morph), and exclusion from
`acceptsInlineIcon`.

- **No presets.** `shapeSupportsPresets` asks `supportsColours`, so a sticker's element menu has no Presets grid,
  and with Presets, Colours and Border all empty the Style flyout does not render (`PresetSections.tsx`).
- **No text, by any route.** No Add-text button, no double-click editor, no type-to-edit, all from
  `isSelfDrawingShape`.
- **Square and aspect-locked.** A new sticker is 104 × 104 and `aspectLocked`, because the plate and its content
  are drawn to one shape (`shape-factory.ts`).

## The artwork is built once

`stickerArt(def)` in `@liveworkspace/icons` returns `{ viewBox, markup }` and is the only place a sticker is drawn:
the SVG / PNG / PDF export (`svg-render-describe.ts`, resolved before any colour work, with no label), the api
worker's share thumbnail and the MCP render all call it. Three layers: a soft shadow, the white die-cut plate, then
the content (an emoji glyph, or a word on a tone-coloured pill whose font size follows its character count, so "P0"
and "OUT OF SCOPE" both fit).

There is no SVG `<filter>` for the shadow: a filter needs a `defs` id, and the export packs every element into one
SVG where those ids collide. The shadow is an offset rounded rect at low opacity instead, which renders the same
everywhere, headless included. The PNG drawer hands a sticker to its SVG before its own shape drawing
(`export-tab-canvas-draw.ts`).

## Rotation enters at its angle

A sticker lands square to the canvas, like every element, and turns from the element's Rotation menu. The pop-in
entry keyframe multiplies in `--lvd-enter-rot` (0deg when unset), which `BoxedElementView` publishes beside the
rotation, so a rotated element (a sticker, a pasted or duplicated shape) enters at its angle rather than flat
(`globals.css`).

## Emoji ids

Sticker ids keep the `emoji-` prefix of the emoji icon entries ([Emoji icons](emoji-icons.md)): an id is what a saved
element, an API payload and an MCP call carry, so it never changes.

## Tests

`stickers.test.ts` (in `@liveworkspace/workbench`) pins the group coverage (every sticker in exactly one group), the
catalogue floors for both flavours, and that every entry builds art drawing both the plate and its content;
`sticker-badge-centre.test.ts` (in `@liveworkspace/icons`) centres a badge's word on its pill.
