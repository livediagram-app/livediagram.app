# Tag colours: blueprint

Derived from [Tag colours](../tag-colours.md). Defaults in [DEFAULTS.md](DEFAULTS.md) as `Dn`.

| File                                                | Role                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/document/src/tag-colours.ts`              | Type, bounds, lookup, write, the card's tag colour, the render overlay |
| `packages/document/src/validate.ts` (tab checks)    | `tagColours` validation                                                |
| `packages/document/src/accent-edge.ts`              | `resolvedAccentEdge` takes the tab's map                               |
| `packages/document/src/svg-render-card.ts`          | Tinted tag chips in export                                             |
| `apps/live/components/canvas/TagColoursContext.tsx` | The active tab's map, for the canvas                                   |
| `apps/live/hooks/editor/useTagColourSetter.ts`      | `setTagColour(tag, colour \| null)`: one history step on the tab       |
| `apps/live/components/palette/TagColoursBlock.tsx`  | The Card section's Tag Colours rows                                    |

## Domain and naming

| Term        | Identifier                                   | Meaning                                        |
| ----------- | -------------------------------------------- | ---------------------------------------------- |
| Tag colours | `Tab.tagColours: TagColour[]`                | The map                                        |
| A row       | `TagColour = { tag: string; color: string }` | One tag's colour                               |
| Tag key     | `tagKey(tag)`                                | `tag.trim().toLowerCase()`, what matching uses |
| Tag colour  | `cardTagColour(card, map)`                   | The colour of the card's first mapped tag      |

## Behaviour and state

- `tagColourOf(map, tag)`: the row whose `tagKey` equals the tag's, else null.
- `withTagColour(tab, tag, color | null)`: replaces the row with the same key (keeping the first-written casing), adds a
  new one at the end, or removes it on null; ignores a blank tag or a non-hex colour; a full map (12) refuses an add.
  Returns the tab itself when nothing changes.
- `cardTagColour(card, map)`: for each of the card's `tags` in order, the first `tagColourOf` hit.
- `withTagAccent(el, map)`: for a card with a tag colour, the card as it renders: `accentEdge` its own or `'left'`,
  `accentEdgeColor` its own or the tag colour. Any other element, or a card with none, comes back unchanged (same
  object).
- Canvas: `BoxedElementView` renders `withTagAccent(element, map)` for the accent edge overlay; `CardFace` tints tags.
- Export: `renderElementsToSvg` reads `tab.tagColours` and renders cards through `withTagAccent`, tags tinted.

### Invariants

- I1: a tag colour never writes to the card; removing the map row restores the card's own look.
- I2: an explicit `accentEdgeColor` always wins.
- I3: canvas and export draw the same edge and tints.

## Interfaces and contracts

```ts
export type TagColour = { tag: string; color: string };
export const TAG_COLOURS_MAX = 12;
export function tagKey(tag: string): string;
export function tagColourOf(map: readonly TagColour[] | undefined, tag: string): string | null;
export function withTagColour<T extends { tagColours?: TagColour[] }>(
  tab: T,
  tag: string,
  color: string | null,
): T;
export function cardTagColour(
  el: ShapeElement,
  map: readonly TagColour[] | undefined,
): string | null;
export function withTagAccent<T extends Element>(el: T, map: readonly TagColour[] | undefined): T;
```

Validation: `tagColours` an array of at most 12 `{ tag: string ≤ 32, color: hex }`, tag keys unique.

## Data and persistence

| Field            | Class     | Notes                         |
| ---------------- | --------- | ----------------------------- |
| `Tab.tagColours` | persisted | Synced with the tab, undoable |

## Errors and edge cases

| #   | Case                      | Handling                                                            |
| --- | ------------------------- | ------------------------------------------------------------------- |
| E1  | Two tags on a card mapped | The first in the card's tag order wins                              |
| E2  | Tag casing differs        | Matched by key; the map's casing shown in the key                   |
| E3  | Map full                  | Adding refuses; the picker row shows nothing new                    |
| E4  | Invalid stored map        | Validation refuses the write; a read ignores rows that do not parse |

## Security and trust

Tags render as React text and are escaped in export; colours are validated hex.

## Performance and limits

A lookup is O(map) ≤ 12 per tag ≤ 6 per card; cards only.

## Presentation and UX

- Tag Colours block (in the Card section, after Tags): heading "Tag Colours", one `ColourRow` per tag labelled with
  the tag, Clear as a `MenuActionButton` under a set row. Tinted chip: wash at 16% of the colour, border the colour,
  text the colour.

## Accessibility

Each colour row is named "<tag> colour"; Clear is "Clear <tag> colour".

## Observability

`Tab·Changed·TagColour` (set), `TagColourCleared`.

## Testing

| Rule                         | Test file                                               |
| ---------------------------- | ------------------------------------------------------- |
| Map writes, lookup, I1 to I2 | `packages/document/src/tag-colours.test.ts`             |
| Export (I3)                  | same                                                    |
| Canvas edge and chips        | `apps/live/components/canvas/web/CardFace.test.tsx`     |
| Menu block                   | `apps/live/components/palette/TagColoursBlock.test.tsx` |

## Constants and configuration

| Name              | Value | Provenance / safe range |
| ----------------- | ----- | ----------------------- |
| `TAG_COLOURS_MAX` | 12    | Spec; 6 to 24           |
| Chip wash         | 16%   | D191                    |
