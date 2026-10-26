# The Page element

## What

A **Page** is a large, paper-proportioned element written into with the rich-text editor: the prose a plan needs but
a label can't hold, such as a brief or a decision record. It is a shape kind (`shape: 'page'`) the canvas draws and
edits wherever it is. No liveplanner surface adds one: the `tools:page` tile in `palette-tile-defs.tsx` is offered by
no picker (the Dashboard slot picker offers only the sticky from the tools section), so a Page arrives with its tab:
an imported tab, a paste, or the elements an agent writes through `update_project`.

## It is a shape kind, not a new element type

`shape: 'page'`. The alternative, a new `BoxedElement` member, would mean
touching validation, both export renderers, Mermaid, Markdown,
the MCP tools and the API schema, to arrive at something that
behaves like a shape in every one of them.

A shape already carries what a page needs:

- **`richText` runs** for the body, with `label` as the plain-text mirror
  ([Canvas and palette](../008-canvas/canvas-and-palette.md)). The formatting algebra, the contentEditable bridge, search,
  export and the JSON round-trip all work unchanged.
- **`textAlignX` / `textAlignY`**, so the body sits top-left instead of
  centred like every other shape.
- Border, fill, shadow, opacity, layers, links, notes, comments, actions.

So the whole feature is a kind, a size, two alignment defaults, a renderer and
a tile definition. Nothing downstream learns a new element.

## The name

It is **Page**, in the selection toolbar and in the code. The flowchart output symbol with the wavy bottom already
owns `shape: 'document'`, so the kind is named `page` and the two never share a name.

## The masthead

A Page carries a **fixed heading and subtitle** above its body, separated by a
hairline rule. Two plain-string fields on the shape, `pageTitle` and
`pageSubtitle`, are bounded at `PAGE_HEADING_MAX` (200) and validated with the
rest.

**Not the first two lines of the body.** A page's title is structure, not
prose. Kept as their own fields, the body can be reordered, reformatted, or
emptied without the heading moving or vanishing, and the masthead is styled as
a masthead rather than as whatever the first line of the rich text happens to
be.

**Fixed means always there.** An empty heading renders a placeholder rather
than collapsing, so a page has the same shape before and after anyone writes in
it, and the body never creeps up into the title's space.

Plain strings, not rich runs: a title has one look and the element sets it.

### Editing them

Each line is a `contentEditable` field that commits on blur: `PageMasthead.tsx`
renders two `InlineTextLine`s (`InlineTextLine.tsx`), deliberately **not** the shared label editor. That editor
owns one field per element (`label` plus its runs), and threading a second and
third target through it would complicate every element in the app to serve one.
A single-line plain string does not need the runs machinery.

Three details the canvas forces:

- `pointerdown` is stopped on each line, or the canvas reads the press as the
  start of a drag and never hands over the caret.
- Every `keydown` is stopped, or typing "d" in a title also fires the editor's
  add-a-diamond shortcut.
- The surrounding gaps stay pointer-inert, so pressing between the lines still
  drags the page.

Enter commits, Escape restores. The commit stores `undefined` for an emptied
line, so a page typed into and cleared serialises identically to one never
touched.

## Paper, not a big box

- **420 × 594**: √2, the A-series ratio, at a size that reads as a page next
  to a 120px square without dominating the canvas.
- **Body top-left**, not centred. Centred prose is the single strongest tell
  that something is a label pretending to be a page.
- **A wide margin** (`padding: 'lg'`), like a word processor's. Text running
  to the edge of a sheet is the other half of "this isn't paper".
- **A white body, a hairline border and a soft shadow**, so it reads as paper
  laid ON the canvas rather than drawn into it.
- **A turned-back bottom-right corner.** Two triangles (the corner cut away,
  a slightly darker leaf laid over the cut) rather than a real curl, which
  would need a gradient and a bezier and would fight the element's own border
  on every resize. Fixed at 22px in element space, so the fold is the same
  physical size on an A4 page and on one dragged out wide.

**A page keeps its own colours.** `deriveNewBoxedColours` projects the tab's
backdrop and theme onto every new shape; a page is exempt, because tinting it
like the nodes around it is precisely what stopped it reading as a page. The
user can still recolour it from the menu like anything else.

It is also routed to the **CSS box** render path rather than the SVG overlay.
`isSvgRenderedShape` keeps page off the overlay, with square / circle / stadium /
browser and the other CSS-drawn kinds; the overlay has no case for a page and
would draw nothing. A white sheet is a rectangle, so it belongs with square.

It resizes like any shape. Nothing is locked to the aspect ratio: a landscape
page is a legitimate thing to want, and locking it would be the tool telling
the user what their page is.

## Editing

Double-click opens the same rich-text editor every label uses, so there is one
editing surface to learn and one set of shortcuts. The body scrolls inside the
page when it outgrows it rather than the page growing without bound.

## Out of scope

- **Pagination.** One element is one page-shaped surface, not a page that
  flows onto a second sheet. A canvas is not a word processor, and the moment
  it pretends to be, every missing word-processor feature becomes a bug.
- **Tables, images or embeds inside the body.** The runs model is a flat text
  algebra; block content inside it is a different data structure and a much
  larger feature. Put an image element next to the page.
- **Import / export as a page format.** It exports exactly like any shape:
  its plain-text mirror in Markdown, its box in PNG / SVG.
