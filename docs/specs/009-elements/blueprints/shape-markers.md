# Shape markers: blueprint

Derived from [Shape markers](../shape-markers.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                         | Role                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `packages/document/src/shape-marker.ts`                      | `ShapeMarker`, `SHAPE_MARKERS` (offer order)                               |
| `packages/document/src/element-types.ts`                     | `ShapeElement.marker`, `ShapeElement.markerSize`                           |
| `packages/document/src/collab-shapes.ts`                     | `supportsMarkers`: the menu gate, beside `hasOwnFace`                      |
| `apps/live/components/canvas/ShapeMarker.tsx`                | `ShapeMarkerGlyph`, `MARKER_LABELS`, the circle fills                      |
| `apps/live/components/canvas/shape-inline-icon-layout.tsx`   | `ShapeInlineIconLayout`: marker + label group, `MARKER_FIXED_PX`           |
| `apps/live/components/canvas/BoxedElementView.tsx`           | Resolves `marker` (none for self-drawing shapes)                           |
| `apps/live/components/canvas/ElementFaceRouter.tsx`          | Inline layout for an icon or a marker, after the face branches             |
| `apps/live/components/palette/context-menu-rows.tsx`         | `MarkerTiles`: None + five tiles, the Size row                             |
| `apps/live/components/palette/ElementAppearanceSections.tsx` | Single-element gate `showMarkers`, Text flyout placement                   |
| `apps/live/components/palette/MultiSelectionContextMenu.tsx` | Multi-selection gate `markerSrc`                                           |
| `apps/live/lib/style-presets.ts`                             | `applyMarkerToEl`, `applyMarkerSizeToEl`                                   |
| `apps/live/hooks/canvas/useStylePreview.ts`                  | `previewMarker` / `commitMarker`, `previewMarkerSize` / `commitMarkerSize` |
| `apps/live/hooks/canvas/useShapeStyleSetters.ts`             | `setMarkerSelected`, `setMarkerSizeSelected`                               |
| `apps/live/lib/editor-commands-selection.ts`                 | Command-palette "Add … marker" / "Clear marker" [QE12]                     |

## Domain and naming

| Term         | Identifier             | Meaning                                                                                 |
| ------------ | ---------------------- | --------------------------------------------------------------------------------------- |
| Marker       | `ShapeMarker`          | `green-circle`, `orange-circle`, `red-circle`, `checkbox-unchecked`, `checkbox-checked` |
| No marker    | `marker` absent        | The None tile; `null` in setters                                                        |
| Marker size  | `markerSize: TextSize` | `scale` (default), `sm`, `md`, `lg`                                                     |
| Marker glyph | `ShapeMarkerGlyph`     | The one drawing, shared by canvas and menu tiles                                        |
| Tile label   | `MARKER_LABELS`        | Green, Orange, Red, To do, Done                                                         |

Banned synonyms: "status dot" in code (say marker), "badge", "tick box" (say checkbox marker),
"annotation marker" (that is the annotation element).

## Behaviour and state

### Render

1. `BoxedElementView`: `marker = element.type === 'shape' && !isSelfDrawingShape(shape) ?
element.marker : undefined`.
2. `ElementFaceRouter` tries the own-face kinds (at rest) and the web components first; any other
   shape with an inline icon or a marker renders through `ShapeInlineIconLayout`, ahead of the page
   and icon-caption branches [QE12] [GE16]. The label editor becomes an inline flex child so the
   marker stays beside it while typing.
3. Marker and label form one inline group (`items-center`, gap `max(4, round(markerPx * 0.4))`),
   marker first; with no label the marker is centred alone per the element's alignment. The
   inline icon keeps its `iconPosition` side of that group.
4. Size: `scale` → `max(10, min(fontSize * 1.1, elementIconSize))`, where `fontSize` is the
   label size (for `scale` text, `max(12, min(height * 0.26, 26))`) and `elementIconSize =
max(16, min(min(w, h) * 0.32, 48))`; fixed buckets from `MARKER_FIXED_PX` (sm 12, md 18,
   lg 26).
5. Glyph on a 24 × 24 viewBox: circles `r=8` in fixed fills; unchecked box a 17 px rounded square
   stroked in the text colour; checked box the same square filled in the text colour with a white
   tick.

### Menu

1. Single element: `showMarkers = target.type === 'shape' && supportsMarkers(target.shape) &&
hasText`, `hasText` = trimmed label non-empty or the element is being edited.
   `supportsMarkers(kind) = !isSelfDrawingShape(kind) && !hasOwnFace(kind)`; it admits the web
   components that carry a label (banner, callout, header), whose face never draws a marker
   [GE16], and the page and icon kinds [QE12].
2. Placement: the Text flyout, after Typography and Alignment.
3. `MarkerTiles`: None + `SHAPE_MARKERS` in order; the Size row (Scale / S / M / L) always
   renders, inert and dimmed at 40 % until a marker is set.
4. Hover previews (`previewMarker`, `previewMarkerSize`), click commits (`commitMarker`,
   `commitMarkerSize`) as one history step with telemetry `Marker` / `MarkerSize`.
5. Multi-selection: shown when any member is a shape passing `supportsMarkers` with a trimmed
   label (`markerSrc`, which also seeds the tiles), writing to every selected shape.
6. The quick style panel has no marker section.
7. Command palette, any single shape selected (`singleIsShape`, no kind or text gate): "Clear
   marker" when one is set, and "Add <name> marker" for each other marker, calling
   `setMarkerSelected` [QE12].

### Export

PNG, SVG and PDF exports do not draw markers [QE11].

## Interfaces and contracts

```ts
export type ShapeMarker =
  'green-circle' | 'orange-circle' | 'red-circle' | 'checkbox-unchecked' | 'checkbox-checked';
export const SHAPE_MARKERS: readonly ShapeMarker[];
// ShapeElement
marker?: ShapeMarker;
markerSize?: TextSize;
export function ShapeMarkerGlyph(props: {
  marker: ShapeMarker;
  size: number;
  color?: string; // checkbox tint; defaults to currentColor
}): JSX.Element;
export function supportsMarkers(kind: ShapeKind): boolean;
export function applyMarkerToEl(el: Element, marker: ShapeMarker | null): Element;
export function applyMarkerSizeToEl(el: Element, size: TextSize): Element;
```

Both apply helpers and `setShapeFieldSelected` write to any shape, self-drawing kinds included
(the renderer then ignores it). `validate.ts` does not check `marker` or `markerSize` [GE5].

## Data and persistence

`marker` and `markerSize` are persisted and optional; absent size is `scale`. Clearing writes
`undefined`. No migration.

## Errors and edge cases

| #   | Case                                  | Handling                                                     |
| --- | ------------------------------------- | ------------------------------------------------------------ |
| E1  | Shape has no label                    | Marker centred per alignment                                 |
| E2  | Label cleared after a marker was set  | Marker stays, centred; menu hides until text returns         |
| E3  | Marker stored on a self-drawing shape | Not drawn                                                    |
| E4  | Unknown `marker` string               | `ShapeMarkerGlyph` falls through to the checked box [GE5]    |
| E5  | Inline icon present                   | Icon on its side, marker hugging the label                   |
| E6  | Rich-text label                       | Runs render beside the marker unchanged                      |
| E7  | Marker on a banner, callout or header | Offered by the menu, never drawn by the face [GE16]          |
| E8  | Marker on a page or an icon           | Inline layout replaces the masthead / caption band [QE12]    |
| E9  | Marker on an own-face kind            | Not drawn at rest; drawn beside the label while it is edited |

## Security and trust

The marker is a closed union rendered from constants; no element string reaches markup. An
unvalidated value only picks a glyph branch [GE5].

## Performance and limits

One 24-unit SVG per marked shape; no measurement.

## Presentation and UX

Fixed circle fills: green `#22c55e`, orange `#f59e0b`, red `#ef4444`; checkboxes follow the
element text colour. Tiles show glyph over label.

## Accessibility

- The glyph is `aria-hidden`; the marker's meaning (status, done) has no text alternative
  (`D104`).
- Colour alone distinguishes the three circles; they share one shape (WCAG 1.4.1) (`D104`).
- No motion.

## Web experience

Canvas-space only (CLS 0). The Size row always renders so the flyout height is stable
([Menu flyouts must not resize under the pointer](../../004-interface-design/flyout-height-stability.md)).

## Observability

Telemetry `track('Element', 'Changed', 'Marker' | 'MarkerSize')` from `commitStyle` or
`setShapeFieldSelected`. No log fingerprints [GE12].

## Testing

| Rule                                         | Test                                                                                    | File                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Set and clear a marker                       | sets and clears a marker on the selected shape                                          | `apps/live/hooks/canvas/useElementStyle.test.ts` |
| Set the size bucket                          | sets the marker size bucket                                                             | `apps/live/hooks/canvas/useElementStyle.test.ts` |
| Command palette offers / clears markers      | offers the marker catalogue; offers Clear marker and hides the current                  | `apps/live/lib/editor-commands.test.ts`          |
| Not offered for non-shapes (palette)         | does not offer markers for a non-shape boxed element                                    | `apps/live/lib/editor-commands.test.ts`          |
| Self-drawing shapes never draw a marker      | none [GE11]                                                                             |                                                  |
| Marker sits left of the label, centred alone | none [GE11]                                                                             |                                                  |
| Menu gate: no self-drawing or own-face kind  | is off for kinds with their own face and for self-drawing kinds; is on for plain shapes | `packages/document/src/collab-shapes.test.ts`    |
| Menu shown only with text; multi-select      | none [GE11]                                                                             |                                                  |
| Export draws the marker                      | none [QE11]                                                                             |                                                  |

## Constants and configuration

| Name              | Value                                         | Provenance / safe range          |
| ----------------- | --------------------------------------------- | -------------------------------- |
| `SHAPE_MARKERS`   | green, orange, red, unchecked, checked        | Spec order                       |
| `MARKER_FIXED_PX` | sm 12, md 18, lg 26                           | `shape-inline-icon-layout.tsx`   |
| Scale factor      | 1.1 × label font, floor 10, ceiling icon size | Inline                           |
| Circle fills      | `#22c55e`, `#f59e0b`, `#ef4444`               | Tailwind green / amber / red-500 |
| Marker-label gap  | `max(4, round(markerPx * 0.4))`               | Inline                           |
