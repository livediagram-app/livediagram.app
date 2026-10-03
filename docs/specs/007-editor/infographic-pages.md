# Infographic pages

Infographic mode ([Editor modes](editor-modes.md)) lays a tab out as **pages**: sheets on the
canvas, each built up into one finished visual. This spec is what a page **is** and everything a
page offers: its size, its background, a ready-made layout to start from, the page's own actions,
snapping to it, and exporting it. The basics (pages in a row, the add button, content moving with
its page, clipping, centring) are in [Editor modes](editor-modes.md) "The pages".

## Domain language

| Term                | Means                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **page**            | One sheet of a tab in Infographic mode (`InfographicPage`), stored in `Tab.pages` in row order.           |
| **page size**       | The sheet's format (`PageSizeId`): its short and long side in canvas px.                                  |
| **orientation**     | Portrait (the long side upright) or landscape. A square page has none.                                    |
| **page background** | What the sheet is painted with (`PageBackground`): a solid colour or a two-stop gradient, plus a pattern. |
| **page layout**     | A ready-made arrangement of elements put onto one page (`PageLayoutId`), to start from and then edit.     |
| **page panel**      | The page's settings, opened from the cog above its top-right corner.                                      |

## The page panel

- Opens beside the page, to the right of its cog, so the sheet stays in view; where the window has
  no room there, it opens under the cog. Screen-space, one size at any zoom; it scrolls when taller
  than the window.
- Top to bottom: the **name** field (placeholder `Page n`; renamed on Enter, on leaving the field,
  or on closing the panel), **Size** tiles (each drawn to scale), **Orientation** (Portrait /
  Landscape, absent for a square page), **Background** swatches, **Pattern** tiles, **Layouts**,
  then the action row (Duplicate, Move left, Move right, Delete) as icon buttons with tooltips.
- **Hover previews**: hovering (or focusing) a background swatch or pattern paints it on the page
  at once; leaving the section puts the page back; a press commits.
- Closes on an outside press, **Escape** (focus returns to the cog), or a wheel over the canvas (a
  pan or zoom would leave it stranded from its cog). After a move the panel follows its cog.

"Template" stays the name of a whole-tab starting point
([Templates](../008-canvas/canvas-and-palette.md)); what goes onto **one page** is a **layout**.

## A page

`InfographicPage = { id, orientation, size?, background?, name? }`. Every field after `orientation`
is optional and absent on a page that never set it:

- `size` absent is **A4**.
- `background` absent is the **paper**: white in light chrome, slate-900 in dark, as before.
- `name` absent shows the page's place ("Page 2"); a name replaces it in the label.

A stored page that is malformed in any optional field keeps its valid fields and drops the rest; a
page with no valid `id` or `orientation` is skipped (as today).

## Sizes

| Size id  | Label (portrait / landscape) | Short x long side (px) | For                      |
| -------- | ---------------------------- | ---------------------- | ------------------------ |
| `a4`     | A4                           | 794 x 1123             | Print, the default       |
| `letter` | US Letter                    | 816 x 1056             | Print in North America   |
| `a3`     | A3                           | 1123 x 1587            | Posters                  |
| `square` | Square                       | 1080 x 1080            | Social posts             |
| `social` | Portrait post (4:5)          | 1080 x 1350            | Instagram and LinkedIn   |
| `wide`   | Story (9:16) / Slide (16:9)  | 1080 x 1920            | Stories, and slides wide |

- Paper sizes are at the CSS 96 px per inch; screen sizes are their own pixels.
- A **square** page has no orientation: its panel shows no Portrait / Landscape choice, and it keeps
  whatever orientation it had, so turning it back to another size restores it.
- **Changing size or orientation re-fits the page's content**: everything on the page before the
  change stays on it. Content that still fits the new margin box keeps its size, re-centred (and
  nudged back inside the margins if it pokes out); content that no longer fits is scaled down as
  one, about the page's centre, until it does, its text scaling with it. Nothing is cut off. The
  pages after it move along. One edit, one undo.
- The page label reads `<name or Page n> · <size label> · <Portrait|Landscape>` (no orientation for
  a square page; no `Page n` while there is one page and no name).

## Backgrounds

- **Solid**: one colour. The panel offers twelve presets, from light to dark: **Paper** (the
  default, no `background` stored), **Cream** `#fbf7ef`, **Mist** `#f1f5f9`, **Sky** `#e0f2fe`,
  **Mint** `#dcfce7`, **Lavender** `#ede9fe`, **Blush** `#fce7f3`, **Sunshine** `#fef9c3`,
  **Ink** `#1e293b`, **Midnight** `#0f172a`, **Forest** `#14532d`, **Plum** `#3b0764`, and a
  **custom** colour (the system colour picker).
- **From the theme**, offered first in their own row: drawn from the tab's theme accent (its
  element stroke, else its first palette colour, else the brand blue) and a second colour (a
  multi-colour theme's next palette colour, else the accent deepened): **Theme wash** (accent
  tinted 93%), **Theme tint** (80%), **Theme fill** (the theme's own element fill, when it has a
  light one), **Theme deep** (accent shaded 60%), **Theme glow** (a gradient of the two, light) and
  **Theme dusk** (the same, dark). A theme change offers new ones; a page keeps the colour it took.
- **Gradient**: two colours and an angle (`from`, `to`, `angle` in CSS degrees, 0 to 359: 180 runs
  top to bottom). Six presets: **Sunrise** (`#fde68a` to `#fca5a5`), **Ocean** (`#bae6fd` to
  `#c7d2fe`), **Meadow** (`#bbf7d0` to `#a5f3fc`), **Peach** (`#fed7aa` to `#fecdd3`), **Dusk**
  (`#1e1b4b` to `#4c1d95`), **Night** (`#0f172a` to `#1e3a8a`), all at 160°.
- **Pattern**, over either: **None** (default), **Dots**, **Grid** or **Lines** (horizontal ruled
  lines), drawn faintly in the page's ink at 24 px pitch.
- **A dark page has light ink.** A page is dark when its background (a gradient's mean of its two
  stops) is dark by the canvas's own rule (`canvasSurface`). Every element whose centre lies on a
  dark page and that carries no colour of its own is drawn as on a dark canvas, on screen and in
  exports, so text and shapes stay readable on Midnight or Dusk.
- **Colours of their own are re-inked** when a page's fill changes: a text element's text, an
  arrow's line and an icon's glyph that sit straight on the page and fall under 3:1 contrast with
  it are lightened (on a dark fill) or darkened (on a light one), keeping their hue, until they
  reach 4.5:1. Anything on a fill of its own (a card, a shape) is left alone. Same edit, one undo.
- The page background is a page's, never the tab's: the surround (the tab's own canvas) is
  untouched.

## Layouts

A **layout** is placed onto one page from its panel's **Layouts** section, a grid of previews.

- **Thirteen layouts**, each a complete, editable starting point in the tab's theme. Most open with
  a title and a lead line. A **tall** page (not wider than 1.15 times its height) stacks; a
  **wide** one sets things side by side:
  1. **Title page**: an eyebrow line, a large title, a subtitle, an image placeholder (below on a
     tall page, to the right on a wide one) and a footer line.
  2. **Big number**: one huge figure, its caption, a paragraph and a progress bar.
  3. **Key stats**: two stat rows of three figures, a trend line where the page has room, and a
     Takeaway callout.
  4. **Process**: four steps. Tall: numbered discs down the page joined by arrows, a name and note
     beside each. Wide: a process strip, a note under each step and a "Why it works" callout.
  5. **Timeline**: five dated milestones. Tall: year discs down the page joined by arrows. Wide: a
     timeline rail with a name and note under each point, and a stat row.
  6. **Comparison**: two columns (Before / After), each a heading over three points with icons,
     and a "The verdict" callout.
  7. **Chart story**: a bar chart, a progress ring and three takeaways with icons.
  8. **Top tips**: five tips, each an icon beside a line.
  9. **Quote**: a large quotation mark, the quote in large type and the attribution (a round
     photo, a name and a role) under it.
  10. **Team**: six people, each a round photo, a name and a role, three across (two on a page
      clearly taller than wide).
  11. **Facts grid**: six cards, each an icon, a figure and a caption, three across (two on a tall
      page).
  12. **Checklist**: six items, a ticked circle for each done one and an empty ring for the rest,
      then "n of 6 done" and a progress bar.
  13. **Event**: "You're invited", a title, an image, when and where (icon rows) and a "Save your
      spot" banner.
- **Body type** is the page-sized medium and large text sizes, never the small one.
- **Fitted to the page**: a layout is laid out in proportions of the page (margins of 7% of the
  short side), so it fits any size and orientation; its titles use the fit-to-box text size so they
  scale with their box.
- **Onto an empty page** a layout is placed straight away. **Onto a page with content** the picker
  asks first, inline: **Replace this page's content?** with **Replace** and **Cancel**. Replace
  removes every element whose centre is on the page (and arrows pinned to one), then places the
  layout. Either way it is one change: one undo step.
- Placed elements are ordinary elements. The selection is cleared (nothing replaced stays
  selected) and the panel closes, so the finished page reads clean.
- **An empty page invites a layout**: a "Start from a layout" button sits in the page's title bar
  beside the cog, only while the page is empty, and opens the panel on Layouts (the cog opens it on
  Page). It shows its words on a wide screen when the title bar has room, else just its icon (and
  its tooltip); when the page is too small on screen even for that, it hides, as the label does.
- **Previews are the real layout**: each tile draws the layout as built for this page's size and
  orientation, as a wireframe (text as bars, images shaded, icons as dots).

## Page actions

From the page panel's footer:

- **Duplicate**: a copy of the page (size, orientation, background, a name with "copy") right
  after it, with a copy of every element on it (new ids; arrows pinned between copied elements stay
  pinned between the copies). Pages after it move along, their content with them.
- **Move left** / **Move right**: swaps the page with its neighbour; both pages' content moves with
  them. Absent at the row's ends.
- **Delete page**: removes the page **and everything on it** (arrows pinned to it too); the pages
  after it close the gap. Offered while there is more than one page.
- **Rename**: the panel's name field; empty clears the name.
- Each is one tab edit (one undo step, synced to everyone). At the page limit (20) Duplicate is
  disabled, like Add page is absent; Move left / right are disabled at the row's ends.
- **A new page comes into view**: after Add page or Duplicate the view frames the new page.

## Getting around the pages

- **A page's label zooms to it**: a press on the label fits that page in the view, as entering the
  mode fits the first.
- **The Map shows the pages**: each page's sheet in its own background with a crisp outline,
  under the content, counted in the Map's bounds (so a tab of empty pages still has a Map), and
  each element inked for its page.
- **Drag a page's label to reorder**: once the press travels 6 screen px sideways it is a drag (an
  editor with two or more pages; the label shows a grab cursor). A marker bar in the gap shows
  where the page will land (after every other page whose centre is left of the dragged page's) and
  the dragged sheet dims; release moves it there with its content, one edit. Escape cancels.
- **The label fits its page**: it truncates to the page's width on screen less the title bar's
  buttons, and hides when under 40 px.
- **Snapping to the page**: while a move or a resize is in hand in Infographic mode, an element
  snaps to the edges, the centre lines and the margins (7% of the short side) of the page it is
  on, with the same guides as element-to-element alignment.

## Export

In Infographic mode the Export dialog exports **pages**, not the tab's content bounds:

- **PDF**: every page, in order, one PDF page each, each at its own size and orientation.
- **PNG** and **SVG**: one page, chosen in the dialog (**Page 1**, **Page 2**, ... or its name);
  the first by default.
- Each page exports **exactly its sheet**: its size, its background and pattern, and the elements on
  it clipped to its edges, as the canvas shows them. The surround is not exported. The plain paper
  exports white; elements are inked for the page's own surface.
- A PDF page is the page's size in print points (CSS px x 0.75: A4 is 595.5 x 842.25 pt).
- The dialog shows a **Page** row: a picker for PNG / SVG, "All n pages, one PDF page each" (and a
  preview picker) for PDF. The Isometric and Background pattern options are not offered: a page is
  its own background and is never tilted.
- Outside Infographic mode, export is unchanged.

## Telemetry

`Tab · Changed ·` `PageSize`, `PageBackground`, `PagePattern`, `PageRenamed`, `PageDuplicated`,
`PageMoved`, `PageLayout`; `Document · Exported · InfographicPNG / InfographicSVG / InfographicPDF`.
Never a colour, name or layout content.

## Non-goals

- Image backgrounds (an image element sent to the back does the job).
- Per-page themes or fonts: the tab's theme and font apply to every page.
- Master pages or shared headers and footers.
