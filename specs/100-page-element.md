# 100 — The Page element

Status: shipped

## What

A **Page** in the palette's Tools → Write group: a large, paper-proportioned
element you write into with the rich-text editor, for the prose a diagram
needs but a label can't hold — a brief, a decision record, the notes a
workshop board is built around.

Everything on the canvas so far is a label on a thing: short, centred, sized
to its box. A sticky note is the closest, and it is deliberately a scrap. When
someone wants a page, they leave for a doc and the diagram stops being the
whole artefact.

## It is a shape kind, not a new element type

`shape: 'page'`. The alternative — a new `BoxedElement` member — would have
meant touching validation, both export renderers, Mermaid, Markdown,
Excalidraw, the MCP tools and the API schema, to arrive at something that
behaves like a shape in every one of them.

A shape already carries what a document needs:

- **`richText` runs** for the body, with `label` as the plain-text mirror
  (spec/09). The formatting algebra, the contentEditable bridge, search,
  export and the JSON round-trip all work unchanged.
- **`textAlignX` / `textAlignY`**, so the body sits top-left instead of
  centred like every other shape.
- Border, fill, shadow, opacity, layers, links, notes, comments, actions.

So the whole feature is a kind, a size, two alignment defaults, a renderer and
a palette tile. Nothing downstream had to learn a new element.

## The name

It is **Page**, in the palette and in the selection toolbar and in the code.

"Document" was the first choice and was wrong twice over. The palette already
has **Document** in Shapes — the flowchart output symbol with the wavy bottom
(`shape: 'document'`) — so two unrelated things would have shared a name in
one search box. And the selection toolbar names an element by its kind, so a
tile called Document selecting into "Selected Page" made the editor look like
it disagreed with itself.

Page is also simply more accurate: it is one sheet, not a document that flows
across sheets (see Out of scope).

Renaming the flowchart shape was considered and rejected: its id is persisted
in palette favourites, and "Document" is its correct name in flowchart
vocabulary.

## Paper, not a big box

- **420 × 594** — √2, the A-series ratio, at a size that reads as a page next
  to a 120px square without dominating the canvas.
- **Body top-left**, not centred. Centred prose is the single strongest tell
  that something is a label pretending to be a document.
- **A wide margin** (`padding: 'lg'`), like a word processor's. Text running
  to the edge of a sheet is the other half of "this isn't paper".
- **A white body, a hairline border and a soft shadow**, so it reads as paper
  laid ON the canvas rather than drawn into it.
- **A turned-back bottom-right corner.** Two triangles — the corner cut away,
  a slightly darker leaf laid over the cut — rather than a real curl, which
  would need a gradient and a bezier and would fight the element's own border
  on every resize. Fixed at 22px in element space, so the fold is the same
  physical size on an A4 page and on one dragged out wide.

**A page keeps its own colours.** `deriveNewBoxedColours` projects the tab's
backdrop and theme onto every new shape; a page is exempt, because tinting it
like the nodes around it is precisely what stopped it reading as a page. The
user can still recolour it from the menu like anything else.

It is also routed to the **CSS box** render path rather than the SVG overlay.
`isSvgRenderedShape` sends every known kind except square / circle / stadium /
browser to the overlay, which has no case for a page and drew nothing at all —
a white sheet is a rectangle, so it belongs with square.

It resizes like any shape. Nothing is locked to the aspect ratio: a landscape
page is a legitimate thing to want, and locking it would be the tool telling
the user what their document is.

## Editing

Double-click opens the same rich-text editor every label uses, so there is one
editing surface to learn and one set of shortcuts. The body scrolls inside the
page when it outgrows it rather than the page growing without bound.

## Out of scope

- **Pagination.** One element is one page-shaped surface, not a document that
  flows onto a second sheet. A diagram is not a word processor, and the moment
  it pretends to be, every missing word-processor feature becomes a bug.
- **Tables, images or embeds inside the body.** The runs model is a flat text
  algebra; block content inside it is a different data structure and a much
  larger feature. Put an image element next to the page.
- **Import / export as a document format.** It exports exactly like any shape:
  its plain-text mirror in Markdown, its box in PNG / SVG.
