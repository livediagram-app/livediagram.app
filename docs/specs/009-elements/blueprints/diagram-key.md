# Diagram key: blueprint

Derived from [The diagram key](../diagram-key.md). Defaults in [DEFAULTS.md](DEFAULTS.md) as `Dn`.

| File                                              | Role                                                |
| ------------------------------------------------- | --------------------------------------------------- |
| `packages/document/src/diagram-key.ts`            | Rows derived from a tab, settling, meanings, layout |
| `packages/document/src/svg-render-diagram-key.ts` | Headless body                                       |
| `apps/live/lib/settle-tabs.ts`                    | Settles keys with the chips, per changed tab        |
| `packages/document/src/stored-tab.ts`             | Settles keys on read                                |
| `apps/live/components/canvas/DiagramKeyFace.tsx`  | Canvas face, meanings edited in place               |

## Domain and naming

| Term    | Identifier                                                     | Meaning                       |
| ------- | -------------------------------------------------------------- | ----------------------------- |
| Key     | `shape: 'diagram-key'`, `isDiagramKey`                         | The element                   |
| Row     | `KeyRow = { id, kind: 'line' \| 'tag', style?, color?, tag? }` | One derived row               |
| Row id  | `line:<strokeStyle>`, `tag:<tagKey>`                           | Stable across derivations     |
| Meaning | `keyMeanings: Record<string, string>`                          | The author's words per row id |

## Behaviour and state

- `keyRowsOf(elements, tagColours)`: walk arrows in array order, one `line` row per distinct `strokeStyle ?? 'solid'`;
  then one `tag` row per map row; cut at `KEY_ROWS_MAX` (12).
- `settleDiagramKeys(elements, tagColours)`: for every key, set `keyRows` to the derived rows and `height` to
  `KEY_TITLE_H + rows * KEY_ROW_H + KEY_PAD` when either changed; unchanged keys keep identity; returns the input array
  when no key changed.
- `meaningOf(key, row)`: `keyMeanings[row.id]` or the starting meaning: `<Pattern> line` (title case of the pattern,
  e.g. "Dashed line"), or the tag as written in the map.
- `withKeyMeaning(el, rowId, text)`: trims to 60; an empty text deletes the entry; more than 24 entries drops the
  oldest whose row is not in `keyRows`.
- Layout `diagramKeyLayout(w, rows)`: title rect `{ 12, 8, w - 24, 20 }`; row `i` at `y = KEY_TITLE_H + i * KEY_ROW_H`:
  swatch rect `{ 12, y + 4, 40, 20 }`, meaning rect `{ 64, y, w - 76, KEY_ROW_H }`.

### Invariants

- I1: after a commit, every key's `keyRows` equals `keyRowsOf` of its tab.
- I2: canvas and export place rows from `diagramKeyLayout`.

## Interfaces and contracts

```ts
export type KeyRow = {
  id: string;
  kind: 'line' | 'tag';
  style?: string;
  color?: string;
  tag?: string;
};
export function keyRowsOf(
  elements: readonly Element[],
  tagColours?: readonly TagColour[],
): KeyRow[];
export function settleDiagramKeys(
  elements: Element[],
  tagColours?: readonly TagColour[],
): Element[];
export function meaningOf(el: ShapeElement, row: KeyRow): string;
export function withKeyMeaning<T extends Element>(el: T, rowId: string, text: string): T;
export function diagramKeyLayout(w: number, rows: number): DiagramKeyLayout;
```

Validation: `keyRows` at most 12 rows as above (strings ≤ 40); `keyMeanings` at most 24 entries, keys ≤ 48, values
≤ 60.

## Data and persistence

| Field         | Class     | Notes                             |
| ------------- | --------- | --------------------------------- |
| `keyRows`     | derived   | Stored so readers need not derive |
| `keyMeanings` | persisted | The author's text                 |

## Errors and edge cases

| #   | Case                  | Handling                                    |
| --- | --------------------- | ------------------------------------------- |
| E1  | No arrows, no tag map | One muted row: "Your line styles show here" |
| E2  | More than 12 rows     | First 12                                    |
| E3  | Stale stored rows     | Re-derived on read and on the next commit   |

## Security and trust

Text renders as React text and is escaped in export; all bounded.

## Performance and limits

Derivation is O(elements) per changed tab with a key; a tab with no key costs one `some` scan.

## Presentation and UX

- Starting content (D191): 260 wide, label "Key", text sm bold title; rows 28 px; swatch: a 40 px line in the
  pattern with an arrowhead, or a 40 × 20 card edge (a 4 px strip of the colour on a white box with a hairline).
- Empty state E1 copy as above, muted.

## Accessibility

Each meaning is a `role="textbox"` named "<row starting meaning> meaning".

## Observability

`Element·Added·DiagramKey`; `Element·Changed·KeyMeaning`.

## Testing

| Rule                        | Test file                                             |
| --------------------------- | ----------------------------------------------------- |
| Rows, settle (I1), meanings | `packages/document/src/diagram-key.test.ts`           |
| Export (I2)                 | same                                                  |
| Face and in-place meaning   | `apps/live/components/canvas/DiagramKeyFace.test.tsx` |

## Constants and configuration

| Name           | Value | Provenance / safe range |
| -------------- | ----- | ----------------------- |
| `KEY_ROWS_MAX` | 12    | Spec                    |
| `KEY_ROW_H`    | 28    | D191                    |
| `KEY_TITLE_H`  | 32    | D191                    |
| `KEY_PAD`      | 8     | D191                    |
| Meanings kept  | 24    | Spec                    |
