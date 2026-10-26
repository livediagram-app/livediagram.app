# Emoji icon entries

Emoji are placed from the top-level **Stickers** category ([Stickers](stickers.md)), as their own element kind with
their own artwork. The icon catalogue also holds every emoji as an ordinary line-art entry, so an icon element that
names an `emoji-` id renders as the bare glyph. The palette does not offer those entries.

## Model: emoji are line-art catalogue entries with a text prim

- The icon prim vocabulary (`packages/icons/src/types.ts`: `path`, `circle`, `line`, `rect`, `polyline`, `polygon`,
  `ellipse`) has a `text` member:

  ```ts
  {
    t: 'text';
    text: string;
    x: number;
    y: number;
    size: number;
  }
  ```

  Rendered as an SVG `<text>` with `text-anchor: middle`, `dominant-baseline: central`, `font-family: system-ui,
sans-serif`. Emoji entries use `x: 12, y: 12, size: 20` in the 0..24 viewBox. Both prim renderers handle it:
  `Prim` in the editor's `icon-glyph.tsx` and `iconPrimMarkup` in `packages/icons/src/markup.ts`, which escapes the
  text for XML.

- Each emoji is an `IconDef`: `id` prefixed `emoji-` (flat namespace, uniqueness is test-pinned), `label`, and
  `keywords`. The entries are **derived** from the sticker catalogue (`LEGACY_EMOJI_ICONS` in `icon-catalog-2.ts`,
  from `sticker-catalog.ts`) rather than hand-copied, so the two can't drift, and are part of the part-2 export.
- No `ICON_CATEGORIES` entry holds them, and the Icons tab's search and the global "Add to canvas" list filter them
  out (`isLegacyEmojiIconId`), so Stickers is the one place to browse or place an emoji.

## What we deliberately do NOT build

No third catalogue, no id set, no MIME, no dispatch branch, no `noTint` plumbing. Those exist for Technology marks
because brand tiles must be excluded from tinting and fold-into-shape; neither exclusion applies to emoji:

- **Tinting is a natural no-op**: colour-emoji font glyphs ignore SVG stroke/fill, so the theme tint wrapper leaves
  them untouched, exactly like a label containing an emoji.
- **Fold-into-shape works**: an emoji icon on a shape is its inline icon beside the label, through the
  `acceptsInlineIcon` path.

## Inherited behaviours

Canvas rendering, editor export, the share thumbnail (client-rendered SVG, so the viewer's emoji font applies) and the
MCP render all come from the catalogue.

## Tests

- `icon-catalog.test.ts` pins unique ids and a label plus at least one prim per entry.
- `resolve.test.ts`'s per-prim markup test covers the `text` case, including escaping.
