# Pages

livedesign has one editor mode, **Pages**: every tab is laid out as **pages**, sheets on the
canvas, each built up into one finished visual. This spec is what a page **is** and everything a
page offers: its size, its background, a ready-made layout to start from, the page's own actions,
snapping to it, and exporting it.

## One mode

The mode stays a named value (`EditorMode`, `packages/document/src/editor-mode.ts`) whose only id is
`pages`, so the places that name a mode (a tab's `opensIn`, a `/new?mode=` link, an `opens-in:` Explorer
filter) read through one function. A stored mode from livediagram (`diagram`, `draw`, `workshop`, `plan`
and Pages' older names, `illustrate` and `infographic`) reads as Pages (`parseEditorMode`); anything else
reads as nothing. There is no mode switch and no mode step on `/new`.

## The pages

Pages draws **pages** on the canvas, in a row, like artboards in a design tool. The rest of this spec is what a
page is and offers; this section is the basics.

- **The pages** are sheets of paper (white in light chrome, slate-900 in dark)
  with a soft shadow, under every element. The first is centred on the row
  anchor (`Page.rowAt`, the canvas origin when absent; "A page"), so content put onto a page keeps its
  place; each further page sits **96** px (`PAGE_GAP`) to the right
  of the one before, every page centred on the row's horizontal axis.
  - A page is **A4** unless it has a size of its own: at 96 px per inch,
    **794 x 1123** in portrait, **1123 x 794** in landscape (`A4_SHORT_SIDE`,
    `A4_LONG_SIDE`, `packages/document/src/page.ts`); the other
    sizes are in "Sizes".
  - The pages are the tab's (`Tab.pages`: `Page[]`, in row
    order), so everyone lays out on the same ones. A tab with no `pages` has one
    page, in its legacy `pageOrientation` (portrait when absent); the legacy
    field is dropped the first time the pages change. At most **100** pages
    (`MAX_PAGES`).
- **The surround** is the tab's own canvas: its colour, and every canvas setting, apply behind the pages. Its
  pattern is **plain** while the tab keeps its theme's pattern; a pattern someone picked shows behind the pages.
- **Each page's label** sits above its top-left corner (**A4 · Portrait** on an infographic page, or
  **A4 · Landscape · Article**, its name first when it has one, never "Page n": the page
  navigator shows its place), and
  **its settings cog** above its top-right, both held at one screen size at any
  zoom. The cog (tooltip **Page settings**, or **Page 2 settings**) opens the
  **page panel** ("The page panel").
  A viewer who cannot edit (a view role, a locked tab) gets no cog and no add
  button.
- **Adding a page:** a round **+** sits in the gap's width to the right of the
  last page, level with its middle, adding another page like the last; under it
  a smaller button opens **Add a Page** to choose a page of any kind
  ("Adding a page"). The page goes after the last; both
  are gone at the limit, and the view then frames the new page.
- **Content moves with its page.** Turning, resizing, moving or deleting a page
  moves the pages after it; every element whose centre lies on a page that
  moves (and an arrow's free ends) moves with it, re-centred on the page's
  centre (`withPages`); on an article page it keeps its place from
  the page's top-left corner, where the writing starts. A deleted page takes its content with it; a
  turned or resized page re-fits its own content
  ("Sizes"). Elements on no page stay
  where they are. Each change is one tab edit (one undo step, synced to
  everyone).
- **Turning, adding and deleting animate:** the sheets ease to their new places
  and shapes over 200 ms (none under reduced motion).
- **Centred in the viewport:** opening a tab fits the first page itself (`pageFitBox(page)`), never the whole row of
  pages: the tab's own fit on landing, and the fit after a template or an import
  lands on it, frame the first page too (only Fit to Screen fits everything), and going to a page
  (its label, the page navigator, a new page) fits that page, so whatever its shape
  (a landscape slide on a wide screen too) it fills the view; turning or resizing a
  page re-fits it. Where the Toolbar strip lies over
  the canvas's top edge, the page centres in the band below it
  (`computeFitBelow`).
- **Only the pages are drawn on.** A draw, tap-to-place or double-click-to-add
  that starts off every page is ignored (`pressIsOffPage`); elements already on
  the canvas still move freely, on or off the pages.
- **Elements are cut off at the page edges.** Whatever part of an element hangs
  off a page is hidden and cannot be pressed, as if the pages were the only
  paper (`PageClip`, a layer clipped to the pages that holds the
  element views). The selection handles are drawn above it, so an element
  hanging off a page still shows all of them. Not in the isometric view, whose
  3D stack a clip would flatten.
- **The sheets are a view, never elements.** They take no pointer events (a
  press on one is a press on the empty canvas). Thumbnails see the tab's own
  backdrop and the elements whole; the Export dialog exports
  the pages ("Export").
- The sheets are `apps/live/components/canvas/CanvasPages.tsx`; the pages'
  edits and the centring are `apps/live/hooks/editor/usePagesMode.ts`.

## Domain language

| Term                | Means                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **page**            | One sheet of a tab (`Page`), stored in `Tab.pages` in row order.                                                                      |
| **page kind**       | What a page is for, fixed when it is made: a **logo** or **wireframe** page; a page with no kind is a blank page.                     |
| **page size**       | The sheet's format (`PageSizeId`): its short and long side in canvas px, or Fit to Content's own sides.                               |
| **row anchor**      | Where the row of pages sits on the canvas (`Page.rowAt`): the first page's centre.                                                    |
| **orientation**     | Portrait (the long side upright) or landscape. A square page has none.                                                                |
| **page background** | What the sheet is painted with (`PageBackground`): a solid colour, a two-stop gradient or a picture under an overlay, plus a pattern. |
| **page layout**     | A ready-made arrangement of elements put onto one page (`PageLayoutId`), to start from and then edit.                                 |
| **page panel**      | The page's settings, opened from the cog above its top-right corner.                                                                  |

## Selecting on a page

**Select All** (Cmd/Ctrl+A on the canvas) selects what is on the **page someone is on**: the page
they last pressed on, went to (its label, the page navigator, Contents), added, or the one in view
as the tab opened. Elements on other pages, and those off every page, are left out, as are hidden
and locked layers' anywhere. With no page known yet it selects the whole tab, as in every other
mode.

## The palette's kind

The palette has a **kind**, which is always the kind of the page someone is on: it
is never shown and never chosen. Each kind is its own palette layout (`palette-layouts.ts`),
offering what that page is made of and nothing it has no use for; within a kind every tile sits in
one category (Popular, a pick from across them, aside).

- **Design** (infographic pages): Popular, Shapes,
  Write, Concepts, Components, Devices, Icons, Stickers, Media, Data.
- **Wireframe** (wireframe pages): **Components** and **Elements** first, in a band of their own
  (a divider after Elements), then the rest without **Concepts** and **Devices**
  ([Wireframe pages](wireframe-pages.md) "The Elements palette").
- **Logo** (logo pages): **Draw** (Pens: the Pen, the Freehand Pencil and the Shape Pen; Outlines:
  the Polygon; Markers: Marker 1, 2 and 3), **Shapes**,
  **Write** (Text for a wordmark, a sticky note for a comment), **Icons** and **Media**
  (an Image to trace); no charts, blocks, frames, stickers or embeds, and no Logo category
  ([Logo pages](logo-pages.md) "The Logo palette").

The kind changes by itself as someone moves (see "Selecting on a page" for which page they are
on): pressing on a page, going to one (its label, the page navigator, Contents), adding one, or a
pan, scroll or zoom that comes to rest with another page under the canvas's centre (250 ms after
the view settles; resting between pages keeps the last). Moving onto a page of another kind opens
that kind's own category (Elements, Draw; the others keep the bar as it is). A change of kind
moves: the new categories come in as a quick cascade, each rising and
fading in a moment after the one before (160 ms each, the whole within the 250 ms chrome budget);
nothing moves under reduced motion.

## Page kinds

A page is one of three kinds (`Page.kind`), chosen when it is made and never changed
afterwards (the one exception: the first page's own choice, below):

- **Infographic** (`kind: 'infographic'`, or absent: unchosen, and every page from before kinds):
  a sheet to lay out elements on, freely, starting from a layout. Everything in this spec applies to it.
- **Logo** (`kind: 'logo'`): a square artboard (1024 x 1024) to design a logo on, laid out like an
  infographic page, with construction guides, mirror drawing, wordmark type, combining shapes,
  and a logo kit export ([Logo pages](logo-pages.md)). Everything in this spec for
  infographic pages applies to it except where [Logo pages](logo-pages.md) says otherwise.
- **Wireframe** (`kind: 'wireframe'`): a screen framed as a device (a phone, the iPhone Duo, a
  tablet, a laptop, a desktop monitor, a browser window or a watch), its size the device's, laid out
  like an infographic page on the device's screen, starting from the wireframe layouts
  ([Wireframe pages](wireframe-pages.md)). Everything in this spec for infographic pages applies to
  it except where [Wireframe pages](wireframe-pages.md) says otherwise.

**Adding a page**: two buttons sit after the last page, one above the other (centred in the gap
after it, level with its middle, or, zoomed out so far that the gap is narrower than them, kept 12
screen px clear of the page), held at one screen size:

- **The +** adds **another page like the last one**, at once: its kind and shape (an infographic
  page's size and orientation, the logo artboard), and a wireframe page's device, frame look, orientation and system bars too
  ([Wireframe pages](wireframe-pages.md)). It carries the last page's background as every new page
  does, never its content. Its tooltip and name say what it adds: **Add Another Infographic
  Page**, **Add Another Logo Page**, **Add Another iPhone Screen** (a browser's **Browser Page**, a watch's **Watch Face**).
- **The button under it** (a grid, tooltip **Add a Page of Any Kind**) opens **Add a Page**: a
  compact list, one row per kind, its glyph, its name and a short line, so it stays small however
  many kinds there are:
  - **Infographic**: "Lay out icons, charts and media."
  - **Logo**: "A square artboard for a mark."
  - **Wireframe**: "A phone, tablet or web screen.", with a chevron: it turns the list to
    **Choose a Device**, a row per device (its miniature, name and screen size) under its family,
    the device last chosen in this browser ringed and focused, and **Back**.

  The list hangs beside the button (right of it while there is room, else left), level with it,
  scrolling inside the window when it cannot fit. Up and Down (Home, End) move between the rows,
  Enter or a press chooses, Escape steps back from the devices and else closes, an outside press
  closes.

The first page's own choice (below) keeps its cards, two by two, arrow keys moving between them. A new
infographic page takes the last infographic page's size and orientation (else A4 portrait; A4 in
its orientation after a Fit to Content page, whose sides are that page's alone); a new logo page
is the 1024 x 1024 artboard. Whatever its
kind, a new page **carries over the background** of the page before it (the last page): its fill
and pattern, a logo page taking the fill alone (it takes no pattern). It is the new page's own
from then on.

**A new page's background.** A new infographic page with nothing to carry over (after the plain
paper, or the first page once it is chosen as an infographic, or a Blank Infographic's page)
starts on the tab theme's **Dusk** gradient (the Gradient category's Theme Dusk: the theme's
accent shaded 65% toward black at the top into its second colour shaded 40%), so a fresh page looks
designed rather than bare; light ink reads on it at 4.5:1 or better on every built-in theme. A new logo
page starts on the plain paper as before, and a template that comes with content keeps the paper it
was designed on. Every path that makes a page lands the same: adding
one, choosing the first page's kind, the template picker and an AI tool's template. The popover is the same on
a phone (a bottom sheet). The + already adds another of the last page's kind, so the list keeps one fixed order.

A tab with no pages stored starts with one page, its kind unchosen.

**The first page's choice**: while a tab's only page is unchosen and empty, it offers the three kinds
inside itself, for someone who may edit: a card centred on the page, held at one screen size,
**What Is This Page For?** ("Choose now: a page keeps its kind once you start."), over the same three
cards as the popover. **Infographic** keeps the page, now chosen (`kind: 'infographic'`), and the
choice goes; **Logo** turns it into the artboard (`kind: 'logo'`), its logo layouts inviting; **Wireframe** turns
the card to Choose a Device, and the device chosen turns it into that device's screen
(`kind: 'wireframe'`, [Wireframe pages](wireframe-pages.md)). One edit each. Anything put on the page first (a layout, an element) is choosing Infographic by doing: the
offer goes while the page has content, and comes back if it is emptied while still unchosen. The
empty page's layout invitation waits until the choice is made. Not offered in zen or isometric
view, nor on a second page (a page added from the + is chosen in the popover).

## The page panel

- Opens beside the page, to the right of its cog, so the sheet stays in view; where the window has
  no room there, it opens under the cog. Screen-space, one size at any zoom; it scrolls when taller
  than the window.
- Top to bottom: on every unlocked page, **Show Me** and **Help** (its kind's article), Show Me running the page kind's
  track of the [Pages tour](pages-tour.md) on this page ([Logo pages](logo-pages.md) "Show Me" for a logo
  page); the **name** field (placeholder `Page n`, or `Untitled page` while there is one
  page; renamed on Enter, on leaving the field, or on closing the panel), then its tabs: **Page**
  alone on an infographic page, with no tab switch (its Layout, Background and Tidy are the
  buttons beside the cog, "Beside the cog" below); a logo page: **Background** and **Layouts**, its Layouts the logo layouts, [Logo pages](logo-pages.md)
  "The page panel"; Page is there only while the page has a size or orientation to choose), then the action row (Split Into Pages on a Fit to Content page, Duplicate, Move left, Move right, Delete) as icon buttons
  with tooltips. **Page** holds the **Size** tiles (each drawn to scale) and **Orientation**
  (Portrait / Landscape, absent for a page with no orientation); **Background** holds the
  **Background** swatches and the **Pattern** tiles; a logo page's **Layouts** holds its layouts by
  category. The cog opens it on its first tab; a logo page's layout invite opens it on Layouts. The tabs, and Portrait /
  Landscape, are the shared
  segmented control, its highlight sliding between the choices.
- **Hover previews**: hovering (or focusing) a background swatch or pattern paints it on the page
  at once; leaving the section puts the page back; a press commits.
- **On a phone** (the mobile viewport) the panel is a **bottom sheet** (up to 60% of the screen,
  swipe down or an outside press to close), the page above it; the layout invite in the title bar
  shows its icon only.
- Focus moves into the panel as it opens. One panel per page: pressing another page's cog opens
  that page's panel afresh. It closes when its page goes or editing does (zen, a lock, a view
  role), and never reopens on its own.
- Closes on an outside press, **Escape** (focus returns to the cog; a typed name is kept), or a wheel over the canvas (a
  pan or zoom would leave it stranded from its cog). After a move the panel follows its cog.

"Template" stays the name of a whole-tab starting point
([Templates](../008-canvas/canvas-and-palette.md)); what goes onto **one page** is a **layout**.

## A page

`Page = { id, orientation, size?, fit?, rowAt?, background?, name?, kind?, locked?, startedBlank? }`. Every
field after `orientation` is optional and absent on a page that never set it:

- `size` absent is **A4**. `fit` (`{ width, height }`, whole canvas px) is present exactly on a page
  in the **Fit to Content** size (`size: 'fit'`, "Sizes"); a stored `fit` page without a valid `fit`
  is read as A4.
- `rowAt` (`{ x, y }`, whole canvas px) is the **row anchor**: the first page's centre. Absent is the
  canvas origin. It is a property of the row, carried by one page (any one, so moving or turning
  pages keeps it); only the first page found carrying it counts, any other is dropped. A page edit
  that would lose it (deleting the page that carries it) hands it to the new first page, so the row
  stays where it is.
- `background` absent is the **paper**: white in light chrome, slate-900 in dark, as before.
- `name` absent shows the page's place ("Page 2"); a name replaces it in the label.
- `locked` is present (`true`) exactly on a locked page ("Locking a page"); `startedBlank` is
  present (`true`) once its in-page layout card was hidden for good.
- `kind` absent is **infographic**.

A stored page that is malformed in any optional field keeps its valid fields and drops the rest; a
page with no valid `id` or `orientation` is skipped (as today), as is a repeat of an id already read.
A new page's id is random (`page-` and eight hex digits) and never one the tab's pages have had, so
a deck slide of a deleted page can never find a new page under the old id.

## Sizes

| Size id  | Label (portrait / landscape)               | Short x long side (px) | For                       |
| -------- | ------------------------------------------ | ---------------------- | ------------------------- |
| `a4`     | A4                                         | 794 x 1123             | Print, the default        |
| `letter` | US Letter                                  | 816 x 1056             | Print in North America    |
| `a3`     | A3                                         | 1123 x 1587            | Posters                   |
| `square` | Square                                     | 1080 x 1080            | Social posts              |
| `social` | Portrait post (4:5) / Landscape post (5:4) | 1080 x 1350            | Instagram and LinkedIn    |
| `wide`   | Story (9:16) / Widescreen (16:9)           | 1080 x 1920            | Stories, and screens wide |
| `logo`   | 1024 x 1024                                | 1024 x 1024            | Logos, logo pages only    |
| `fit`    | Fit to Content                             | its own (`fit`)        | Content put onto a page   |

- **Which sizes a page offers** depends on its kind. An **infographic** page: A4,
  US Letter, A3, Square, Post and Story. A **logo** page: the `logo` size only, and no Size
  section ([Logo pages](logo-pages.md)).
- The size tiles sit four to a row. Turned landscape, the Story (9:16) reads **Widescreen
  (16:9)**.
- A page is only ever given a size its kind offers; any other is refused.
- **Fit to Content** (`fit`) is the page made around content that does not fit a paper size ("Into
  pages"): its sides are its own (`Page.fit`), the content's bounds plus the page margin
  all round, so nothing on it is scaled. Each side is clamped to **200** to **19200** px
  (`FIT_PAGE_MIN_SIDE`, `FIT_PAGE_MAX_SIDE`; 19200 px is 14400 pt, the largest page a PDF holds).
  - It is offered only on an infographic page **already in it**, as its first tile; its sides come
    from content, so no other page can choose it. Choosing another size leaves it for good (its
    content re-fits as any size change does).
  - It has no orientation, like a square: no Portrait / Landscape choice and no turn.
  - Its label is **Fit to Content**; its tile hint "Sized around the content it was made for".

- Paper sizes are at the CSS 96 px per inch; screen sizes are their own pixels.
- A **square** page has no orientation: its panel shows no Portrait / Landscape choice, and it keeps
  whatever orientation it had, so turning it back to another size restores it.
- **Changing size or orientation re-fits the page's content**: everything on the page before the
  change stays on it. Content that still fits the new margin box keeps its size, re-centred (and
  nudged back inside the margins if it pokes out); content that no longer fits is scaled down as
  one, about the page's centre, until it does: text elements' text scales with it (`textScale`)
  and arrows' bends with their lines; a shape's own label keeps its size. Nothing is cut off. The
  pages after it move along. One edit, one undo.
- The page label reads `<name> · <size label> · <Portrait|Landscape> · <Logo|Wireframe>`,
  the name only where the page has one: never "Page n", which the page navigator shows.
  Only the paper sizes (A4, US Letter, A3) add the orientation: a square and Fit to Content have none, and the post
  and story labels already say which way they face. The kind ends it, but for an infographic
  page, the plain page, which leaves the kind off so its title bar keeps the room for its
  controls.

## Backgrounds

Every page kind (infographic, logo and wireframe) is painted the same way, except that a logo
page takes no pattern and no picture ([Logo pages](logo-pages.md) "A logo page"). The page panel's
**Background** section sorts its fills into three **categories**, a row of tiles at its top read like the
Pattern tiles: each a small sheet picturing what it makes (the page's own fill on its category's tile, else
the theme's colour, a theme gradient, a sky over a meadow with a picture glyph), its name under it:
**Solid**, **Gradient** and **Image** (the tab theme's own colours lead the first two, so no
separate Theme category; a logo page shows Solid and Gradient only). It opens on the category of
the page's current fill (any gradient's on Gradient, a picture's on Image, else Solid); moving
between categories changes nothing on the page.

- **Solid**: one colour, from the one colour picker drawn in the panel
  ([Colour picker](../004-interface-design/colour-picker.md)): **Paper** (the default, no
  `background` stored) leading the tab theme's colours (**Theme Palette**, at most nine of them and
  never its white, so Paper and the theme fill one row of ten), then the soft standard colours
  ("Light") and the strong ones ("Dark"), for light paper, then Custom colours and **Add a custom
  colour** (four coloured dots). A page holding an earlier preset (Cream, Mist, Midnight, or a
  retired theme solid such as Theme wash) keeps it; it shows as the custom colour in force.
- **Gradient**: two colours and an angle (`from`, `to`, `angle` in CSS degrees, 0 to 359: 180 runs
  top to bottom), all at 160°, in two headed groups of seven across:
  - **Theme**: fourteen gradients drawn from the tab's theme, two rows of seven, the light ones
    first, then the bold and deep: from its accent (its element stroke, else its first palette
    colour, else the brand blue), a second colour and a third (a multi-colour theme's next palette
    colours, else the accent deepened 25% and 45%): **Theme dawn**, **Theme mist**, **Theme glow**,
    **Theme haze**, **Theme sorbet**, **Theme pastel**, **Theme bloom**, **Theme bright**, **Theme
    vivid**, **Theme aurora**, **Theme ember**, **Theme dusk**, **Theme twilight**, **Theme ink**.
    A theme change offers new ones; a page keeps the gradient it took.
  - **Gradients**: thirteen presets, then **Custom gradient**, two rows of seven: **Sunrise**
    (`#fde68a` to `#fca5a5`), **Peach** (`#fed7aa` to `#fecdd3`), **Rose** (`#ffe4e6` to
    `#fbcfe8`), **Lavender** (`#e9d5ff` to `#fbcfe8`), **Ocean** (`#bae6fd` to `#c7d2fe`),
    **Meadow** (`#bbf7d0` to `#a5f3fc`), **Mint** (`#ccfbf1` to `#d9f99d`), **Sand** (`#fef3c7` to
    `#e7e5e4`), **Steel** (`#f1f5f9` to `#cbd5e1`), **Dusk** (`#1e1b4b` to `#4c1d95`), **Night**
    (`#0f172a` to `#1e3a8a`), **Forest** (`#052e16` to `#115e59`), **Ember** (`#7c2d12` to
    `#be123c`).
- **Custom gradient**: the Gradient category's last swatch, a rainbow ring until a custom gradient
  is the page's fill, then that gradient. Pressing it makes the page's fill a custom gradient
  (starting from the page's current gradient, or its current solid colour to a deepened version
  of it, or Sky to Lavender at 160° on the paper) and opens its editor under the swatches, as does
  any gradient that is not a preset: **From** and **To** (each a swatch button opening the colour
  picker in a popover, with the Light and Dark rows), **Angle** (a slider, 0° to 355° in steps of
  5°, previewed while dragged, one edit on release) and **Swap** (exchanges From and To, one
  edit). The editor closes when another category or a preset is chosen.
- **Previews**: hovering or focusing any colour (Solid, From, To) previews it on the page; a pick
  is one edit. **Add a custom colour** (four coloured dots) opens the custom colour editor (no board warning). **Escape** in a From or To
  popover closes the popover only, dropping its preview, and never the panel.
- **Pattern**, over either: **None** (default), **Dots**, **Grid** or **Lines** (horizontal ruled
  lines), drawn faintly in the page's ink at 24 px pitch.
- **Image**: a picture covering the page, under an overlay that keeps what is on it readable
  ("Image backgrounds" below).
- **A dark page has light ink.** A page is dark when its background (a gradient's mean of its two
  stops, a picture's tone under its overlay) is dark by the canvas's own rule (`canvasSurface`). Every element whose centre lies on a
  dark page and that carries no colour of its own is drawn as on a dark canvas, on screen and in
  exports, so text and shapes stay readable on Midnight or Dusk.
- **Colours of their own are re-inked** when a page's fill changes, so nothing on it becomes hard
  to read ("Re-inking" below). Same edit, one undo.
- The page background is a page's, never the tab's: the surround (the tab's own canvas) is
  untouched.
- **It follows the theme.** When the tab's theme changes (a theme, or a Look), a page whose fill is
  one of the old theme's own takes the same one from the new theme: a Theme gradient (the default
  Mist included) the gradient of the same name, an animated background the same motion in the same
  colouring, a Theme Palette colour the colour in the same place of the new palette. A colour
  someone picked that is not the theme's (a preset gradient, a custom one, a standard colour, a
  picture) stays, as an element's own colour does. Content on a page whose fill moved is re-inked
  for it, in the same edit.

### Re-inking

When a page's fill changes (any page kind: infographic, logo, wireframe), every colour of its
own on the page is measured against what it now sits on, and only a colour that falls under its
**floor** is changed: lightened or darkened, keeping its hue, by the least amount that reaches its
**target**, whichever way (lighter or darker) needs the smaller change. A colour that still reads
is kept as chosen. The re-inking is part of the fill's edit (one undo step, synced to everyone),
and the panel's hover preview draws it exactly as the press would write it. Re-inking the same
fill twice changes nothing the second time.

- **What an element sits on** (its ground): the topmost card under its centre (a filled shape, a
  closed filled path or sketch, a sticky note or a link card drawn below it) in that card's fill,
  as re-inked in the same pass; else the page. A page is measured as: a solid's colour; the plain
  paper as white, the paper as printed and exported; a picture's tone under its overlay ("Image
  backgrounds"); a gradient, for text and lines, at its **worst point under the element** (the
  colours the gradient runs through across the element's span along its angle), because every
  glyph must read where it sits, and, for a card's fill, at its mean under the element, because an
  area is seen as a whole. An element over a picture, a video or a widget that paints its own
  surface has no known ground and is left as it is.
- **Floors and targets** (contrast ratios, WCAG 2.2):

  | What                                                                                                                                                                                                                             | Measured against                        | Floor  | Target |
  | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------ | ------ |
  | **Text**: a text element's text, a shape's, table's, chart's or icon's label, a stat row's figures and captions (on its cards), a process's captions, an arrow's label (its line's colour when it has no text colour of its own) | its card's fill, else the page          | 4.5:1  | 7:1    |
  | **Lines and glyphs**: an arrow's line and head, an outlined (unfilled) shape's border, a sketch's or path's line, an icon's glyph, a progress, rail or rating accent, a process's discs, a table's grid                          | its ground                              | 3:1    | 3:1    |
  | **Marks**: the fill of a filled shape, closed path or sketch that holds nothing (no label, nothing on it): a dot, a bar, a rule, a logo's shape                                                                                  | its ground                              | 3:1    | 3:1    |
  | **Cards**: the fill of a filled shape, closed path or sketch with a label or something on it, and a stat row's cards                                                                                                             | its ground (a gradient's mean under it) | 1.25:1 | 1.4:1  |

  Text under 4.5:1 (AA) is moved, a large heading in a soft colour included: on a new fill every
  word reads, which matters more than the heading's softer tone. It goes to 7:1 (AAA), not just to
  AA: the least change that only just reaches AA leaves a dark heading a muddy mid grey on a dark
  page, where 7:1 reads plainly and still keeps its hue. On a mid-tone fill where no lightness
  of it reaches 7:1 (teal, say), it goes to AA, still keeping its hue. Lines, glyphs and marks go to
  3:1, WCAG's non-text floor, and no further. A card is a container: its text carries its content and is held to 4.5:1 against the
  card's fill as re-inked, so the card itself needs only to separate from the page; 1.25:1 is
  where a white card on a near-white page stops reading as a card. A card or mark whose border is
  drawn and already reaches its floor against the ground keeps its fill: the outline separates it.
  The fill is nudged rather than a border added, so the element keeps its design (its border
  width, its corners) and only its tone moves.

- **Left as they are**, their colours being what they are, and their text sitting on their own
  surface: sticky notes, images, videos, link cards, stickers, code blocks,
  device frames, checklists, the accent-bar web components (banner,
  header), whose text sits on their own bar, emoji, a chart's series colours
  (they adapt as they are drawn instead, below), a table's per-cell styles and fills.
  A status colour (a green tick, a rose cross) is ink like any other: re-inked keeping its hue, so
  a tick stays green.
- **Elements with no colour of their own** follow the page ("A dark page has light ink") and are
  not written, with one exception: one sitting on a card of the other lightness (a pale card of
  its own colour on a dark page, a dark one on a light page), whose page ink would vanish on it.
  When that ink is under its floor against the card, it is given the ink a card of that lightness
  takes, re-inked if needed, as a colour of its own; going back to a fill its page ink reads on, it
  has no colour of its own again (the memory below). This covers a stat card's caption, a label
  with no colour on a coloured box, an icon in a disc. The same holds straight on a page with a
  fill: the page's ink is made for a near-white or near-black paper, so on a mid-tone fill (a
  slate glyph on teal, a sky progress bar on yellow) it can fall under its floor, and then it is
  given that ink re-inked as a colour of its own. On the plain paper and a white fill it is never
  judged: the design's own pairing is kept there.
- **Locks**: a locked page takes no new fill, so nothing on it is re-inked. A locked element and an
  element on a locked layer are re-inked: a lock holds where an element is and how big, not how it
  looks, as with the tab's theme.
- **Going back**: the editor remembers, for the session, each colour re-inking replaced and what
  it wrote in its place. On the page's next fill change, a colour still as re-inking left it is
  judged from the author's own colour: restored when that reads on the new fill, else re-inked
  from it. So Midnight and back to the paper returns every colour as it was, and two fills in turn
  never drift. A colour changed since (by anyone) is the author's new choice, and its memory goes.
  The memory is not stored in the document: it would go stale the moment an element is recoloured,
  and every reader (the api, the AI tools, the exports) would have to carry it; Undo restores
  exactly in any case. A fill set by an AI tool re-inks from the colours as they are.
- **Theme**: a re-inked colour is no longer the theme's, so a later theme switch keeps it as the
  author's (the theme switch's own rule).
- **Share roles**: re-inking is part of a background change, which only an Editor makes; a
  Participant or a Viewer never re-inks anything.
- **Telemetry**: none of its own; it rides on the fill's `PageBackground` event.

#### Charts adapt as they are drawn

A chart's series colours (its lines, bars, wedges and Sankey nodes) come from a palette, not from
the element: the tab theme's ramp, the chart's own palette, a slice's or series' own colour. Re-
inking writes none of them, so a page's fill could leave a series unreadable (the Boardroom look's
dark slate line on a dark page). Instead, every time a chart on a page with a fill of its own is
drawn, each colour it draws is measured against what the chart sits on and adapted for that
drawing only, never stored:

- **Its ground** is found as re-inking finds one: the topmost card drawn under the chart's centre
  (a filled box, a closed filled path, a filled table, a sticky note or a link card, in its fill as
  drawn), else the page under the chart's box (a solid's colour, a picture's tone under its
  overlay, a gradient's every tone across the box). A chart over a surface of unknown tone (a
  picture) and a chart on the plain paper or on no page are drawn as they are:
  the palettes are made for the paper.
- **Series** (a line, its points and its area, a bar, a wedge, a Sankey node and the bands it
  colours) under **3:1** against the ground (at its worst tone) are lightened or darkened, keeping
  their hue, by the least that reaches 3:1, whichever way needs the smaller change. A colour that
  already reaches 3:1 is drawn exactly as it is.
- **The chart's own text** (its axis labels, its key, a Sankey's node names) is held to **4.5:1**, and taken to **7:1** when under it,
  the same way, as re-inked text is.
- **Everywhere it is drawn alike**: the canvas, the image exports of a page (SVG, PNG, PDF), the
  Slide Deck's thumbnails and the minimap use the same adaptation (`chart-ink.ts`), so a chart exports as
  it shows. A page export also draws its charts in the tab theme's ramp, as the canvas does.
- The axis lines keep their fixed faint greys: they are guides, not data.

### Animated backgrounds

A wireframe page's Background (whose screen it moves, [Wireframe pages](wireframe-pages.md)) has a fourth category, **Animated**, after Solid, Gradient and Image (the
four tiles share the row, each a quarter, Animated's sheet a theme gradient under a sparkle). Its **Motion** carousel holds twenty-four
motions, six to a page across four pages (two rows of three) with the carousel's arrows and page dots, opening on
the page holding the page's motion; each tile, 16:9, plays in the tab theme's colours: **Aurora** (soft lights wandering, in the theme's colour and two companion hues turned
either way round the colour wheel), **Mesh** (the page's colours turning slowly into each other),
**Starfield** (stars twinkling on their own beats as the sky drifts), **Retro Grid** (a neon grid
rolling toward a glowing horizon), **Bokeh** (out-of-focus lights floating and breathing),
**Waves** (three layers rolling along the bottom), **Spotlight** (a stage light sweeping across,
answered by a softer one), **Beams** (shafts of light gliding past at a slant), **Flow**,
**Drift**, **Ripple** and **Ribbons** (with Aurora, the animated canvas styles' five, made for a
screen), **Sunburst** (rays turning slowly from below), **Fireflies** (small lights drifting and
glowing), **Snowfall** (flakes of three sizes falling and drifting), **Lava** (big soft blobs
rising and sinking), **Dot Wave** (a grid of dots swelling in a wave corner to corner),
**Clouds** (soft clouds drifting across, the nearer faster), **Warp** (stars streaking out from
the centre, lengthening as they speed up), **Orbits** (planets circling a glowing sun on faint
rings, the outer ones slower), **Radar** (a sweep turning over rings and cross hairs, each blip
lighting as the sweep reaches it and fading over the rest of the turn), **Equaliser** (bars along
the bottom rising and falling to their own beats, tallest in the middle), **Confetti** (pieces in
the theme's colours fluttering down, swaying and spinning) and **Threads** (fine lines of light
weaving past each other at their own paces). Under them, **Colours** offers six
theme colourings (Theme Deep, Night, Vivid, Bright, Soft and Mist, each a pair of stops drawn from
the theme's accent and its second colour); a press recolours the chosen motion, and the colouring
carries to the next motion picked. The row ends in **Custom colours** (the rainbow swatch, shown while the page has
a motion): it opens the Gradient category's custom editor (From, To, Angle, Swap) on the page's
two colours; the motion and its speed ride along, a motion picked next keeps them, and as they are
not the theme's they stay put when the theme changes. Each motion starts in its own colouring. Then **Speed**, while
the page has a motion: a slider from 25% to 300% in quarter steps (100% is each motion's own
pace), as the canvas's animated styles take one; dragging previews on the page, letting go sets
it once (one undo step, `Tab · Changed · PageBackgroundAnimatedSpeed`), and the speed carries to
the next motion or colouring picked. Hovering a tile or a colouring previews it on the page; a
press sets it (`Tab · Changed · PageBackgroundAnimated`).

- **Speed** is stored on the fill (`speed`, absent for 100%; a value outside 25% to 300% is
  dropped on reading) and divides every loop's length and start, so the whole motion runs faster
  or slower together.
- **What is stored**: the gradient (its two stops, at the presets' angle) with its `motion`. So
  everything that reads a gradient reads it unchanged: re-inking measures its tones, thumbnails
  draw the still gradient, AI tools see a gradient. A motion the editor does not know is dropped
  on reading, leaving the gradient.
- **Where it moves**: on the page on screen and while presenting, its moving parts over the
  gradient and under everything on the page. In an export, a thumbnail and with Reduce Motion on
  it is still: under Reduce Motion each part rests where it stands, a finished background in
  itself (a streak still points its way, a planet keeps its place on its orbit, each bar stands at
  its own height and the confetti hangs scattered down the page).
- **In an export** (PDF, PNG and SVG, and the export's preview) the page's background is its first
  frame: every part where it stands as the page opens, never the bare gradient. The parts are
  described once (`motionParts`, `apps/live/lib/page-motion-parts.ts`), so the moving layer and the
  export draw the same ones; where each stands is its loop evaluated at its start
  (`openingPose`, `page-motion-frame.ts`, which restates `app/motion-page.css`'s keyframes and
  matches the browser's own first frame). The PNG and PDF paint it onto the page
  (`paintMotionFrame`, `page-motion-canvas.ts`); the SVG embeds a picture of the gradient with the
  frame over it (a JPEG, 29 to 141 KiB for a 1920 x 1080 page, about a fiftieth of a see-through
  PNG). The picture is opaque, so it takes the fill's place, under the pattern (`pageExportFrame`'s
  `overFill`): laid over the pattern, as the page on screen and the PNG and PDF draw the motion, it would
  hide the pattern entirely. So a patterned animated page's SVG shows the pattern over the motion. A set of pages often repeats
  one background, so an export paints each background once (the PDF and a zip of pages keep the
  last two painted, as a 1920 x 1080 page at 2x is 33 MB of pixels; the SVG keeps its last eight
  pictures).
- **Cost**: every part moves by transform and opacity alone, so the compositor runs it with no
  repaint; soft edges are radial gradients, never blur filters; each motion has at most about a
  hundred parts (Dot Wave's grid); loops run from 4 to 90 seconds, calm rather than busy. Positions come from fixed
  seeds, so a page looks the same wherever it is opened.
- **Legibility**: the moving parts are faint on a light colouring (70% strength) and lights on a
  dark one; what sits on the page is re-inked against the gradient as with any gradient.
- Infographic and logo pages offer no Animated category.
- **Share roles**: as any background, an Editor's alone.

### Image backgrounds

An infographic or wireframe page can be painted with a picture:
`PageFill` `{ kind: 'image', imageId, tone?, overlay?, position?, credit? }`. A logo page offers no
Image category: a logo goes over other things, so its artboard stays a colour or the paper.

- **The Image category**, while the page has no picture: a search field and its results (the image
  picker's Search, [Image search](../009-elements/image-search.md), three tiles across), under
  them **Choose From My Images** (the person's own gallery, three tiles across, in a popover that
  opens beside the panel so the panel stays in view; one press picks and closes it; an offline
  document embeds the picture as the picker's Gallery does) and **Upload an Image** (a file, as
  the picker's Upload takes one: the same types and size limit). Once the page has a picture: the picture in a strip with **Remove** (back to the paper,
  one edit), its **Credit** line when it came from a search (the image element's Credit row: the
  text, **Source** and **Licence**), then **Overlay**, **Strength** and **Position**, then the
  search, Choose From My Images and Upload again under **Replace Image**.
- **The search suits a page.** It asks Openverse only for pictures of the page's shape
  (`aspect_ratio`: `tall` for a portrait page, `wide` for a landscape one,
  `square` for a square page), so a result covers the page without a lopsided crop. It does not
  ask for large ones (`size=large`): Openverse cannot render thumbnails for most of those, so every
  result drew broken. Everything else is the picker's search: the licences, no mature
  results, Load more, the loading, error and empty states, the footer credit.
- **Hover previews**: hovering or focusing a result paints its Openverse thumbnail on the page
  under the overlay a pick would get; leaving the results puts the page back. A press downloads
  and stores the picture as the picker's pick does (into the gallery, or embedded in an
  [Offline Mode](../006-document/offline-mode.md) document), with the same stages and failure
  copy, then commits **one edit**: the fill with its credit and tone, and the overlay. An upload
  commits the same way, with no credit.
- **Fit**: the picture **covers** the sheet, cropped and never stretched, centred across.
  **Position** (**Top**, **Centre**, **Bottom**) keeps that band of a taller picture when it is
  cropped; Centre is the default and is not stored.
- **Overlay**, over the picture and under the pattern and everything on the page: **None**,
  **Light** (a white wash), **Dark** (a slate-900, `#0f172a`, wash), **Tint** (the tab theme's
  accent, taken when chosen and stored as a hex, so a theme change leaves it), **Fade** (white,
  clear at the top and at its strength at the bottom). **Strength** is a slider, 0% to 90% in
  steps of 5, previewed while dragged and one edit on release; it is hidden for None. An overlay
  tile previews on hover and commits on a press.
- **A picture is readable by default.** A new picture takes **Light 60%** on a light canvas and
  **Dark 60%** on a dark one; replacing a picture keeps the overlay in force.
- **Tone and ink.** `tone` is the picture's average colour, sampled once when it is picked (drawn
  down to 16 x 16 px) and stored as a hex. The page's tone, what "A dark page has light ink" and
  the re-inking read, is that tone mixed toward the overlay's colour by its strength (a Fade by
  half its strength). A picture whose tone could not be sampled reads as mid grey (`#808080`). So a
  Dark wash makes a dark page with light ink, a Light wash a light page with dark ink.
- **On the canvas** the sheet paints the picture as CSS background layers (the pattern, the
  overlay, the picture, and its tone under them while it loads). Its bytes are fetched once per
  picture while the editor is open, never per frame, pan or zoom.
- **Exports** (PNG, PDF, SVG) embed the picture, cropped the same way, under its overlay. The Map,
  the Slide Deck's thumbnails and layout previews paint the page in its tone: a picture at their size is a
  smudge, and they draw without the image store.
- **Stored like an image element's picture**, never as a web address: `imageId` is a gallery id
  (1 to 128 letters, digits, `-` or `_`) or an Offline Mode document's base64 PNG, JPEG, GIF or WebP
  data URI. A fill with anything else, or an overlay or position it does not know, is dropped on
  read (the overlay's strength is clamped to 0 to 0.9). A page background counts as a reference in
  the image reference index ([Images](../009-elements/images.md) "Reference index"), so retention
  keeps its bytes and a share visitor can load it; Take Offline embeds it and Sync Document uploads
  it, as for image elements. A new page carries it over with the rest of the background.
- **The credit** stays on the fill while its picture does; replacing or removing the picture
  replaces or drops it. Exports do not print it, as for image elements.
- **Share roles**: an Editor sets, changes and removes it, as every background; a Participant or a
  Viewer sees the picture and no controls.
- **Agents** read it on `change_pages` as `image` with its overlay ("image, light 60%") and can
  replace it with a colour, a gradient or the paper; they cannot set one (they have no way to put a
  picture in the gallery).
- **Telemetry**: `Tab · Changed · PageBackgroundImage` when a picked or uploaded picture lands
  (beside the background's own `PageBackground`); a search counts as the picker's
  `Element · Searched · Image`, and a failed search or pick as its `ImageSearch.*` warnings.

### Copying a background

A page's **format** is its background: its fill (a colour, a gradient, an animated background with
its speed, or a picture with its overlay and position) and its pattern. Its size, orientation,
content, name and lock stay its own. A set of pages often wears one background, so it is
given in one go rather than page by page.

- **Apply to All**: at the foot of a page's **Background** (the button beside its cog, and the page
  panel's Background tab), **Apply to All Infographic Pages** (**Logo Pages** or **Wireframe
  Pages** on the other kinds) gives
  every other page of the same kind this page's background, under a line saying how many it reaches
  and that a locked one keeps its own. Shown only while there is another page of the kind. One edit, one undo, each page re-inked for
  its new fill ("Re-inking"). A notice says what it did: "Background applied to 35 infographic pages.", adding
  "2 locked infographic pages kept their own." when it skipped any. A locked page is skipped, never refused
  whole; a logo page's pattern is never touched.
- **The Format tool paints pages**: with the [Format
  tool](../008-canvas/canvas-and-palette.md#format-painter), a press on a page's paper (anywhere on
  the page but on an element) arms that page's background as the brush, and each press on another
  page paints it there, one edit each, re-inked. The banner reads "Select a base element or page to
  copy its style", then "Tap pages to paint this background onto them". **Keep the brush** and
  **Paint once** work as for elements; the Format Panel's groups (Fill, Border, Text, Effects, Size)
  are an element's and do not narrow a page's paint. A press on the source page, an element pressed
  under a page brush, or a page pressed under an element's brush is a no-op that keeps the brush
  (as a shape's look onto an arrow is). Painting crosses kinds (a wireframe page's background onto an
  infographic page), except a picture onto a logo page ("A logo page takes no picture background.");
  a locked target says so ("That page is locked. Unlock it to change its background.") and is left
  as it is. A refused paint keeps a Paint once brush (only a paint empties it), and a brush whose
  page has gone (deleted, undone) empties as the page goes (`useDeadPageBrush`), so the next press, on a page or an element, works at once. A press off every
  page still ends the tool.
- **Agents** give every page of a kind one background with `change_pages`'s
  `apply_background_to_all` ([Pages for agents](../024-agents/pages-for-agents.md)).
- **Share roles**: as any background, an Editor's alone. A Participant's or a Viewer's press on a
  page with the Format tool is an empty-canvas press, and they see no Apply to All.
- The pure edits are `pageBackgroundSpread` and `pageBackgroundCopied`
  (`packages/document/src/pages-background-copy.ts`), shared by the panel, the Format tool and
  the agents.

### Beside the cog

**Named while there is room.** On a desktop the title bar's buttons (Layout, Background,
the lock, a logo page's Mirror and Guides; Tidy is always its icon alone) name themselves beside their icons only while
the page is wide enough on screen to hold them named and still leave the label its least room
(40 px); zoomed out further, they all drop to their icons (with their tooltips), as on a phone.

An infographic or wireframe page's title bar holds a **Background** button before its lock and cog,
the cog's size with a tooltip, for someone who may edit (an Editor; a Participant or Viewer sees
no title-bar controls), as a logo page holds its Guides ([Logo pages](logo-pages.md) "Beside the
cog"). It opens a popover anchored to it holding the **Background** and **Pattern** sections (these
pages' panels have no Background tab: this is its one place), with the same hover previews; a press commits, one edit, and the
popover stays open for another pick. Leaving the popover, or closing it (an outside press, Escape,
the button again), drops any preview. It is tinted while its popover is open. On a desktop it
names itself beside its icon (**Background**); a phone shows the icon alone. A locked page shows
no Background button (its panel says it is locked). The page label truncates before it. Logo
pages keep their background in the panel only. Opening it is tracked as
`UI / Opened / PageBackgroundButton`.

### Tidy

An infographic or wireframe page's title bar holds a **Tidy** button, its icon alone (never named,
on a desktop or a phone), right after Background and left of the lock and the cog, shown only
while a press would change something (a page already tidy, or empty, shows none), the cog's
size with a tooltip ("Tidy: align and space what is on this page"), its glyph a broom. A page has no graph to lay out from, so it keeps the author's layout and straightens it.

- **Runs at once.** One tidier, so no popover: a press tidies the page, one edit, one undo. On a
  desktop pointer, hovering the button shows the tidied page in place (nothing written); leaving the button puts it back. A page already tidy says so in a
  toast ("This page is already tidy.") and writes nothing.
- **What it tidies**: the elements on the page (centre on the page, as everywhere else), as
  **blocks**: an element with others wholly inside it (a card and its text, a background and
  everything on it) carries them, and what is inside a block is tidied inside it the same way.
  Blocks of one size (the cards of a grid, the columns of a comparison) have what is inside them
  lined up together, so every card's icon, figure and caption sit in the same place in it.
- **What it does**, in order, each a small move that keeps the layout the author made:
  1. **Inside the margins**: a block poking out of the page's content box (the page less its
     margins) is nudged back in, never scaled. A block bigger than the box on a side (a full-bleed
     background, a banner) is left where it is on that side.
  2. **Shared lines**: left edges that nearly line up are put on one line, as are right edges and
     centres; across, tops, bottoms and middles. "Nearly" is within 1.2% of the page's short side
     (about 10 px on A4), or a run of many copies of one line each a little off. A line that near
     a margin, or the page's centre, goes on it; else the line most of them already share, else
     the middle one's, so the fewest things move. A block already on a shared line stays on it.
  3. **Even gaps**: three or more blocks of a similar size side by side in a row (or stacked in a
     column), on one line, whose gaps are already close (within a quarter of their mean) get one
     gap: the first and last stay, the ones between are spaced evenly.
  4. **A fine grid**: what lines up with nothing sits on a 4 px grid from the content box's corner
     (inside a block, from the block's corner);
     a shape's or sticky's size rounds to it too (not a square shape's, an aspect-locked one's, an
     image's or text's, so nothing is distorted or rewraps).
- **What it never does**: it never makes two blocks overlap that did not, never takes a block out
  of the block it sat in, never moves anything far (only within the nearly-lined-up distance, or
  back inside the margins), never changes the paint order, and never moves a locked element, a
  turned (rotated) one or anything on a locked layer ([Layout cleanup](../008-canvas/layout-cleanup.md#locked-elements-stay-put)),
  which stays where it is and is kept clear of like any other block. Arrows pinned to what moves
  follow their ends; a free arrow end stays. Running it twice changes nothing the second time.
- **Where it shows**: infographic and wireframe pages only (a logo page has its own Tidy for
  drawn lines). A locked page shows no
  Tidy, like its Background.

| Role        | Tidy                                                                                    |
| ----------- | --------------------------------------------------------------------------------------- |
| Editor      | Sees the button and uses it.                                                            |
| Participant | No button: a tidy moves every element on the page, and a Participant never reshapes it. |
| Viewer      | No button.                                                                              |

Pressing it is tracked as `Tab / Aligned / PageTidyUp`.

## Layouts

A **layout** is placed onto one page from its panel's **Layouts** tab, by category.

**Change Theme** sits at the top right of the title bar's Layout popover (never on the in-page
Start From a Layout card, which keeps to its layouts), left of its X: it closes the picker and opens the Tab Style
popover, as the dock's Theme button does, so a layout and the look it wears are chosen together.
It shows wherever the session may restyle the tab (an Editor; never for a Participant or a Viewer,
who see no layout picker anyway). On a phone the Layout sheet keeps Change Theme and closes by a
swipe, with no X.

- **Ninety-two layouts**, each a complete, editable starting point in the tab's theme: a layout is built without
  colours where it means the theme's, and placing it (in the editor or by an agent) fills each of those from the
  tab's built-in theme (`themedForTab`), keeping the colours it sets itself; on a dark page (a dark fill), from the
  theme's dark half, so its words are light there. Most open with
  a title and a lead line. A **tall** page (not wider than 1.15 times its height) stacks; a
  **wide** one sets things side by side:
  1. **Title Page**: an eyebrow line, a large title over a short accent rule, a subtitle, an image
     placeholder (below on a tall page, to the right on a wide one) and a footer line.
  2. **Big Number**: one huge figure, its caption, a paragraph, a progress bar and a source line.
  3. **Key Stats**: two stat rows of three figures, a trend line where the page has room, and a
     Takeaway callout.
  4. **Process**: four steps. Tall: numbered discs down the page joined by arrows, a name and note
     beside each. Wide: a process strip, a note under each step and a "Why it works" callout.
  5. **Timeline**: five dated milestones. Tall: year discs down the page joined by arrows. Wide: a
     [Timeline](../009-elements/concept-graphics.md) of the five, each its name with its year as its when, and a stat
     row.
  6. **Comparison**: two columns (Before / After), each a heading over three points with icons,
     and a "The verdict" callout.
  7. **Chart Story**: a captioned bar chart, a progress ring, three takeaways with icons and a
     source line.
  8. **Top Tips**: five tips, each an icon beside a line.
  9. **Quote**: a large quotation mark, the quote in large type and the attribution (a round
     photo, a name and a role) under it.
  10. **Team**: six people, each a round photo, a name and a role, three across (two on a page
      clearly taller than wide).
  11. **Facts Grid**: six cards, each an icon, a figure and a caption, three across (two on a tall
      page).
  12. **Checklist**: six items, a ticked circle for each done one and an empty ring for the rest,
      then "n of 6 done" and a progress bar.
  13. **Event**: "You're invited", a title, an image, when and where (icon rows) and a "Save your
      spot" banner.
  14. **Section Divider**: a big section number, an accent rule, a title and a line, centred
      down the page.
  15. **Poster**: a large image (top, or the left on a wide page), a bold headline, a line and a
      footer.
  16. **Survey Results**: a pie chart of the answers with its legend, three headline figures (a
      stat row, or stacked beside the chart on a wide page) and a source line.
  17. **Progress Report**: four goals, each a name, its percentage and a progress bar, and an
      "Updated" line.
  18. **Roadmap**: Now, Next and Later columns, three item cards each.
  19. **Agenda**: six timed items, each a title and a note (two columns of three on a page not
      clearly taller than wide).
  20. **Questions and Answers**: four questions in bold, each with its answer.
  21. **Profile**: a round photo, a name, a role, a short bio and a stat row of three facts.
  22. **Pros and Cons**: a heading, then Pros (ticks, green) and Cons (crosses, rose) side by side,
      four each, and a "Weighing it up" callout.
  23. **Before and After**: Before and After panels, each an image placeholder over three points,
      an arrow between them (down the page when tall), and the change in one figure.
  24. **Feature Matrix**: three options across, five features down, a tick or a dash in each cell,
      the recommended option's column highlighted.
  25. **Announcement**: a "New" badge, a large headline, a line, an image placeholder and a call to
      action button.
  26. **Did You Know?**: an icon in a large disc, "Did you know?", one surprising fact set large,
      and a source line.
  27. **Save the Date**: "Save the date", the date in a calendar tile, the event's name, where, and
      a "More soon" line.
  28. **Pictogram**: a figure set large ("7 in 10") over a grid of ten person icons, seven filled,
      and a caption.
  29. **Ranking**: five ranked rows, each a Step number, a name and a bar sized to its value.
  30. **Cycle**: four stages round a loop, each a disc with an icon, a name and a note, joined by
      arrows that close the loop.
  31. **Funnel**: four stages narrowing down the page, each a band with its name and count, and the
      conversion between them.
  32. **Report Cover**: the organisation and "Annual report" in tracked capitals over an accent
      rule, the year set huge, a title, a lead, a picture where the page has room, three headline
      figures split by hairlines, and a footnote saying what period the figures cover. Tall:
      everything stacks, the year above the title. Wide: the title, lead and figures on the left;
      the year and picture on the right.
  33. **Magazine Cover**: a tracked masthead, an issue strip between hairlines (issue and price),
      cover lines (an accent rule, a bold lead and a line each) and the cover story. Tall: three
      cover lines beside the picture (two on a square), the cover story across the foot. Wide: the
      cover story on the left, the picture in the middle, the cover lines on the right.
  34. **Book Cover**: inside a double rule, the author in tracked capitals, the title centred, a
      star ornament between hairlines, "A novel" in italics, round artwork, a blurb and the
      publisher. Tall: everything centred down the page; where there is no room for the artwork, the
      words centre above the blurb. Wide: the artwork on the left, the words on the right.
  35. **Proposal Cover**: a logo placeholder, the studio's name and a Confidential badge; a
      "Proposal" kicker, the title and a lead beside an accent bar; and labelled details (Prepared
      for, Prepared by, Date, Reference), each a hairline, a label, a bold value and a note. Tall:
      the title block centred above the details set two by two; a page not much taller than wide
      keeps one row (Prepared for and Date). Wide: the title block on the left, the four details
      stacked in a tinted panel on the right.
  36. **Case Study**: a "Case study" badge and a sector line, an outcome headline, a picture, a
      client quote with attribution, three results split by hairlines, and a source line. Tall:
      everything stacks, and the quote shows only where it leaves room for the picture. Wide: the
      headline and quote on the left, the picture over the results on the right.
  37. **Newsletter**: volume and date in tracked capitals, a masthead band in the accent colour
      (name and tagline), the lead story (kicker, headline, standfirst, picture), and "In this
      issue" in a tinted panel listing four page-numbered stories. Tall: stacked, with the stories
      two by two; the standfirst and picture drop where there is no room. Wide: the headline and
      standfirst, then the picture, then "In this issue" as a column on the right.
  38. **Contents**: "Inside this report", a "Contents" title, an accent rule and an intro line, then
      six chapters, each a hairline, a big number, a bold name, a note and its page number on the
      right. Notes drop where rows are short. Tall: the chapters run down the page. Wide: the title
      block and a picture on the left, the chapters on the right.
  39. **Certificate**: inside a double rule, the heading, "This is proudly presented to", the name
      set large over an accent rule, the reason, and two signature lines (name, then Date) around an
      award seal. Pages up to 1.3 times taller than wide (including square) set one line of tracked
      capitals with the seal between the signatures. Taller pages set "CERTIFICATE" large over "of
      achievement", with the seal above the two signatures.
  40. **Gig Poster**: a letter-spaced venue line, the band's name huge over two lines, the support
      acts, a photo, a ticket-stub row (date, doors, price between hairlines) and a "Tickets on sale
      now" banner. Tall: stacked and centred. Square or wide: the words down the left, the photo
      full height on the right.
  41. **Research Poster**: a two-line title set at one size, the authors and their school, a logo
      slot and a rule. Under it are sections, each a tinted heading bar over its body: Introduction,
      Methods, Results (a captioned bar chart with its legend and a source line), a Key Finding card
      with its figure set large, Conclusions and References with a slot for a code. Three columns on
      a page about as wide as tall or wider, two on a tall one.
  42. **Coming Soon**: a key image, "This winter", the title huge over two lines, a tagline in
      italics, an accent rule, the release date set large, where to watch and a billing block of
      credits. Tall: the image on top. Square or wide: the image down the left, the words centred on
      the right.
  43. **Exhibition**: the gallery and "Free entry" over a hairline, then "Form" and "Colour" set
      huge with "and" inside a big disc between them, and a subtitle. Below come an artwork image
      with its caption and a three-column grid of Dates, Open and Where, each under a hairline.
      Square or wide: the title down the left, the image, caption and grid down the right.
  44. **Travel**: "Visit", the destination set huge, a line on it, a big photo with a round "Fly
      from" fare stamp over its corner, three facts (an icon beside a figure and a caption) and a
      foot of where and by when to book. Tall: stacked. Square or wide: the name across the top, the
      photo down the left, the facts stacked down the right.
  45. **Workshop**: an eyebrow, a two-line title, a lead, a photo beside three ticked points and a
      when / how many / how much stat row. Along the foot is a tear-off strip of dashed tabs, each
      with the class and a phone number running up it. Square or wide: the words and stat row on the
      left, the photo and points on the right, the strip across the foot.
  46. **We're Hiring**: the company line, "We're hiring." set huge beside an icon disc, a lead,
      three open-role cards (role, team and terms, an arrow), three perks with icons and an "Apply
      by" banner. Tall: stacked. Square or wide: the pitch, perks and banner on the left, an "Open
      roles" column of cards on the right.
  47. **Big Sale**: "Summer sale", "Up to 50% off" set inside a big disc with two stars on its edge,
      a headline, the dates, department pills and an "In store and online" banner. Tall: stacked and
      centred. Square or wide: the disc on the left, the rest centred down the right, the pills two
      by two in a narrow column.
  48. **Notice**: a tinted Caution band with a warning icon at each end, a big shield disc, the rule
      over two lines at one size, three ticked dos and a contact footer. Tall: stacked and centred.
      Square or wide: the band across the top, the disc on the left, the words on the right.
  49. **Motivational**: a framed, type-only poster with three words set huge (START, USE, DO), each
      over its phrase, an accent rule and who said it. Tall or square: stacked and centred. Wide:
      the three pairs side by side at one size.
  50. **KPI Dashboard**: four metric cards, each a name, a big figure, its change against last
      quarter with a trend icon (green when good, rose when bad) and a six-month area sparkline,
      with a source line. A wide page sets the cards four across, a long page (a story) one per row,
      and other pages two by two. A card much wider than tall sets its figure beside the sparkline.
      Every card's figure is the same size.
  51. **Trend Story**: a headline and lead on the left and the period's one figure set big on the
      right, then a two-series line chart (this year against last) over twelve months, and three
      moments, each a disc holding its month, a name and a note, with a source line. A wide page
      sets the moments in a column beside the chart, a long page stacks them under it, and other
      pages run them three across under it.
  52. **Market Share**: a doughnut of five shares with its key, the leader's share set in the hole,
      a table of each share and the points it moved (green up, rose down, the leader's row bold),
      and a source line. A wide page sets the doughnut on the left with the table and a "The story"
      callout on the right. A tall page stacks the doughnut over the table.
  53. **Stat Mosaic**: six tiles of mixed sizes on a grid: a hero figure with an icon, an icon
      figure, a score with five stars, a progress ring and its caption, a day-by-day area chart, and
      a second icon figure, with a source line. A wide page, or one not much taller than wide, uses
      a four by three grid with the hero and chart two by two each. A tall page uses three by four,
      and a long page two by six with the hero and chart across the page. A page that is not much
      taller than wide drops the lead line.
  54. **Staircase**: five levels, each a number, a name and a note. Not clearly taller than wide:
      five columns standing on the page's foot, each taller than the last, the level's number, name
      and note inside each, and the lead line in the room the low steps leave above them. Taller:
      five cards climbing from the bottom left to the top right, each a Step number, a name and a
      note, joined by arrows, with a pin beside the first and a flag beside the last.
  55. **Customer Journey**: five stages, each an icon and a name, what the customer does, where it
      happens, how it feels as an emoji face, and what to fix next. Not clearly taller than wide:
      stages as columns and the journey's lanes (Doing, Touchpoints, Feeling, Fix next) as rows
      under them, a persona photo heading the lane names, and the faces plotted at the height of
      their mood and joined by arrows. Taller: stages as rows (a stage card, what happens and
      where), and a Feeling column from Low to High where each face sits further right the better
      the stage feels, joined down the page by arrows; a long page adds each stage's fix.
  56. **Project Plan**: six dated weeks across the top, five workstreams (a name and an owner each)
      as progress bars spanning their weeks, a Launch row ending in a milestone diamond, a Today
      line through the rows with a tag under it, and faint gridlines. Not clearly taller than wide:
      a progress ring of how much is done, "Done so far" and two figures beside the chart. Taller: a
      stat row of three figures under it.
  57. **Decision Flow**: a New idea start, three numbered question diamonds and a Build it end,
      joined by arrows labelled Yes, each question's No arrow ending in its own outcome card. Not
      clearly taller than wide: the flow runs across the middle, each question above its diamond and
      its outcome below, with a line under each end. Taller: it runs down the middle, each question
      to the left of its diamond and its outcome to the right.
  58. **How-To**: a title, three facts as icon rows (time, servings, difficulty), then six steps,
      each a photo with a Step number in its corner over the step's name and a note. One row of
      six on a clearly wide page, otherwise three across in two rows.
  59. **Versus**: two contenders, each an icon in a large disc, a name and a line, with a VS badge
      between them; four stats, each a name over a pair of bars (left and right contender); and a
      source line. Tall: the contenders face to face across the top, the stats under them. Not
      clearly taller than wide: the contenders out at either side, the badge and stats between them,
      no lead line.
  60. **Pricing Tiers**: three plan cards side by side, each a name, a line on who it is for
      (dropped where the card is short), the price set large, what it is per, an accent rule, four
      ticked features and a button. The middle plan is drawn heavier and badged "Most popular". A
      wide page drops the lead line.
  61. **SWOT**: Strengths, Weaknesses, Opportunities and Threats, each a card with its letter set
      large, its name at one shared size, an icon where there is room, a rule and three points. Two
      by two with Helpful / Harmful column heads and a "Top row: inside the business" foot line.
      Four in a row under "Inside the business" / "Outside it" on a wide page. Stacked on a page
      over 1.6 times taller than wide. Lead line only when clearly taller than wide.
  62. **Effort vs Impact**: four quadrants (Quick wins outlined, Big bets, Fill-ins, Money pits),
      each named with a hint at its outer edge, inside an Impact axis up the left and an Effort axis
      along the foot, each ending in an arrow. Seven numbered ideas sit at their effort and impact,
      kept clear of the quadrant names. A numbered key sits beside the plot, or under it in two
      columns on a page clearly taller than wide.
  63. **Scorecard**: three options, each a card with its name, its overall score set large over "out
      of 5", and star ratings on four criteria. The top scorer is drawn heavier and badged "Top
      score". A source line ends the page. Three cards down the page (score at the left, a rule, the
      criteria two by two) where it is clearly taller than wide; three across otherwise (score over
      a rule, criteria down the card).
  64. **Spectrum**: a rail across the page with five options placed on it at their positions from
      simple to powerful. Each option is an icon disc, with its name and note above and below the
      rail in turn. The pick is drawn heavier and badged "Our pick", and the two ends are named
      under the rail with arrows. A tall page with room adds three trade-off rows (what changes from
      one end to the other); with less room it closes on a "Why the middle" callout.
  65. **Venn**: two overlapping translucent circles, side by side or one over the other (whichever
      lets them grow larger). Each set's name is set large over its three traits in its own part,
      and "Both" with the three shared traits sits in the overlap.
  66. **Three Options**: three option cards, each a lettered disc, a name, its cost and time, an
      image placeholder, two ticked points for (green) and one cross against (rose). One is drawn
      heavier and badged "Recommended". Three across where the page is at least 0.8 times as wide as
      tall; otherwise three cards down the page, each with the image and cost at the left and the
      letter, name and points beside them.
  67. **Org Chart**: a lead's card (round photo, name, role) joined by thin lines to three crew
      cards. Each crew card has its lead's photo, name and role, a short rule and its members, one
      per line (two to a line in a wide card). A page much taller than wide closes on a stat row of
      the team's numbers.
  68. **Testimonials**: three customer quotes, each with a star rating, a round photo, a name and a
      role, and a source line. Not much taller than wide: three cards side by side, the rating at
      the top and the attribution at the foot (under the photo in a narrow card). Taller: three
      cards down the page, the photo and rating beside each quote.
  69. **Meet the Speakers**: the event in the lead line, four speakers each a photo with a time
      badge, a name, a role and the talk's title, and a "Book your seat" banner. Four across on a
      wide page, two by two on a tall one; a cell much wider than tall puts the photo beside the
      words.
  70. **Spotlight**: an "Employee Spotlight" eyebrow, the colleague's name and role, three quick
      facts as icon rows and three interview questions in bold, each answered. Wide or not much
      taller than wide: the photo down the left, the words beside it. Tall: the photo beside the
      name and facts, the interview under them. A story: the photo across the top.
  71. **Our Values**: six values, each an icon in a disc, a name, a short accent rule and a line,
      centred in their cells. Three across (two on a page much taller than wide).
  72. **Idea Board**: a "How might we" question, six sticky notes slightly turned, each with its
      vote count in a disc on its corner, and a Next step callout. Three across (two on a tall
      page).
  73. **Persona**: a "User Persona" eyebrow, a round photo, a name and a line of facts, a quote in a
      speech bubble, Goals (green ticks) and Frustrations (rose warnings) side by side, and two
      trait bars. Wide or not much taller than wide: the person and quote down the left, the lists
      and traits beside them. Tall: the photo beside who she is, then the quote, the lists and the
      traits.
  74. **Shout-outs**: a Colleague of the Month card (round photo with an award badge, name, role and
      why) and three thank-you cards, each a heart, who it is to and from, and the message. Wide or
      not much taller than wide: the colleague of the month on the left, the notes beside. Tall:
      that card across the top (photo beside the words), the notes under it.
  75. **Carousel Cover**: the account's handle and a "1 / 7" slide count, a "Save this for later"
      kicker, a hook stacked over four lines at one size (three lines on a page not much taller than
      wide), an accent rule, a teaser line and "Swipe for all 7" beside an arrow disc at the foot; a
      wide page sets the hook on the left and a large arrow disc with "Swipe" on the right.
  76. **Tip of the Day**: a "Tip of the day" pill and a large "#12", the tip stacked over three
      lines as large as the page allows, an accent rule, three reasons (an icon beside a line each)
      and the handle row with "Save for later"; a wide page puts the reasons on a card to the right
      of the tip.
  77. **Milestone**: "We just hit", the figure ("10,000") set as wide as the page, what it counts, a
      thank-you line, the follower climb as a line chart with a caption naming its source, and the
      handle row; a square page has no room for the chart and sets the figure larger instead; a wide
      page centres the words on the left with the chart on the right.
  78. **Behind the Scenes**: a "Behind the scenes" pill, a two-line title, a line, and a mosaic of
      three photos (one across the top, two below), each with its step named on a chip, then the
      handle row; a square page drops the line so the photos keep their room; a wide page sets the
      title on the left and the mosaic on the right (one tall photo, two stacked).
  79. **Countdown**: "The countdown is on", the event's name, three tiles (days, hours, minutes,
      each a large number over its unit), the date and time, a "Turn on reminders" button and the
      handle row; a wide page sets the words on the left and the tiles in a row on the right.
  80. **Product Spotlight**: the product photo as large as the page allows with a round price badge
      on its lower edge, "New in", the product's name, a five-star rating with its review count, one
      line, and a "Shop now" button beside "Link in bio"; a wide page fills the left with the photo,
      the badge on its edge, and centres the words on the right.
  81. **Giveaway**: "Giveaway" set across the page, the prize, its photo with a "WIN" star on it,
      "How to enter" with three numbered steps across, and the small print; a wide page lists the
      steps down the left and sets the photo on the right.
  82. **Welcome Aboard**: a "Please welcome" pill, a large round photo, the name, the role, three
      facts across (an icon over a line each) and the handle row with "Say hi below"; a wide page
      sets the photo on the left and the name, role and facts (as icon rows) on the right.
  83. **Webinar**: a "Free live webinar" pill, the talk's title over two lines, when, how long and
      where (an icon row each), the host on a card (round photo, "Your host", name and role; a
      square page drops the "Your host" line) and a full-width "Save your seat" button; a wide page
      sets the talk on the left and the host's portrait, name and role on the right.
  84. **How It Works**: an image with four numbered hotspots on it, a key giving each step's name
      and note, and the one figure that sells it ("3x") over its source line. Wide, square and 4:5
      pages set the image over the figure on the left and the key down the right; a taller page puts
      the image across the top, the key two by two under it, and the figure at the foot.
  85. **Anatomy**: an image down the middle and six named parts, three either side, each joined to a
      spot on the image by a leader line with no arrowhead. Every page keeps the three columns; a
      wide page sets the image square-ish and the names in larger type, a tall page keeps the image
      narrow like a phone screen.
  86. **Key Concepts**: one big idea in a hub circle and the six ideas behind it, each an icon disc
      with a name and note, an arrow from the hub to each. A wide page sets three ideas down each
      side on an arc, words reading away from the hub; a taller page sets three above and three
      below, the group centred down the page; a square keeps the discs and notes compact.
  87. **Cheat Sheet**: four groups of four shortcuts, each group an icon and name over an accent
      rule, each shortcut a keycap beside what it does, with a line at the foot for the Mac keys.
      Two columns of groups, one on a story; a page clearly taller than wide adds a Pro Tip callout.
  88. **Glossary**: eight terms A to Z, each under its letter tile with a plain-words definition,
      the term set as large as its column allows. Two columns reading down, one on a story.
  89. **Myths and Facts**: four myths in dashed cards, each joined by an arrow to the fact that
      corrects it in a solid card, under a red-cross Myth and green-tick Fact header, over a source
      line. Side by side on every page but a story, which sets each myth over its fact with an arrow
      down and a cross or tick beside each card.
  90. **Fact File**: an image, a table of six key facts with the names in a header column, a "Did
      you know?" callout and the source line. Wide, square and 4:5 pages set the image down the left
      beside the table and callout; a taller page stacks image, table and callout.
  91. **Lesson Summary**: what you can now do (three ticked lines), three numbered key points, four
      key-word pills, and a question with four answers A to D, the answer at the foot. Two columns
      (what was learnt left, words and quiz right) on every page but a story, which stacks the four
      sections; the answers sit one under another where the column has the height, else two by two.
  92. **Formula Explained**: a rule set large across a band, each term on a tile and the exponent
      raised, each term's meaning under a symbol disc, a worked example and a bar chart of the
      result over time. Wide, square and 4:5 pages set the four meanings in a row, each linked to
      its term, with the example beside the chart below; a taller page sets the meanings two by two
      with no lines, then the chart, then the example at the foot.
- **Categories**: the picker groups the layouts as /new groups templates, one category at a time,
  at most twelve to a category: **Covers** (Title Page, Quote, Event, Section Divider, Report Cover,
  Magazine Cover, Book Cover, Proposal Cover, Case Study, Newsletter, Contents, Certificate),
  **Posters** (Poster, Gig Poster, Research Poster, Coming Soon, Exhibition, Travel, Workshop, We're
  Hiring, Big Sale, Notice, Motivational), **Data** (Big Number, Key Stats, Chart Story, Facts Grid,
  Survey Results, Progress Report, Pictogram, Ranking, KPI Dashboard, Trend Story, Market Share,
  Stat Mosaic), **Steps and Time** (Process, Timeline, Checklist, Roadmap, Agenda, Cycle, Funnel,
  Staircase, Customer Journey, Project Plan, Decision Flow, How-To), **Compare** (Comparison, Pros
  and Cons, Before and After, Feature Matrix, Versus, Pricing Tiers, SWOT, Effort vs Impact,
  Scorecard, Spectrum, Venn, Three Options), **People and Ideas** (Top Tips, Team, Questions and
  Answers, Profile, Org Chart, Testimonials, Meet the Speakers, Spotlight, Our Values, Idea Board,
  Persona, Shout-outs), **Social** (Announcement, Did You Know?, Save the Date, Carousel Cover, Tip
  of the Day, Milestone, Behind the Scenes, Countdown, Product Spotlight, Giveaway, Welcome Aboard,
  Webinar) and **Explainers** (How It Works, Anatomy, Key Concepts, Cheat Sheet, Glossary, Myths and
  Facts, Fact File, Lesson Summary, Formula Explained). A category with no layouts is not offered. Every picker browses them in the **layout gallery**
  (below).
- **Body type** is the page-sized medium and large text sizes, never the small one. Headlines
  are large text scaled to their box (`textScale`), so they read the same on the canvas and in
  every export.
- **Numbers cite a source**: Big number and Chart story end in a source line at the page's
  foot; Chart story's chart carries a caption naming what it shows.
- **Nothing floats in empty space**: Quote centres its block down the page; Comparison's rows
  share their column down to the verdict.
- **Fitted to the page**: a layout is laid out in proportions of the page's content box (the page
  less margins of 7% of its short side), so it fits any size and orientation.
- **A press places the layout straight away**, never asking first, empty page or not: onto a page
  with content it removes every element whose centre is on the page (and arrows pinned to one,
  and in turn arrows riding a removed arrow), then places the layout with **what was written
  there carried into it** (below). It is one change, one undo step, so Undo brings the page's
  content back.
- **Content carries over** (`carryPageContent`): the words, pictures and figures a person put on
  the page move into the new layout's matching places, each taking its new place's position, size
  and look, so changing a page's layout never means retyping it. The same holds on logo
  pages (a wordmark's name carries into the next wordmark).
  - **Only what was written carries.** Placeholder words from any layout ("Your big headline"), an
    empty image placeholder, or a chart, stat row or icon left as a layout made it, stay behind:
    switching between untouched layouts shows each one's own placeholders.
  - **Words go by role.** The page's text sorts into its **title** (its most prominent words), its
    **large** lines (a subtitle, a lead, a statement: type at least as large as the large text
    size) and its **body** (the rest), each in reading order (top to bottom, then left to right).
    The title lands in the new title, the first large line in the first large line, and so on.
    **Figures** ("73%", "12k", "$4.2M", "2026") are a role of their own and land only in figures.
    Words left over once their role is full take the nearest role that still has room (a title
    then large then body; large then body then title; body then large then title).
  - **Pictures go to pictures**, the largest first into the largest place, filling it (cropped).
  - **The same element carries its data**: a stat row's stats, a chart's figures, a callout's
    title and words, a progress bar's value, a checklist's items, an icon's icon, each into the
    next element of the same kind in reading order.
  - **Words fit their new place**: carried words keep the place's type, shrinking (never growing)
    only when they would overflow it, and never below 40% of the place's own size.
  - Whatever finds no place goes with the rest of the page's content (Undo brings it back).
  - An agent's `layout` change (the MCP tools) stays a plain replace: an agent writes its own
    words afterwards, by element id.
- Placed elements are ordinary elements. The selection is cleared (nothing replaced stays
  selected) and the panel closes, so the finished page reads clean.
- **The layout gallery** is how every picker offers a page's layouts (the Layout popover, the empty
  page's card, Choose a Layout's dialog, a logo page's Layouts tab), all of them at once (a
  wireframe page's for its device class); a wireframe page's tiles stand at most 200 px tall, a
  phone's narrowing to fit:
  - Along the top, a **search** ("Search n layouts") and **Surprise Me**. The search narrows every
    category at once: each word typed must appear in a layout's name, its description or its
    category's name. Nothing matches: "No layouts match" with Clear Search.
  - Under them, **category chips** in one row that scrolls sideways: **All** first, then each
    category, each with its count. All (the default) shows every layout in sections, one per
    category, its heading (the category's name and count) held at the top while its layouts scroll
    past; a chip shows that category's layouts alone. A chip and the search combine.
  - The layouts in **large tiles**, as many columns as the gallery's width holds at 156 px each (a
    tall page's at 112 px), never fewer than two: each tile is the layout's preview, its name and,
    where the gallery is wide (the card from 520 px, the popover and the dialog), its one-line
    description. Under the pointer a tile lifts and takes the brand ring with a **Use** pill at
    its corner (the same on keyboard focus); none of the motion under reduced motion. Tiles cascade
    in as a view opens, and draw their preview once they scroll near view (a soft placeholder of
    the page's shape until then), so ninety layouts open without drawing them all.
  - **Surprise Me** places a random layout from those shown (never the one it last landed on while
    there is another), and its dice tumble. In the Layout popover it keeps the popover open, so
    pressing it again rolls again with the page changing behind it; elsewhere it places and
    closes as a press does. Tracked as `Tab / Changed / PageLayoutSurprise`.
  - A picture a layout leaves for the author shows in its tile as a **sample picture** (a soft
    drawn landscape, the palettes taken in turn), so a picture-led layout reads as one; what lands
    is the ordinary picture placeholder.
- **The Layout button**: an infographic or wireframe page's title bar always holds a **Layout**
  button (an icon and its name on a desktop, the icon alone on a phone, tooltip **Layout**) before
  its Background button, for an Editor, on any page that is not locked, empty or not. It opens the
  page's layout gallery (a wireframe page's the wireframe layouts) in a popover anchored to it (580 px,
  headed **Layouts**, the search taking the keyboard); on a phone it opens as a bottom sheet.
  Hovering a tile previews it on the page; pressing one places it (over anything there, at once)
  and closes the popover; closing it takes any preview away. Opening it is tracked as
  `UI / Opened / PageLayoutsButton`. These pages' panels hold no Layouts tab: the button is their
  one way in, besides an empty page's own card. A **logo** page keeps its Layouts tab, and its
  empty artboard still invites them: a "Start From a Layout" button beside the cog, only while the
  page is empty, opening the panel on Layouts, with its words while the title bar has room for
  them beside its other buttons and the label, else just its icon, else hidden.
- **An empty page offers its layouts**: while an infographic or logo page is empty (never a
  wireframe page, whose screen stays clear), on a tab
  the viewer can edit, a **Start From a Layout** card sits centred on the page, held at its screen
  size whatever the zoom, as large as the page on screen leaves room for inside a 16 px margin (at
  most 900 by 660 px): a header (a sparkles badge where the card is 520 px or wider, **Start From a
  Layout**, "n infographic layouts in your theme. Pick one, then make it yours." naming the page's kind,
  and Hide; no Change Theme, the card keeps to its layouts) over the layout gallery. Pressing a layout places it (the page is empty,
  so at once, as one undo step); there is no hover preview here, since drawn over the page it
  would cover the card's own tiles. The card goes as
  soon as anything lands on the page, and **Hide** (in its corner) puts it away for that page until
  the tab is next opened; the title bar's Layout button still opens the layouts. It
  never shows while the first page offers its kind, while the page's panel is open, while a palette tile is armed
  (tap to drop or drag to draw: the page is where the element will land, so the card steps aside and comes back when
  the tool is put down with the page still empty), when presenting or in zen, or when the page is too small on
  screen to hold it (less than 340 by 380 px inside its margin). There, a phone or a page zoomed out
  small, the page shows a **Choose a Layout** button in its middle instead (brand-filled, a
  sparkles icon, held at its screen size), which opens the layout gallery on its own: a bottom
  sheet on a phone, a centred dialog on a desktop, headed like the card (no Change Theme either); a press or Surprise Me
  places the layout and closes it. Opening it is tracked as `UI / Opened / EmptyPageInvite`.
- **Hover previews the layout on the page**: while a tile is hovered (or focused) the page shows
  that layout as it would land, drawn over the whole sheet in the page's background, and the
  page's own content is hidden meanwhile (left out of the page clip), so the two never mix. The
  preview already holds the carried content (the page's words and pictures in their new places),
  so it shows exactly what a press lands. It is a picture only: nothing is placed and nothing
  enters the history; leaving the tiles (or closing the panel) takes it away.
- **Tiles are the real layout**: each tile draws the layout as built for this page's size and
  orientation and rendered as it lands, as the viewer sees it: placed in the tab's theme as a
  press places it, drawn in the viewer's half on the page's own background, and on a plain page
  in dark chrome on the dark paper the canvas shows (not an export's white), through the same
  renderer the exports use. Only
  outside the editor (no tab to paint with) is a tile a wireframe (text as bars, images shaded,
  icons as dots).

**Full bleed.** A layout is built in the page's content box, and is told how far the page runs
past it (the margin, its **bleed**). A picture or panel set to the page's edges reaches exactly that
far, square-cornered, so it meets the page's own edge; it never stops in the margin short of it, and
nothing else passes the margins. The words always stay inside them. Words a layout sets over a
picture carry their own colours on a scrim of their own, so they read on any picture
in any theme.

## Contents

**Contents** is every page of the Pages tab in one list, in every Pages tab and for every role:
finding your way round a long document is everyone's. It has two homes on a desktop, and the person
chooses between them. Each row's picture is the page as the canvas shows it: a page with no fill on
the canvas's own paper (white, or slate `#0f172a` in dark mode, as the Map draws it) in the
canvas's ink; the Slide Deck's pictures the same.

- **Docked as a sidebar** (the default): a filmstrip pinned flush against the canvas's left edge,
  the way a slide editor shows its slides. It starts below the Toolbar strip and runs down to the
  canvas's foot, 236 px wide (at the panels' UI scale), opaque, with no gap at its edge, so no page
  shows round or through it; only its inner top corner is rounded, and a border and a soft shadow
  part it from the canvas. Its header holds the list glyph, "Contents" and **Minimise** (a
  panel-close glyph facing its edge; HoverCard "Minimise", "Tuck Contents into its button, bottom
  right."). Dragging the header carries it across the canvas, the side it would pin to outlined,
  and it pins to the left or the right on release; there is no button for it. Its side is the
  person's per-device choice, kept in this browser alone (`livedesign:contents-side:v1`), as the
  corner panels' places are ([Panel docking](panel-docking.md)). It stays open while the person
  works; the cluster has no Contents button while it shows, and the corner panels and the
  bottom-right cluster on its side start past it.
- **Minimised to its button**: the bottom-right cluster holds **Contents** (a list glyph, named
  beside it on a desktop), left of the Theme & canvas button. It opens the **Contents** popover
  above it, whose header adds **Dock as Sidebar** (a panel-open glyph; HoverCard "Dock as Sidebar",
  "Keep Contents open beside the canvas."), which closes the popover and docks the sidebar.

Which home is the person's own, kept in their synced preferences (`contentsPlacement`,
[User preferences](user-preferences.md)), so it follows them across devices and documents; Settings
› Editor › Pages › **Contents** (Sidebar or Button) sets it too. The sidebar docks only while
the tab has more than one page: a single page has nothing to find your way round, so it keeps the
button (and its popover offers no Dock as Sidebar). A phone never has the sidebar, whatever the
choice: there Contents is always the button, opening a bottom sheet. Zen mode and presenting hide
both. The sidebar slides in from its side as it docks (a 200 ms fade and 12 px slide), with none
under reduced motion.

**Framing beside it**: a page framed on screen (a press in the list, the pages row's arrows,
opening the tab) centres in what shows beside the sidebar, never under it. Docking it (from the
popover, opening the tab, dragging it to the other side) frames the page in view again beside it,
measured where the sidebar comes to rest rather than mid-slide;
minimising it frames that page again across the whole canvas. **Fit** (the zoom cluster's, and
Shift+1) frames the page nearest the middle of what shows, not the whole tab.

Both show the same list:

- **Header**: "Contents" (no page count: the list says it); with more than six pages, a **Find a
  Page** box under it that narrows the list as you type, by a page's name, kind or number and by
  the words on it: its elements' labels, notes, cells, items and the rest the editor's find reads
  (Escape clears it, then closes).
- **The list**: every page in row order, one row each: its number, a live thumbnail of the page as
  it is (its background, motion still, and everything on it, drawn by the same renderer as the
  Slide Deck's thumbnails, 16:9, A4 or square as the page is), and its name (its own, else "Page
  3"), with the padlock on a locked page. Nothing more: the picture says what the page is. The
  sidebar lays them out as a filmstrip: the number beside a picture as wide as the column, up to
  124 px tall for a portrait page, left-aligned with the name under it. The page in view is marked
  by its row's tint and its picture's accent ring (and, in the popover, an accent bar down the
  row's left edge).
- **A page's actions** (an Editor's): in the sidebar, a small toolbar at the end of the name's
  line, shown while the row is hovered, focused or marked: **Duplicate**, **Lock** or **Unlock**,
  and **Delete** (not on a locked page), each a glyph with its Tooltip. In the popover, one **⋯**
  button (shown on hover or focus) opens the same as a menu, a header naming the page, with Delete
  last under its own separator.
  Each does exactly what the page's title bar does; none glides to the page. A Participant and a
  Viewer see neither.
- **Going there**: a press (or Enter) glides the canvas to the page, as the pages row's arrows do,
  and marks it as here. On a desktop the popover stays open, so a reader can hop from page to page;
  on a phone the sheet closes so the page shows. Up and Down move between rows, Home and End to
  the first and last; the list scrolls the marked page into view when it opens.
- **Following the view**: the sidebar keeps marking the page in view as the view moves (a pan, a
  zoom, the pages row's arrows), read once the view has rested 150 ms, and scrolls its row into view.
  The page in view is the one holding the middle of what shows beside the sidebar, else the nearest.
- **Reordering**: an Editor drags a row to move its page: a caret shows where it will land and
  the move commits on release, one edit (one undo), the page's content with it, exactly as
  dragging its label along the pages row does.
  A mouse or pen drags the whole row; a finger drags the row's grip (shown on a phone and on hover
  on a desktop), so the list still scrolls by touch. The release is not a press of the row: it
  does not glide there, but marks the moved page as here. While Find a Page narrows the list there
  is no reordering (the rows shown are not the whole order). A Participant and a Viewer see no grip
  and cannot drag. The drag is the Slide Deck's (`useRowReorderDrag`).
- **For a screen reader** the rows are a list named Pages. Each row opens through one button stretched across it,
  named by the page and `aria-current="page"` on the one here; its toolbar (or ⋯ menu) and grip sit above that
  button as controls of their own. Rows that were listbox options held those buttons, controls nested in a
  control. Up, Down, Home and End move between the rows' buttons.
- **Adding**: an Editor's footer is the same pair as the canvas's + after the last page ("Adding a
  page"): a wide **Add Page** button, with the add icon, that adds another page like the last (its
  tooltip names what it adds, **Add Another Infographic Page**, **Add Another iPad Screen**: its kind and
  shape, a wireframe page's device and frame too), and beside it a square button, **Add a Page of
  Any Kind**, opening Add a Page (the kinds as rows, Wireframe stepping on to its devices) beside
  it. A new page lands after the last (carrying the background, theme's Dusk for a new infographic), glides into view and the list scrolls to its new row, marked as here. At the page
  limit both buttons are disabled with the limit in
  their tooltips. A Participant and a Viewer see the list without the footer.
- **Cost**: thumbnails are drawn when the popover opens and redrawn only when the tab's elements
  or pages change while it is open, arrow labels laid out once for the tab rather than once a
  page; nothing is drawn while it is closed. The sidebar stays on screen while the person works, so
  its thumbnails redraw only once the tab has rested 250 ms, never on every frame of a drag or every
  key typed, and the page in view is read on the view's rest, never on every frame of a pan. The
  words on the pages are read only while Find a Page holds a search.
- **Telemetry**: `UI · Opened · PageContents` on opening; `UI · Used · PageContentsJump` on going
  to a page; `UI · Used · PageContentsReorder` on moving one; adding a page counts as the row's + does,
  and a page's actions as its title bar's. Minimising sends `UI · Changed · ContentsPlacementButton`,
  docking `UI · Changed · ContentsPlacementSidebar`, before the choice is kept; dragging the sidebar
  across sends `UI · Changed · ContentsSideLeft` or `ContentsSideRight`.

## Page actions

From the page panel's footer.

- **Duplicate**: a copy of the page (size, orientation, background, a name with "copy") right
  after it, with a copy of every element on it (new ids; arrows pinned between copied elements stay
  pinned between the copies). Pages after it move along, their content with them.
- **Move left** / **Move right**: swaps the page with its neighbour; both sides' content moves with them. Disabled at the row's ends.
- **Delete page**: removes the page **and everything on it** (arrows pinned to it too); the pages
  after it close the gap. Deleting the only page clears the
  tab (its pages and elements, one edit) and brings Start Making Pages back
  ([Template starts](start-diagramming.md) "Start Making Pages").
- **Split Into Pages** (a Fit to Content page only): splits the page into one page per cluster of
  its content, nothing scaled ("Into pages" › "Split Into Pages"). Its icon button sits first in
  the action row, tooltip **Split Into Pages**.
- **Rename**: the panel's name field; empty clears the name.
- Each is one tab edit (one undo step, synced to everyone). At the page limit (**100** pages,
  `MAX_PAGES`) Duplicate is disabled, like
  Add page is absent; Move left / right are disabled at the row's ends.
- **A new page comes into view**: after Add page or Duplicate the view frames the new page.
- **A delete never leaves you looking at nothing**: after Delete the view glides to the page
  before the deleted one, or to the next when the first page went,
  as it glides to a new page (instant under reduced motion).

## Arrows stay on one page

An arrow never joins two pages. An element (or arrow) is on the page its centre
lies on; one between pages is on none.

- **Drawing or moving an arrow's end**: the end pins to an element, or connects onto another
  arrow, only when that element or arrow is on the same page as the arrow's other end, or either
  is on no page. Elements on another page show no connection points and are passed over, so the
  end stays free where it is dropped.
- **Connect** (an arrow from a selected element to the next one clicked): clicking an element on
  another page draws no arrow and ends the connect.
- An arrow already joining two pages (made before this rule, in livediagram, or by an AI tool or a
  collaborator) stays as it is.

## Locking a page

Any page, of every kind (infographic, logo, wireframe), can be **locked**, so it stays as it
is while the rest of the tab is worked on.

- **Where**: a padlock button in the page's title bar, before its cog (and the logo page's own
  controls), for someone who may edit: **Lock page** while open, **Unlock page** (pressed, the
  padlock closed) while locked. Its label says **Locked** beside it on a desktop while locked.
  One edit, one undo, synced to everyone (the lock is the page's, not a person's).
- **What a lock holds**:
  - **Its elements** (those whose centre lies on the page) behave as on a locked layer: drawn as
    ever, but not selectable, movable, editable or deletable; clicks pass through; the marquee
    and Select All skip them. Whatever reaches them anyway (a drag, a nudge, a resize, an align, a
    Tidy Up) leaves them where they are: the lock holds where they are and how big, not how they
    look, so the tab's theme re-colours them and their comments still work. One that goes in a
    cascade (an arrow whose pinned end was deleted, a deleted layer's) goes.
  - **Nothing is added to it**: an element drawn, dropped, pasted or placed so its centre lands on
    a locked page is not added, and one dragged onto it goes back; a short notice says why ("That
    page is locked. Unlock it to change what is on it.").
  - **The page itself**: its name, size, orientation, background, pattern, layout and kind do not
    change, and **Delete page** is disabled. Its panel opens, showing a notice ("This page is
    locked. Unlock it beside the cog to change it.") with its sections unavailable. Moving it left or right and duplicating it still work
    (a duplicate is unlocked).
- **What a lock does not do**: pages around it can still be added, moved or deleted (its content
  moves with it as pages close up or open around it), and the tab's theme still applies to it.
  The lock is on the active tab's edits made here: an AI tool's or a collaborator's edit is not
  refused.
- **Telemetry**: `Tab · Changed · PageLocked` / `PageUnlocked`.

## Getting around the pages

- **A page's label zooms to it**: a press on the label fits that page in the view, as landing on
  the tab fits the page you were on: the page itself fills the view (below the Toolbar strip), whatever its
  shape, not a square around it.
- **The Map shows the pages**: each page's sheet in its own background (a picture as its tone) with a crisp outline,
  under the content, counted in the Map's bounds (so a tab of empty pages still has a Map), and
  each element inked for its page.
- **Drag a page's label to reorder**: once the press travels 6 screen px sideways it is a drag (an
  editor with two or more pages; only then the label shows a grab
  cursor). A marker bar in the gap shows
  where the page will land (after every other page whose centre is left of the dragged page's) and
  the dragged sheet dims; release moves it there with its content, one edit. Escape cancels.
- **The label fits its page**: it truncates to the page's width on screen less the title bar's
  buttons, and hides when under 40 px.
- **Snapping to the pages**: while a move or a resize is in hand, an element
  snaps to the edges, the centre lines and the margins (7% of the short side) of every page, with
  the same guides as element-to-element alignment (not to the pages' spacing: equal-spacing snaps
  stay element to element).
- **The page navigator**: in the bottom-right cluster, right of Undo / Redo (first when there is
  no Undo / Redo), while there are two pages or more: a cluster strip of the cluster's own 44 px
  controls, **Previous page**, the place of the page someone is on ("2 of 5"), **Next page**
  (disabled at either end). An arrow fits that neighbouring page in the view, as a press on its label does, gliding
  there (an ease-out over `VIEW_GLIDE_MS`, 280ms, `apps/live/lib/viewport-glide.ts`) so the eye follows the
  move; a page just added glides into view the same way, and under reduced motion each lands at
  once. A second press mid-glide starts from where the view has got to. For everyone who can see
  the pages; not in zen, and not on a phone, whose bottom row has no room for it (a swipe moves
  between pages there).
- **The arrow keys**: with nothing selected (and no text being typed in), **Right** and **Down** go
  to the next page and **Left** and **Up** to the previous one, from the page someone is on, as the
  navigator's arrows do (gliding there, the page fitted); at either end of the row the key does
  nothing. With a selection the arrows nudge it, as everywhere. For every role: it only moves the
  view.
- **The view rests on a page**: the canvas never comes to rest between pages, beyond the row, or
  zoomed out past a page. Pan and zoom as freely as ever while a hand is on it (a drag, a finger, a
  pinch, a wheel or trackpad); the moment it lets go, the view glides (`VIEW_GLIDE_MS`, at once
  under reduced motion) onto one page:
  - **Which page**: the one holding the middle of what shows (beside the Contents sidebar), else
    the nearest. From a page seen whole, a pan of a fifth of the view's width toward a neighbour,
    or a quicker flick of at least 24 px, turns to that neighbour, as swiping a slide deck does, so
    getting to the next page never needs a long drag. A pinch or a zoom never turns the page.
  - **At least whole**: zoomed out past the page's fit (or within 2% of it), the view fits that
    page, exactly as its label, Fit and the pages row's arrows frame it. Zoomed in further than fit
    stays zoomed in: the page is kept across what shows, its edges never pulled more than 104 px
    (`READING_TOP_ROOM`, the reading frame's own top room) inside the view's edges, and centred
    along a side it is now narrower than. Moving on from a page seen whole (a swipe, or a pan onto
    another page) lands on the new page seen whole, at its own fit, whatever the zoom was: a watch
    fits far closer than an A4 page, and its zoom never carries over.
  - **Whenever the view rests**: the same holds after anything else that moves the view (the zoom
    cluster's buttons, the Map, the arrow keys) once the view has rested 250 ms with no pointer
    held. Not while following someone (their view is the follow's, and a move of your own would
    end it).
  - For everyone who can see the pages, on a phone and a desktop alike; no setting.
- **Back to the page you were on**: landing on a tab of pages (switching back to it, a reload) fits the page you were last on rather than the first, so moving between tabs
  never loses your place. The page you are on is the one under the middle of the view (else the
  nearest), taken once the view has rested for 400 ms (`LAST_PAGE_SETTLE_MS`), and
  straight away as you leave the tab or close the page. It is each person's, kept in this browser
  per document and tab (the latest 200 tabs), never in the document: a collaborator lands on their
  own page. The first time, or once that page is deleted, landing fits the first page. For everyone
  who can see the pages, whatever their role.
- **A page is something in view**: the canvas's "Nothing's in view" nudge counts every page, an
  empty one too, as content, so it never shows while a page is on screen.

## Export

The Export dialog exports **pages**, not the tab's content bounds.

- **Formats**: **PDF**, **PNG**, **SVG** and **GIF** (an animated GIF of the pages, moving as they
  move on the canvas: [Animated GIF export](../020-import-export/animated-gif-export.md)), plus **JSON** (the tab
  itself, a backup that imports back). Markdown is not offered: a page is not an outline.
- **Pages**: every format asks **All pages** or **One page** (a segmented control), and with One
  page, which page (each by its label). PDF starts on All pages; PNG and SVG start on One page,
  the first.
  - **PDF, all pages**: one PDF, every page in order, one PDF page each.
  - **PDF, one page**: a one-page PDF of the chosen page.
  - **PNG / SVG, one page**: that page's image.
  - **PNG / SVG, all pages**: a **.zip** holding one image per page, in order, each named
    `NN <page label>.png` (two-digit place, then the label).
- The download is named `<document> - <tab>` (`.pdf`, `.zip`), or with ` - <page label>` for one
  page.
- The preview shows the chosen page, or with All pages a page picked to preview.
- Each page exports **exactly its sheet**: its size, its background (a picture embedded under its overlay) and pattern, and the elements on
  it clipped to its edges, as the canvas shows them. The surround is not exported. The plain paper
  exports white (a logo page's is transparent in PNG and SVG, [Logo pages](logo-pages.md) "Export",
  which also adds the Logo Kit format); elements are inked for the page's own surface. An element (an arrow by its
  resolved ends) that reaches onto the page is drawn; the rest are left out of the file.
- A PDF page is the page's size in print points (CSS px x 0.75: A4 is 595.5 x 842.25 pt).
- The Isometric and Background pattern options are not offered: a page is its own background and
  is never tilted.
- The Hidden layers option is not offered: Pages has no Layers, so a hidden layer's
  elements stay out of the export as they stay off its canvas.
- The preview is the download: a logo page's PNG and SVG preview show its see-through paper over a
  checkerboard, as the Logo Kit's preview does.

## Import

The Import dialog offers **JSON** (a livedesign tab, which may carry pages).

## Telemetry

`Tab · Changed ·` `PageAdded`, `PageRemoved`, `PagePortrait`, `PageLandscape`, `PageSize`,
`PageBackground`, `PageBackgroundImage`, `PagePattern`, `PageBackgroundAppliedToAll` (Apply to All),
`PageBackgroundPainted` (the Format tool, page onto page), `PageRenamed`, `PageDuplicated`, `PageMoved`, `PageLayout`,
`PageLayoutSurprise` (the layout gallery's Surprise Me), `PageLocked`, `PageUnlocked`,
`PageFitToContent` (content put onto a page on opening), `PagesLaidOut` (Split Into Pages),
`LogoPageAdded` and `WireframePageAdded` (the other kinds' adds), `PageKindInfographic` / `PageKindLogo` /
`PageKindWireframe` (the first page's own choice);
`Document · Exported · PagesPNG / PagesSVG / PagesPDF / PagesGIF` (one page) and
`PagesPNGPages / PagesSVGPages / PagesPDFPages / PagesGIFPages` (all pages);
`UI · Added · PageSlide`; `UI · Opened · SlideDeck`; `UI · Used · PageSwipe` (a short pan or a flick
turning to the neighbouring page, never the snap itself); `Tab · Aligned · PageTidyUp` (an infographic
page's Tidy); `UI · Closed · EmptyPageLayouts` (the in-page
**Start From a Layout** card's Hide); `UI · Opened · EmptyPageInvite` (Choose a Layout, where the
card has no room). Never a colour, name or layout content.
A logo page's own events are in [Logo pages](logo-pages.md) "Telemetry".

## Into pages

Opening a tab never moves, resizes or scales an element. Content that does not fit its page is put
onto a page made to fit it instead.

- When an editor opens a tab whose content is off its page (an import or the
  api), its content is put onto a page as an edit of its own (a viewer or a locked tab is left alone):
  - **No pages stored**, and content that does **not fit inside the first page**: one page is
    made **around all of the content, where it is**. The row anchor (`rowAt`) is the content's
    centre, so the page sits over the content and nothing moves.
  - **Pages stored**, none of them made anything of (no logo or wireframe page, no name, no
    background, no lock), and **no element on any page**: the stored pages are replaced by one
    page made around the content, as above. Pages someone has set up are kept, the content left
    in the surround.
  - Otherwise nothing happens: content left in the surround stays where it is.
- **The page made around content** is an infographic page, landscape when the content is more than
  1.1 times wider than tall (`LANDSCAPE_RATIO`), portrait otherwise. It is **A4** when the content
  fits A4's margin box in that orientation, and otherwise **Fit to Content** ("Sizes"): the
  content's bounds plus the margin all round. Past `FIT_PAGE_MAX_SIDE` the page stops growing and
  the content runs off its edge, still unscaled.
- A toast tells the editor: "Put onto a page that fits it. Undo takes the page away." Telemetry:
  `Tab · Changed · PageFitToContent`.

### Split Into Pages

A page action on a **Fit to Content** page ("Page actions"), for content that reads better as
separate pages. It is explicit: never run on opening a tab.

- The page's content (every element whose centre is on it) splits into **clusters**: elements
  joined by a pinned arrow, and elements within 120 px of each other (edge to edge)
  (`PAGINATE_CLUSTER_GAP`), belong together.
- Clusters go in **reading order**: rows top to bottom (a cluster joins a row while its top is above
  the row's first cluster's bottom), each row left to right.
- The page is replaced, in its place in the row, by **one page per cluster**, each made around its
  cluster as above (A4 or Fit to Content, landscape or portrait) with the cluster **moved** onto it,
  centred, **never scaled**. Each new page keeps the split page's background and its name (the
  first as it was, the rest numbered: "Overview", "Overview 2", ...). The pages after it move along
  with their content.
- At most 20 pages (`PAGINATE_MAX_PAGES`), and never past `MAX_PAGES`: clusters past the
  last share it (its page made around them together). At the page limit there is no room for a
  second page: nothing changes and a toast says "A tab holds at most 100 pages: delete one to split
  this page."
- With one cluster there is nothing to split: the page is left as it is and a toast says "This
  page is one group: nothing to split."
- It is **one edit**. A toast: "Split into n pages. Undo puts it back." Telemetry:
  `Tab · Changed · PagesLaidOut`.

## Slides

Every page of a tab is a slide of the deck, in page order, and presenting the tab shows its
pages one by one. How the deck follows the pages (a page joining it, moving, being hidden or
deleted) is in [Presentation mode](../012-collaboration/presentation-mode.md) "The deck follows
the pages"; this section is what the pages themselves show of it.

- The Slide Deck panel adds slides **a page at a time**: a page picker (each page by
  its label) and **Add as slide**, in place of "Select elements to make a slide". Every page is in
  the deck already, so what it adds is a **copy** of a page's slide (to show a page twice), which
  takes its place in the page order too and deletes as any slide does.
- A **page slide** (`Slide.pageId`, docs/specs/012-collaboration/presentation-mode.md) is the page,
  resolved live: it shows whatever is on the page now and is framed to exactly the page, so it
  follows the page's edits, reorders and size changes. Its row reads `<tab> · <page label>`, the
  label read from the slide's own tab (so a slide on another tab names its page too), or
  `<tab> · Page deleted` while its page is missing and the deck has not yet followed (its tab still
  loading); its thumbnail is the page on its background, its elements inked for the page's surface
  as the export inks them. Once the tab's pages are read, a deleted page's slides leave the deck.
- Pressing a page slide's row switches to its tab and frames its page, as the page's label does.
  Its `…` menu has no Selection section (the slide is whatever is on its page), its delete confirm
  (on a copy) says "The page stays.", and a duplicate counts as `UI · Added · PageSlide`.
- **A page's deck button**: in every page's title bar, beside its cog, for an editor on a desktop,
  the page shows its place in the deck, named beside its icon while the title bar has room. The
  deck always has a slide of every page, so the button toggles that slide's visibility in the
  presentation: **Hide in Slides** (an open eye) or **Show in Slides** (a crossed eye), the same as
  the slide's Visibility in the Slide Deck, so wherever a page is presented its visibility is one
  press away. Telemetry as the Slide Deck's own (`UI · Added · PageSlide`, `UI · Toggled ·
SlideHidden / SlideShown`).
- **Add Notes**: beside the deck button once the deck has a slide of the page, **Add Notes** (a
  page glyph) opens a popover holding that slide's speaker notes, the deck slide's own: the same
  notes the Slide Deck panel writes and the presenter view shows, never drawn on the page. Once
  the slide has notes the button reads **Notes**, pressed. Every keystroke writes the deck (one
  `UI · Changed · SlideNotes` per opening, on the first keystroke); emptying the box removes the
  notes. Telemetry `UI · Opened · PageNotesButton`. An Editor's alone, like the deck button.
- **A page slide presents full screen**: it is fitted with no margin, the page edge to edge on the
  screen's limiting side, and everything round the sheet is black (a letterbox), so a 16:9 page
  fills a 16:9 screen and any other shape sits between black bars, as a projector shows it.
- Zen, presenting and the isometric view show the sheets alone: no labels, cogs, layout invites or
  add button. While a
  page slide presents, the canvas shows that page's sheet alone (its neighbours are not drawn), as
  it shows only a slide's elements.

## Chrome

- **Slides button**: in the bottom-right cluster (left of the brush), joined to Contents in one frame (`PagesClusterStrip`, as Layers and Theme share one), a **Slides** button opens the Slide Deck panel as a popover hanging above it (an
  outside press closes it; the button shows pressed while open). A design is likely to be
  presented, so its deck is one press away. Desktop only, as the Slide Deck itself is. Shown whenever the tab has pages, as every page is in the deck. Its hover card
  reads "Order, hide and present your pages." Telemetry: `UI · Opened · SlideDeck`.
- **No Layers**: the Layers button and panel are not offered (a page is arranged by its pages, not
  layers); a tab's stored layers are left untouched.

## Non-goals

- Per-page themes or fonts: the tab's theme and font apply to every page.
- Master pages or shared headers and footers.
