# Snap colours: blueprint

Derived from [Whiteboard](../whiteboard.md) "Snap colours" (and the Settings bullet of "What a
whiteboard shows"). Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) as `Sn`.

Scope, by file:

| File                                                                | Role                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/document/src/pen-colours.ts`                              | `hexOklch`, `PEN_NEUTRAL_CHROMA`, `nearestPenColour` (pure colour maths) |
| `packages/document/src/snap-colours.ts`                             | `SNAP_COLOUR_FIELDS`, `snappableCustomColours`, `snapTabColours` (pure)  |
| `apps/live/hooks/canvas/useSnapColours.ts`                          | The board's snappable colours and the one-commit `snap()`                |
| `apps/live/components/canvas/whiteboard/SnapColoursSection.tsx`     | The Settings flyout's Colours section                                    |
| `apps/live/components/canvas/whiteboard/dock-flyouts.tsx`           | Renders the section last in `SettingsFlyoutBody`                         |
| `apps/live/hooks/canvas/useWhiteboard.ts`                           | Carries `snapColours` on the dock model                                  |
| `apps/live/app/document/[id]/useEditorState.ts`                     | Builds `useSnapColours` and hands it to `useWhiteboard`                  |
| `packages/api-schema/src/telemetry-schema.ts`, `apps/telemetry/...` | The `SnapColours` token's comment and its dashboard sentence             |

## Domain and naming

| Term             | Identifier                 | Meaning                                                                 |
| ---------------- | -------------------------- | ----------------------------------------------------------------------- |
| Custom colour    | `isCustomPenColour`        | An exact `#rrggbb`, the same on both boards                             |
| Stock colour     | `PenColourName`            | One of the seven named, adaptive colours                                |
| Ink              | `'ink'` (a `SnapTarget`)   | No colour stored: the board's own ink                                   |
| Neutral          | `PEN_NEUTRAL_CHROMA`       | OKLCH chroma below it: snaps to Ink                                     |
| Snap target      | `SnapTarget`               | `PenColourName \| 'ink'`: what a custom colour becomes                  |
| Snap field       | `SnapColourField`          | One row of the field table: which kinds, the hex field, the named field |
| Snappable colour | `snappableCustomColours`   | A custom colour held in a snap field of an element the snap may change  |
| Snap             | `snapTabColours`, `snap()` | Converting every snappable colour to its target, as one commit          |

Banned synonyms: "quantise", "normalise" (the action is a snap), "theme colour" (a whiteboard has
no theme; the colours are stock colours), "default colour" for Ink in code (it is `'ink'`).

## Behaviour and state

### `nearestPenColour(hex): SnapTarget | null`

- `null` when `hex` is not `#rrggbb` (case-insensitive).
- `hexOklch(hex)`: OKLCH `{ l, c, h }` (the module's existing `rgbOklch`, exported through it).
- `c < PEN_NEUTRAL_CHROMA` → `'ink'`.
- Else the `PEN_COLOURS` entry with the smallest circular hue distance
  `min(|h - hue|, 360 - |h - hue|)`; equal distances go to the earlier entry (strict `<`).

### `snapTabColours(elements, skip?) → { elements, colours, changed }`

- Walks `elements` once. An element is **eligible** when it is not `locked`, its id is not in
  `skip` (the hidden-or-locked-layer ids), and a `SNAP_COLOUR_FIELDS` row applies to it.
- For each applying row whose hex field holds a custom colour: the hex field and the row's
  `clear` fields (`strokeSwatch`, the quick-swatch binding that would re-derive a hex) are
  removed; the named field is set to the target, or removed for `'ink'`.
- Untouched elements are returned **by identity**; `changed` counts patched elements,
  `colours` the distinct custom colours (lower-cased) converted.
- `snappableCustomColours(elements, skip?)`: the distinct lower-cased custom colours the snap
  would convert, most recently drawn first (walking the array from the end), uncapped.

### Field table (`SNAP_COLOUR_FIELDS`)

| Applies to                                                 | Hex field     | Named field | Clears         |
| ---------------------------------------------------------- | ------------- | ----------- | -------------- |
| `freehand` with `penWidth` set and `pen !== 'highlighter'` | `strokeColor` | `penColour` | `strokeSwatch` |
| `shape`                                                    | `strokeColor` | `penColour` | `strokeSwatch` |
| `arrow`                                                    | `strokeColor` | `penColour` | `strokeSwatch` |

A kind gaining a named colour (text colour, path stroke) adds one row; nothing else changes.

### Editor (`useSnapColours`)

- Inputs: `elements` (the active tab's), `inertIds` (`layerInertIds`), `editsBlocked`, `commit`.
- Output: `{ colours: string[], blocked: boolean, snap(): number }`; `colours` is
  `snappableCustomColours`, memoised on `elements` and `inertIds`.
- `snap()`: no-op returning 0 when blocked or nothing to snap; else one `commit` running
  `snapTabColours` on the live elements (one undo step), `track('Whiteboard', 'Changed',
'SnapColours')`, a `console.info` fingerprint, and returns `colours`.

### Section (`SnapColoursSection`)

- States: **hidden** (no colours, no result), **offer** (count, swatches, button), **done**
  (status sentence, no button). The result lives in component state, so closing the flyout (which
  unmounts it) forgets it; undo re-renders **offer** once colours are back and no result is shown.
- Section heading "Colours" in the flyouts' small capitals; `role="group"`, `aria-label="Colours"`.
- Offer copy: "1 custom colour" / "N custom colours"; swatches: first `TAB_CUSTOM_COLOURS_MAX` (8, `apps/live/lib/quick-style-pen.ts`),
  each `aria-hidden`, its hex in `data-snap-swatch`; button "Snap to stock colours", disabled when
  `blocked`.
- Done copy: "1 custom colour snapped to stock colours" / "N custom colours snapped to stock
  colours", in a `role="status"` paragraph that is present (empty) in the offer state so the
  announcement is polite and reliable. The button goes once pressed, so the focus moves to that
  paragraph (`tabIndex={-1}`) instead of being lost.

## Interfaces and contracts

```ts
export const PEN_NEUTRAL_CHROMA = 0.05;
export function hexOklch(hex: string): { l: number; c: number; h: number } | null;
export type SnapTarget = PenColourName | 'ink';
export function nearestPenColour(hex: string): SnapTarget | null;

export type SnapColourField = {
  applies: (el: Element) => boolean;
  hex: 'strokeColor';
  named: 'penColour';
  clear: readonly 'strokeSwatch'[];
};
export const SNAP_COLOUR_FIELDS: readonly SnapColourField[];
export function snappableCustomColours(
  els: readonly Element[],
  skip?: ReadonlySet<string>,
): string[];
export function snapTabColours(
  els: readonly Element[],
  skip?: ReadonlySet<string>,
): { elements: Element[]; colours: number; changed: number };
```

## Data and persistence

- Writes only existing, validated fields (`penColour` is one of the seven names; removing
  `strokeColor` is always valid). No new field, no migration, no schema regeneration.
- Collaboration and the activity log see an ordinary element change through `commit`.

## Errors and edge cases

- Invalid or non-hex colours (`transparent`, `rgb(...)`, 3-digit hex) are not custom colours:
  untouched.
- An element holding both a custom `strokeColor` and a `penColour`: the custom colour shows today
  (it overrides), so it is snapped and the named field replaced.
- Empty board, or only protected elements: hidden section, `snap()` returns 0 and commits nothing.
- A peer edit between render and press: `snap()` reads the live elements inside `commit`.

## Security and trust

- Client-only restyle of the user's own board through the ordinary edit path; the dock is absent
  for view-role visitors and `blocked` disables the button otherwise.

## Performance and limits

- O(n) per render for `snappableCustomColours` (memoised), O(n) per snap; `nearestPenColour` is
  seven hue comparisons. A tab's element cap bounds n.

## Presentation and UX

- See Section above; the section never shifts the flyout's other sections (it is last).

## Accessibility

- Button reachable by Tab inside the flyout, accessible name "Snap to stock colours"; the count
  sentence is plain text in the group; result announced by `role="status"`. After a press the focus
  moves to that status, since the button is gone. Swatches are
  decorative. Text uses the flyouts' existing slate colours (AA in light and dark).

## Web Experience

- No network, no new bundle weight beyond two small modules; the section sits last in a flyout
  that opens above the dock, so it shifts nothing on the page (CLS 0); a snap is one O(n) commit
  (INP well under 200 ms at the tab element cap).

## Observability

- `console.info('[snap-colours] snapped', { colours, elements })` on a snap (counts only);
  `console.debug('[snap-colours] nothing to snap')` when pressed with nothing eligible.

## Testing

| Rule                                                       | Test                                            |
| ---------------------------------------------------------- | ----------------------------------------------- |
| Each stock hue's own colours map to it                     | `pen-colours.test.ts` "nearestPenColour" table  |
| Neutrals (black, white, greys, slate) map to Ink           | same                                            |
| Near-boundary hues go to the nearer; ties to the earlier   | same                                            |
| Invalid input is null; case-insensitive                    | same                                            |
| Each field-table row snaps; Ink removes the named field    | `snap-colours.test.ts`                          |
| Untouched elements by identity; counts                     | same                                            |
| Highlighter, stock, ink, locked, skipped, fills, text kept | same                                            |
| `strokeSwatch` cleared                                     | same                                            |
| Snappable colours: distinct, lower-cased, newest first     | same                                            |
| Hook: one commit, telemetry, blocked no-op                 | `useSnapColours.test.tsx`                       |
| Section: hidden, offer copy, press, done status, disabled  | `SnapColoursSection.test.tsx`                   |
| Settings flyout shows the section only with custom colours | `WhiteboardDock.test.tsx`                       |
| End to end: snap, undo, light and dark                     | `apps/live/e2e/whiteboard-snap-colours.spec.ts` |

## Constants and configuration

| Constant             | Value | Provenance                                                                   | Safe range   |
| -------------------- | ----- | ---------------------------------------------------------------------------- | ------------ |
| `PEN_NEUTRAL_CHROMA` | 0.05  | Spec; greys measure 0.00 to 0.03, slates about 0.04, dusty pastels from 0.06 | 0.03 to 0.08 |

## Defaults ledger

S1 to S3 in [DEFAULTS.md](DEFAULTS.md).
