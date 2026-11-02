# The card: blueprint

Derived from [The card](../card.md). Defaults in [DEFAULTS.md](DEFAULTS.md) as `Dn`. The card joins the web
components family ([web-components.md](web-components.md)): it reuses their face routing, `InlineTextLine`, `WebRows`
and the rows menu, and only what differs is written here.

| File                                                                       | Role                                                                                                          |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/card.ts`                                            | `CardMedia`, bounds, `cardLayout`, `cardTagWidth`, `withCardMedia`, `withCardHeader`, `migrateLegacyCallouts` |
| `packages/document/src/shape-kind.ts`                                      | `'card'` in `ShapeKind` / `SHAPE_KINDS`                                                                       |
| `packages/document/src/web-components.ts`                                  | `'card'` in `WebComponentShape`; `tags` in `WebRows`                                                          |
| `packages/document/src/element-types.ts`, `element-fields.ts`              | `cardMedia`, `cardHeader`, `tags`                                                                             |
| `packages/document/src/validate-shape.ts`                                  | Bounds for the three fields                                                                                   |
| `packages/document/src/shape-factory.ts`, `component-factories.ts`         | Default size, starting content, the Callout preset                                                            |
| `packages/document/src/colors.ts`                                          | `card` in `RADIUS_SHAPES`; `acceptsInlineIcon` true                                                           |
| `packages/document/src/svg-render-card.ts`                                 | `svgCard`: the headless body                                                                                  |
| `packages/document/src/stored-elements.ts`                                 | `migrateLegacyCallouts` joins `migrateStoredElements`                                                         |
| `packages/document/src/element-normalise.ts`                               | An agent's `callout` becomes a card on write                                                                  |
| `apps/editor/components/canvas/web/CardFace.tsx`                             | The canvas face (`card`, and `callout` before migration)                                                      |
| `apps/editor/components/palette/CardMenuSection.tsx`                         | Header Band, Media tiles, Tags rows                                                                           |
| `apps/editor/components/palette/palette-tile-defs.tsx`, `palette-layouts.ts` | Card tile, Callout tile → card preset                                                                         |
| `apps/editor/lib/element-telemetry.ts`                                       | `Card` tokens                                                                                                 |

## Domain and naming

| Term           | Identifier                                   | Meaning                                          |
| -------------- | -------------------------------------------- | ------------------------------------------------ |
| Card           | `shape: 'card'`                              | The element                                      |
| Slot           | (prose only)                                 | Header band, media, title, meta line, body, tags |
| Media          | `CardMedia = 'badge' \| 'tile' \| 'initial'` | Absent = none                                    |
| Header band    | `cardHeader: true`                           | Absent = off                                     |
| Title          | `pageTitle`                                  | Shared masthead field                            |
| Meta line      | `pageSubtitle`                               | Shared masthead field                            |
| Tag            | `tags[i]`                                    | One chip                                         |
| Callout preset | `CALLOUT_PRESET`                             | `cardMedia: 'badge'`, title, body                |

## Behaviour and state

### Layout (`cardLayout(width, height, slots)`), element-relative

`slots = { header, media, title, meta, tags: readonly string[] }` (booleans except tags).

1. `pad = round(clamp(min(w, h) * 0.1, 10, 18))`, `gap = 6`.
2. `titlePx = round(clamp(h * 0.16, 14, 18))` (never below the body's default size), `metaPx = round(clamp(titlePx *
0.8, 11, 14))`.
3. **Tags row**: `tagH = round(clamp(h * 0.16, 18, 22))`, `tagPx = round(tagH * 0.5)`; chips laid left to right from
   `pad` at `y = h - pad - tagH`, width `cardTagWidth(text, tagPx) = ceil(len * tagPx * 0.6) + round(tagPx * 1.6)`,
   gap 4; a chip whose right edge would pass `w - pad` and every chip after it are not placed (D176).
4. **Header band** (`header`): `bandH = round(titlePx * 2.3)` across the full width at the top. In it: media (when
   on) as a square of `bandH - 10` at `(pad, 5)`; title from after the media (or `pad`) to the meta; meta right-aligned
   ending at `w - pad`, its width `min(45% of the band, its estimated width)`.
5. **No band**: media square `m = round(clamp(min(w, h) * 0.3, 24, 44))` at `(pad, pad)`; text column from
   `pad + m + 10` (or `pad`); title line `titlePx * 1.35` tall at `pad`, meta line `metaPx * 1.4` under it; the top
   row is `max(m, title + meta)` tall when either exists.
6. **Body**: from below the top row (or band) plus `gap` to above the tags row minus `gap` (or `h - pad`); x from
   `pad` to `w - pad`, except with **badge** media and no band, where it starts at the text column (the Callout's
   layout).
7. **Dropping** (D177): if the body has words and would be under `max(14, titlePx)` tall, drop tags and redo; then
   the meta; then the media. A dropped slot is absent from the result. A card with no body text drops nothing.

### Media

- Badge: disc `r = m / 2` filled with the accent; glyph `iconId` in `ACCENT_BAR_TEXT`, else "i".
- Tile: rounded square (`rx = m * 0.24`) filled `colorWash(accent, 0.16)` over the card fill; line-art glyph in the
  accent; a Technology `iconId` draws its own tile at the same rect.
- Initial: disc filled with the same wash; the title's first letter, upper-cased, in the accent ("?" with no title).

### Writes

- Title / meta: `setPageHeading` (`MASTHEAD_SHAPES` gains `card`), unchanged semantics (empty → `undefined`).
- Tags: `withWebRows(el, { tags })`, each `clampCardTag` (collapse, trim, slice 32), count sliced to 6, an empty
  array stores `undefined`; append adds `'Tag'` (D178).
- `withCardMedia(el, media | null)`, `withCardHeader(el, on)`: menu writes via the generic style ops, telemetry
  `CardSlots`.
- Icon drop on a card with no media sets `cardMedia: 'tile'` alongside `iconId` (`applyInlineIconToEl`).

### Callout migration

`migrateLegacyCallouts(elements)`: for each `shape: 'callout'` return `{ ...el, shape: 'card', cardMedia: 'badge' }`;
the same array when there is none (I2). Runs inside `migrateStoredElements` (every stored-tab read path) and in
`element-normalise` (agent writes).

### Invariants

- I1: `tags` has at most 6 entries, each at most 32 characters, after any write.
- I2: after `migrateStoredElements`, no element is a `callout`.
- I3: canvas and export place every slot from the same `cardLayout` call.

## Interfaces and contracts

```ts
export type CardMedia = 'badge' | 'tile' | 'initial';
export const CARD_MEDIA: readonly CardMedia[];
export const CARD_TAGS_MAX = 6;
export const CARD_TAG_MAX = 32;
export type CardSlots = {
  header: boolean;
  media: boolean;
  title: boolean;
  meta: boolean;
  tags: readonly string[];
};
export type CardLayout = {
  band: LayoutRect | null;
  media: LayoutRect | null;
  title: LayoutRect | null;
  meta: LayoutRect | null;
  body: LayoutRect;
  tags: { text: string; rect: LayoutRect }[];
  titlePx: number;
  metaPx: number;
  tagPx: number;
};
export function cardLayout(width: number, height: number, slots: CardSlots): CardLayout;
export function cardSlotsOf(el: ShapeElement): CardSlots;
export function withCardMedia<T extends Element>(el: T, media: CardMedia | null): T;
export function withCardHeader<T extends Element>(el: T, on: boolean): T;
export function migrateLegacyCallouts(elements: Element[]): Element[];
export function svgCard(
  el: ShapeElement,
  o: { stroke; fill; labelColor; label; fontFamily? },
): string;
```

Validation: `cardMedia` one of `CARD_MEDIA`; `cardHeader` boolean; `tags` array of at most 6 strings of at most 32.
`callout` stays a valid `shape` value.

## Data and persistence

| Field        | Class     | Notes                               |
| ------------ | --------- | ----------------------------------- |
| `cardMedia`  | persisted | Absent = none                       |
| `cardHeader` | persisted | Stored only when true               |
| `tags`       | persisted | Absent when empty; order is meaning |

Migration: callout → card on every read; idempotent; no write-back until the next save.

## Errors and edge cases

| #   | Case                                 | Handling                                          |
| --- | ------------------------------------ | ------------------------------------------------- |
| E1  | Card too small for its slots         | Dropped in order tags, meta, media (D177)         |
| E2  | Tags wider than the card             | Trailing chips not drawn; still stored (D176)     |
| E3  | `cardMedia: 'tile'` with no `iconId` | Draws the tile with the "image" placeholder glyph |
| E4  | Unknown `iconId`                     | The placeholder glyph, as every icon does         |
| E5  | Header band on a light `headerFill`  | Band text `labelOn(headerFill)`                   |
| E6  | A stale client saves a `callout`     | Accepted; migrated on the next read               |

## Security and trust

Strings are bounded by validation, rendered as React text and `xmlEscape`d in export. The migration runs server side
on every read, so no reader sees a legacy kind.

## Performance and limits

`cardLayout` is O(tags) with at most 6; no measurement (character estimate, as the header's links). One face per
card; the in-place lines are inert unless the card is selected.

## Presentation and UX

- Starting content (D179): 300 × 150, tile media with `iconId: 'credit-card'`, title "Payments", meta
  "Stripe, EU region", body "Takes card payments and issues refunds.", tags `['PCI', 'v2']`.
- Callout preset (D180): 380 × 116, badge, title "Heads up", body "A short note with some supporting detail."
- Placeholders while empty and editable: "Title", "Meta line", "Tag".
- Menu section **Card** (Tools flyout): **Header Band**, **Title** and **Meta Line** toggle rows (`withCardLine`,
  starting words "Title" / "Meta line"), **Media** tiles (None, Badge, Tile, Initial); a **Tags** section (the web
  rows editor, Add Tag, 32-character rows).
- Ring add: **Add Tag** while under 6.

## Accessibility

In-place lines: `role="textbox"`, labels "Card title", "Card meta line", "Tag 1" …; menu tiles have names ("No Media",
"Badge Media", "Tile Media", "Initial Media"); media is `aria-hidden`.

## Web experience

In-place edits touch the DOM until blur, then one commit (INP); no layout reads.

## Observability

Telemetry only: `Element·Added·Card` on create, `Element·Changed·CardSlots` (band, media), `Element·Changed·Card`
(tags from the menu or ring). The migration emits nothing (as the group migration).

## Testing

| Rule                                                    | Test file                                                 |
| ------------------------------------------------------- | --------------------------------------------------------- |
| Layout per slot combination, dropping, tags overflow    | `packages/document/src/card.test.ts`                      |
| Writes: media, header, tags bounds (I1)                 | same                                                      |
| Callout migration (I2), idempotent, untouched array     | same + `stored-elements.test.ts`                          |
| Validation bounds                                       | same                                                      |
| Export draws each slot (I3)                             | same (`svgCard`)                                          |
| Face: slots render, lines inert until selected, commits | `apps/editor/components/canvas/web/CardFace.test.tsx`       |
| Menu section writes                                     | `apps/editor/components/palette/CardMenuSection.test.tsx`   |
| Callout tile places a card                              | `apps/editor/components/palette/palette-tile-defs.test.tsx` |

## Constants and configuration

| Name            | Value     | Provenance / safe range                               |
| --------------- | --------- | ----------------------------------------------------- |
| `CARD_TAGS_MAX` | 6         | One row of chips at default width; 4 to 8             |
| `CARD_TAG_MAX`  | 32        | A chip is a word or two; 16 to 40                     |
| Card size       | 300 × 150 | Fits title, meta, two body lines and a tag row (D179) |
| Pad clamp       | 10 to 18  | Callout's padding range                               |
