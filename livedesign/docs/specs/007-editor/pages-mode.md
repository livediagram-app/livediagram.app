# Pages

livedesign has one editor mode, **Pages**: every tab is laid out as **pages**, sheets on the
canvas, each built up into one finished visual. This spec is what a page **is** and everything a
page offers: its size, its background, a ready-made layout to start from, the page's own actions,
snapping to it, and exporting it.

## One mode

The mode stays a named value (`EditorMode`, `packages/design/src/editor-mode.ts`) whose only id is
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
    `A4_LONG_SIDE`, `packages/design/src/page.ts`); the other
    sizes are in "Sizes".
  - The pages are the tab's (`Tab.pages`: `Page[]`, in row
    order), so everyone lays out on the same ones. A tab with no `pages` has one
    page, in its legacy `pageOrientation` (portrait when absent); the legacy
    field is dropped the first time the pages change. At most **100** pages
    (`MAX_PAGES`).
- **The surround** is the tab's own canvas: its colour, and every canvas setting, apply behind the pages. Its
  pattern is **plain** while the tab keeps its theme's pattern; a pattern someone picked shows behind the pages.
- **Each page's label** sits above its top-left corner (**1024 x 1024 · Logo** on a logo page,
  **iPhone · Wireframe** on a wireframe page, its name first when it has one), and
  **its settings cog** above its top-right, both held at one screen size at any
  zoom. The cog (tooltip **Page settings**, or **Page 2 settings**) opens the
  **page panel** ("The page panel").
  A viewer who cannot edit (a view role, a locked tab) gets no cog and no add
  button.
- **Adding a page:** a round **+** sits in the gap's width to the right of the
  last page, level with its middle, adding another page like the last, always of the
  tab's own kind ("One kind a tab", "Adding a page"); on a wireframe tab a smaller button
  under it adds a screen of another device. The page goes after the last; the buttons
  are gone at the limit, and the view then frames the new page.
- **Content moves with its page.** Turning, resizing, moving or deleting a page
  moves the pages after it; every element whose centre lies on a page that
  moves (and an arrow's free ends) moves with it, re-centred on the page's
  centre (`withPages`). A deleted page takes its content with it; a
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
  (a turned tablet on a wide screen too) it fills the view; turning or resizing a
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
  hanging off a page still shows all of them.
- **The sheets are a view, never elements.** They take no pointer events (a
  press on one is a press on the empty canvas). Thumbnails see the tab's own
  backdrop and the elements whole; the Export dialog exports
  the pages ("Export").
- The sheets are `apps/live/components/canvas/CanvasPages.tsx`; the pages'
  edits and the centring are `apps/live/hooks/editor/usePagesMode.ts`.

## Domain language

| Term                | Means                                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **page**            | One sheet of a tab (`Page`), stored in `Tab.pages` in row order.                                                                                                 |
| **page kind**       | What a page is for, fixed when it is made: a **logo**, **wireframe** or **photo** page; a page with no kind is a blank page. Every page of a tab is of one kind. |
| **page size**       | The sheet's format (`PageSizeId`): its short and long side in canvas px, or Fit to Content's own sides.                                                          |
| **row anchor**      | Where the row of pages sits on the canvas (`Page.rowAt`): the first page's centre.                                                                               |
| **orientation**     | Portrait (the long side upright) or landscape. A square page has none.                                                                                           |
| **page background** | What the sheet is painted with (`PageBackground`): a solid colour, a two-stop gradient or a picture under an overlay, plus a pattern.                            |
| **page layout**     | A ready-made arrangement of elements put onto one page (`PageLayoutId`), to start from and then edit.                                                            |
| **page panel**      | The page's settings, opened from the cog above its top-right corner.                                                                                             |

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

- **Design** (a blank page, its kind not chosen yet): Popular, Shapes,
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

A page is one of three kinds (`Page.kind`, `PageKind`), chosen when it is made and never changed
afterwards (the one exception: the first page's own choice, below). Every page of a tab is of one
kind ("One kind a tab"). A page whose kind is absent is
a **blank page** not chosen yet: a plain A4 sheet. A kind livediagram stored that livedesign does not
have (an infographic, a slide, an article) reads as absent (`pageKindOf`).

- **Logo** (`kind: 'logo'`): a square artboard (1024 x 1024) to design a logo on, laid out freely,
  starting from a logo layout, with construction guides, mirror drawing, wordmark type, combining
  shapes, and a logo kit export ([Logo pages](logo-pages.md)). Everything in this spec applies to it
  except where [Logo pages](logo-pages.md) says otherwise.
- **Wireframe** (`kind: 'wireframe'`): a screen framed as a device (a phone, the iPhone Duo, a
  tablet, a laptop, a desktop monitor, a browser window or a watch), its size the device's, laid out
  freely on the device's screen, starting from the wireframe layouts
  ([Wireframe pages](wireframe-pages.md)). Everything in this spec applies to it except where
  [Wireframe pages](wireframe-pages.md) says otherwise.
- **Photo** (`kind: 'photo'`): a picture to edit, its sheet the photo's own shape, with layers, brushes,
  selections, adjustments and filters ([Photo pages](../031-photo/photo-pages.md)). It has no background, no
  margin and no layouts; elements may sit on top of it as on any page.

### One kind a tab

A tab is a logo, a set of wireframe screens or a set of photos, never a mix: **every page of a tab
is of the tab's kind**, the kind of its first page (`tabPageKind`, `packages/design/src/page.ts`). A
logo tab holds only logo pages, a wireframe tab only wireframe pages (of any devices), a photo tab only
photo pages.

- The kind is set by the first page's choice (below) or by the template a tab is made from. It is
  never changed afterwards: the first page's choice is offered only while the tab's only page is
  unchosen and empty.
- A tab whose first page is still a **blank page** (its kind not chosen) has no kind yet: no page of a
  kind is added to it. While that page is alone and empty its choice sets the kind; a blank page that
  holds something stays blank (as a page stored by livediagram does), and a tab of blank pages grows
  only by duplicating one.
- Adding a page (the +, Contents' **Add Page**, the wireframe tab's device chooser, **Edit as Photo**,
  an agent's `add`) only ever adds a page of the tab's kind. A page of any other kind is refused
  (`kind_not_offered`): someone who wants another kind starts another tab.
- A duplicate is of its page's kind, so it keeps the rule.
- A tab stored with pages of more than one kind (made before this rule) opens as it is: nothing is
  taken away or changed, and a page added to it is of its first page's kind, like the last page of
  that kind.

**Adding a page**: the **+** sits after the last page (centred in the gap after it, level with its
middle, or, zoomed out so far that the gap is narrower than it, kept 12 screen px clear of the
page), held at one screen size. It adds **another page like the last one** (the last of the tab's
kind), at once: its kind and shape (the logo artboard, a photo page's picture size), and a wireframe
page's device, frame look, orientation and system bars too ([Wireframe pages](wireframe-pages.md)). It
carries the last page's background as every new page does, never its content. Its tooltip and name
say what it adds (`addAnotherLabel`): **Add Another Logo Page**, **Add Another Photo Page** (an
unstarted photo page), **Add Another iPhone Screen** (a browser's **Browser Page**, a watch's **Watch
Face**). There is no way to choose another kind: the tab has one. A tab with no kind yet (a blank
first page) shows no +.

**A screen of another device**: on a wireframe tab a smaller button sits under the + (a grid, tooltip
**Add a Screen of Another Device**). It opens **Choose a Device**: a compact list, a row per device
(its miniature, name and screen size) under its family, the device last chosen in this browser ringed
and focused. A press or Enter adds a wireframe page in that device; Up and Down (Home, End) move
between the rows, Escape or an outside press closes. The list hangs beside the button (right of it
while there is room, else left), level with it, scrolling inside the window when it cannot fit; on a
phone it is a bottom sheet. The device is a wireframe page's shape, not its kind, so a tab of screens
may hold phones, tablets and browsers together.

A new logo page is the 1024 x 1024 artboard, a new wireframe page the device of the page it is like
(or the device chosen), a new photo page its picture's size. Whatever its
kind, a new page **carries over the background** of the page before it (the last page): its fill
and pattern, a logo page taking the fill alone (it takes no pattern). It is the new page's own
from then on.

**A new page's background.** A new page with nothing to carry over starts on the plain paper, and a
template that comes with content keeps the paper it was designed on. Every path that makes a page
lands the same: adding one, choosing the first page's kind, the template picker and an AI tool's
template.

A tab with no pages stored starts with one page, its kind unchosen.

**The first page's choice**: while a tab's only page is unchosen and empty, it offers the three kinds
inside itself, for someone who may edit: a card centred on the page, held at one screen size,
**What Is This Page For?** ("Choose now: every page of this tab will be this kind."), over three
cards (`FirstPageChoice`, `page-kind-cards.tsx`):

- **Logo**: "A square artboard for a logo, with guides and drawing tools."
- **Wireframe**: "A screen to wireframe, framed as a phone, tablet, laptop or browser."
- **Photo**: "A picture to edit: layers, brushes, adjustments and filters."

**Logo** turns it into the artboard
(`kind: 'logo'`), its logo layouts inviting; **Wireframe** turns
the card to Choose a Device, and the device chosen turns it into that device's screen
(`kind: 'wireframe'`, [Wireframe pages](wireframe-pages.md)); **Photo** turns it into an unstarted photo page
(`kind: 'photo'`), its Start a Photo card showing ([Photo pages](../031-photo/photo-pages.md)). One edit each. Anything put on the page first (a layout, an element) keeps it a blank page: the
offer goes while the page has content, and comes back if it is emptied while still unchosen. The
empty page's layout invitation waits until the choice is made. Not offered in zen,
nor on a second page (a page added from the + is of the tab's kind).

## The page panel

- Opens beside the page, to the right of its cog, so the sheet stays in view; where the window has
  no room there, it opens under the cog. Screen-space, one size at any zoom; it scrolls when taller
  than the window.
- Top to bottom: on every unlocked page, **Show Me** and **Help** (its kind's article), Show Me running the page kind's
  track of the [Pages tour](pages-tour.md) on this page ([Logo pages](logo-pages.md) "Show Me" for a logo
  page); the **name** field (placeholder `Page n`, or `Untitled page` while there is one
  page; renamed on Enter, on leaving the field, or on closing the panel), then its tabs: **Page**
  alone on a blank page, **Device** alone on a wireframe page, with no tab switch (a wireframe page's Layout, Background and Tidy are the
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
- `kind` absent is a **blank page**, its kind not chosen yet.

A stored page that is malformed in any optional field keeps its valid fields and drops the rest; a
page with no valid `id` or `orientation` is skipped (as today), as is a repeat of an id already read.
A new page's id is random (`page-` and eight hex digits) and never one the tab's pages have had, so
anything that named a deleted page can never find a new page under the old id.

## Sizes

| Size id  | Label (portrait / landscape) | Short x long side (px) | For                       |
| -------- | ---------------------------- | ---------------------- | ------------------------- |
| `a4`     | A4                           | 794 x 1123             | A blank page, the default |
| `logo`   | 1024 x 1024                  | 1024 x 1024            | Logo pages only           |
| `device` | the device's name            | the device's frame     | Wireframe pages only      |
| `photo`  | the picture's size           | its own (`fit`)        | Photo pages only          |
| `fit`    | Fit to Content               | its own (`fit`)        | Content put onto a page   |

- **Which sizes a page offers** depends on its kind (`pageSizesFor`): a blank page A4, a **logo**
  page the `logo` size only and no Size section ([Logo pages](logo-pages.md)), a **wireframe** page
  its device ([Wireframe pages](wireframe-pages.md)), a **photo** page its picture's size
  ([Photo pages](../031-photo/photo-pages.md)).
- A page is only ever given a size its kind offers; any other is refused. A page stored in a size
  livediagram had (US Letter, A3, Square, Post, Story) reads as A4.
- **Fit to Content** (`fit`) is the page made around content that does not fit a paper size ("Into
  pages"): its sides are its own (`Page.fit`), the content's bounds plus the page margin
  all round, so nothing on it is scaled. Each side is clamped to **200** to **19200** px
  (`FIT_PAGE_MIN_SIDE`, `FIT_PAGE_MAX_SIDE`; 19200 px is 14400 pt, the largest page a PDF holds).
  - It is offered only on a page **already in it**, as its first tile; its sides come
    from content, so no other page can choose it. Choosing another size leaves it for good (its
    content re-fits as any size change does).
  - It has no orientation, like a square: no Portrait / Landscape choice and no turn.
  - Its label is **Fit to Content**; its tile hint "Sized around the content it was made for".

- A4 is at the CSS 96 px per inch; screen sizes are their own pixels.
- A **square** page (the logo artboard) has no orientation: its panel shows no Portrait / Landscape
  choice.
- **Changing size or orientation re-fits the page's content**: everything on the page before the
  change stays on it. Content that still fits the new margin box keeps its size, re-centred (and
  nudged back inside the margins if it pokes out); content that no longer fits is scaled down as
  one, about the page's centre, until it does: text elements' text scales with it (`textScale`)
  and arrows' bends with their lines; a shape's own label keeps its size. Nothing is cut off. The
  pages after it move along. One edit, one undo.
- The page label reads `<name> · <size label> · <Portrait|Landscape> · <Logo|Wireframe|Photo>`
  (`pageLabel`), the name where the page has one. Only A4 adds the orientation (a turned device
  says **Landscape**); a square and Fit to Content have none. The kind ends it where the size label
  does not already name it; a blank page has no kind to name.

## Backgrounds

Logo and wireframe pages are painted the same way (a photo page is never painted), except that a logo
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

When a page's fill changes (any page: blank, logo, wireframe), every colour of its
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
  The memory is not stored in the design: it would go stale the moment an element is recoloured,
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
  Contents thumbnails and the minimap use the same adaptation (`chart-ink.ts`), so a chart exports as
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
- **Where it moves**: on the page on screen, its moving parts over the
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
- Blank and logo pages offer no Animated category.
- **Share roles**: as any background, an Editor's alone.

### Image backgrounds

A wireframe page can be painted with a picture:
`PageFill` `{ kind: 'image', imageId, tone?, overlay?, position?, credit? }`. A logo page offers no
Image category: a logo goes over other things, so its artboard stays a colour or the paper.

- **The Image category**, while the page has no picture: a search field and its results (the image
  picker's Search, [Image search](../009-elements/image-search.md), three tiles across), under
  them **Choose From My Images** (the person's own gallery, three tiles across, in a popover that
  opens beside the panel so the panel stays in view; one press picks and closes it; an offline
  design embeds the picture as the picker's Gallery does) and **Upload an Image** (a file, as
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
  [Offline Mode](../006-design/offline-mode.md) design), with the same stages and failure
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
  the Contents thumbnails and layout previews paint the page in its tone: a picture at their size is a
  smudge, and they draw without the image store.
- **Stored like an image element's picture**, never as a web address: `imageId` is a gallery id
  (1 to 128 letters, digits, `-` or `_`) or an Offline Mode design's base64 PNG, JPEG, GIF or WebP
  data URI. A fill with anything else, or an overlay or position it does not know, is dropped on
  read (the overlay's strength is clamped to 0 to 0.9). A page background counts as a reference in
  the image reference index ([Images](../009-elements/images.md) "Reference index"), so retention
  keeps its bytes and a share visitor can load it; Take Offline embeds it and Sync Design uploads
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
  panel's Background tab), **Apply to All Logo Pages** (**Wireframe Pages**, **Photo Pages** or
  **Blank Pages** on the others, `kindPages`) gives
  every other page of the same kind this page's background, under a line saying how many it reaches
  and that a locked one keeps its own. Shown only while there is another page of the kind. One edit, one undo, each page re-inked for
  its new fill ("Re-inking"). A notice says what it did: "Background applied to 35 wireframe pages.", adding
  "2 locked wireframe pages kept their own." when it skipped any. A locked page is skipped, never refused
  whole; a logo page's pattern is never touched.
- **The Format tool paints pages**: with the [Format
  tool](../008-canvas/canvas-and-palette.md#format-painter), a press on a page's paper (anywhere on
  the page but on an element) arms that page's background as the brush, and each press on another
  page paints it there, one edit each, re-inked. The banner reads "Select a base element or page to
  copy its style", then "Tap pages to paint this background onto them". **Keep the brush** and
  **Paint once** work as for elements; the Format Panel's groups (Fill, Border, Text, Effects, Size)
  are an element's and do not narrow a page's paint. A press on the source page, an element pressed
  under a page brush, or a page pressed under an element's brush is a no-op that keeps the brush
  (as a shape's look onto an arrow is). Painting crosses kinds (a wireframe page's background onto a
  blank page), except a picture onto a logo page ("A logo page takes no picture background.");
  a locked target says so ("That page is locked. Unlock it to change its background.") and is left
  as it is. A refused paint keeps a Paint once brush (only a paint empties it), and a brush whose
  page has gone (deleted, undone) empties as the page goes (`useDeadPageBrush`), so the next press, on a page or an element, works at once. A press off every
  page still ends the tool.
- **Agents** give every page of a kind one background with `change_pages`'s
  `apply_background_to_all` ([Pages for agents](../024-agents/pages-for-agents.md)).
- **Share roles**: as any background, an Editor's alone. A Participant's or a Viewer's press on a
  page with the Format tool is an empty-canvas press, and they see no Apply to All.
- The pure edits are `pageBackgroundSpread` and `pageBackgroundCopied`
  (`packages/design/src/pages-background-copy.ts`), shared by the panel, the Format tool and
  the agents.

### Beside the cog

**Named while there is room.** On a desktop the title bar's buttons (Layout, Background,
the lock, a logo page's Mirror and Guides; Tidy is always its icon alone) name themselves beside their icons only while
the page is wide enough on screen to hold them named and still leave the label its least room
(40 px); zoomed out further, they all drop to their icons (with their tooltips), as on a phone.

A wireframe page's title bar holds a **Background** button before its lock and cog,
the cog's size with a tooltip, for someone who may edit (an Editor; a Participant or Viewer sees
no title-bar controls), as a logo page holds its Guides ([Logo pages](logo-pages.md) "Beside the
cog"). It opens a popover anchored to it holding the **Background** and **Pattern** sections (its
panel has no Background tab: this is its one place), with the same hover previews; a press commits, one edit, and the
popover stays open for another pick. Leaving the popover, or closing it (an outside press, Escape,
the button again), drops any preview. It is tinted while its popover is open. On a desktop it
names itself beside its icon (**Background**); a phone shows the icon alone. A locked page shows
no Background button (its panel says it is locked). The page label truncates before it. Logo
pages keep their background in the panel only. Opening it is tracked as
`UI / Opened / PageBackgroundButton`.

### Tidy

A wireframe page's title bar holds a **Tidy** button, its icon alone (never named,
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
- **Where it shows**: wireframe pages only (a logo page has its own Tidy for
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

- **Which layouts a page offers** depends on its kind (`layoutCatalogueFor`,
  `packages/templates/src/layout-catalogue.ts`): a logo page the logo layouts
  ([Logo pages](logo-pages.md) "Logo layouts"), a wireframe page its device class's
  ([Wireframe pages](wireframe-pages.md) "Wireframe layouts"), each by its own categories. A photo
  page and a blank page have none, so they show no Layout button and no layout card.
- Each layout is a complete, editable starting point in the tab's theme: a layout is built without
  colours where it means the theme's, and placing it (in the editor or by an agent) fills each of those from the
  tab's built-in theme (`themedForTab`), keeping the colours it sets itself; on a dark page (a dark fill), from the
  theme's dark half, so its words are light there. Every picker browses them in the **layout gallery**
  (below).
- **Body type** is the page-sized medium and large text sizes, never the small one. Headlines
  are large text scaled to their box (`textScale`), so they read the same on the canvas and in
  every export.
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
    the page's shape until then), so a long catalogue opens without drawing it all.
  - **Surprise Me** places a random layout from those shown (never the one it last landed on while
    there is another), and its dice tumble. In the Layout popover it keeps the popover open, so
    pressing it again rolls again with the page changing behind it; elsewhere it places and
    closes as a press does. Tracked as `Tab / Changed / PageLayoutSurprise`.
  - A picture a layout leaves for the author shows in its tile as a **sample picture** (a soft
    drawn landscape, the palettes taken in turn), so a picture-led layout reads as one; what lands
    is the ordinary picture placeholder.
- **The Layout button**: a wireframe page's title bar always holds a **Layout**
  button (an icon and its name on a desktop, the icon alone on a phone, tooltip **Layout**) before
  its Background button, for an Editor, on any page that is not locked, empty or not. It opens the
  page's layout gallery (a wireframe page's the wireframe layouts) in a popover anchored to it (580 px,
  headed **Layouts**, the search taking the keyboard); on a phone it opens as a bottom sheet.
  Hovering a tile previews it on the page; pressing one places it (over anything there, at once)
  and closes the popover; closing it takes any preview away. Opening it is tracked as
  `UI / Opened / PageLayoutsButton`. A wireframe page's panel holds no Layouts tab: the button is its
  one way in, besides an empty page's own card. A **logo** page keeps its Layouts tab, and its
  empty artboard still invites them: a "Start From a Layout" button beside the cog, only while the
  page is empty, opening the panel on Layouts, with its words while the title bar has room for
  them beside its other buttons and the label, else just its icon, else hidden.
- **An empty page offers its layouts**: while a logo page is empty (never a
  wireframe page, whose screen stays clear), on a tab
  the viewer can edit, a **Start From a Layout** card sits centred on the page, held at its screen
  size whatever the zoom, as large as the page on screen leaves room for inside a 16 px margin (at
  most 900 by 660 px): a header (a sparkles badge where the card is 520 px or wider, **Start From a
  Layout**, "n logo layouts in your theme. Pick one, then make it yours." naming the page's kind,
  and Hide; no Change Theme, the card keeps to its layouts) over the layout gallery. Pressing a layout places it (the page is empty,
  so at once, as one undo step); there is no hover preview here, since drawn over the page it
  would cover the card's own tiles. The card goes as
  soon as anything lands on the page, and **Hide** (in its corner) puts it away for that page until
  the tab is next opened; the title bar's Layout button still opens the layouts. It
  never shows while the first page offers its kind, while the page's panel is open, while a palette tile is armed
  (tap to drop or drag to draw: the page is where the element will land, so the card steps aside and comes back when
  the tool is put down with the page still empty), in zen, or when the page is too small on
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
finding your way round a long design is everyone's. It has two homes on a desktop, and the person
chooses between them. Each row's picture is the page as the canvas shows it: a page with no fill on
the canvas's own paper (white, or slate `#0f172a` in dark mode, as the Map draws it) in the
canvas's ink.

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
[User preferences](user-preferences.md)), so it follows them across devices and designs; Settings
› Editor › Pages › **Contents** (Sidebar or Button) sets it too. The sidebar docks only while
the tab has more than one page: a single page has nothing to find your way round, so it keeps the
button (and its popover offers no Dock as Sidebar). A phone never has the sidebar, whatever the
choice: there Contents is always the button, opening a bottom sheet. Zen mode hides
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
  Map and the export, 16:9, A4 or square as the page is), and its name (its own, else "Page
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
  and cannot drag. The drag is `useRowReorderDrag`.
- **For a screen reader** the rows are a list named Pages. Each row opens through one button stretched across it,
  named by the page and `aria-current="page"` on the one here; its toolbar (or ⋯ menu) and grip sit above that
  button as controls of their own. Rows that were listbox options held those buttons, controls nested in a
  control. Up, Down, Home and End move between the rows' buttons.
- **Adding**: an Editor's footer is the canvas's + after the last page ("Adding a
  page"): a wide **Add Page** button, with the add icon, that adds another page like the last (its
  tooltip names what it adds, **Add Another Logo Page**, **Add Another iPad Screen**: its kind and
  shape, a wireframe page's device and frame too), always of the tab's kind ("One kind a tab"); on a
  wireframe tab, beside it, a square button, **Add a Screen of Another Device**, opening Choose a
  Device beside it. A new page lands after the last (carrying the background), glides into view and the list scrolls to its new row, marked as here. At the page
  limit the buttons are disabled with the limit in
  their tooltips. A tab with no kind yet (a blank first page) has no footer. A Participant and a Viewer see the list without the footer.
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

Any page, of every kind (logo, wireframe, photo, a blank page), can be **locked**, so it stays as it
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
  the tab fits the page you were on: the page itself fills the view (below the Toolbar strip and above the
  bottom-right controls, 12 px clear of them, so a wide page never runs under them), whatever its shape, not a square
  around it.
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
  there (an ease-out over `VIEW_GLIDE_MS`, 280ms, `../packages/workbench/src/lib/viewport-glide.ts`) so the eye follows the
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
    or a quicker flick of at least 24 px, turns to that neighbour, as swiping through photos does, so
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
  per design and tab (the latest 200 tabs), never in the design: a collaborator lands on their
  own page. The first time, or once that page is deleted, landing fits the first page. For everyone
  who can see the pages, whatever their role.
- **A page is something in view**: the canvas's "Nothing's in view" nudge counts every page, an
  empty one too, as content, so it never shows while a page is on screen.

## Export

The Export dialog exports **pages**, not the tab's content bounds.

- **Formats**: **PDF**, **PNG** and **SVG**, plus **JSON** (the tab itself, a backup that imports back),
  the **Logo Kit** while the tab has a logo page ([Logo pages](logo-pages.md) "Export") and **Photo**
  (PNG, JPEG, WebP or PSD, or each layer as a file) while it has a photo page
  ([Photo pages](../031-photo/photo-pages.md)). There is no GIF or Markdown export.
- **Pages**: every format asks **All pages** or **One page** (a segmented control), and with One
  page, which page (each by its label). PDF starts on All pages; PNG and SVG start on One page,
  the first.
  - **PDF, all pages**: one PDF, every page in order, one PDF page each.
  - **PDF, one page**: a one-page PDF of the chosen page.
  - **PNG / SVG, one page**: that page's image.
  - **PNG / SVG, all pages**: a **.zip** holding one image per page, in order, each named
    `NN <page label>.png` (two-digit place, then the label).
- The download is named `<design> - <tab>` (`.pdf`, `.zip`), or with ` - <page label>` for one
  page.
- The preview shows the chosen page, or with All pages a page picked to preview.
- Each page exports **exactly its sheet**: its size, its background (a picture embedded under its overlay) and pattern, and the elements on
  it clipped to its edges, as the canvas shows them. The surround is not exported. The plain paper
  exports white (a logo page's is transparent in PNG and SVG, [Logo pages](logo-pages.md) "Export",
  which also adds the Logo Kit format); elements are inked for the page's own surface. An element (an arrow by its
  resolved ends) that reaches onto the page is drawn; the rest are left out of the file.
- A PDF page is the page's size in print points (CSS px x 0.75: A4 is 595.5 x 842.25 pt).
- The Background pattern option is not offered: a page is its own background.
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
`LogoPageAdded`, `WireframePageAdded` and `PhotoPageAdded` (each kind's add), `PageKindLogo` /
`PageKindWireframe` / `PageKindPhoto` (the first page's own choice);
`Design · Exported · PagesPNG / PagesSVG / PagesPDF` (one page) and
`PagesPNGPages / PagesSVGPages / PagesPDFPages` (all pages);
`UI · Used · PageSwipe` (a short pan or a flick
turning to the neighbouring page, never the snap itself); `Tab · Aligned · PageTidyUp` (a wireframe
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
- **The page made around content** is a blank page, landscape when the content is more than
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

## Zen

Zen shows the sheets alone: no labels, cogs, layout invites or add button.

livedesign has no slides: a tab's pages are not a deck and are not presented (removed 25 October 2026,
[Presentation mode](../012-collaboration/presentation-mode.md)).

## Chrome

- **Photo button**: while a photo page is in focus, a **Photo** button joins the same frame right after Contents and
  opens the Photo panel as a popover above it ([Photo pages](../031-photo/photo-pages.md) "The Photo panel").
- **No Layers**: the Layers button and panel are not offered (a page is arranged by its pages, not
  layers); a tab's stored layers are left untouched.

## Non-goals

- Per-page themes or fonts: the tab's theme and font apply to every page.
- Master pages or shared headers and footers.
