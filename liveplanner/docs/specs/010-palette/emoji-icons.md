# Emoji icons

Colour emoji are entries in the platform's icon catalogue (`@liveworkspace/icons`), so an `icon` element whose
`iconId` names one (`emoji-thumbs-up`) draws the emoji. liveplanner shows no icon picker, so an emoji icon arrives
with a tab (an import, a paste); the browsable emoji are [Stickers](stickers.md), which share their ids.

## Model: a text prim

The icon prim vocabulary (`path`, `circle`, `line`, `rect`, `polyline`, `polygon`, `ellipse`) has one more member:

```ts
{
  t: 'text';
  text: string;
  x: number;
  y: number;
  size: number;
}
```

It renders as an SVG `<text>` with `text-anchor: middle`, `dominant-baseline: central` and
`font-family: system-ui, sans-serif`; emoji entries use `x: 12, y: 12, size: 20` in the 0..24 viewBox. Two renderers
draw it: `Prim` in the editor's `components/primitives/icon-glyph.tsx` (for the glyphs the editor draws, such as a
shape's inline icon) and `iconPrimMarkup` in `@liveworkspace/icons` (`markup.ts`, which escapes the text), used by every
export.

Each emoji is an ordinary `IconDef`: an `emoji-` id (unique across the catalogue, test-pinned), a `label`, and
`keywords` carrying its search synonyms. The entries live in `sticker-catalog.ts`.

## No special casing

- **Tinting is a natural no-op.** Colour-emoji glyphs ignore SVG stroke and fill, so the theme tint leaves them as
  they are. The editor's prim sets an explicit fill (a non-emoji fallback character paints in the tint) and
  `stroke="none"`, overriding the wrapper's `fill="none"` for line art.
- **Folding into a shape works.** An emoji can be a shape's inline icon beside its label, through `acceptsInlineIcon`
  like any line-art icon.

## Tests

`apps/editor/lib/icons.test.ts` and `@liveworkspace/icons`' `icon-catalog.test.ts` pin unique ids and a label and at
least one prim per entry; `markup.test.ts` and `resolve.test.ts` cover the `text` prim's markup, escaping included.
