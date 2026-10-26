# Emoji icon entries

Emoji are **icon-catalogue entries with a text prim**, so a saved `{ shape: 'icon', iconId: 'emoji-…' }` element
renders, exports and folds into a shape like any other icon. They are browsed and placed only from the
**Stickers** category ([Stickers](stickers.md)); the Icons tab has no Emoji category.

## Model: a text prim

- The icon prim vocabulary (`../packages/icons/src/types.ts`) includes a text prim:

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
sans-serif`. Emoji entries use `x: 12, y: 12, size: 20` in the 0..24 viewBox. Both prim renderers handle it: the
  editor's icon glyph and `iconPrimMarkup` in `../packages/icons/src/markup.ts`, which XML-escapes the text payload.

- Each emoji entry is an ordinary `IconDef`: `id` prefixed `emoji-` (flat namespace, uniqueness test-pinned), a
  `label`, and `keywords` carrying the search synonyms. The entries are **derived** from the sticker catalogue
  (`LEGACY_EMOJI_ICONS` in `../packages/icons/src/icon-catalog-2.ts`, from `sticker-catalog.ts`), so the two cannot
  drift. The Icons tab's search and the global "Add to canvas" list filter `emoji-` ids out.

## Deliberately not built

No third catalogue, no id set, no MIME, no dispatch branch, no `noTint` plumbing. Those exist for Technology marks
because brand tiles must be excluded from tinting and fold-into-shape; neither exclusion applies to emoji:

- **Tinting is a natural no-op**: colour-emoji font glyphs ignore SVG stroke/fill, so the theme tint wrapper leaves
  them untouched, exactly like a label containing an emoji.
- **Fold-into-shape is a feature**: an emoji icon on a shape is the shape's inline icon beside the label via the
  `acceptsInlineIcon` path, which is what you want from a status emoji.

## Inherited behaviours

Canvas rendering, editor export, the share thumbnail (client-rendered SVG, so the viewer's emoji font applies) and
the MCP render all come from the catalogue.

## Tests

- `../packages/icons/src/icon-catalog.test.ts` pins unique ids and a label plus at least one prim per entry.
- `../packages/icons/src/resolve.test.ts`'s per-prim markup test covers the `text` case, including escaping.
