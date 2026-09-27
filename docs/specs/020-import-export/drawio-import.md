# draw.io import

The Import dialog gains a **draw.io** format: a diagram made in draw.io (diagrams.net, the desktop app,
the VS Code and Confluence plugins) comes into livediagram near-losslessly. It is a migration path: a
person with a hundred boards in draw.io should be able to bring each one across in one step and trust
what arrives. Everything is parsed in the browser; nothing touches a server except, later, the image
upload the image pipeline already owns.

Two promises shape the design:

- **Near-lossless for everyday diagrams.** Flowcharts, swimlanes, UML-ish class and entity boxes,
  tables, architecture diagrams with cloud stencils, and multi-page files keep their shapes, text,
  colours, connections and structure.
- **Nothing degrades silently.** Every difference between the draw.io file and the imported tab is
  either a documented, accepted loss (listed in this spec, the same for every file) or counted in the
  import's report and shown to the person importing, with what it affected.

## Where it lives

- `apps/live/lib/drawio/`: the importer, a folder of small modules (decode, style, cells, shapes,
  labels, edges, convert), entry point `importDrawio(input, options)`. Sibling of
  `excalidraw-import.ts`; lazy-loaded by `useTabImport` so none of it lands in the editor's first
  load. It never throws on bad input: it returns `{ ok: false, error }` with a human-readable message.
- `apps/live/lib/import-report.ts`: the import report every importer can return (kinds, counts,
  copy). draw.io is its first user; later importers (Miro, Microsoft Whiteboard) reuse it.
- Nothing lives in `packages/`: only the editor imports draw.io files, and the importer leans on the
  browser's `DOMParser` and `DecompressionStream`, which the Workers runtime lacks.

The importer is **pure with respect to the editor**: bytes or text in, pages of elements plus a report
and a list of pending images out. Applying the result to tabs is the hook's job. That split is what lets
bulk import (many files at once, not built) reuse the importer unchanged later.

## Inputs

One file or one pasted text. The importer sniffs the content, never the file name:

| Input                            | How it is recognised                                    | How the diagram XML is reached                                                                  |
| -------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `.drawio` / `.xml`, uncompressed | root element `mxfile`, `<diagram>` holds `mxGraphModel` | directly                                                                                        |
| `.drawio` / `.xml`, compressed   | root `mxfile`, `<diagram>` holds text                   | base64 decode, raw inflate, `decodeURIComponent` (draw.io's own `Graph.decompress`)             |
| bare `mxGraphModel`              | root element `mxGraphModel`                             | directly; one page, named after nothing (see pages)                                             |
| `.drawio.svg`                    | root element `svg` with a `content` attribute           | the attribute holds an `mxfile` (compressed or not); a base64 value is decoded first            |
| `.drawio.png`                    | the PNG signature                                       | a `tEXt` or `zTXt` chunk keyed `mxfile` or `mxGraphModel`, URI-decoded; `zTXt` is zlib inflated |
| pasted XML                       | as for the file forms above                             | as above                                                                                        |

A PNG or SVG without an embedded diagram is refused with a message saying so ("This PNG has no draw.io
diagram inside. In draw.io, export as PNG with 'Include a copy of my diagram' ticked."). Refusals are
named and specific: not XML, not a draw.io file, a page that fails to decode (named by page), a file
over the size limit, a file with no pages.

**Limits.** A file over 50 MB is refused before reading. Inflating stops at 100 MB of output across the
whole file (a zip-bomb guard), refusing the file. A file with more than 100 pages imports the first 100
and counts the rest. A page with more than `MAX_ELEMENTS_PER_TAB` (10 000) elements imports the first
10 000 in document order and counts the rest.

## Pages become tabs

A draw.io file holds one or more pages. Each page becomes its own tab:

- **The first page replaces the active tab**, exactly as every other import format does (the Import
  dialog's warning names that tab).
- **Every further page becomes a new tab**, inserted straight after the active tab in page order.
- **Names.** A single-page file leaves the active tab's name alone, like every other format. A
  multi-page file names every tab after its page, the active tab included, so the set reads as the
  file's pages. An empty page name falls back to `Page n`.
- **One undo step.** The replace and the new tabs go through one `commitTabs`, so a single undo takes
  the whole import back, new tabs included.
- The active tab stays active and is framed; the new tabs frame when first visited.
- Links between pages (`data:page/id,...`) become tab links to the tab the page turned into.

The dialog's draw.io card says this up front: "Multi-page files add a tab for each further page."

## Mapping

Ids are re-minted inside the converter (with a map so connections, parents and links follow), so
imported elements cannot collide with anything already on the diagram.

### The cell tree

- **Layers.** The root cell's children are draw.io layers. One layer imports as the tab's implicit
  default layer; two or more become `Tab.layers` in the same order (bottom to top), with their names,
  `visible="0"` as a hidden layer and `locked=1` as a locked layer. Every element carries its layer.
- **Geometry.** A cell's geometry is relative to its parent's origin; the converter resolves every
  cell to absolute canvas coordinates. A `relative="1"` vertex geometry inside a vertex is a fraction
  of the parent's size plus an offset. Edge waypoints and loose edge ends are in the edge's parent's
  coordinates and are resolved the same way.
- **Order.** Elements keep draw.io's paint order: a depth-first walk, parents before their children.
- **Groups.** A `group` cell (an invisible container) is dropped and its children come in where they
  were: livediagram has no groups ([Web components are elements; groups are gone](../009-elements/web-components-and-no-groups.md)).
  Counted (`group-flattened`).
- **Containers.** A visible vertex with children (`container=1`, or simply a parent) imports as its
  own element, and its children import as separate elements inside it.
- **Hidden cells** (`visible="0"` on a vertex or edge) are skipped. Counted (`hidden-skipped`).
- **Collapsed containers** (`collapsed="1"`) import at their collapsed size without their children,
  as draw.io shows them. The children are counted (`collapsed-skipped`).
- **`UserObject` / `object` wrappers** carry the label (`label`), a link (`link`) and a tooltip
  (`tooltip`); other attributes are custom properties. `placeholders="1"` labels have their `%name%`
  references filled from those properties first.

### Vertices: shapes

The style string names a shape by its first token (`ellipse;...`, `swimlane;...`) or by `shape=...`.
The mapping is one table; a row marked **exact** is not counted, a row marked **approximated** is
counted (`shape-approximated`), and anything not in the table is **unmatched** (next section).

| draw.io                                                                                                                                                                                                                                                                                       | livediagram                                                                   | Fidelity     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------ |
| default rectangle, `rect`, `label`, `mxgraph.flowchart.process`, `mxgraph.basic.rect`                                                                                                                                                                                                         | `square`; `rounded=1` maps `arcSize` to the nearest `borderRadius`            | exact        |
| `ellipse`, `mxgraph.flowchart.start_1`, `startState`, `mxgraph.flowchart.on-page_reference`                                                                                                                                                                                                   | `circle` (fills its box, so a wide one is an ellipse)                         | exact        |
| `rhombus`, `mxgraph.flowchart.decision`                                                                                                                                                                                                                                                       | `diamond`                                                                     | exact        |
| `triangle`                                                                                                                                                                                                                                                                                    | `triangle`, turned to draw.io's `direction` (east by default) with `rotation` | exact        |
| `hexagon`, `mxgraph.flowchart.preparation`                                                                                                                                                                                                                                                    | `hexagon`                                                                     | exact        |
| `cylinder`, `cylinder3`, `datastore`, `mxgraph.flowchart.database`                                                                                                                                                                                                                            | `cylinder`                                                                    | exact        |
| `cloud`, `mxgraph.networks.cloud`                                                                                                                                                                                                                                                             | `cloud`                                                                       | exact        |
| `parallelogram`, `mxgraph.flowchart.data`                                                                                                                                                                                                                                                     | `parallelogram`                                                               | exact        |
| `trapezoid`                                                                                                                                                                                                                                                                                   | `trapezoid`                                                                   | exact        |
| `document`, `mxgraph.flowchart.document`                                                                                                                                                                                                                                                      | `document`                                                                    | exact        |
| `actor`, `umlActor`                                                                                                                                                                                                                                                                           | `actor`                                                                       | exact        |
| `mxgraph.flowchart.terminator`                                                                                                                                                                                                                                                                | `stadium`                                                                     | exact        |
| `mxgraph.basic.star`                                                                                                                                                                                                                                                                          | `star`                                                                        | exact        |
| `callout`, `wedgeCallout`                                                                                                                                                                                                                                                                     | `speech-bubble`                                                               | exact        |
| `note`                                                                                                                                                                                                                                                                                        | `sticky` with its fill                                                        | exact        |
| `text`, `edgeLabel` on a vertex                                                                                                                                                                                                                                                               | `text`                                                                        | exact        |
| `line` (a vertex drawn as a line)                                                                                                                                                                                                                                                             | headless `arrow` across the box's middle                                      | exact        |
| `swimlane`                                                                                                                                                                                                                                                                                    | `lane`, or `entity` for a class / entity stack (below)                        | exact        |
| `table` (with `tableRow` rows)                                                                                                                                                                                                                                                                | `table` (below)                                                               | exact        |
| `image`                                                                                                                                                                                                                                                                                       | `image` (below)                                                               | exact        |
| `umlFrame`                                                                                                                                                                                                                                                                                    | `frame`                                                                       | exact        |
| `mxgraph.android.phone2`, `mxgraph.ios7.misc.iphone`                                                                                                                                                                                                                                          | `phone`                                                                       | exact        |
| `mxgraph.mockup.containers.browserWindow`                                                                                                                                                                                                                                                     | `browser`                                                                     | exact        |
| `doubleEllipse`, `orEllipse`, `sumEllipse`, `or`, `xor`, `endState`, `mxgraph.flowchart.start_2`, `umlBoundary`, `umlEntity`, `umlControl`, `mxgraph.bpmn.event`, `lineEllipse`                                                                                                               | `circle`                                                                      | approximated |
| `process`, `internalStorage`, `card`, `cube`, `folder`, `component`, `module`, `offPageConnector`, `mxgraph.flowchart.predefined_process`, `mxgraph.flowchart.off-page_reference`, `umlLifeline`, `partialRectangle`, `singleArrow`, `doubleArrow`, `mxgraph.bpmn.task`, `mxgraph.bpmn.shape` | `square`                                                                      | approximated |
| `delay`, `display`, `mxgraph.flowchart.delay`, `mxgraph.flowchart.display`                                                                                                                                                                                                                    | `stadium`                                                                     | approximated |
| `step`                                                                                                                                                                                                                                                                                        | `parallelogram`                                                               | approximated |
| `manualInput`, `loopLimit`, `mxgraph.flowchart.manual_input`, `mxgraph.flowchart.loop_limit`, `mxgraph.flowchart.manual_operation`                                                                                                                                                            | `trapezoid`                                                                   | approximated |
| `tape`, `mxgraph.flowchart.paper_tape`, `mxgraph.flowchart.multi-document`                                                                                                                                                                                                                    | `document`                                                                    | approximated |
| `dataStorage`, `mxgraph.flowchart.stored_data`, `mxgraph.flowchart.direct_data`, `mxgraph.flowchart.sequential_data`                                                                                                                                                                          | `cylinder`                                                                    | approximated |
| `mxgraph.bpmn.gateway2`, `mxgraph.flowchart.merge_or_storage`, `mxgraph.flowchart.extract_or_measurement`                                                                                                                                                                                     | `diamond` / `triangle`                                                        | approximated |
| `mxgraph.aws4.group`, `mxgraph.aws4.groupCenter`, `mxgraph.gcp2.*` groups                                                                                                                                                                                                                     | `frame` with the group's label                                                | approximated |

A shape turned by `direction` other than the triangle keeps its upright livediagram form (counted with
the approximated shapes). `flipH` / `flipV` on an asymmetric shape is dropped the same way.

### Vertices: stencils, icons and unmatched shapes

Cloud and network stencils map to a livediagram icon only where the match is clear. Each match is an
`icon` shape carrying the icon id, its label as the caption, and counts as `icon-substituted` (the
look changes, the meaning does not):

- **AWS** (`mxgraph.aws4.*`, including `resourceIcon;resIcon=...` and `productIcon;prIcon=...`):
  S3 and buckets, EC2 and instance types, Lambda and functions, RDS / Aurora instances, DynamoDB,
  API Gateway, CloudFront, Route 53 and hosted zones, VPC, SQS and queues, SNS and topics, ECS, EKS,
  CloudWatch and alarms, IAM and roles, to the matching `aws-*` Technology icon.
- **Azure** (draw.io's `img/lib/azure2/...svg` icon images): virtual machines,
  storage accounts and blobs, App Service, Function Apps, SQL Database, Cosmos DB, AKS, virtual
  networks, load balancers, Service Bus, Key Vault, Monitor, to the matching `azure-*` icon.
- **Kubernetes** (`mxgraph.kubernetes.*`): the `k8s` icon, the resource kind (Pod, Deployment, ...) as
  the caption when the cell has no label.
- **Network** (`mxgraph.networks.*`): servers to `server`, PCs and monitors to `monitor`, phones and
  tablets to `smartphone`, users to `user` / `users`, firewalls to `shield`, storage to `hard-drive`,
  terminals to `terminal`, secured / unsecure to `lock` / `unlock` (line-art icons).

A tech icon's size is the nearest `iconSize` preset to the stencil's box. Its label, which draw.io
draws outside the box (usually below), becomes the icon's caption on the same side, and the box grows
to hold it.

**Unmatched** shapes (Cisco, GCP, BPMN detail, electrical, custom `stencil(...)` shapes, anything not
listed) come in as a **labelled box**: a `square` in the stencil's box with its colours and label.
When the cell has no label, the box is labelled with the stencil's readable name (`router` for
`mxgraph.cisco.routers.router`) so the diagram still says what stood there. Counted
(`shape-unmatched`), and the report lists the stencil names with their counts.

### Vertices: containers with a meaning

- **Swimlanes** (`swimlane`) become `lane`s. draw.io's title strip is `startSize` thick: a horizontal
  swimlane (the default) puts it across the top (`textAlignX: 'center'`, `textAlignY: 'top'`), a
  `horizontal=0` one down the left (`textAlignX: 'left'`), and `headerSize` takes `startSize`. The
  swimlane's `fillColor` is its title strip (`headerFill`), `swimlaneFillColor` its body (`fillColor`,
  transparent when absent). A pool is a swimlane of swimlanes: every level becomes a lane.
- **Class and entity stacks.** A swimlane with `childLayout=stackLayout` whose children are all text
  rows or separator lines is a UML class or an entity box: it becomes an `entity`, its title the
  swimlane's label and its rows the `entityFields` (a row `name: type` splits at the last colon; a
  separator line is dropped). Connections to a row attach to the entity. Rows beyond
  `ENTITY_MAX_FIELDS`, and text beyond `ENTITY_MAX_TEXT`, are cut and counted (`text-truncated`).
- **Tables** (`shape=table` with `shape=tableRow` children) become a `table`: one row per row, one
  cell per cell, the row heights and the first row's column widths carried over. A table's own label
  (the title draw.io draws in its `startSize` strip) comes in as a `text` element above the grid,
  counted (`shape-approximated`).

### Vertices: properties

- `fillColor` to `fillColor`, `strokeColor` to `strokeColor`, `fontColor` to `textColor`. A hex colour
  is kept verbatim; `none` is `transparent` for a fill and `strokeWidth: 'none'` for a stroke;
  `light-dark(a, b)` takes the light value `a`. **`default`, or no colour at all, is left unset**, so
  the element takes the tab's theme like anything drawn in livediagram: draw.io's white-and-black
  defaults become the theme's defaults (a documented decision, not a loss).
- `strokeWidth` (px) to the nearest `thin` / `medium` / `thick` / `extra-thick`; `0` to `none`.
- `dashed=1` to `dashed`; a `dashPattern` whose dashes are no longer than its gaps to `dotted`.
- `rounded=1` with `arcSize` (a percentage of the shorter side, default 10; `absoluteArcSize=1` makes
  it px) to the nearest `borderRadius` preset.
- `opacity` 0 to 100 to `opacity` 0 to 1 (100 omitted). `rotation` (degrees, clockwise) to `rotation`.
- `shadow=1` to a fixed soft drop shadow.
- `locked=1` to `locked`.
- `link` to an element link: `http(s):` and `mailto:` to a URL link, `data:page/id,<id>` to a tab link.
  Any other scheme (`data:action/...`, `javascript:`) is dropped and counted (`link-dropped`).
- `tooltip` and the custom properties go into the element's `note`, one `name: value` line each.

### Labels

- **Plain labels** (`html` absent or `0`) keep their text, newlines included.
- **HTML labels** (`html=1`) are parsed as HTML, never rendered: block elements and `<br>` become line
  breaks, lists become `•` / `1.` lines, entities decode, whitespace collapses as a browser would.
  Formatting becomes `richText` runs where the element has them: bold, italic, underline,
  strike-through, colour, links (`http(s)` / `mailto` only) and `<h1>` to `<h3>` headings. `label` is
  always the plain text of the runs.
- `fontStyle` bits (1 bold, 2 italic, 4 underline, 8 strike-through) to `textBold` / `textItalic` /
  `textUnderline` / `textStrikethrough`.
- `fontSize` (px) to the `textSize` preset whose rendered size is nearest on the element's own scale
  (shape labels, sticky notes and arrow captions each have one), so a 12 px draw.io label is `sm`, not
  the 22 px default.
- `fontFamily` to a livediagram font where the name matches one (`Courier New` and monospace faces to
  `roboto-mono`, sketch faces to `caveat`, a family we ship by name to itself); anything else, and
  Helvetica, the default, is left unset.
- `align` to `textAlignX`; `verticalAlign` to `textAlignY`.
- A label draw.io places **outside** its shape (`labelPosition` / `verticalLabelPosition` other than
  centre) on anything but an icon is kept inside the shape, aligned towards that side. Counted
  (`label-moved`).

### Edges

- **Ends.** An edge's `source` / `target` pin its ends to the elements they became. `exitX` / `exitY`
  (and `entry...`) name a point on the shape; the end pins to the nearest anchor the shape offers.
  A floating end pins to the anchor nearest where the line towards the next point leaves the shape;
  an orthogonal edge's floating end sits at the middle of the side the line leaves through. A cell that was consumed (an entity
  row, a table cell, a dropped group) hands its connections to the nearest ancestor that became an
  element. An end with no cell, or an end on another edge, is a free end at its geometry point;
  one that had a cell but has nowhere to pin is counted (`connection-loosened`).
- **Route.** `edgeStyle=orthogonalEdgeStyle`, `elbowEdgeStyle`, `entityRelationEdgeStyle`,
  `segmentEdgeStyle`, `isometricEdgeStyle` and the other routers are `angled`; `curved=1` is `curved`;
  no edge style is `straight`. Waypoints become `curvePoints`: through them as given for a curved
  edge; as a polyline for a straight edge (an `angled` arrow through its points, which is how
  livediagram draws a bent straight line); with right-angle corners added between them for an
  orthogonal edge.
- **Heads.** `endArrow` / `startArrow` decide `arrowEnds` (draw.io's default end is `classic`, its
  default start none). The head shape is one per arrow: the end's, else the start's. `classic`,
  `block`, `classicThin`, `blockThin` to `triangle`; `open`, `openThin` to `line`; `oval`, `circle`
  to `circle`; `diamond`, `diamondThin` to `diamond`; `startFill=0` / `endFill=0` to the hollow
  variant. `endSize` / `startSize` to the nearest `arrowheadSize`. Two different heads on one arrow,
  and markers livediagram does not draw (`dash`, `cross`, `async`, `box`, `halfCircle`, the ER
  crow's feet `ERone`, `ERmany`, `ERmandOne`, `ERoneToMany`, `ERzeroToOne`, `ERzeroToMany`, ...),
  become the nearest head and are counted (`arrowhead-approximated`).
- **Stroke.** `strokeColor`, `strokeWidth` (px, kept as a number), `dashed`, `opacity` as for
  vertices.
- **Labels.** The edge's own value and its `edgeLabel` children form the arrow's one label; several
  labels join with a line break and are counted (`label-moved`). A label placed away from the middle
  (`x` other than 0 on its geometry) keeps its place along the line as `labelOffset`. Font size and
  styling map as for vertex labels, on the arrow caption scale.

### Images

A vertex with `shape=image` becomes an `image` element in its box, its label as `alt`. livediagram
stores image bytes in its image pipeline ([Image element + per-owner gallery](../009-elements/images.md)),
never inside the diagram, so the bytes are **not** written into the element:

- `image=data:...` (an embedded image): the element is a **placeholder** (`imageId: null`) and the
  image joins the result's **pending images** list (element id + data URL). Counted
  (`image-placeholder`).
- Any other `image=` (a web URL, or one of draw.io's own library paths such as
  `img/lib/azure2/...`, unless it matched an icon above): a placeholder, the URL kept in the pending
  list. Counted (`image-unavailable`): the importer never fetches from third parties.
- An `image=` on a shape that is not an image shape (a `label` style with an icon): the shape
  imports without the picture. Counted (`image-unavailable`).
- A page `backgroundImage`: dropped. Counted (`image-unavailable`).

The pending list is the seam for the shared import image pipeline (browser resize to WebP, then the
existing upload, within the hosted per-owner cap): once it lands, the hook hands the list to it and each
uploaded image fills its placeholder's `imageId`. Anything the pipeline cannot place (the cap, a failed
upload, an unsupported format) stays a placeholder and stays counted; an import never fails because of
an image.

### The page

- `background` on the page's `mxGraphModel` to the tab's `backgroundColor` (`none` leaves it unset).
- The tab keeps its own theme, pattern and font.

## The import report

Every import returns a report: pages imported, elements created, and one line per kind of degradation
that occurred, with its count. The kinds are a closed set shared by every importer
(`ImportNoteKind`):

| Kind                     | Meaning                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `shape-unmatched`        | a shape with no livediagram match, imported as a labelled box (names listed)                                |
| `shape-approximated`     | a shape imported as the nearest livediagram shape                                                           |
| `icon-substituted`       | a vendor stencil imported as the matching livediagram icon                                                  |
| `image-placeholder`      | an embedded image imported as a placeholder, waiting for upload                                             |
| `image-unavailable`      | an image the importer cannot bring (a web or library URL, a page background, an image on a non-image shape) |
| `arrowhead-approximated` | an arrowhead livediagram does not draw, imported as the nearest one                                         |
| `connection-loosened`    | a connection whose end could not stay attached                                                              |
| `label-moved`            | a label moved inside its shape, or several edge labels merged                                               |
| `group-flattened`        | a group dropped, its members kept in place                                                                  |
| `hidden-skipped`         | a hidden shape or connection not imported                                                                   |
| `collapsed-skipped`      | a shape inside a collapsed container not imported                                                           |
| `link-dropped`           | a link with a scheme livediagram does not follow                                                            |
| `text-truncated`         | text or rows cut to fit an element's limits                                                                 |
| `content-truncated`      | pages or elements beyond the import limits not imported                                                     |

When the report has any line, the Import dialog does not close: it shows the summary (below), so the
person sees what changed before they carry on. A clean import closes the dialog as before.

## Accepted losses (documented, not counted)

These differ from draw.io for every file and are not worth a line each time:

- Gradients (`gradientColor`), glass, `sketch=1` hand-drawn rendering, `fillStyle` hatching: solid
  fills.
- Rounded corners on connector bends; jump-overs (`jumpStyle`); edge `labelBackgroundColor` (captions
  keep livediagram's knockout).
- `spacing*`, `perimeterSpacing`, `whiteSpace`, `overflow`, `textOpacity`, `fillOpacity`,
  `strokeOpacity`, `labelBorderColor`: livediagram lays text out itself.
- Page size, grid, guides, page view and print settings; the page's zoom and scroll.
- Custom connection points (`points=[...]`) beyond the anchor they resolve to.
- draw.io comments, tags, metadata and the file's edit history.
- The white-and-black default colours (see properties): the theme paints them.

## UI

- **Import dialog.** A fifth format card, **draw.io**: "A .drawio file, or a PNG / SVG with the diagram
  inside. Keeps shapes, text, connections and pages. Multi-page files add a tab for each further
  page." Its panel is the shared paste-or-file panel: paste XML, or pick a file; the picker accepts
  `.drawio`, `.xml`, `.svg`, `.png` and `.drawio.*`.
- **The summary.** After an import with a non-empty report the dialog shows "Imported from draw.io",
  a line of what arrived ("3 pages became 3 tabs, 128 elements"), the report's lines in the table's
  order, each with its count and, for unmatched shapes, the top stencil names, then a **Done** button
  that closes it. Images waiting for the pipeline say so ("2 images came in as placeholders. Select
  one and upload the picture to fill it."). The summary is part of the dialog body: nothing is
  toasted, nothing shifts the canvas.
- **Telemetry** ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)):
  `track('Tab', 'Imported', 'Drawio')`, once per import, the existing pair and no schema change.
- **Help centre.** The Importing a Tab article lists draw.io, what maps and what the summary means;
  its registry keywords gain `drawio draw.io diagrams.net`.

## Non-goals

- Exporting to draw.io.
- Fetching library or web images from draw.io's or anyone's servers.
- Rendering draw.io's stencil artwork (the vendor icon catalogues are theirs to ship, not ours).
- Bulk import of many files at once (the importer is ready for it; the UI is undecided).
- `.vsdx`, Lucidchart and Gliffy files, which draw.io itself imports: bring them through draw.io first.
- Re-creating draw.io's automatic layouts (`childLayout` other than the stacks above, tree layouts):
  the laid-out positions in the file are imported as they are.
