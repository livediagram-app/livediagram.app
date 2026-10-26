# Timeline: blueprint

Derived from [Timeline](../timeline-rail.md) and the "Timeline" section of [Concept graphics](../concept-graphics.md).
What every concept graphic shares (row writes, the Rows section, Concept animations, the tour) is in the
[concept graphics blueprint](concept-graphics.md); this file holds only what is the Timeline's own. The spec decides;
this file only adds engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn` (D13 to D16).

Scope, by file:

| File                                                     | Role                                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/document/src/shape-kind.ts`                    | `ShapeKind` includes `'timeline-rail'`                                                   |
| `packages/document/src/concept.ts`                       | `ConceptShape` includes it; `CONCEPT_ROWS['timeline-rail']`; `conceptDrawsNotes` is true |
| `packages/document/src/concept-timeline.ts`              | `timelineLayout(w, h, n)`: the pure layout the face and the export share                 |
| `packages/document/src/svg-render-timeline.ts`           | `svgTimeline`: the headless render                                                       |
| `packages/document/src/svg-render-concept.ts`            | Dispatches a Timeline to `svgTimeline`                                                   |
| `packages/document/src/shape-factory.ts`                 | `SHAPE_DEFAULT_SIZE['timeline-rail']` (720 × 240); `createShape` starting milestones     |
| `packages/document/src/element-normalise.ts`             | `normaliseConcept`, `railToTimeline`: point fields into milestones                       |
| `packages/document/src/element-types.ts`                 | `ShapeElement.railCount`, `railLabels`: read once, never written                         |
| `packages/document/src/validate.ts`, `validate-shape.ts` | The kind in the vocabulary; `railLabels` bounded by `dataArray`; `conceptRows` bounded   |
| `packages/document/src/data-shapes.ts`                   | `isRailShape(kind)`                                                                      |
| `packages/document/src/colors.ts`                        | `SELF_PAINTING_SHAPES` entry: no Border controls                                         |
| `apps/editor/components/canvas/ConceptFace.tsx`          | Routes a Timeline to `ConceptTimelineBody`                                               |
| `apps/editor/components/canvas/ConceptTimelineBody.tsx`  | The canvas face: spine, arrowhead, a `ConceptRowLayer` per milestone                     |
| `apps/editor/components/canvas/element-variant.ts`       | Borderless wrapper via `SELF_PAINTING_SHAPES`                                            |
| `apps/editor/components/canvas/QuickConnectPluses.tsx`   | The ring's Add Milestone                                                                 |
| `apps/editor/components/palette/ConceptMenuSection.tsx`  | The menu section's title, "Timeline"                                                     |
| `apps/editor/components/palette/palette-tile-defs.tsx`   | Tile `tools:timeline`, section `concepts`                                                |
| `apps/editor/lib/palette-tile-keywords.ts`               | Search words for the tile                                                                |
| `apps/editor/lib/element-tours.ts`                       | `elementTourKindOf`: `'timeline'`                                                        |
| `packages/document-views/src/content-summary.ts`         | The outline's summary of a Timeline's rows                                               |

## Domain and naming

| Term          | Identifier                        | Meaning                                      |
| ------------- | --------------------------------- | -------------------------------------------- |
| Timeline      | `shape: 'timeline-rail'`          | The element kind                             |
| Milestone     | one `ConceptRow` in `conceptRows` | A name on the line                           |
| Name          | `ConceptRow.label`                | The milestone's words, at most 60 characters |
| When          | `ConceptRow.note`                 | A date, a quarter, a sprint; at most 40      |
| Spine         | `TimelineLayout.spine`            | The line across the middle                   |
| Arrowhead     | `TimelineLayout.head`             | At the spine's right end: time runs that way |
| Point fields  | `railCount`, `railLabels`         | Read once into milestones, never written     |
| Add Milestone | `QuickConnectPluses` entry        | The ring action that appends a milestone     |

Banned synonyms: "point", "node" or "tick" for a milestone; "date" as an identifier (the when is free text).

## Behaviour and state

1. **Create.** `createShape('timeline-rail', x, y)` returns 720 × 240 with `conceptRows`
   `[{ Kick-off, Jan }, { First prototype, Mar }, { Beta with customers, Jun }, { Launch, Sep }]` (D16).
2. **Rows.** Every row write goes through the concept graphics path (`boundConceptRows`, the Rows section, in-place
   editing), within `CONCEPT_ROWS['timeline-rail']` = `{ min: 2, max: 8, noun: 'Milestone', noteNoun: 'When' }` (D13).
   An added row is named `Milestone n`; the when's placeholder is "When".
3. **Add Milestone.** The quick-connect ring offers "Add Milestone" ("Add another milestone to the end.") while the
   Timeline has fewer than 8 rows.
4. **Read.** `normaliseConcept` runs on every stored element: with `conceptRows`, the list is cut to 8 and filled to 2
   with `Milestone n`; without them, `railToTimeline` makes them from the point fields.
5. **`railToTimeline`**: `count = clamp(round(railCount ?? 3), 2, 8)` (a non-finite count reads as 3); milestone `i`
   is `railLabels[i]` trimmed, or `Milestone i+1` when blank or absent; `railCount` and `railLabels` are removed.

Invariants:

- **I1:** a stored Timeline that has been read carries `conceptRows` of length 2 to 8 and no point fields.
- **I2:** the face and the export draw from the same `timelineLayout`, so their geometry matches.

## Interfaces and contracts

```ts
// packages/document/src/concept-timeline.ts
export type TimelineMilestone = {
  dot: { x: number; y: number };
  stem: { y1: number; y2: number };
  above: boolean;
  note: LayoutRect;
  label: LayoutRect;
};
export type TimelineLayout = {
  spine: { x1: number; x2: number; y: number };
  head: { tip: { x: number; y: number }; size: number };
  dotR: number;
  milestones: TimelineMilestone[];
  labelPx: number;
  notePx: number;
};
export function timelineLayout(w: number, h: number, n: number): TimelineLayout;

// packages/document/src/svg-render-timeline.ts
export function svgTimeline(
  el: Shape,
  rows: readonly ConceptRow[],
  o: { stroke: string; fill: string; labelColor: string; fontFamily?: string },
): string;
```

Validation (`isValidElement`): `railLabels`, when present, is an array of at most `MAX_DATA_ARRAY` entries;
`conceptRows` is bounded as every concept graphic's.

## Data and persistence

| Field         | Class     | Notes                                                 |
| ------------- | --------- | ----------------------------------------------------- |
| `conceptRows` | persisted | The milestones                                        |
| `conceptAnim` | persisted | `build` or `pulse` (Flow is the Cycle's alone)        |
| `railCount`   | read once | Turned into milestones by `railToTimeline`, then gone |
| `railLabels`  | read once | Turned into milestone names, then gone                |

## Layout (D14)

`timelineLayout(w, h, n)`, `count = max(1, n)`:

- Spine at `y = h / 2`, from `x1 = 0` to `x2 = w - 0.2 * head`; arrowhead `head = clamp(0.06 h, 6, 12)`, tip at
  `(w, y)`.
- `slot = max(1, w - 1.5 * head) / count`; milestone `i` at `x = slot * (i + 0.5)`; even indices above the spine.
- `dotR = clamp(min(0.055 h, 0.14 slot), 5, 12)`; `labelPx = round(clamp(0.075 h, 11, 17))`;
  `notePx = round(clamp(0.8 labelPx, 10, 14))`; gap 4.
- Words up to `min(w, 1.9 slot)` wide, never under `0.95 slot`, centred on the dot and clamped inside the element.
- Stem `max(6, min(0.3 * room, 28))`, `room = max(0, y - dotR - gap)`; the when (height `1.5 notePx`) nearest the stem,
  the name beyond it, at most `1.6 labelPx` tall.

## Presentation and UX (D15)

- Spine in the accent at opacity 0.55, 3 px, round caps; arrowhead filled in the accent.
- Stems in the accent at 0.5, 1.5 px; dots in the accent ringed 3 px in the fill.
- Whens in the accent, bold; names in the ink, bold; each shrinks to fit (`conceptFitPx`), then ellipses.
- A cleared when leaves the name alone.
- Palette tile `tools:timeline`, caption "Timeline", blurb "Milestones along a line, when and what", label
  "Add Timeline". The menu section is titled "Timeline".

## Accessibility

The drawing is `aria-hidden`; the names and whens are the concept graphics' in-place text, named and focusable as
every row is. Build and Pulse honour reduced motion as every Concept animation does.

## Errors and edge cases

| #   | Case                                 | Handling                                          |
| --- | ------------------------------------ | ------------------------------------------------- |
| E1  | Point fields with no rows            | `railToTimeline`                                  |
| E2  | `railCount` absent or not finite     | Read as 3                                         |
| E3  | `railCount` outside 2 to 8           | Clamped                                           |
| E4  | Rows over 8 or under 2               | Cut to 8, filled to 2 with `Milestone n`          |
| E5  | Add Milestone at 8                   | Not offered                                       |
| E6  | Very small element, or one milestone | `timelineLayout` stays whole (non-negative sizes) |

## Security and trust

Text is plain: the face renders it as React text and the export escapes it with `xmlEscape`. The row cap bounds render
cost.

## Performance and limits

At most 8 milestones, each one `<g>` of a stem, a dot and two lines of text. No measurement pass: the layout is
arithmetic.

## Observability

The Timeline emits what every concept graphic emits (its Added and Changed tokens, the concept animation); it has no
log of its own.

## Testing

| Rule                                                        | File                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------- |
| Even slots, spine through the middle, short of the head     | `packages/document/src/concept-timeline.test.ts`         |
| Turns above and below; stem from the dot to the when        | `packages/document/src/concept-timeline.test.ts`         |
| Words stay inside the element, centred on the dot           | `packages/document/src/concept-timeline.test.ts`         |
| Whole when squeezed or given one milestone                  | `packages/document/src/concept-timeline.test.ts`         |
| Made with four milestones and their whens                   | `packages/document/src/concept-timeline-element.test.ts` |
| Point fields open as milestones, unnamed ones numbered (I1) | `packages/document/src/concept-timeline-element.test.ts` |
| A read keeps the range                                      | `packages/document/src/concept-timeline-element.test.ts` |
| Export draws the spine, a dot per milestone, every word     | `packages/document/src/concept-timeline-element.test.ts` |

## Constants and configuration

| Name                | Value     | Provenance / safe range                        |
| ------------------- | --------- | ---------------------------------------------- |
| Milestones          | 2 to 8    | `CONCEPT_ROWS['timeline-rail']` (D13)          |
| Default size        | 720 × 240 | `SHAPE_DEFAULT_SIZE['timeline-rail']` (D16)    |
| `CONCEPT_LABEL_MAX` | 60        | Shared by every concept row                    |
| `CONCEPT_NOTE_MAX`  | 40        | Shared by every concept row                    |
| Default `railCount` | 3         | `railToTimeline`, for a count that is absent   |
| `MAX_DATA_ARRAY`    | 5 000     | Abuse bound for `railLabels`, `validate-shape` |
