# Map

A **Map** element is a simple map for a slide: the world, a region, or one country's outline, with
countries picked out in the accent and pins with short labels. It is for market, office and
footprint slides ("where we sell", "our offices", "launch countries"), not for navigation: there are
no tiles, no zoom and no streets, and nothing is fetched from anywhere when it draws.

## Behaviour

- Drag it in from the palette (Data category, after Rating) as **Add Map**. It drops as a 480 × 260
  world map with no pins and no highlighted countries.
- **Double-click** it, or press **Edit Map** in its menu, to open the **Map dialog**. Its context
  menu carries a **Map** section (in the Tools flyout, beside Rating and the charts) with a line
  saying what it shows, the Edit Map button and a **View** list of the regions (one country, a
  long list, is picked in the dialog, where it can be searched).
- It is a normal boxed element otherwise: move, resize, rotate, lock, theme colours, shadow, and
  every other boxed behaviour. It draws no box border (`SELF_PAINTING_SHAPES`).
- The map keeps its proportions: it fits its view inside the box, centred, and lets the land around
  the view fill the rest of the box rather than leaving empty bands, so a wide box over Europe shows
  some of the Atlantic and Russia too.

## What it shows

- **View.** One of eight **regions**: World (the default), Europe, Africa, Asia, Middle East, North
  America, South America, Oceania. Or **one country** (picked by name in the View picker), which
  frames that country on its main land and the pieces near it (France frames on Europe with Corsica,
  not on French Guiana) and draws every other country faint behind it for context. The **United
  States** frames on the lower 48, so they fill the box, and draws **Alaska and Hawaii again in
  insets** along the frame's lower left, as an atlas does: Alaska smaller, Hawaii a little larger,
  both in the United States' own fill, so a highlighted United States shows every state. Each
  inset sits on a plate of the paper, so the faint land behind it never runs into it.
- **Highlighted countries** are filled in the accent (the element's stroke colour). The rest of the
  land is the element's fill colour, else a soft neutral for the paper it sits on. Country borders
  are thin lines in the paper colour.
- **Pins** are dots in the text colour with a paper-coloured ring (so a pin reads on a highlighted
  country as well as on plain land), each with an optional **label** beside it,
  written in the element's text colour and font with a paper-coloured halo so it reads over land and
  sea. A label sits right of its pin, or left when it would run past the box's right edge.
- A country focus with highlighted countries highlights them as usual; the faint context countries
  stay faint unless highlighted.

## The Map dialog

A dialog titled **Edit Map** with a large live preview on the left and the controls on the right. On
a phone the preview sits above the controls.

- **View**: the regions, then every country, in one picker; a country frames that country.
- A two-way switch over the preview chooses what a click on it does: **Highlight Countries**
  (the default) toggles the country under the pointer; **Place Pins** drops a pin where it lands. The
  country under the pointer is named in a small readout under the preview.
- **Countries**: the highlighted countries as removable chips, plus a searchable **Add Country**
  field (by name or code).
- **Pins**: a **Find a Place** field searching a catalogue of about 240 cities and capitals (Natural
  Earth's populated places); picking one adds a pin labelled with its name. Each pin is a row with
  its label (editable, up to 40 characters) and a Remove button.
- The dialog edits a draft that its preview shows; **Done** writes it to the element as one undo
  step, and **Cancel** or Escape leaves the map as it was.
- The dialog shows the limits when they are hit: up to 40 pins and 60 highlighted countries.

## Who may do what

Following [gate a feature by share role](../../instructions/gate-a-feature-by-share-role.md):

- **Editor**: everything above, on an unlocked map.
- **Participant** and **Viewer**: see the map; double-click does nothing, the menu shows no Map
  section and the dialog never opens. A participant's own-content rules do not cover a map: it is
  board structure, like a Sankey.

## Model

Map is a `ShapeKind` `'map'`, following the composite-component pattern ([Timeline rail](timeline-rail.md)).

- `mapRegion?: MapRegion`: the region; absent is World.
- `mapCountry?: string`: the country code to frame; when set it outranks `mapRegion`.
- `mapHighlights?: string[]`: highlighted country codes, at most `MAP_HIGHLIGHTS_MAX` (60).
- `mapPins?: MapPin[]`, at most `MAP_PINS_MAX` (40), each `{ id, lat, lon, label? }`: latitude
  -85 to 85, longitude -180 to 180, label up to `MAP_PIN_LABEL_MAX` (40) characters.
- Country codes are ISO 3166-1 alpha-2 ("GB", "US"; Kosovo is "XK"), and Natural Earth's own
  three-letter code for the two places with none (Northern Cyprus "CYN", Somaliland "SOL"). A code
  the geometry does not know is kept and drawn as nothing.
- Validation (`validate-shape.ts`) checks each field's shape; the menu and dialog write only valid
  values.

## Geometry

- **Source**: Natural Earth 1:110m Admin 0 Countries and Populated Places (simple), version 5.1.2,
  **public domain** ([terms](https://www.naturalearthdata.com/about/terms-of-use/)). Recorded as an
  embedded work on the [licences page](../002-project-scope/third-party-licences.md) under the
  licence id `LicenseRef-Public-Domain`, which the allowlist accepts for this reason.
- **Projection**: Equal Earth, an equal-area projection that keeps continents their true relative
  size, projected once at build time into a plane 4000 units wide and rounded to whole units.
- **Built, not hand-edited**: `packages/document/scripts/build-world-map.mjs` turns the two
  downloaded GeoJSON files into `map-geometry.generated.ts` (176 countries, Antarctica left out, and
  the places catalogue). About 58 KB, 26 KB gzipped.
- **Loaded on demand**: the geometry is its own module (`@livedocuments/document/map-geometry`), never
  part of the package barrel, so the editor fetches it only when a page with a map draws, or the
  Map dialog opens, and the main bundle does not grow. While it loads the map shows a soft
  placeholder in the land colour.

## Exports and other surfaces

- **SVG export, snapshots, embeds, MCP renders and the api's thumbnails** draw the map from the same
  pure layout (`mapLayout`) the canvas uses. The geometry reaches the renderer the way icon art
  does: whoever loads it hands it to the document package once (`provideMapGeometry`), and the
  renderer reads what has been provided. Each caller that renders a tab with a map loads it first;
  without it the map draws as its placeholder.
- **PNG and PDF** export rasterise it through that SVG, like the other self-drawing shapes.
- **PowerPoint** exports it as a picture of itself, like every other shape a native slide shape
  cannot say.
- **MCP**: agents create maps with `shape: "map"` and the four fields above; the element docs list
  the regions, the code style and the limits.
- **Telemetry**: `track('Element', 'Added', 'Map')` on create and `track('Element', 'Changed', 'Map')`
  when the dialog commits a change or the View picker changes the view.
