# BPMN

## What

**BPMN** (OMG BPMN 2.0) is the notation process teams draw business processes in: Camunda, bpmn.io, Signavio,
Lucid and draw.io all speak it. livediagram draws its common subset as ordinary elements wearing a BPMN mark:

- **Events**: start, intermediate and end circles, with the message, timer, error and terminate markers.
- **Activities**: the task (a rounded rectangle) with its user, service, script, manual, send, receive and
  business rule markers, and the collapsed sub-process (its `+` box).
- **Gateways**: diamonds, plain or with the exclusive (X), parallel (+), inclusive (O), event-based and complex
  markers.
- **Data**: the data object (a page with a folded corner) and the data store (a cylinder).
- **Pools and lanes**: the [Lane](lane.md), its title upright down the left gutter.
- **Flows**: the sequence flow is the default arrow; the **message flow** is dashed with an open circle at its start
  and an open arrowhead at its end; the **association** is dotted, with no head.

A `.bpmn` file comes in through Import to Tab ([BPMN import](../020-import-export/bpmn-import.md)), and draw.io's
`mxgraph.bpmn.*` stencils land as the same elements ([draw.io import](../020-import-export/drawio-import.md)).

## Why

People mapping business processes got flowchart boxes and swimlanes, and nothing for the notation their process
team, their workflow engine and their auditors read. The template search sent "bpmn" to Flowchart and Swimlane as a
stand-in, a draw.io file's BPMN shapes beyond a gateway diamond came in as plain labelled boxes, and our own
comparison pages conceded "very broad professional libraries (UML, BPMN, ...)" to draw.io and Lucid. The
[entity](entity.md) closed the ER and UML part of that gap; this closes BPMN.

## The model: one mark on an existing kind

Every BPMN symbol is an existing shape kind carrying one field:

```ts
bpmn?: BpmnSymbol; // ShapeElement, @livediagram/document bpmn.ts
```

| Family  | Kind       | Symbols                                                                                                                                                                         |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Event   | `circle`   | `start`, `start-message`, `start-timer`, `intermediate`, `intermediate-message`, `intermediate-timer`, `intermediate-error`, `end`, `end-message`, `end-error`, `end-terminate` |
| Task    | `square`   | `task`, `task-user`, `task-service`, `task-script`, `task-manual`, `task-send`, `task-receive`, `task-business-rule`, `subprocess`                                              |
| Gateway | `diamond`  | `gateway`, `gateway-exclusive`, `gateway-parallel`, `gateway-inclusive`, `gateway-event`, `gateway-complex`                                                                     |
| Data    | `document` | `data-object`                                                                                                                                                                   |
| Data    | `cylinder` | `data-store`                                                                                                                                                                    |

Why a mark on an existing kind rather than new kinds: a BPMN task IS a rounded box, a gateway IS a diamond, an event
IS a circle. Built on them, every existing behaviour (resize, colour, text, anchors, arrows, layers, export, the
agents' tools, other products reading the document) works unchanged, and a reader that does not know the mark still
draws a correct circle, diamond or box. The mark only adds what BPMN adds on top.

A mark is drawn only on its own kind (`bpmnSymbolOf`): a `start` on a square is ignored, so a stray value can never
draw a ring on the wrong silhouette. Absent means none, and every shape drawn before BPMN is unchanged.

`bpmn` is a closed vocabulary: the validator refuses any other value (`element-field-values.ts`), so an agent's or an
import's typo is refused by name rather than stored.

## How it looks

The mark is drawn over the shape in the shape's line colour, at fixed pixel sizes so it never stretches with the box:

- **Start**: the shape's own ring. **Intermediate**: a second ring 3 px inside it. **End**: a heavy ring inside the
  border, so an end event reads as thick whatever the border width.
- **Markers** sit centred in the circle at about half its width. A catching marker (start, intermediate) is drawn
  as an outline; a throwing one (end message, end error) is filled, as BPMN draws them. Terminate is a filled disc.
- **Task markers** sit in the top-left corner, 18 px. The sub-process's `+` box sits centred on the bottom edge.
- **Gateway markers** sit centred at about half the diamond's width, in a heavy stroke.
- **Data object**: the `document` kind drawn as a page with its top-right corner folded, the fold in the line
  colour. **Data store**: the cylinder as it is.

The canvas (`BpmnMarkLayer`) and the export (`svgBpmnMarks`) draw from one pure geometry (`bpmnMarkParts`), so an
exported PNG or SVG matches the canvas. Under the Sketch and Marker finishes the silhouette is hand drawn as usual and
the mark stays crisp on top.

**Names.** BPMN writes an event's, a gateway's and a data element's name under the symbol, not inside it. The palette
places the symbol unnamed; typing names it inside, like any shape. The template and both importers put such a name in
a text element under the symbol, as bpmn.io keeps an external label. A task's name sits inside the box, as usual.

## The palette

One group, **BPMN**, at the end of Diagram mode's **Shapes** category: no new category, no new toolbar button. Its
tiles, each a [shape variant](../010-palette/build-category.md) placed by the one variant path every placement takes
(tap, drag, drop):

**Start Event**, **Intermediate Event**, **End Event**, **Task**, **User Task**, **Sub-Process**, **Exclusive
Gateway**, **Parallel Gateway**, **Inclusive Gateway**, **Data Object**, **Data Store**, **Pool**, **Message Flow**
and **Association**.

- An event lands 48 px round, a gateway 56 px, a task 128 × 80 with medium corners, a data object 44 × 56, a data
  store 60 × 56.
- **Pool** is the [Lane](lane.md) with its title upright in a 40 px left gutter, 640 × 200.
- **Message Flow** and **Association** arm the arrow tool in their line style; the sequence flow is the Arrow tile
  everyone already has. Connecting from a selected shape keeps the chosen style.
- Search finds the tiles by "bpmn", "event", "gateway", "task", "pool", "message flow", "process" and the marker
  names.

Workshop's Shapes keeps its own tiles: a session does not stop to draw BPMN.

## Changing the symbol

Right-click a BPMN element, then **Tools**, then **BPMN**: a tile per symbol of its family (every event for an event,
every task type for a task, every gateway type for a gateway, the data object and data store for data), the current
one pressed. A press changes the mark in one history step; the kind, size, colours and name stay. A multi-selection
changes every selected element of the same family. Only an Editor sees it (Viewers and Participants get no element
menu), the same as every other element setting.

## Lines

The message flow and association are ordinary arrows in a preset look (`BPMN_FLOW_LOOKS`):

| Flow        | Line   | Start       | End             |
| ----------- | ------ | ----------- | --------------- |
| Sequence    | solid  | none        | filled triangle |
| Message     | dashed | open circle | open triangle   |
| Association | dotted | none        | none            |

They stay editable through the arrow's own controls; nothing remembers that they were BPMN.

## The template

**BPMN Process** (`bpmn-process`, Processes, extra): an online order between the customer's pool and the
shop's pool of two lanes (Sales, Warehouse): a plain start and a message start, user and service tasks, an exclusive gateway with its Yes and No
flows, a parallel split and join, a timer, a data store and a data object joined by associations, message flows
between the pools and end events. Its names follow the rule above. Search finds it by "bpmn", "process model",
"camunda", "bpmn.io" and "workflow".

## Share roles

BPMN adds no role of its own: placing, editing and changing a symbol are element edits, an Editor's alone. A
Participant may add elements where the room allows (their usual rule), and a Viewer sees the marks drawn.

## Telemetry

Placing a tile reports `Element·Added` with the kind's type, as every variant tile does. A `.bpmn` import reports
`Tab·Imported·Bpmn` ([BPMN import](../020-import-export/bpmn-import.md)).

## Not in v1

The rest of BPMN 2.0 (signal, escalation, compensation, conditional and link events; boundary events attached to a
task; loop and multi-instance markers; expanded sub-processes; choreographies and conversations) is outside the common
subset. An import draws each as the nearest symbol of its family and says so in its report, or as a labelled box when
it has no family. Exporting `.bpmn` could come later.
