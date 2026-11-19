# Visio and Lucidchart import

A diagram made in Microsoft Visio, or in Lucidchart, comes into livediagram as a `.vsdx` file: the Import
dialog's **Visio** format fills the active tab and adds a tab per further page, exactly as a multi-page draw.io file
does. It is a migration path for teams leaving Visio or Lucidchart. Everything is parsed in the browser; nothing
touches a server except the image upload the [import image pipeline](import-image-pipeline.md) already owns.

## Lucidchart

Lucidchart has no file of its own that another tool can read: its downloads are pictures (PNG, JPEG, SVG, PDF),
Visio (**File, Export, Visio (VSDX)**, or the older Visio 2010 VDX), a JSON and a CSV of the shape data, and the
`.LAF` bulk backup only Lucid restores. Its VSDX export is the one that carries shapes, text and connections, so a
Lucidchart diagram comes in through this importer: the person exports it as VSDX and imports that file. The Visio
card says so, and so does the help.

## Where it lives

- `apps/editor/lib/visio/`: the importer, a folder of small modules (the package, the shape sheet, the masters, the
  page, the convert), entry point `importVisio(bytes, options)`. Lazy-loaded with the format, so none of it lands in
  the editor's first load. It never throws: it returns `{ ok: false, error }` with a human-readable message.
- It reads the `.vsdx` zip through the shared bounded reader (`apps/editor/lib/zip-reader.ts`) and the XML parts
  through `parseInert` (trusted types), never a bare `DOMParser`.
- **It reuses the draw.io importer's converter.** Each Visio page becomes the same cell tree a draw.io page reads into
  ([draw.io import](drawio-import.md) "The cell tree"): a vertex per shape, an edge per connector, each with the draw.io
  style its master maps to. From there the page goes through draw.io's conversion unchanged: its shape table, page
  scale, labels, colours (defaults and paper colours following the theme), routes, report and image requests. So a
  Visio flowchart lands exactly as the same flowchart drawn in draw.io does, and every rule below that names a
  draw.io style means "and then as draw.io import says". draw.io itself reads `.vsdx` the same way.

## Inputs

One `.vsdx` file (the Visio 2013 and later drawing, a zip of XML parts), or a `.vsdm` (the same with macros, which are
never read). The content is sniffed, never the file name.

| The file                                     | What happens                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| a zip holding `visio/pages/pages.xml`        | imported                                                                                                                       |
| an older binary `.vsd` (an OLE file)         | refused: "This is an older Visio drawing (.vsd). Open it in Visio and save it as a .vsdx, then import that."                   |
| a Visio XML drawing `.vdx` (`VisioDocument`) | refused: "This is a Visio 2010 XML drawing (.vdx). Save it as a .vsdx in Visio, or export it from Lucidchart as Visio (VSDX)." |
| any other zip                                | refused: "This isn't a Visio file. Pick a .vsdx, saved from Visio or exported from Lucidchart (File, Export, Visio (VSDX))."   |
| anything else                                | refused with the same message                                                                                                  |

Other refusals: "This file is too large to import (the limit is 50 MB).", "This .vsdx couldn't be read: the file
looks damaged." (a broken zip, an entry that does not inflate, a part that is not XML), "This file unpacks to more
than an import can read." (past the inflate budget), "This Visio file has no pages.", and, for anything else, "Couldn't
read this Visio file."

**Limits** (every one a named constant, the file is untrusted):

- A file over 50 MB is refused before it is read.
- A zip with more than `VISIO_MAX_ZIP_ENTRIES` (10 000) entries is refused as damaged.
- Inflating stops at 100 MB of output across the whole import (a zip-bomb guard), refusing the file; a single XML part
  larger than `VISIO_MAX_PART_BYTES` (20 MB) is refused the same way, before it is parsed.
- A part with more than `VISIO_MAX_XML_ELEMENTS` (400 000) XML elements is refused as too large.
- A file with more than 100 pages imports the first 100 and counts the rest; a file with more than
  `VISIO_MAX_MASTERS` (2 000) masters reads the first 2 000 (the rest map as unknown masters).
- A page with more than `MAX_ELEMENTS_PER_TAB` (10 000) shapes imports the first 10 000 in document order and counts
  the rest. Groups nest at most `VISIO_MAX_GROUP_DEPTH` (32) deep; deeper shapes are counted and left out.
- An embedded picture over `VISIO_MAX_IMAGE_BYTES` (10 MB) comes in as a placeholder.

## Pages become tabs

Exactly as [draw.io import](drawio-import.md) "Pages become tabs": the first page replaces the active tab, every
further page becomes a new tab after it with the active tab's theme, font, text size and background, a single-page
file leaves the tab's name alone, a multi-page file names every tab after its page (`Page n` when unnamed), one undo
takes the whole import back. Background pages are pages like any other, in the file's page order.

## Mapping

### Units and geometry

- Visio measures in inches from the page's bottom-left corner, y upwards. A length becomes `VISIO_PX_PER_INCH` (96)
  pixels, the CSS inch, and y is flipped against the page's height (`PageHeight`, 11 inches when unset).
- A 2-D shape's box is its `Width` and `Height` centred where its `PinX` / `PinY`, `LocPinX` / `LocPinY` and `Angle`
  put its middle. `Angle` (radians, anticlockwise) becomes `rotation` (degrees, clockwise); `FlipX` / `FlipY` become
  draw.io's `flipH` / `flipV`.
- A shape inside a group is in the group's own coordinates; every shape is resolved to page coordinates through each
  enclosing group's pin, local pin and angle.
- **Inheritance.** A shape's cell (`<Cell N="...">`) and section rows come from the shape itself, else from its master's
  shape (`Master`, and `MasterShape` for a shape inside a master's group), else they are unset. A value is the cell's
  `V`, its formula's last computed result. Style sheets are not read: what a shape does not set itself, or its master
  for it, is left to the theme, as a draw.io default is.

### Shapes

A 2-D shape's **master** decides what it becomes. Its name (`NameU`, the universal name, case and Visio's `.12` copy
number ignored) is looked up in one table of the common **Basic Shapes** and **Basic Flowchart Shapes** masters. Each
row names the draw.io style the shape is built as; a row marked approximated is counted (`shape-approximated`).

| Visio master                                                                     | Built as (draw.io)                         | Fidelity     |
| -------------------------------------------------------------------------------- | ------------------------------------------ | ------------ |
| Rectangle, Square, Process                                                       | rectangle                                  | exact        |
| Rounded rectangle, Rounded square                                                | rectangle, rounded                         | exact        |
| Ellipse, Circle, On-page reference                                               | `ellipse`                                  | exact        |
| Diamond, Decision                                                                | `rhombus`                                  | exact        |
| Triangle                                                                         | `triangle` pointing up                     | exact        |
| Hexagon, Preparation                                                             | `hexagon`                                  | exact        |
| Can, Cylinder, Database                                                          | `cylinder3`                                | exact        |
| Parallelogram, Data                                                              | `parallelogram`                            | exact        |
| Trapezoid                                                                        | `trapezoid`                                | exact        |
| Document                                                                         | `document`                                 | exact        |
| Start/End, Terminator                                                            | `mxgraph.flowchart.terminator` (a stadium) | exact        |
| 5-point star, Star                                                               | `mxgraph.basic.star`                       | exact        |
| Annotation                                                                       | `text`                                     | exact        |
| Pentagon, Heptagon, Octagon, Decagon                                             | `hexagon`                                  | approximated |
| Right triangle, Merge                                                            | `triangle` (Merge pointing down)           | approximated |
| Extract                                                                          | `triangle` pointing up                     | approximated |
| Subprocess, Predefined process, Off-page reference, Internal storage, Card, Cube | rectangle                                  | approximated |
| Custom 1, Custom 2, Custom 3, Custom 4                                           | rectangle                                  | approximated |
| Multiple documents, Paper tape                                                   | `document`                                 | approximated |
| Stored data, Direct data, Sequential data, External data                         | `cylinder3`                                | approximated |
| Manual input, Manual operation, Loop limit                                       | `trapezoid`                                | approximated |
| Delay, Display                                                                   | `mxgraph.flowchart.terminator`             | approximated |
| Sort, Collate                                                                    | `rhombus`                                  | approximated |

**A shape with no master** (Visio's own drawing tools, and what Lucidchart's VSDX export writes for most shapes) is
read from its geometry: a geometry section holding an `Ellipse` row is an ellipse; one whose points are the box's four
corners is a rectangle (rounded when `Rounding` is set); one whose points are the middles of the box's four sides is a
diamond. A shape whose geometry is hidden (`NoShow`), or draws neither fill nor line (`NoFill` and `NoLine`), or has no
geometry at all, is a **text box**. A masterless shape with no text and nothing drawn is left out silently: there is
nothing to see.

**Every other shape comes in as a text box** (owner decision, Work Tracker 914): a `text` element in the shape's box
carrying its text, so no words are lost; a shape without text carries its master's name (or "Shape") so the diagram
still says what stood there. Counted (`shape-as-text`), the report listing the master names with their counts A stencil shape built as a group is one text box too: its sub-shapes are its artwork and are not read
separately, and a connector glued to one of them lands on the text box.

**Groups.** A group whose master maps is that one shape: its sub-shapes are the master's own artwork and are not read
separately, though a connector glued to one of them lands on the group. Any other group draws itself (when it has
geometry or text of its own, by the rules above) and then its sub-shapes, each resolved to page coordinates; its own
outline is otherwise dropped and counted (`group-flattened`), as draw.io's groups are.

**Pictures.** A foreign shape holding a raster picture (PNG, JPEG, GIF, BMP, WebP) becomes an `image` whose picture
goes through the import image pipeline as a draw.io embedded image does: stored once per distinct picture, reported per
image, never failing the import. A picture of any other kind (a metafile, an OLE object), or one past
`VISIO_MAX_IMAGE_BYTES`, comes in as a placeholder, counted (`image-unavailable`).

### Properties

- **Fill**: `FillForegnd` becomes `fillColor`; `FillPattern` 0 or `FillForegndTrans` 1 is no fill.
- **Line**: `LineColor` becomes `strokeColor`; `LinePattern` 0 is no line, 1 solid, 3 (dots) dotted, any other
  dashed; `LineWeight` (inches) becomes `strokeWidth` in pixels.
- **Colours**: a `#rrggbb` value is kept; a number is an index into the document's colour table, else Visio's
  standard 24 colours; anything else (a theme reference with no computed value) is left unset.
- **Rounding** (inches) becomes `rounded` with an absolute arc in pixels.
- **Text**: the shape's `<Text>`, its fields' shown values included, line breaks kept (a trailing one dropped), cut at
  `VISIO_MAX_TEXT` (5 000) characters and counted (`text-truncated`). The first character row gives `fontSize`
  (its `Size` cell, stored in inches, times 96; a shape with none takes 16 px, Visio's 12 pt), `fontColor`, bold, italic and underline (`Style` bits 1, 2 and 4) and `fontFamily` (the `Font`
  cell's name); the first paragraph row's `HorzAlign` gives the alignment (left, centre, right; justified reads as
  left) and `VerticalAlign` the vertical one (top, middle, bottom). Visio's defaults are centre and middle, text boxes
  included.
- Hyperlinks, shape data, comments, layers (every shape comes in, on the tab's one layer), themes and effects
  (gradients, shadows, glow) are not read: see "Accepted losses".

### Connectors

A 1-D shape (it has `BeginX` and `EndX`, the Dynamic connector and every line) is a connection:

- Its ends are the `Connect` records that glue it (`FromCell` `BeginX` or `EndX`, `ToSheet` the shape): a glued end
  pins to the element that shape became (a shape inside a mapped master or a dropped group hands it to its nearest
  ancestor that became one). An unglued end is a free end at `BeginX` / `BeginY` or `EndX` / `EndY`.
- Its route is its geometry: the points between its first and last vertex become the waypoints, so the line takes
  Visio's corners; a route with an arc, a spline or a NURBS row is curved through the same points.
- `BeginArrow` / `EndArrow`: 0 is no head; 1 to 3 an open (line) head; 4, 5 and 13 a filled triangle; 20 a circle;
  22 a diamond; any other head a filled triangle, counted (`arrowhead-approximated`).
- Its line takes the properties above and its text is the connection's label, at its middle.

## The import report

The one import report every importer shares, through draw.io's tally and rules ([draw.io import](drawio-import.md)
"The import report"), with one rule only Visio raises:

| Kind            | Rule (the report shows "count · rule")                                          | Shown as |
| --------------- | ------------------------------------------------------------------------------- | -------- |
| `shape-as-text` | Shapes with no livediagram match came in as text boxes (the top 5 master names) | changed  |

It sits after `shape-unmatched` in the report's order. Every draw.io rule a Visio page can raise keeps its wording.

## Accepted losses (documented, not counted)

- Style sheets and the document theme: what a shape leaves to them takes the tab's theme.
- Gradients, shadows, glow, bevels, sketchy lines and fill patterns other than solid: solid fills.
- Character formatting past the first run, and paragraph formatting past the first paragraph: one style per label.
- Layers, their visibility and locks; shape data, hyperlinks, comments and screen tips.
- Text block position and margins (`TxtPinX`, `TxtWidth`): the label sits in its shape.
- Line ends' sizes (`BeginArrowSize`, `EndArrowSize`), line caps and corner rounding on connectors.
- Containers, swimlanes and callouts from stencils other than Basic and Flowchart: their outline is a text box with
  their words.
- Page size, print setup, drawing scale and the page's background colour.

## UI

- **Import dialog.** An eighth format card, **Visio**, after draw.io: "A .vsdx from Visio, or a Lucidchart diagram
  exported as Visio (VSDX). Keeps shapes, text, connections and pages." Its file icon reads `vsdx`. The file is binary,
  so its panel has no paste box: a drop target ("Drop a .vsdx file here, or choose one") that opens the picker when
  pressed and takes a dropped file, one line under it ("From Lucidchart: File, Export, Visio (VSDX), then import that
  file."), the format's help link in the footer and **Choose a File**. The picker accepts `.vsdx`, `.vsdm` and the
  Visio media types. While images store, the panel counts them, as every format's does; errors show under the target.
- **The report.** As draw.io's: after an import with a rule or images, the dialog shows the shared report.
- **Start screen.** The start screen's Import list ([Start diagramming](../007-editor/start-diagramming.md) "Import")
  lists **Visio** after draw.io, its file `.vsdx` and its line "A Visio drawing, or a Lucidchart Visio export";
  picking it opens this dialog at the Visio format.
- **Explorer.** The Explorer's **Import from draw.io** ([draw.io import](drawio-import.md) "Import as new canvass")
  reads a `.vsdx` among the files it is given as it reads a draw.io file: each becomes its own canvas, its pages as
  tabs, named after the file (without `.vsdx`) and dated by the file's last-modified time.
- **Share roles.** Importing replaces a tab, so it is an Editor's alone, as every Import format is: a Participant and a
  Viewer have no Import in the tab menu and no start screen.
- **Telemetry** ([Telemetry](../017-telemetry/telemetry.md)): `track('Tab', 'Imported', 'Visio')` once per import into
  a tab; an Explorer import counts as a draw.io one does.
- **Help centre.** The Importing a Tab article lists Visio, what maps, how to export from Lucidchart and what the
  report means; the draw.io Explorer article says it reads `.vsdx` too; registry keywords gain
  `visio vsdx lucidchart lucid`.

## Non-goals

- Exporting to Visio.
- `.vsd` (binary) and `.vdx` (XML) drawings, and Visio stencils (`.vssx`) and templates (`.vstx`): refused or not
  offered; Visio saves any of them as a `.vsdx`.
- Masters beyond the Basic and Flowchart ones above (network, cloud, floor plans, UML, BPMN stencils): their shapes
  come in as text boxes (owner decision).
- Lucidchart's JSON, CSV and `.LAF` exports, and Lucidchart links: Lucid's own formats, with no geometry or no public
  layout; the VSDX export is the route.
