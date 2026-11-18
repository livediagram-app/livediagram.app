# BPMN import

## What

**Import to Tab** reads a `.bpmn` file (BPMN 2.0 XML, as Camunda Modeler, bpmn.io, Signavio, Bizagi and most
process tools save it) into the active tab: every shape and line the file's diagram (its BPMNDI) draws, at its
position and size, as livediagram's [BPMN elements](../009-elements/bpmn.md). Paste the XML or pick the file; like
every Import to Tab format it replaces the tab's content in one undo step.

## Why

A process model lives in a modeler's file. Without an import, bringing one into livediagram meant redrawing it, and
the document a team reviews drifted from the one their engine runs. The BPMN elements give every common symbol a
home, so the import is a mapping rather than an approximation.

## Reading the file

- **Parsed, never rendered**: the XML is read with the product's `parseInert` (`application/xml`, the trusted-types
  inert parse), never a bare `DOMParser`, and nothing in it is ever put into the page. Scripts, external entities
  and links in the file do nothing: the parser resolves no external entity and the importer reads only the elements
  and attributes named below.
- **Caps**: a file over **5 MB** is refused unread ("This file is too large to import (the limit is 5 MB)"). The
  walk reads at most **100,000** XML elements and refuses a file past that as too complex. At most **2,000**
  elements are drawn; the rest are counted in the report. Every step is linear in the file (one walk, maps by id), so
  the largest file finishes in well under a second.
- **What counts as BPMN**: the root is a `definitions` element (any prefix; the BPMN namespace is not required, as
  some tools omit it). Anything else is refused: "This isn't a BPMN file (expected BPMN 2.0 XML with a definitions
  element)." Unreadable XML: "Couldn't read this BPMN file."
- **The layout**: the first `BPMNDiagram`'s `BPMNPlane`. Each `BPMNShape` draws its `bpmnElement` in its `Bounds`;
  each `BPMNEdge` draws its flow along its `waypoint`s. A file with no diagram (no BPMNShape) is refused: "This BPMN
  file has no diagram layout to draw. Open it in a modeler and save it with its diagram." A file with more than one
  diagram draws the first and says so.
- **Names**: the semantic element's `name`, its line breaks kept. A text annotation's `text`.
- **Colours**: the BPMN in Color attributes (`color:background-color` / `color:border-color`, and bpmn.io's older
  `bioc:fill` / `bioc:stroke`) set the fill and line colour when they are a hex colour; anything else is ignored.

## The mapping

| BPMN                                                                                                         | Becomes                                                                                                     |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `startEvent` (none, message, timer)                                                                          | `start`, `start-message`, `start-timer`                                                                     |
| `intermediateCatchEvent`, `intermediateThrowEvent`, `boundaryEvent` (none, message, timer, error)            | `intermediate`, `intermediate-message`, `intermediate-timer`, `intermediate-error`                          |
| `endEvent` (none, message, error, terminate)                                                                 | `end`, `end-message`, `end-error`, `end-terminate`                                                          |
| `task`, `userTask`, `serviceTask`, `scriptTask`, `manualTask`, `sendTask`, `receiveTask`, `businessRuleTask` | `task` and its typed markers                                                                                |
| `subProcess`, `callActivity`, `adHocSubProcess`, `transaction` drawn collapsed                               | `subprocess`                                                                                                |
| the same drawn expanded (`isExpanded="true"`)                                                                | a `frame` titled with its name, its contents drawn inside                                                   |
| `exclusiveGateway`                                                                                           | `gateway-exclusive` when its shape has `isMarkerVisible="true"`, else the plain `gateway`                   |
| `parallelGateway`, `inclusiveGateway`, `eventBasedGateway`, `complexGateway`                                 | the matching gateway                                                                                        |
| `dataObjectReference`, `dataObject`, `dataInput`, `dataOutput`                                               | `data-object`                                                                                               |
| `dataStoreReference`                                                                                         | `data-store`                                                                                                |
| `participant` (a pool), `lane`                                                                               | a [Lane](../009-elements/lane.md), its title upright in a 30 px gutter; lanes over their pool               |
| `textAnnotation`                                                                                             | a `text` element                                                                                            |
| `group`                                                                                                      | a dashed `frame` titled with its category value's name                                                      |
| `sequenceFlow`                                                                                               | an arrow (the default look), its name as the label                                                          |
| `messageFlow`                                                                                                | an arrow in the message flow look                                                                           |
| `association`, `dataInputAssociation`, `dataOutputAssociation`                                               | an arrow in the association look; a data association or a directed association keeps a line head at its end |

**Approximated**, each counted in the report: an event with a marker v1 does not draw (signal, escalation,
compensation, conditional, link) becomes its position's plain event; a call activity, ad hoc sub-process or
transaction drawn collapsed becomes the sub-process; an expanded sub-process becomes a frame; a vertical pool or
lane keeps its title across the top.

**Unmatched**: a shape whose element is none of the above (a choreography task, a conversation) comes in as a
labelled box in its bounds, labelled with its name or its element type, counted and named in the report.

### Names under symbols

An event's, a gateway's and a data element's name becomes a `text` element in its `BPMNLabel` bounds when the file
gives them, else centred under the symbol, as the modeler draws it. A task's, a sub-process's, a pool's and a lane's
name is its own label.

### Lines

A flow pins to the elements its `sourceRef` and `targetRef` name when both are drawn, each end on the anchor nearest
its first or last waypoint on the side the route leaves through, and bends through the waypoints between (the
draw.io importer's route helpers, `lib/drawio/arrow-route.ts`). An end whose element is not drawn stays free at its
waypoint. A flow with fewer than two waypoints is skipped and counted.

## The report

The Import dialog shows the shared import report when anything changed on the way: how many shapes and lines came
in, then the approximated symbols, the unmatched shapes (with their types), the elements left out past the cap, the
flows without a route and the diagrams beyond the first. Its subtitle: "Here's how your BPMN came across."

## Where

The Import to Tab dialog's **BPMN** card, after draw.io: "A .bpmn file from Camunda, bpmn.io, Signavio or any BPMN
2.0 modeler. Keeps every event, task, gateway, pool and flow where the modeler drew it." The file picker offers
`.bpmn` and `.xml`.

## Share roles

Import to Tab replaces the tab's content, so it is an Editor's, as every format's is; the dialog is not offered to a
Participant or a Viewer.

## Telemetry

`Tab·Imported·Bpmn` once per import that lands, charted under Export & Import's **Tabs Imported**.

## Not in v1

Exporting `.bpmn`. Laying out a file that has no diagram. Reading a `.bpmn` from the Explorer as a new document
(Import to Tab on a blank tab does the same). Boundary events attach to nothing: they import at their position on the
task's edge.
