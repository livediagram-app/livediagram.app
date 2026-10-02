# draw.io import

A diagram made in draw.io (diagrams.net, the desktop app, the VS Code and Confluence plugins) comes
into livediagram near-losslessly, two ways: the Import dialog's **draw.io** format fills the active tab
(and adds a tab per further page), and the Explorer's **Import from draw.io** turns any number of files,
or a whole folder, into documents of their own. It is a migration path: a
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
- `apps/live/lib/drawio/report.ts`: draw.io's notes turned into the one import report every
  importer shares ([Board scene](board-scene.md) "The report"): what landed, counted by kind, and
  each change as a rule with its count.
- In the same folder: `json-export.ts` (the JSON export, below), `library.ts` (shape libraries,
  below) and `files.ts` (many files to documents, "Import as new documents" below).
- Nothing lives in `packages/`: only the editor imports draw.io files, and the importer leans on the
  browser's `DOMParser` and `DecompressionStream`, which the Workers runtime lacks.

The importer is **pure with respect to the editor**: bytes or text in, pages of elements plus a report
and the embedded images' requests for the [import image pipeline](import-image-pipeline.md) out.
Storing the images and applying the result to tabs is the hook's job, and the same importer feeds
both the tab import and the Explorer's many-file import.

## Inputs

One file or one pasted text. The importer sniffs the content, never the file name, so a file
**without an extension** (as Google Drive stores a draw.io file) reads like any other:

| Input                            | How it is recognised                                    | How the diagram XML is reached                                                                  |
| -------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `.drawio` / `.xml`, uncompressed | root element `mxfile`, `<diagram>` holds `mxGraphModel` | directly                                                                                        |
| `.drawio` / `.xml`, compressed   | root `mxfile`, `<diagram>` holds text                   | base64 decode, raw inflate, `decodeURIComponent` (draw.io's own `Graph.decompress`)             |
| bare `mxGraphModel`              | root element `mxGraphModel`                             | directly; one page, named after nothing (see pages)                                             |
| `.drawio.svg`                    | root element `svg` with a `content` attribute           | the attribute holds an `mxfile` (compressed or not); a base64 value is decoded first            |
| `.drawio.png`                    | the PNG signature                                       | a `tEXt` or `zTXt` chunk keyed `mxfile` or `mxGraphModel`, URI-decoded; `zTXt` is zlib inflated |
| pasted XML                       | as for the file forms above                             | as above                                                                                        |
| JSON export                      | a JSON object with `version` and a `pages` array        | see "The JSON export" below                                                                     |
| shape library (`mxlibrary`)      | root element `mxlibrary` holding a JSON array           | not a diagram: it becomes a shape library (see "Shape libraries" below)                         |

A PNG or SVG without an embedded diagram is refused with a message saying so ("This PNG has no draw.io
diagram inside. In draw.io, export as PNG with 'Include a copy of my diagram' ticked."). Refusals are
named and specific: not XML, not a draw.io file, a page that fails to decode (named by page), a file
over the size limit, a file with no pages.

**Limits.** A file over 50 MB is refused before reading. Inflating stops at 100 MB of output across the
whole file (a zip-bomb guard), refusing the file. A file with more than 100 pages imports the first 100
and counts the rest. A page with more than `MAX_ELEMENTS_PER_TAB` (10 000) elements imports the first
10 000 in document order and counts the rest.

## The JSON export

draw.io's "Export as JSON" writes `{ version, pages: [{ id, name, cells }], data? }`. The cells carry
the graph (`layer`, `node` with `label`, `html` and `metadata.link`, `edge` with `source` and
`target`) but **no geometry and no style**.

- When `data` holds an `mxfile` (draw.io writes it when asked to include the diagram), that file is
  imported instead, exactly, like any `.drawio` file.
- Otherwise each page's nodes and edges become a graph that is **laid out automatically** by the same
  layered layout Mermaid import uses (`layoutClusteredGraph`, `packages/document`): nodes as
  boxes, edges as connections between them, layers in document order. Labels convert from draw.io's
  HTML to plain text (`<br>`, `<p>`, `<div>` and headings become line breaks, entities decode,
  every other tag is dropped); an empty label stays empty. A node's `metadata.link` becomes its
  link by the same rule as any cell's: a web or email address, or a link to another page of the
  export as a link to that page's tab. An edge with only one end on a node keeps it, its free end
  drawn a short way out from the node (draw.io draws such an edge dangling); an edge with neither
  end on a node is left out. Both count as connections that couldn't stay attached. The report says once per import that positions and
  styles were not in the file ("Positions and styles weren't in the file; the layout is
  automatic"), counting the pages laid out.
- A page with no cells imports as an empty tab.

## Shape libraries

A draw.io **library** (`<mxlibrary>`, the "preset" draw.io keeps in a scratchpad or a Drive file) is
not a diagram: it is a list of reusable shapes, each `{ xml, w, h, aspect, title }` (or `{ data }`
for an image), its `xml` a compressed `mxGraphModel` snippet. Each item decodes like a page and
converts through the same mapping, so a library shape arrives as the elements draw.io would draw.
An item that cannot be read is left out and counted; a library none of whose items can be read is
refused ("None of this library's shapes could be read."). A library keeps its first 1 000 items.

Each imported library becomes **its own named shape library** of the person importing it, as
[Shape libraries](../013-workspace/shape-libraries.md) defines (palette **My shapes**, the Explorer's
**Shape libraries** page): named after the file, never merged with another library. The tab Import
dialog does not take libraries; pasted or picked there, one is refused with "This is a draw.io shape
library. Import it from the Explorer's Import from draw.io to add it to My shapes."

## Pages become tabs

A draw.io file holds one or more pages. Each page becomes its own tab:

- **The first page replaces the active tab**, exactly as every other import format does (the Import
  dialog's warning names that tab).
- **Every further page becomes a new tab**, inserted straight after the active tab in page order,
  with the active tab's theme, font, text size and background, and in its tab folder (so a folder's
  run of tabs is never split).
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
| `ellipse`, `mxgraph.flowchart.start_1`, `mxgraph.flowchart.start_2`, `startState`, `mxgraph.flowchart.on-page_reference`                                                                                                                                                                      | `circle` (fills its box, so a wide one is an ellipse)                         | exact        |
| `rhombus`, `mxgraph.flowchart.decision`                                                                                                                                                                                                                                                       | `diamond`                                                                     | exact        |
| `triangle`                                                                                                                                                                                                                                                                                    | `triangle`, turned to draw.io's `direction` (east by default) with `rotation` | exact        |
| `hexagon`, `mxgraph.flowchart.preparation`                                                                                                                                                                                                                                                    | `hexagon`                                                                     | exact        |
| `cylinder`, `cylinder3`, `datastore`, `mxgraph.flowchart.database`                                                                                                                                                                                                                            | `cylinder`                                                                    | exact        |
| `cloud`, `mxgraph.networks.cloud`                                                                                                                                                                                                                                                             | `cloud`                                                                       | exact        |
| `parallelogram`, `mxgraph.flowchart.data`                                                                                                                                                                                                                                                     | `parallelogram`                                                               | exact        |
| `trapezoid`                                                                                                                                                                                                                                                                                   | `trapezoid`                                                                   | exact        |
| `document`, `mxgraph.flowchart.document`, `mxgraph.flowchart.document2`                                                                                                                                                                                                                       | `document`                                                                    | exact        |
| `actor`, `umlActor`                                                                                                                                                                                                                                                                           | `actor`                                                                       | exact        |
| `mxgraph.flowchart.terminator`                                                                                                                                                                                                                                                                | `stadium`                                                                     | exact        |
| `mxgraph.basic.star`                                                                                                                                                                                                                                                                          | `star`                                                                        | exact        |
| `callout`, `wedgeCallout`                                                                                                                                                                                                                                                                     | `speech-bubble`                                                               | exact        |
| `note`                                                                                                                                                                                                                                                                                        | `sticky` with its fill                                                        | exact        |
| `text`, `edgeLabel` on a vertex; `mxgraph.flowchart.annotation_1` / `_2` (approximated)                                                                                                                                                                                                       | `text`                                                                        | exact        |
| `line` (a vertex drawn as a line)                                                                                                                                                                                                                                                             | headless `arrow` across the box's middle                                      | exact        |
| `swimlane`                                                                                                                                                                                                                                                                                    | `lane`, or `entity` for a class / entity stack (below)                        | exact        |
| `table` (with `tableRow` rows)                                                                                                                                                                                                                                                                | `table` (below)                                                               | exact        |
| `image`                                                                                                                                                                                                                                                                                       | `image` (below)                                                               | exact        |
| `umlFrame`                                                                                                                                                                                                                                                                                    | `frame`                                                                       | exact        |
| `mxgraph.android.phone2`, `mxgraph.ios7.misc.iphone`                                                                                                                                                                                                                                          | `phone`                                                                       | exact        |
| `mxgraph.mockup.containers.browserWindow`                                                                                                                                                                                                                                                     | `browser`                                                                     | exact        |
| `doubleEllipse`, `orEllipse`, `sumEllipse`, `or`, `xor`, `endState`, `mxgraph.flowchart.or_2`, `mxgraph.flowchart.summing_junction`, `umlBoundary`, `umlEntity`, `umlControl`, `mxgraph.bpmn.event`, `lineEllipse`                                                                            | `circle`                                                                      | approximated |
| `process`, `internalStorage`, `card`, `cube`, `folder`, `component`, `module`, `offPageConnector`, `mxgraph.flowchart.predefined_process`, `mxgraph.flowchart.off-page_reference`, `umlLifeline`, `partialRectangle`, `singleArrow`, `doubleArrow`, `mxgraph.bpmn.task`, `mxgraph.bpmn.shape` | `square`                                                                      | approximated |
| `delay`, `display`, `mxgraph.flowchart.delay`, `mxgraph.flowchart.display`                                                                                                                                                                                                                    | `stadium`                                                                     | approximated |
| `step`                                                                                                                                                                                                                                                                                        | `parallelogram`                                                               | approximated |
| `manualInput`, `loopLimit`, `mxgraph.flowchart.manual_input`, `mxgraph.flowchart.loop_limit`, `mxgraph.flowchart.manual_operation`                                                                                                                                                            | `trapezoid`                                                                   | approximated |
| `tape`, `mxgraph.flowchart.paper_tape`, `mxgraph.flowchart.multi-document`                                                                                                                                                                                                                    | `document`                                                                    | approximated |
| `dataStorage`, `mxgraph.flowchart.stored_data`, `mxgraph.flowchart.direct_data`, `mxgraph.flowchart.sequential_data`                                                                                                                                                                          | `cylinder`                                                                    | approximated |
| `mxgraph.bpmn.gateway2`, `mxgraph.flowchart.sort` (diamond); `mxgraph.flowchart.merge_or_storage`, `mxgraph.flowchart.extract_or_measurement` (triangle)                                                                                                                                      | `diamond` / `triangle`                                                        | approximated |
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
to hold it: down (or up) by a line per caption line, and wider about its centre when the caption is
wider than the icon, since draw.io draws it unwrapped. The caption takes the theme's text colour:
vendor stencils hard-code a caption colour for white paper, which vanishes on a dark canvas. A UML
actor's name, drawn under the figure, grows its box the same way and is not counted as moved.

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
  cell per cell, the row heights and the first row's column widths carried over, and each cell's fill,
  text colour, bold / italic / underline and alignment. A table's own label (the title draw.io draws in
  its `startSize` strip) comes in as a `text` element above the grid, counted (`shape-approximated`).
- **Vertical lane titles.** draw.io writes a `horizontal=0` lane's title upright in a thin strip
  (`startSize`, usually 20 px). A livediagram lane title cannot be turned: it reads across. So the
  title strip widens to hold the whole title on one line, and the lane grows **to the left** by
  whatever the gap before its first shape cannot give. The lane's content, its right edge and every
  connection stay exactly where draw.io put them; nothing sits over a title. Lanes stacked in a pool
  (siblings sharing a left edge and width) share one strip width and grow together, so the stack
  stays aligned. A pool of lanes resolves from the inside out: it grows to make room for its lanes'
  widened strips and then for its own title. Growing left can overlap something drawn close to the
  lane's left side; that is accepted. Every titled vertical lane is counted
  (`lane-title-turned`).
- **Frames** (`umlFrame`, AWS and GCP groups) keep their title in the top-left corner, as a
  livediagram frame does.

### Vertices: properties

- `fillColor` to `fillColor`, `strokeColor` to `strokeColor`, `fontColor` to `textColor`. A hex colour
  is kept verbatim; `none` is `transparent` for a fill and `strokeWidth: 'none'` for a stroke;
  `light-dark(a, b)` takes the light value `a`. **`default`, or no colour at all, is left unset**, so
  the element takes the tab's theme like anything drawn in livediagram: draw.io's white-and-black
  defaults become the theme's defaults. The same goes for the page: draw.io's white page is its
  default paper and leaves the tab's background unset. This is an operator decision, not a loss:
  default colours and the white page follow the tab theme, and colours the author picked are kept.
  Keeping draw.io's white page and black-on-white shapes was considered and rejected, because it
  leaves a white island on a dark canvas.
- **Legible labels on own fills.** A label with no colour of its own on a shape (or lane title, entity,
  table cell) with a fill of its own takes the ink that reads on that fill: dark on a light fill, white
  on a dark one. draw.io's default label ink is black on paper, and the theme's text colour pairs with
  the theme's fill, not with a fill the author picked.
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
  centre) on anything but an icon or an actor is kept inside the shape, aligned towards that side.
  Counted (`label-moved`).

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

A vertex with `shape=image` becomes an `image` element in its box, its label as `alt`. Its picture comes
across through the shared [import image pipeline](import-image-pipeline.md), exactly as an Excalidraw
scene's images do: resized in the browser, stored in the gallery (or embedded in an Offline Mode
diagram), and reported per image in the import's report, including any left as placeholders and why
(the gallery is full, the format could not be read, and so on). An import never fails because of an
image.

- `image=data:...` (an embedded image): the element starts as a placeholder (`imageId: null`) and
  the importer requests the picture from the pipeline (element id, a key shared by identical pictures
  so each is stored once across all pages, the data URL, the element's size). The hook runs every
  page's requests through **one** pipeline session and progress count before the tabs change, so the
  import stays one undo step; each stored image fills its placeholder.
- Any other `image=` (a web URL, or one of draw.io's own library paths such as
  `img/lib/azure2/...`, unless it matched an icon above): a placeholder, never requested. Counted
  (`image-unavailable`): the importer never fetches from third parties.
- An `image=` on a shape that is not an image shape (a `label` style with an icon): the shape
  imports without the picture. Counted (`image-unavailable`).
- A page `backgroundImage`: dropped. Counted (`image-unavailable`).

### The page

- `background` on the page's `mxGraphModel` to the tab's `backgroundColor`; `none` and white (draw.io's
  default page) leave it unset.
- The tab keeps its own theme, pattern and font.

## Import as new documents (Explorer)

The Explorer page header's **Import from** group ([Folders](../013-workspace/folders.md)) has a
**draw.io** source beside Microsoft Whiteboard and Excalidraw. It takes **files or a whole folder**
(a folder picker and drop), reads every file by content, and lists what it found:

- **Diagrams**: each draw.io file becomes **its own new document**, its pages as **diagram tabs** in
  page order (named after the pages), through the shared new-document target ([Board import](board-import.md)
  "new-document"), filed where New document files.
- **Libraries**: each library file becomes its own shape library (above).
- **Everything else** (an image without a diagram, a text file, a folder's stray files) is listed as
  skipped with its reason, never fatal.
- **The list**: one row per diagram or library with a checkbox, all ticked, under the name it will
  get, with its date and size ("Edited 12 Mar 2026 · 3 pages", "Shape library · 14 shapes"). A single
  readable file imports straight away. Then "Importing 3 of 12…", then the shared report: what
  landed, every rule, the new documents and libraries as links, the files left out with their reasons.

**Names.** The file name without its extension (`.drawio`, `.xml`, `.json`, `.drawio.svg`,
`.drawio.png`, `.svg`, `.png`). When that name is generic (empty, or draw.io's `Untitled Diagram`,
`untitled`, `diagram`, `drawing`, any case, with an optional copy number such as ` (2)` or `-2`),
the `mxfile`'s `name` attribute when it is not generic either, else the first page's name, else
"draw.io diagram, 12 Apr 2026" by its date.

**Dates.** Last modified is the `mxfile`'s `modified` attribute (an ISO timestamp draw.io writes on
every save), else the file's own last-modified time; created is the same moment, as nothing in the
file records when it was made. Both are checked by the same rule as Microsoft Whiteboard's board
dates; a date that cannot be used is reported, and the document is dated today.

**Tab size.** A page is one tab, and a tab must fit one database row (`MAX_TAB_BYTES`, just under
2 MB: [Tab size](../015-api/api.md#tab-size)). A page too large to store is left out of its document
and named in the report ("Page 'Network' is too large to store"); the file's other pages still land.
A file none of whose pages fit fails on its own. An Offline Mode import has no such limit.

## The import report

draw.io reports through the **one import report every importer shares** ([Board scene](board-scene.md)
"The report", one view in the Import dialog and the Explorer's import): what landed, counted by kind
(shapes, arrows, text boxes, sticky notes, images, frames, lines), then every change on the way in as
a rule with its count, changes first and things left out after, then how the images came across (the
[import image pipeline](import-image-pipeline.md)'s report). The importer tallies closed note kinds
(`ImportNoteKind`) and `lib/drawio/report.ts` gives each its rule, in this order:

| Kind                      | Rule (the report shows "count · rule")                                          | Shown as |
| ------------------------- | ------------------------------------------------------------------------------- | -------- |
| `shape-unmatched`         | Shapes with no livediagram match came in as labelled boxes (the top 5 stencils) | changed  |
| `shape-approximated`      | Shapes came in as the nearest livediagram shape                                 | changed  |
| `icon-substituted`        | Vendor icons came in as the matching livediagram icon                           | changed  |
| `image-unavailable`       | Images linked outside the diagram came in as placeholders or were left out      | changed  |
| `arrowhead-approximated`  | Arrowheads livediagram doesn't draw took the nearest one                        | changed  |
| `connection-loosened`     | Connection ends that couldn't stay attached were left where they were           | changed  |
| `label-moved`             | Labels were moved inside their shapes or merged onto one line                   | changed  |
| `lane-title-turned`       | Upright lane titles now read across                                             | changed  |
| `group-flattened`         | Groups were dropped                                                             | changed  |
| `link-dropped`            | Links of a kind livediagram can't follow were dropped                           | changed  |
| `text-truncated`          | Texts were shortened to fit                                                     | changed  |
| `auto-layout`             | Positions and styles weren't in the file; the layout is automatic (pages)       | changed  |
| `hidden-skipped`          | Hidden items were left out                                                      | left out |
| `collapsed-skipped`       | Items inside collapsed containers were left out                                 | left out |
| `library-item-unreadable` | Library shapes that couldn't be read were left out                              | left out |
| `content-truncated`       | Pages or items beyond the import limits were left out                           | left out |

When the report has a rule, or met any image, the Import dialog does not close: it shows the report,
so the person sees what changed before they carry on. A clean import closes the dialog as before.

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
- Tooltips and custom properties on connections (a livediagram arrow has no note); on shapes they
  become the note.
- A single word wider than its shape: livediagram's smallest label size (14 px) is larger than
  draw.io's default 12 px, so a long word in a narrow shape (a `:PaymentGateway` lifeline) wraps
  mid-word as livediagram wraps any label. The shape is not widened and the text is not shrunk
  (operator decision): both would change what the author drew.
- The white-and-black default colours (see properties): the theme paints them.

## UI

- **Import dialog.** A fifth format card, **draw.io**: "A .drawio file, or a PNG / SVG with the diagram
  inside. Keeps shapes, text, connections and pages. Multi-page files add a tab for each further
  page." Its panel is the shared paste-or-file panel: paste XML, or pick a file; the picker accepts
  `.drawio`, `.xml`, `.json`, `.svg`, `.png` and `.drawio.*`.
- **The report.** Every importer ends in the same view ("The import report" above): after an
  import with a rule or images, the dialog replaces its warning and panel with it, its **Done** button
  taking focus; the subtitle reads "Here's how your board came across." ("Here's how your images came
  across." when only images had news). It is announced as a status; nothing is toasted and nothing
  shifts the canvas. While images store, the panel counts them ("Importing images 3 of 12…").
- **Explorer.** The **draw.io** button of the page header's **Import from** group (an original
  glyph, not draw.io's logo: the repo ships no vendor marks, [Iconography](../004-interface-design/iconography.md));
  its tooltip "draw.io" and its accessible name "Import from draw.io" ("Import as new documents" above).
- **Telemetry** ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)):
  `track('Tab', 'Imported', 'Drawio')`, once per tab import and once per document the Explorer
  import makes (as Microsoft Whiteboard counts once per board), the existing pair and no schema
  change; the shared new-document target adds `Document · Created`. A library's telemetry is
  [Shape libraries](../013-workspace/shape-libraries.md)'.
- **Help centre.** The Importing a Tab article lists draw.io, what maps and what the report means, and
  a draw.io import article in the Explorer category covers files, folders, Drive saves, JSON
  exports and libraries; registry keywords gain `drawio draw.io diagrams.net`.

## Non-goals

- Exporting to draw.io.
- Fetching library or web images from draw.io's or anyone's servers.
- Rendering draw.io's stencil artwork (the vendor icon catalogues are theirs to ship, not ours).
- `.vsdx`, Lucidchart and Gliffy files, which draw.io itself imports: bring them through draw.io first.
- Re-creating draw.io's automatic layouts (`childLayout` other than the stacks above, tree layouts):
  the laid-out positions in the file are imported as they are.
