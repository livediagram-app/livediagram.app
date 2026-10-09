# Logo pages

A **logo page** is the fourth kind of page in Illustrate mode ([Illustrate pages](illustrate-pages.md)
"Page kinds"): a square artboard to design a logo on. It is laid out like an infographic page,
with ordinary elements, and adds tools a logo needs and an infographic does not: **construction
guides** to build a balanced mark, **mirror** drawing for symmetry, **wordmark** type (tracking,
weight, case, text on an arc), **combining** shapes into one mark, and a **logo
kit** export. Everything [Illustrate pages](illustrate-pages.md) says
of infographic pages applies to a logo page except where this spec says otherwise.

## Domain language

| Term                    | Means                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **logo page**           | A page of kind `logo` (`IllustratePage.kind`).                                                                                 |
| **artboard**            | The logo page's sheet: always the `logo` size, 1024 x 1024 px.                                                                 |
| **safe area**           | The square inside the artboard, inset 10% from each edge, that the mark should stay within. It is the logo page's margin.      |
| **construction guides** | The lines and keyline shapes drawn over a logo page to build on (below). A view, never elements.                               |
| **keyline**             | One of the construction guides' reference shapes: the keyline circle, the inner circle and the keyline square.                 |
| **mirror**              | Drawing with a reflected twin across the artboard's vertical centre line. Per person, for the session.                         |
| **twin**                | A copy mirror makes of a drawing under its page's axis (or **Mirror Copy** reflects).                                          |
| **wordmark type**       | A text element's tracking (`letterSpacing`), weight (`fontWeight`), case (`textCase`) and arc (`textArc`).                     |
| **combine**             | Turning two or more selected shapes into one path by a boolean operation: **Unite**, **Subtract**, **Intersect**, **Exclude**. |
| **contour**             | One closed outline of a path. A combined path may have several (`PathElement.subpaths`): islands and holes.                    |
| **logo kit**            | The export of a logo page as one .zip: an SVG, PNGs at the standard icon sizes and a `favicon.ico`.                            |

## A logo page

- **Adding one**: the **Add a page** popover and the first page's choice offer a fourth card,
  **Logo**: "A square artboard for a logo, with guides and drawing tools." The cards sit in a 2 x 2
  grid (Infographic, Article / Slide, Logo). A new logo page is the artboard on plain paper.
- **Size**: the artboard is the `logo` size, **1024 x 1024**, labelled `1024 x 1024`. It offers no
  other size and no orientation; a stored logo page in any other size is read as the artboard.
  The page label reads `<name or Page n> · 1024 x 1024 · Logo`.
- **Background**: the Background swatches as on any page. A logo page offers **no pattern** (a
  pattern is a page decoration, never part of a mark); a stored pattern on a logo page is dropped.
- **Margin**: a logo page's margin is its **safe area**, 10% of its side (102 px), in place of the
  7% other pages use. Layouts fit it and snapping offers it.
- **Re-fitting and laying out**: a logo page never changes size, so it never re-fits. Laying loose
  content out into pages never makes a logo page.
- **No quick-connect pluses**: a selection on a logo page shows no **+** buttons around it (a
  mark is drawn, not wired up as a diagram); everything else about selecting is as anywhere.

## The Logo palette

In Illustrate mode, while the tab has at least one logo page, the palette strip offers a **Logo** category, first of the Common band after Popular: "The tools a logo is
made with: the pen, the pencil, text, the basic shapes and your markers."

- **Pen**: the Path tool (click for corners, drag for curves), the same tool Draw mode's dock
  holds.
- **Freehand pencil**.
- **Text**, and the basic shapes: **Square**, **Circle** and **Diamond** (the same tiles as
  elsewhere; the rest stay in their own categories).
- **Markers**: Draw mode's three (**Marker 1**, **Marker 2**, **Marker 3**), each in the colour and
  width the person gave it.

Each tool puts itself down after one use and selects what it drew, as the pencil does, a marker
included (a marker picked up
in Draw mode, or from the Toolbar strip's Search elsewhere, stays in hand as before). Off a
whiteboard a marker lines up as the pencil does: its first point snaps to nearby alignments (the
dot shows before the press) and its stroke shows alignment guides as it grows. In the palette a
held marker pressed again opens Draw mode's own flyout for it below its tile (colour and width); its changes are the marker's everywhere and re-arm it at once.

The palette follows the page someone moves to: **Logo** on a logo page, **Popular** on any other.
They move to a page by going to it with its label or the page navigator, or by pressing on a page
other than the one they were last on; a logo page added turns it to Logo too. On opening, a logo
page in view (the one under the canvas's centre, else the first) turns it to Logo, and any other
page leaves the category the person last chose. Staying on the same page never turns it again, so
another category chosen meanwhile is kept, and a press on the bare canvas between pages changes
nothing.

## Beside the cog

A logo page's title bar holds, before its cog and each the cog's size with a tooltip, for someone
who may edit:

- **Tidy Up**, while the selection holds a hand-drawn line: the mind map's tidy wand ("Tidy Up"
  below).
- **Mirror**, pressed while Mirror While Drawing is on, its icon showing the page's axis, opening
  a popover anchored to it: a **Mirror While Drawing** switch for this page at the top, then
  **Axis** tiles (**Vertical**, **Horizontal**, **Both**, **Radial**), **Copies** (**3**, **4**,
  **5**, **6**, **8**) while Radial is chosen, and a **Merge Into One** switch with a line saying
  what it does ("Each drawing and its copies become one element." / "Each copy is its own
  element."). The settings dim while it is off; choosing an axis turns it on. ("Mirror" below.)
- **Guides**, pressed while the page shows its guides, opening a popover anchored to it: a
  **Show Guides** switch for this page at the top, then a tile per guide (**Centre Lines**,
  **Diagonals**, **Safe Area**, **Circles**, **Square**, **Grid**) to show or hide it, and
  **Strength** (**Faint**, **Medium**, **Strong**); the tiles and Strength dim while the page
  shows none. The parts and Strength are the person's synced preferences, also in Settings.

Each acts on this page only. On a desktop each names itself beside its icon (**Tidy Up**,
**Mirror**, **Guides**); a phone shows the icons alone. The page's label truncates before room for all three. Combine stays in the selection toolbar and
the selection's context menu.

## The page panel

A logo page's panel has two tabs: **Page** and **Layouts** (its guides and Mirror are beside the
cog).

- **Page**: the **Background** swatches. No Size, Orientation or Pattern sections.
- **Layouts**: the **logo layouts** (below), in the same browser as the infographic layouts
  (categories, then a category's layouts, the same Replace question and hover previews). Each
  tile is the layout exactly as it lands: built for this page and drawn by the export renderer in
  the tab's theme and font, on the page's background, its words and icon included (a wireframe
  outside an editor). An empty logo page shows them inside itself (**Start From a Layout**) as an empty
  infographic page does, with **Start From Scratch** at the card's foot, in the look of Plan's **Add New
  Card Type** (a full-width dashed row with a plus, quiet until hovered): it puts the card away for good on that page (the page is marked started blank, for everyone, in the same undoable edit), leaving the artboard to start from nothing. Hide puts it away until the tab is next opened. Either way the page's layouts stay in its panel's Layouts tab.
- The cog opens the panel on Page; the layout invite on Layouts.

## Logo layouts

A logo page's Layouts are the **logo layouts**, built for the safe area in the tab's theme. Each
is a complete, editable mark: an icon (a theme shape holding a line-art icon), the name and,
where it has one, a tagline. The name is wordmark type: tracked, and set in capitals where the
layout says so.

- **Lockups**:
  - **Icon Above Name**: the icon in a disc, centred over the name, the tagline under it.
  - **Icon Beside Name**: the icon in a rounded square, the name to its right, the pair centred
    on the artboard, the tagline under the name.
  - **Stacked**: the icon, the name in capitals, a short accent rule and the tagline, centred.
  - **Name Beside Icon**: the name and tagline set right, the icon in a disc to their right.
  - **Divided**: the icon, a thin upright rule, then the name in capitals over the tagline.
  - **Pill**: the icon and the name inside an outlined pill.
  - **Icon Below Name**: the name and tagline over the icon in a disc.
- **Wordmarks**:
  - **Wordmark**: the name set large, centred, tracked tight, with the tagline under it set small,
    in capitals and tracked wide.
  - **Monogram**: two initials set large, bold, in an outlined rounded square.
  - **Underlined**: the name set large with an accent bar under its first letters.
  - **Two Lines**: the name in bold capitals over a second word (**Studio**) tracked wide.
  - **Spaced Capitals**: the name in widely spaced capitals between two thin rules.
  - **Initial Accent**: the first letter in a ring, the rest of the name in lower case beside it.
- **Emblems**:
  - **Badge**: a ring, the name in capitals arched over the top inside it, the tagline arched
    under the bottom, the icon in the centre.
  - **Seal**: a filled disc, the icon in it, the name in capitals arched round its top and the
    tagline round its bottom, both just outside it.
  - **Hexagon**: a hexagon, the icon in it, the name in capitals under it.
  - **Stamp**: a double ring, the initials inside, the name arched over the top and the tagline
    under.
  - **Square Badge**: an outlined rounded square holding the icon over the name in capitals.
  - **Diamond**: the initials in an outlined diamond, the name in capitals under it.
- **Marks** (a symbol alone, several made to be combined):
  - **Icon Disc**: the icon in a large disc.
  - **App Icon**: a filled rounded square with the icon in it.
  - **Rings**: two overlapping rings, ready to Unite or Exclude.
  - **Initial**: the name's first letter, large, in a ring.
  - **Peaks**: two overlapping triangles, ready to Unite.
  - **Star**: a star with a disc at its heart, ready to Subtract.

Twenty-five in all, in four categories: **Lockups**, **Wordmarks**, **Emblems** and **Marks**.
Text sits on the paper or inside an outline, never on a theme fill, so it reads in every theme.
The placeholder name is **Brand**, its initials **BR**, the tagline **Your tagline here**.

## Construction guides

**Show Guides** is per page: a logo page shows its construction guides to someone who may edit it
while Show Guides is on for that page. Each page keeps its own choice (each person's, in this
browser, the latest 200 pages); a page with no choice of its own follows the **Logo Guides**
setting (Settings, Editor, then Illustrate; on by default). Snapping to a page's keylines and
drawing onto its guides go with them. They are drawn **over** the artwork, in a cyan that reads on any page, one
screen pixel wide at any zoom, and take no presses. On an **empty** page (no artwork yet) they are
drawn under the page's own cards (the layout invitation), which are solid in light and dark.

Each person chooses **which guides show** (any of the parts below) and their **Strength**:
**Faint**, **Medium** (the default) or **Strong** (the grid always fainter than the rest), in the
page's Guides popover and in Settings, under Editor, then Illustrate.

- **Centre lines**: the vertical and horizontal centre lines.
- **Diagonals**: corner to corner, both ways.
- **Safe area**: the 10% inset square, dashed.
- **Keyline circle**: the circle inscribed in the safe area (diameter 80% of the side).
- **Inner circle**: a circle of half the side, centred.
- **Keyline square**: a centred square of 64% of the side.
- **Grid**: an 8 x 8 grid over the artboard, fainter than the rest.

The parts, as the tiles name them: **Centre Lines**, **Diagonals**, **Safe Area**, **Circles** (the
keyline and inner circles), **Square** and **Grid**.

Guides are a view: never stored, never exported, never in a slide or a preview, and not shown in
zen, presenting or the isometric view, nor to a viewer.

**Snapping**: on a logo page an element also snaps (as it snaps to every page's edges, centre lines
and margin) to the **inner circle** and the **keyline square** (their edges and centres), while
Show Guides is on.

**Drawing onto the guides**: while Show Guides is on, a **Pen** click (the node it places, and the
rubber band to it) and a pencil or marker stroke's **start and end** land on a shown guide within
8 screen px of it. Where shown guides cross (the centre, a corner, a circle meeting a centre line
or a diagonal, a grid crossing) wins; else the nearest point on the nearest guide line or circle.
A stroke's end moved onto a guide carries its nearest samples part of the way, fading over eight,
so the line bends onto the guide rather than kinking. Hidden parts never snap. Before Mirror makes
its twin, so the twin lands on the guides too.

**Where a drawing can start**: while a drawing tool is in hand (the Pen, the Pencil, a marker; not
the highlighter) and the page under the pointer shows its guides, a faint dot marks each place the
shown guides cross within 64 screen px of the pointer, and a ring marks the point a press there
would start from (the same snap as above), so the start can be aimed before pressing. Nothing shows
with no drawing tool in hand, away from every crossing and guide, or while the page's Start From a
Layout card is open. In screen px at any zoom; they take no presses.

## Mirror

- **Mirror While Drawing** is per page and per person, off when the editor opens, and held while
  the tab is open: on for one page, drawing on another is never mirrored. While it is on for a
  page, that page's axes are drawn emphasised (solid, the accent at full opacity) over its guides,
  and the Mirror button beside the page's cog shows pressed.
- **Settings**, per page and per person for the session, set in the Mirror popover; a page with
  none yet takes the last ones chosen on any page (Vertical, 6 copies, Merge Into One on, at
  first). Turning a page off and on keeps its settings.
  - **Axis**: **Vertical** reflects across the vertical centre line (one twin); **Horizontal**
    across the horizontal one (one twin); **Both** across each and through the centre (three
    twins, four ways in all); **Radial** turns the drawing about the page centre, once per copy
    (Copies in all, the drawing included: 3 to 8). The axes drawn: the centre line for each
    reflection, a spoke from the centre to the edge for each radial copy, the first straight up.
  - **Merge Into One**: on, a drawing and its twins become one element; off, each twin is added as
    its own element beside the drawing.
- While it is on, the drawing in progress (a pencil stroke, a path being placed, a shape being
  dragged out, a polygon) on a logo page shows its twins live, under the page's axis, growing with
  it. A marker's twins are placed by the page under the stroke's start, so a stroke started on an
  axis still shows them as it leaves it.
- On release, an element **drawn** whose centre lies on a logo page gets its **twins**, in the same
  edit (one undo):
  - a **freehand** stroke (any pen) and a **path**: the twin's points are mapped (reflected or
    turned), any rotation baked into them;
  - a **shape** drawn by drag or placed from the palette: the twin is the same shape with its
    centre mapped; a vertical reflection negates its rotation, a horizontal one turns it to 180°
    less its rotation (upside down for a symmetric shape), a turn adds the turn.
  - **Merged** (Merge Into One on): an area (a shape, a closed path, a closed stroke) is united
    with its twins, as Combine's Unite does, into one path (islands where they do not touch), in
    the drawn element's style; an open line (a path or a pencil stroke) and its twins become one
    path of open contours, in the drawn line's stroke. The result keeps the drawn element's id,
    so it stays selected. Where they cannot be merged (the combining engine has not loaded, a shape
    has no outline, or the result is too detailed), the twins are added as their own elements.
  - A marker's stroke merges as a line, as a pencil stroke does: one path of open lines in the
    marker's colour (Ink for one with none) and the thinnest stroke width at least as wide, so Tidy
    Up can take it. (Combine still unites marker strokes as areas, filled in their pen colour.)
  - The combining engine starts loading when Mirror is turned on (or Merge Into One chosen), so
    the merge is ready on the first release.
  - A twin that would land on the drawing itself (its centre moved by no more than 2% of the
    artboard's width: on a reflection's axis, or at the centre a turn is about) is not made.
  - Text, images, stickies, tables, arrows and every other element are placed singly.
- A twin left as its own element is ordinary: editing one afterwards leaves the other as it is.
- **Mirror Copy** (the selection's context menu on a logo page, and the command
  palette) adds a twin of each selected element whose centre is on a logo page, reflected across
  that page's centre line, by the same rules, as one edit; text and images are copied to the
  reflected position unflipped. Arrows are not copied. The twins become the selection.

## Wordmark type

A text element carries four optional fields for wordmark type. They render wherever the text is
(on any page, any mode, every export); the controls for them appear in a **Wordmark** section of a
text element's **Text** options (its element menu) while its centre is on a logo page. A value out of
its range is refused by the document's validation, as any malformed field is.

- **Tracking** (`letterSpacing`): the space added between letters, in em, from -0.2 to 1 (absent
  is 0). Shown as a slider from -20 to 100 (hundredths of an em).
- **Weight** (`fontWeight`): **Regular** (400), **Medium** (500) or **Bold** (700), the weights
  every catalogue font loads. When present it wins over `textBold`; choosing a weight clears
  `textBold`, and the Bold button sets `textBold` and clears `fontWeight`.
- **Case** (`textCase`): **As Typed** (absent), **Capitals** (`upper`) or **Lower Case** (`lower`).
  The text keeps what was typed; only its display changes.
- **Arc** (`textArc`): bends the text along a circle, from -360 to 360 degrees (absent is flat).
  Positive bows **up** (text over the top of a circle, letters outward), negative bows **down**
  (text along the bottom, letters upright). The arc's span is set by the element's box: under 180
  degrees the arc's ends meet the box's sides; from 180 its circle is the largest that fits the box;
  at 360 the text may run the whole circle. The text is centred on the arc's midpoint at the
  element's size. Arched text is one line: line breaks are read as spaces and per-range formatting
  (bold or a colour on part of it) yields to the element's own. Editing arched text shows it flat
  in the editor; the arc returns when editing ends.

## Combine

- **Where**: in Illustrate mode, when the selection is two or more **combinable** elements on the
  same logo page: the multi-selection toolbar shows a **Combine** button opening the four
  operations, the multi-selection context menu has a **Combine** section with them, and the command
  palette offers each (`Unite Shapes`, `Subtract Shapes`, `Intersect Shapes`, `Exclude Shapes`).
- **Combinable**: a shape whose kind has an outline (not a data shape, chart, or self-painting
  widget), a closed path (with its contours), a closed freehand stroke and a whiteboard pen stroke
  (by its outline). A selection holding anything else offers no Combine.
- **Operations**, over the elements in their stacking order:
  - **Unite**: everything any of them covers.
  - **Subtract**: the bottom-most, less everything the others cover.
  - **Intersect**: only what all of them cover.
  - **Exclude**: what an odd number of them cover.
- **The result** is one **path** in the bottom-most element's place in the stacking order and its
  layer, with its fill, stroke, stroke width and style and opacity (as stored: a colour left to the
  theme stays the theme's). A pen stroke at the bottom gives its colour as the fill, with no line.
  Shapes combine by their filled area whether or not they show a fill (an outlined ring combines as
  its disc). Rotations are applied to the outlines; the result is unrotated. Its
  contours are closed and filled even-odd, so holes show through. The inputs are removed (with the
  arrows pinned to them, as Delete removes them), and the result is selected. One edit, one undo.
- Curves are traced finely enough that no outline strays more than a quarter of a pixel from its
  shape at the artboard's size, and the result's straight runs are merged, so a combined circle
  stays round.
- **Nothing left** (Intersect of shapes that do not overlap, or a Subtract that removes it all):
  no edit, and a toast says "Nothing left: these shapes don't overlap."
- **Too detailed**: a result of more than 5,000 points (`MAX_PATH_NODES`) is not made; a toast says
  "That combination is too detailed to keep as one shape."
- A path with more than one contour moves, resizes, rotates and restyles as a whole; its points are
  not edited one by one (its point editing offers none, and says "Combined shapes edit as a
  whole.").

## Tidy Up

**Tidy Up** (beside the page's cog, while the selection holds one) makes hand-drawn lines
clean, as one edit:

- **What it takes**: a pencil or marker stroke (not a highlighter, not rotated) and an open path of
  corners alone (a mirrored stroke merged into one); locked elements are left as they are.
- **What it makes**: a path of straight segments, keeping the element's id (so the selection
  stays), its place in the stacking order, its stroke colour and style; a marker's width in px
  becomes the nearest stroke width. Each line is cut to the corners that shape it (they stray no
  more than 5% of the element's size, 2 px at least, from what was drawn). While the page shows
  its guides, Tidy Up aligns to them within 16 screen px (further than drawing does): a corner near
  a guide is put on it, a crossing first. Then every segment
  within 12 degrees of level or upright is made exactly so, the whole shape at once (a closed
  shape's closing segment too): corners joined by level segments share one height and by upright
  ones one position across: the one a guide holds, so squaring never moves a corner off its guide,
  else the mean of theirs moved onto a guide line along the run (a grid line, a centre line, a
  safe area or keyline square edge) when one is within reach. Corners left in line after that go. A single line whose ends meet closes
  into a shape, unfilled (a line stays a line); a closed pencil shape keeps its fill. A marker with
  no colour of its own keeps Ink by name.

## Export

- A logo page on **plain paper** exports with a **transparent** background in PNG and SVG (a logo
  is placed over other things); its PDF page stays white. A page background is exported as itself.
- **Logo Kit**: the Export dialog offers a **Logo Kit** card while the tab has a logo page, and
  only then. Its panel asks which logo page when there are several, shows it over a checkerboard,
  and downloads `<document> - <page name> - Logo Kit.zip` (the page by its name, else "Page n",
  or no page part while it is the only page), holding:
  - `logo.svg`, the artboard as SVG;
  - `logo-16.png`, `logo-32.png`, `logo-48.png`, `logo-64.png`, `logo-128.png`, `logo-180.png`,
    `logo-192.png`, `logo-256.png`, `logo-512.png` and `logo-1024.png`, the artboard at each size;
  - `favicon.ico`, holding the 16, 32 and 48 px images.

## Collaboration and agents

- A logo page and everything on it sync like any page; the guides and mirror are each person's own
  view.
- The `logo` kind, the `logo` size, `PathElement.subpaths` and the wordmark fields are part of the
  document schema the api validates and agents read and write.

## Telemetry

`Tab · Changed ·` `LogoPageAdded`, `PageKindLogo` (the first page's choice);
`Element · Changed ·` `ShapesUnited`, `ShapesSubtracted`, `ShapesIntersected`, `ShapesExcluded`,
`MirrorCopy`, `StrokesTidiedUp`, `TextTracking`, `TextWeight`, `TextCase`, `TextArc`;
`Element · Created · MirrorTwin` (once per mirrored drawing);
`UI · Toggled ·` `LogoGuidesOn` / `LogoGuidesOff`, `LogoGuide<Part>On` / `Off`, `LogoMirrorOn` /
`LogoMirrorOff`; `UI · Changed · LogoGuideStrength<Faint|Medium|Strong>`,
`LogoMirrorAxis<Vertical|Horizontal|Both|Radial>`, `LogoMirrorCopies<3|4|5|6|8>`,
`LogoMirrorMergeOn` / `LogoMirrorMergeOff`;
`Document · Exported · LogoKit`. Never a colour, name or text.

## Non-goals

- Text converted to outlines (it needs a font parser; wordmarks stay live text).
- Editing a combined path's points one by one; a mirror axis other than the vertical centre line;
  linked twins that follow each other's edits.
- Combining on pages other than logo pages, or outside Illustrate mode.
- A brand palette or colour generator; the tab's theme and the colour pickers do this job.
- An SVG favicon or a web manifest in the kit.
- A combined shape's holes in an Excalidraw export, which draws its first contour only.
