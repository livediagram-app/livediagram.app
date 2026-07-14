# 85 — Emoji section in the Icons tab

Native colour emoji as first-class icon-catalogue entries, browsable under a new **Emoji** category in the palette's Icons tab. Stickies, retros, and reactions want emoji; the icon pipeline already gives us every behaviour for free once emoji are catalogue entries.

## Model: emoji are line-art catalogue entries with a text prim

- The icon prim vocabulary (`packages/icons/src/types.ts`, currently `path`/`circle`/`line`/`rect`/`polyline`/`polygon`/`ellipse`) gains one member:

  ```ts
  {
    t: 'text';
    text: string;
    x: number;
    y: number;
    size: number;
  }
  ```

  Rendered as an SVG `<text>` with `text-anchor: middle`, `dominant-baseline: central`, `font-family: system-ui, sans-serif`. Emoji entries use `x: 12, y: 12, size: 20` in the 0..24 viewBox. The two prim renderers each gain a case: `Prim` in the editor's `icon-glyph.tsx` and `iconPrimMarkup` in `packages/icons/src/markup.ts` (which also gains an XML text escaper — every existing prim payload is numeric, so none exists yet).

- Each emoji is an ordinary `IconDef` — `id` prefixed `emoji-` (flat namespace, uniqueness is test-pinned), `label`, and `keywords` carrying the search synonyms ("rocket launch ship" etc.). The entries live in their own pure-data file in `packages/icons/src` (size-exempt data catalogue), concatenated into the part-2 export so consumers see one line-art catalogue and the async icon chunk (`icon-registry.ts`) needs no changes.

- A new `ICON_CATEGORIES` entry `{ id: 'emoji', label: 'Emoji', iconIds: [...] }` in `apps/live/lib/icons.ts` makes it a filter chip in the Icons tab. The starter set is roughly 60 emoji weighted toward collaboration and status: smileys/reactions (thumbs up/down, clapping, party, thinking, heart), status marks (check, cross, warning, question, fire, star, sparkles, rocket, bulb, target, trophy, hourglass), work objects (calendar, clock, pin, lock, key, bug, wrench, memo, folder, chart), and hands/people.

## What we deliberately do NOT build

No third catalogue, no id set, no MIME, no dispatch branch, no `noTint` plumbing. Those exist for Technology marks because brand tiles must be excluded from tinting and fold-into-shape; neither exclusion applies to emoji:

- **Tinting is a natural no-op**: colour-emoji font glyphs ignore SVG stroke/fill, so the theme tint wrapper leaves them untouched, exactly like a label containing an emoji today.
- **Fold-into-shape is a feature**: dragging an emoji onto a shape sets it as the shape's inline icon beside the label via the existing `acceptsInlineIcon` path, which is precisely what you want from a status emoji.

## Inherited behaviours (all automatic, all catalogue-driven)

Palette grid + in-tab search, category filter, click-to-add (standalone icon element or fold into the selected shape), drag-to-canvas and drag-onto-shape via `ICON_DND_MIME`, Favourites tiles, the global search "Add to canvas" group, canvas rendering, editor export, the api share thumbnail (client-rendered SVG, so the viewer's emoji font applies), and the MCP render. Telemetry rides the existing `track('Element','Added','Icon')`.

## Tests

- `icons.test.ts` already pins: unique ids, label + ≥1 prim, every category id resolving to an entry — the emoji category and entries are covered by construction.
- `resolve.test.ts`'s per-prim markup test gains the `text` case, including escaping.
