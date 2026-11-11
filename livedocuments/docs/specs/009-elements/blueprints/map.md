# Map: blueprint

Derived from [Map](../map.md). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as
`Dn`.

Scope, by file:

| File                                                     | Role                                                                                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/document/scripts/build-world-map.mjs`          | Builds the geometry module from the two Natural Earth files                                                                                                                                                  |
| `packages/document/src/map-geometry.generated.ts`        | `MAP_GEOMETRY`: countries and places (subpath `@livedocuments/document/map-geometry` only)                                                                                                                   |
| `packages/document/src/map-model.ts`                     | Types, limits, regions, projection, validators, `MAP_REGIONS`, `provideMapGeometry` / `providedMapGeometry`                                                                                                  |
| `packages/document/src/map-layout.ts`                    | `mapLayout`: view window, transform, country fills, pins and labels, shared by every surface                                                                                                                 |
| `packages/document/src/svg-render-map.ts`                | `svgMap`: the export body from `mapLayout`                                                                                                                                                                   |
| `packages/document/src/svg-render-body.ts`               | Routes `'map'` to `svgMap` with the resolved colours                                                                                                                                                         |
| `packages/document/src/shape-factory.ts`                 | Size 480 × 260, no data                                                                                                                                                                                      |
| `packages/document/src/colors.ts`                        | `SELF_PAINTING_SHAPES` membership                                                                                                                                                                            |
| `packages/document/src/validate.ts`, `validate-shape.ts` | Kind accepted; field checks                                                                                                                                                                                  |
| `apps/editor/lib/map-geometry-loader.ts`                 | `loadMapGeometry()` (one dynamic import, cached, provided to the document package), `useMapGeometry()`, `useMapGeometryFor(elements)` for page thumbnails, `ensureMapGeometryFor(elements)` before an export |
| `apps/editor/components/canvas/MapView.tsx`              | Canvas drawing (lazy chunk via `ShapeContentRouter`)                                                                                                                                                         |
| `apps/editor/components/canvas/MapDrawing.tsx`           | The pure SVG drawing shared by the view and the dialog preview                                                                                                                                               |
| `apps/editor/components/dialogs/MapDialog.tsx`           | The Edit Map dialog                                                                                                                                                                                          |
| `apps/editor/components/dialogs/MapSearchField.tsx`      | Add Country and Find a Place: a combobox over the loaded geometry, `matchCountries`, `matchPlaces`                                                                                                           |
| `apps/editor/components/dialogs/MapPinRows.tsx`          | The dialog's pin rows: a label each and Remove                                                                                                                                                               |
| `packages/document/src/map-geometry-ensure.ts`           | `ensureMapGeometry(elements)`: the api's thumbnails and the MCP previews load the geometry before drawing a tab with a map                                                                                   |
| `apps/editor/components/palette/MapMenuSection.tsx`      | The Map section in the Tools flyout                                                                                                                                                                          |
| `apps/editor/hooks/canvas/useMapSetters.ts`              | `setMap(id, patch)`, `setMapViewSelected(view)`, `cleanMapPatch`                                                                                                                                             |
| `apps/editor/lib/map-edit.ts`                            | `canEditMap(can, el)`                                                                                                                                                                                        |
| `apps/editor/components/palette/palette-tile-defs.tsx`   | Tile `data:map`                                                                                                                                                                                              |
| `packages/agent-verbs/src/mcp/element-docs.ts`           | The `map` paragraph of the element docs                                                                                                                                                                      |
| `packages/licences/src/embedded-works.ts`                | The `natural-earth` entry                                                                                                                                                                                    |

## Domain and naming

| Term                | Identifier                                  | Meaning                                                |
| ------------------- | ------------------------------------------- | ------------------------------------------------------ |
| Map                 | `ShapeKind` `'map'`, `isMapShape`           | The element                                            |
| Region              | `MapRegion`, `ShapeElement.mapRegion`       | One of `MAP_REGIONS`; absent is `'world'`              |
| Country focus       | `ShapeElement.mapCountry`                   | A country code that frames the view                    |
| Highlighted country | `ShapeElement.mapHighlights`                | Codes filled in the accent                             |
| Pin                 | `MapPin`, `ShapeElement.mapPins`            | `{ id, lat, lon, label? }`                             |
| View                | `MapView` value `{ region } \| { country }` | What the View picker sets: a region or a country focus |
| Geometry            | `MapGeometry`                               | `{ width, height, countries, places }`                 |
| Country row         | `MapCountryRow`                             | `[code, name, d, x0, y0, x1, y1]`                      |
| Place row           | `MapPlaceRow`                               | `[name, code, lat, lon]`                               |
| Layout              | `MapLayoutResult`                           | `{ transform, countries, pins }` in element px         |

Banned synonyms: "location" for a pin, "zoom" for the view, "tile".

## Constants

| Constant             | Value                                                               | Provenance                                       |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| `MAP_WORLD_WIDTH`    | 4000                                                                | Plane width; 1 unit is 0.5 px on a 1920 px world |
| `MAP_PINS_MAX`       | 40                                                                  | Spec                                             |
| `MAP_HIGHLIGHTS_MAX` | 60                                                                  | Spec                                             |
| `MAP_PIN_LABEL_MAX`  | 40                                                                  | Spec                                             |
| `MAP_LAT_MAX`        | 85                                                                  | Spec                                             |
| Default size         | 480 × 260                                                           | Spec                                             |
| Pin radius           | `clamp(min(w, h) * 0.022, 3.5, 9)` px                               | D194                                             |
| Pin ring             | `max(1.5, r * 0.35)` px in the paper colour                         | D194                                             |
| Label size           | `clamp(min(w, h) * 0.055, 10, 22)` px, weight 600                   | D194                                             |
| Label halo           | stroke `max(2, size * 0.22)` px, paper, `paint-order: stroke`       | D194                                             |
| Border width         | `max(0.5, min(1.2, scale * 6))` px, paper, `stroke-linejoin: round` | D195                                             |
| Faint context        | land at 45% opacity when a country is focused                       | D196                                             |
| Default land         | `#dbe3ec` light paper, `#334155` dark paper                         | D195                                             |

Regions, as longitude and latitude windows (west, south, east, north), D197:

| Region          | Window             |
| --------------- | ------------------ |
| `world`         | -180, -57, 180, 84 |
| `europe`        | -25, 34, 45, 71    |
| `africa`        | -20, -36, 55, 38   |
| `asia`          | 25, -11, 150, 60   |
| `middle-east`   | 24, 11, 64, 43     |
| `north-america` | -170, 7, -50, 75   |
| `south-america` | -85, -57, -32, 14  |
| `oceania`       | 110, -48, 180, 0   |

## Behaviour and state

### Projection

`projectLonLat(lon, lat)` is Equal Earth (A1 1.340264, A2 -0.081106, A3 0.000893, A4 0.003796) scaled
so x spans `[0, MAP_WORLD_WIDTH]` and y `[0, MAP_GEOMETRY.height]`, north up, the same formula the
build script uses (a test projects a few cities both ways). `unprojectPoint(x, y)` inverts it by
Newton's method on θ (at most 12 steps, tolerance 1e-9), clamped to `MAP_LAT_MAX`, for Place Pins.

### Layout (`mapLayout(el, box, geometry)`)

1. The view window: the focused country's frame (its row's `x0..y1`) padded 12% each side, else the
   region's window projected by sampling a 5 × 5 grid of its corners and edges and taking the box.
   An unknown country code falls back to the region.
2. Fit: `scale = min(boxW / winW, boxH / winH)`, the window centred; the transform maps plane units
   to element px. The drawing is clipped to the element box, not the window (the spec's "land
   around the view").
3. Countries: every row, in geometry order, with its fill: accent when highlighted, land otherwise,
   at the faint opacity when a country is focused and this is neither it nor highlighted.
4. Pins: in list order, projected then transformed; a pin outside the box is kept and clipped.
   A label's side is right unless `x + r + gap + estimatedWidth > boxW`, then left
   (`estimatedWidth = label.length * size * 0.56`).

### Edit

1. Double-click a map, or Edit Map in the Map section, opens the dialog when `canEditMap` holds.
2. The dialog holds a draft `{ mapRegion, mapCountry, mapHighlights, mapPins }`; Done calls
   `setMap(id, patch)` once if the draft differs, else just closes.
3. Highlight Countries mode: a click on a country path toggles its code (no-op past the limit, with
   the limit note shown). Place Pins mode: a click adds `{ id: makeId(), lat, lon }` from
   `unprojectPoint`, no label, and focuses that pin's label field.
4. The View picker in the menu calls `setMapViewSelected(view)`, one undo step.

### Setters (`useMapSetters`)

`makeShapePatcher({ matches: (kind) => kind === 'map' })`, telemetry `Map` on each commit.

## Interfaces and contracts

Validation rules (`validate-shape.ts`), each a named rule string:

| Field           | Valid                                                                          |
| --------------- | ------------------------------------------------------------------------------ |
| `mapRegion`     | one of `MAP_REGIONS`                                                           |
| `mapCountry`    | `isMapCode`: 2 or 3 uppercase letters                                          |
| `mapHighlights` | array of at most 60 `isMapCode`                                                |
| `mapPins`       | array of at most 40 `{ id: non-empty string, lat, lon in range, label? ≤ 40 }` |

## Data and persistence

Four optional fields on `ShapeElement`; absent is the default. No migration: older documents have no
maps. Copy, duplicate and paste carry them like any shape field; pin ids are copied as they are
(they only key the dialog's rows).

## Errors and edge cases

- Geometry not loaded yet (nothing provided): the canvas and an export draw the
  placeholder, a rounded rect in the land colour at 60% opacity (D198).
- Geometry import fails (offline first load): the placeholder stays; the loader retries on the next
  mount.
- An empty box (width or height under 8 px): nothing drawn.
- Duplicate codes in `mapHighlights`: drawn once; the dialog never writes duplicates.

## Security and trust

The geometry is first-party static data; labels render as React text and XML-escaped in exports;
no network call at render.

## Performance and limits

- Geometry: 58,181 bytes, 25.8 KB gzipped, one chunk, fetched once per session on first need.
- Canvas: 176 paths in one SVG, memoised on geometry, view and colours; a pan or zoom repaints the
  SVG without re-rendering React. Pins at most 40.
- Export: the full country set is written per map (about 58 KB of SVG each).

## Presentation and UX

Dialog: `max-w-4xl`, preview `aspect-[2/1]` over the controls on phone widths (`sm:` side by side),
shared `Dialog` chrome, Title Case labels, every control with a tooltip, pointer cursors on the
preview's countries in Highlight mode and a crosshair in Place mode.

## Accessibility

The preview is `role="img"` with an `aria-label` naming the view and the counts; every action it
offers is also reachable from the side panel (Add Country, Find a Place), so the map is not the only
way in. The mode switch is a radio group.

## Observability

`track('Element', 'Added', 'Map')`, `track('Element', 'Changed', 'Map')`.

## Testing

- `map-model.test.ts`: projection agrees with the script on known cities; inverse round-trips;
  validators accept and refuse each field; regions project to sane windows.
- `map-layout.test.ts`: fit, centring, faint context, highlight fill, pin placement and label side.
- `svg-render-map.test.ts`: export body with and without geometry.
- `MapDialog.test.tsx`: toggle a country, place a pin, find a place, Done commits once, Cancel none.
- `map-edit.test.ts`: Editor yes; Participant, Viewer and a locked map no.

## Assets and external resources

Natural Earth 1:110m Admin 0 Countries and Populated Places (simple) v5.1.2, public domain, from the
URLs in the build script's header; regenerated with `node scripts/build-world-map.mjs <countries>
<places>` in `packages/document`.
