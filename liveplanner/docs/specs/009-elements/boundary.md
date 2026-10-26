# The boundary

## What

A **Boundary**: a container that means something. A cloud region, a VPC, a cluster, a trust zone, a system in a C4
diagram. A titled, tinted area with a dashed edge that holds the elements inside it and carries them when it moves.
A `shape: 'boundary'`.

## Why

Architecture diagrams are nested boxes: the region holds the VPC, the VPC holds the subnets, the subnets hold the
services. A Frame is a plain section (an outline and a corner label) and a Lane is a band; neither says "this is a
zone" the way the cloud vendors' own diagrams do, with a tab-style title, the provider's mark and a tint that deepens
as the boxes nest. Building that by hand means a frame, a separate text box and an icon per zone, none of which
follow each other.

## The element

- **The title is the label.** Double-click edits it.
- **Style** (`boundaryStyle`), one of three:
  - **Tab** (the default): the title in a small tab sitting on the top edge, filled with the accent, with the icon
    before it. The cloud-vendor look.
  - **Inset**: the title inside the top-left corner in the accent's colour, with the icon before it and the meta
    line after it. The look for a zone nested in another, so the titles do not stack up on the edges.
  - **C4**: no tab; the title bold in the bottom-left corner with the meta line under it in brackets
    ("[Software System]"). The C4 model's boundary.
- **Meta line** (`pageSubtitle`): an optional second line, a CIDR range or a C4 type. Edits in place once selected.
- **Icon** (`iconId`): a line-art or Technology icon before the title (Tab and Inset). Dropping an icon on a boundary
  sets it rather than adding the icon inside.
- **Edge**: dashed by default (`strokeStyle: 'dashed'` at creation), long-dashed in C4; Border changes it like any
  shape. Corner radius is offered (Medium by default).

## Tint that deepens

A boundary with no `fillColor` washes its area with 6% of its accent. A boundary inside another stacks its wash on
the outer one, so the deeper a zone is nested the deeper it reads, with nothing to compute or store. An explicit
`fillColor` wins. The tint follows the accent, so a theme switch carries it.

## A container

A boundary is a **container**, as a frame and a lane are: it holds every element whose centre is inside it (the
shared containment rule), carries them when it is dragged or nudged, and always paints behind what it holds. A
boundary's own containment and a frame's are the same predicate, not a second copy. It is never inherited as the
size of the next element added while it is selected.

Arrows connect to a boundary like any shape ("Internet → VPC"); its anchors sit on its outline.

## Palette

| Mode     | Where                                     |
| -------- | ----------------------------------------- |
| Diagram  | **Build**: Boundary, after Frame and Lane |
| Pages    | none (it organises a diagram, not a page) |
| Plan     | none                                      |
| Workshop | none (Search still finds and places it)   |

## The menu

A **Boundary** section (Tools flyout), closed until opened: **Meta Line** on / off (on gives it "Meta line" to type
over; clearing its text in place switches it off) and the three styles as tiles.

## Share roles

| Role        | May                                                                           |
| ----------- | ----------------------------------------------------------------------------- |
| Editor      | Everything above                                                              |
| Participant | Write the title, as on any element; cannot place, move, resize or restyle one |
| Viewer      | Look                                                                          |

## Agents

The MCP server and the REST API take `boundary` with `boundaryStyle`, `pageSubtitle` and `iconId`. An agent drawing
cloud architecture nests boundaries for edge, region, VPC and subnet.
