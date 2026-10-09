# Illustrate pages

Illustrate mode ([Editor modes](editor-modes.md)) lays a tab out as **pages**: sheets on the
canvas, each built up into one finished visual. This spec is what a page **is** and everything a
page offers: its size, its background, a ready-made layout to start from, the page's own actions,
snapping to it, and exporting it. The basics (pages in a row, the add button, content moving with
its page, clipping, centring) are in [Editor modes](editor-modes.md) "The pages".

## Domain language

| Term                | Means                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **page**            | One sheet of a tab in Illustrate mode (`IllustratePage`), stored in `Tab.pages` in row order.             |
| **page kind**       | What a page is for, fixed when it is made: an **infographic**, an **article** or a **slide** page.        |
| **page size**       | The sheet's format (`PageSizeId`): its short and long side in canvas px.                                  |
| **orientation**     | Portrait (the long side upright) or landscape. A square page, and a slide size, has none.                 |
| **page background** | What the sheet is painted with (`PageBackground`): a solid colour or a two-stop gradient, plus a pattern. |
| **page layout**     | A ready-made arrangement of elements put onto one page (`PageLayoutId`), to start from and then edit.     |
| **page panel**      | The page's settings, opened from the cog above its top-right corner.                                      |

## Page kinds

A page is one of three kinds (`IllustratePage.kind`), chosen when it is made and never changed
afterwards (the one exception: the first page's own choice, below):

- **Infographic** (`kind: 'infographic'`, or absent: unchosen, and every page from before kinds):
  a sheet to lay out elements on, freely, starting from a layout. Everything in this spec applies to it.
- **Article** (`kind: 'article'`): a page to write on, its text flowing through the linked pages
  of one article ([Article pages](article-pages.md)). This spec applies to it except where a
  rule names infographic pages; [Article pages](article-pages.md) adds the rest.
- **Slide** (`kind: 'slide'`): one slide of a deck, to lay out like an infographic page and
  present. Always landscape, in a slide size (16:9, or the classic 4:3); it offers no orientation
  and no other size. It starts from the **slide layouts** rather than the infographic ones.
  Everything in this spec for infographic pages applies to it except where a rule says otherwise.

**Adding a page**: the **+** after the last page (centred in the gap after it, or, zoomed out so
far that the gap is narrower than the button, kept 12 screen px clear of the page) opens a small
popover, **Add a page**, offering
three cards, side by side, each a miniature of the kind and a line under its name:

- **Infographic**: "A page to lay out: layouts, icons, charts and media."
- **Article**: "A page to write on, flowing onto new pages as it grows."
- **Slide**: "A slide for a deck: widescreen, ready to present."

Arrow keys move between them, Enter or a press chooses, Escape or an outside press closes. A new
infographic page takes the last infographic page's size and orientation (else A4 portrait); a new
article is as [Article pages](article-pages.md) "An article" says; a new slide takes the last
slide's size (else 16:9), landscape. The popover is the same on
a phone (a bottom sheet). The **+** is named **Add page** and shows the popover open as pressed. The Toolbar
strip ends, after a divider, with the same **+** (Add page), opening the same
popover, while in Illustrate mode; not on a phone, where the strip has no room to spare and the
row's own **+** adds a page.

A tab entering Illustrate mode with no pages stored starts with one page, its kind unchosen.

**The first page's choice**: while a tab's only page is unchosen and empty, it offers the two kinds
inside itself, for someone who may edit: a card centred on the page, held at one screen size,
**What Is This Page For?** ("Choose now: a page keeps its kind once you start."), over the same three
cards as the popover. **Infographic** keeps the page, now chosen (`kind: 'infographic'`), and the
choice goes; **Article** makes it the first page of a new article, the caret in its title;
**Slide** turns it into a 16:9 landscape slide (`kind: 'slide'`), its slide layouts inviting. One
edit each. Anything put on the page first (a layout, an element) is choosing Infographic by doing: the
offer goes while the page has content, and comes back if it is emptied while still unchosen. The
empty page's layout invitation waits until the choice is made. Not offered in zen or isometric
view, nor on a second page (a page added from the + is chosen in the popover).
The **Article** template in /new starts a tab that opens in Illustrate mode with one article.

## The page panel

- Opens beside the page, to the right of its cog, so the sheet stays in view; where the window has
  no room there, it opens under the cog. Screen-space, one size at any zoom; it scrolls when taller
  than the window.
- Top to bottom: the **name** field (placeholder `Page n`, or `Untitled page` while there is one
  page; renamed on Enter, on leaving the field, or on closing the panel), then two tabs, **Page**
  and **Layouts** (a slide page's Layouts are the slide layouts; an article page: **Page** and
  **Style**, [Article pages](article-pages.md) "Article style"), then the action row (Duplicate, Move left, Move right, Delete) as icon buttons
  with tooltips. **Page** holds the **Size** tiles (each drawn to scale), **Orientation**
  (Portrait / Landscape, absent for a page with no orientation), the **Background** swatches and
  the **Pattern** tiles; **Layouts** holds the layouts by category. The cog opens it on Page; the
  layout invite opens it on Layouts. The two tabs, and Portrait / Landscape, are the shared
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

`IllustratePage = { id, orientation, size?, background?, name?, kind?, flow? }`. Every field after
`orientation` is optional and absent on a page that never set it:

- `size` absent is **A4**.
- `background` absent is the **paper**: white in light chrome, slate-900 in dark, as before.
- `name` absent shows the page's place ("Page 2"); a name replaces it in the label.
- `kind` absent is **infographic**; `flow` is present exactly on an article page (its article's
  id). A stored article page without a flow is read as an article of its own (its id as the
  flow); a stored infographic or slide page with a flow drops it.
- A **slide** page is always in a slide size and landscape: a stored slide page in any other size
  is read as 16:9, and its orientation as landscape.
- **An article's pages sit together.** Read pages are put in order so that the pages of one flow
  form one run, in their stored order, where the flow's first page stands (pages of a flow found
  after another page joined the run as two collaborators' edits crossed). Every page of a flow
  takes the size, orientation and background of its first.

A stored page that is malformed in any optional field keeps its valid fields and drops the rest; a
page with no valid `id` or `orientation` is skipped (as today), as is a repeat of an id already read.
A new page's id is random (`page-` and eight hex digits) and never one the tab's pages have had, so
a page slide of a deleted page stays empty rather than finding a new page under the old id.

## Sizes

| Size id         | Label (portrait / landscape) | Short x long side (px) | For                      |
| --------------- | ---------------------------- | ---------------------- | ------------------------ |
| `a4`            | A4                           | 794 x 1123             | Print, the default       |
| `letter`        | US Letter                    | 816 x 1056             | Print in North America   |
| `a3`            | A3                           | 1123 x 1587            | Posters                  |
| `square`        | Square                       | 1080 x 1080            | Social posts             |
| `social`        | Portrait post (4:5)          | 1080 x 1350            | Instagram and LinkedIn   |
| `wide`          | Story (9:16) / Slide (16:9)  | 1080 x 1920            | Stories, and slides wide |
| `slide`         | Slide (16:9)                 | 1080 x 1920            | Slides, landscape only   |
| `slide-classic` | Classic slide (4:3)          | 1080 x 1440            | Slides for 4:3 screens   |

- **Which sizes a page offers** depends on its kind. An **infographic** page: A4, US Letter, A3,
  Square, Post, Story and **Slide** (16:9). An **article** page: the first six. A **slide** page:
  **Slide** (16:9) and **Classic** (4:3) only.
- The **slide sizes** (`slide`, `slide-classic`) are **landscape only**: like a square they show no
  Portrait / Landscape choice, a page in one is always drawn landscape, and a turn is refused. An
  infographic page keeps whatever orientation it had, so turning it back to a paper size restores
  it; a slide page's is always landscape.
- The size tiles sit four to a row.

- Paper sizes are at the CSS 96 px per inch; screen sizes are their own pixels.
- A **square** page has no orientation: its panel shows no Portrait / Landscape choice, and it keeps
  whatever orientation it had, so turning it back to another size restores it.
- **Changing size or orientation re-fits the page's content**: everything on the page before the
  change stays on it. Content that still fits the new margin box keeps its size, re-centred (and
  nudged back inside the margins if it pokes out); content that no longer fits is scaled down as
  one, about the page's centre, until it does: text elements' text scales with it (`textScale`)
  and arrows' bends with their lines; a shape's own label keeps its size. Nothing is cut off. The
  pages after it move along. One edit, one undo.
- The page label reads `<name or Page n> · <size label> · <Portrait|Landscape> · <Infographic|Article|Slide>`.
  Only the paper sizes (A4, US Letter, A3) add the orientation: a square has none, and the post,
  story and slide labels already say which way they face. The kind always ends it. No `Page n`
  while there is one page and no name.

## Backgrounds

- **Solid**: one colour. The panel offers twelve presets, from light to dark: **Paper** (the
  default, no `background` stored), **Cream** `#fbf7ef`, **Mist** `#f1f5f9`, **Sky** `#e0f2fe`,
  **Mint** `#dcfce7`, **Lavender** `#ede9fe`, **Blush** `#fce7f3`, **Sunshine** `#fef9c3`,
  **Ink** `#1e293b`, **Midnight** `#0f172a`, **Forest** `#14532d`, **Plum** `#3b0764`, and a
  **custom** colour (the system colour picker: previewed while dragged, one edit when it
  settles).
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
- Re-inking against the plain **paper** measures it as white, the paper as printed and exported.
- The page background is a page's, never the tab's: the surround (the tab's own canvas) is
  untouched.

## Layouts

A **layout** is placed onto one page from its panel's **Layouts** tab, by category.

- **Thirty-one layouts**, each a complete, editable starting point in the tab's theme. Most open with
  a title and a lead line. A **tall** page (not wider than 1.15 times its height) stacks; a
  **wide** one sets things side by side:
  1. **Title page**: an eyebrow line, a large title over a short accent rule, a subtitle, an image
     placeholder (below on a tall page, to the right on a wide one) and a footer line.
  2. **Big number**: one huge figure, its caption, a paragraph, a progress bar and a source line.
  3. **Key stats**: two stat rows of three figures, a trend line where the page has room, and a
     Takeaway callout.
  4. **Process**: four steps. Tall: numbered discs down the page joined by arrows, a name and note
     beside each. Wide: a process strip, a note under each step and a "Why it works" callout.
  5. **Timeline**: five dated milestones. Tall: year discs down the page joined by arrows. Wide: a
     timeline rail with a name and note under each point, and a stat row.
  6. **Comparison**: two columns (Before / After), each a heading over three points with icons,
     and a "The verdict" callout.
  7. **Chart story**: a captioned bar chart, a progress ring, three takeaways with icons and a
     source line.
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
  14. **Section divider**: a big section number, an accent rule, a title and a line, centred
      down the page.
  15. **Poster**: a large image (top, or the left on a wide page), a bold headline, a line and a
      footer.
  16. **Survey results**: a pie chart of the answers with its legend, three headline figures (a
      stat row, or stacked beside the chart on a wide page) and a source line.
  17. **Progress report**: four goals, each a name, its percentage and a progress bar, and an
      "Updated" line.
  18. **Roadmap**: Now, Next and Later columns, three item cards each.
  19. **Agenda**: six timed items, each a title and a note (two columns of three on a page not
      clearly taller than wide).
  20. **Questions and answers**: four questions in bold, each with its answer.
  21. **Profile**: a round photo, a name, a role, a short bio and a stat row of three facts.
  22. **Pros and cons**: a heading, then Pros (ticks, green) and Cons (crosses, rose) side by side,
      four each, and a "Weighing it up" callout.
  23. **Before and after**: Before and After panels, each an image placeholder over three points,
      an arrow between them (down the page when tall), and the change in one figure.
  24. **Feature matrix**: three options across, five features down, a tick or a dash in each cell,
      the recommended option's column highlighted.
  25. **Announcement**: a "New" badge, a large headline, a line, an image placeholder and a call to
      action button.
  26. **Did you know?**: an icon in a large disc, "Did you know?", one surprising fact set large,
      and a source line.
  27. **Save the date**: "Save the date", the date in a calendar tile, the event's name, where, and
      a "More soon" line.
  28. **Pictogram**: a figure set large ("7 in 10") over a grid of ten person icons, seven filled,
      and a caption.
  29. **Ranking**: five ranked rows, each a number disc, a name and a bar sized to its value.
  30. **Cycle**: four stages round a loop, each a disc with an icon, a name and a note, joined by
      arrows that close the loop.
  31. **Funnel**: four stages narrowing down the page, each a band with its name and count, and the
      conversion between them.
- **Categories**: the picker groups the layouts as /new groups templates, one category at a time:
  **Covers** (Title page, Quote, Event, Section divider, Poster), **Data** (Big number, Key stats,
  Chart story, Facts grid, Survey results, Progress report, Pictogram, Ranking), **Steps and
  Time** (Process, Timeline, Checklist, Roadmap, Agenda, Cycle, Funnel), **Compare** (Comparison,
  Pros and cons, Before and after, Feature matrix), **People and Ideas** (Top tips, Team,
  Questions and answers, Profile) and **Social** (Announcement, Did you know?, Save the date). The Layouts tab opens on the categories, each a card fronted
  by its first two layouts fanned, with its count; a card opens its layouts, with an **All
  layouts / <category>** row to go back.
- **Body type** is the page-sized medium and large text sizes, never the small one. Headlines
  are large text scaled to their box (`textScale`), so they read the same on the canvas and in
  every export.
- **Numbers cite a source**: Big number and Chart story end in a source line at the page's
  foot; Chart story's chart carries a caption naming what it shows.
- **Nothing floats in empty space**: Quote centres its block down the page; Comparison's rows
  share their column down to the verdict.
- **Fitted to the page**: a layout is laid out in proportions of the page's content box (the page
  less margins of 7% of its short side), so it fits any size and orientation.
- **Onto an empty page** a layout is placed straight away. **Onto a page with content** the picker
  asks first, inline: **Replace this page's content?** with **Replace** and **Cancel**. Replace
  removes every element whose centre is on the page (and arrows pinned to one, and in turn arrows
  riding a removed arrow), then places the
  layout. Either way it is one change: one undo step.
- Placed elements are ordinary elements. The selection is cleared (nothing replaced stays
  selected) and the panel closes, so the finished page reads clean.
- **An empty page invites a layout**: a "Start from a layout" button sits in the page's title bar
  beside the cog, only while the page is empty, and opens the panel on Layouts (the cog opens it on
  Page). It shows its words on a wide screen when the title bar has room, else just its icon (and
  its tooltip); when the page is too small on screen even for that, it hides, as the label does.
- **An empty infographic page shows its layouts inside itself**: while an infographic page is
  empty, on a tab the viewer can edit, a **Start From a Layout** card sits centred on the page,
  held at one screen size like the first page's kind choice, with the panel's Layouts in it: the
  categories (Covers, Data, Steps and Time, People and Ideas, each with its count), then a
  category's layouts with a way back. Pressing a layout places it (the page is empty, so at once,
  as one undo step); there is no hover preview here, since drawn over the page it would cover the
  card's own tiles. The card goes as
  soon as anything lands on the page, and **Hide** (in its corner) puts it away for that page until
  the tab is next opened; the title bar's "Start from a layout" button still opens the panel. It
  never shows while the first page offers its kind, while the page's panel is open, when presenting
  or in zen, or when the page is too small on screen to hold it.
- **Hover previews the layout on the page**: while a tile is hovered (or focused) the page shows
  that layout as it would land, drawn over the whole sheet in the page's background, and the
  page's own content is hidden meanwhile (left out of the page clip), so the two never mix. It is
  a picture only: nothing is placed and nothing enters the history; leaving the tiles (or closing
  the panel) takes it away. While Replace is being asked, that layout stays
  previewed.
- **Tiles are the real layout**: each tile draws the layout as built for this page's size and
  orientation, as a wireframe (text as bars, images shaded, icons as dots).

## Slide layouts

A **slide** page's Layouts tab, and its in-page **Start From a Layout** card, offer the **slide
layouts** in place of the infographic ones, in the same browser (categories first, then a
category's layouts, the same Replace question, hover previews and wireframe tiles). They are
built for a landscape slide's content box (16:9 or 4:3), in the tab's theme, with type sized to
be read across a room:

- **Openers**: **Title slide** (a large title, a subtitle, an accent rule, and the presenter and
  date at the foot), **Section header** (a big section number, an accent rule, the section's title
  and a line), and **Agenda** (the infographic Agenda).
- **Content**: **Title and bullets** (a title over five bullet points, each a dot beside a line),
  **Two columns** (a title over two columns, each a heading and three bullet points), **Image and
  text** (an image filling the left half, a title, a line and three bullet points to its right),
  **Statement** (an accent rule, one sentence set very large, centred, and a line under it) and **Quote** (the
  infographic Quote).
- **Data**: **Big number**, **Key stats**, **Chart story** and **Comparison** (the infographic
  ones, side by side).
- **Steps and Time**: **Process**, **Timeline** and **Roadmap** (the infographic ones).
- **Closers**: **Thank you** (a large "Thank you", "Questions?", and a contact line) and **Team**
  (the infographic Team).

Seventeen in all; a slide layout reused from the infographics is the same layout (same id, same
build), filed under the slide category.

## Page actions

From the page panel's footer. On an **article page** each action acts on its **whole article**
(every page of its flow, its writing, and the elements on its pages), and reads so: **Duplicate
article**, **Move article left / right**, **Delete article**.

- **Duplicate**: a copy of the page (size, orientation, background, a name with "copy") right
  after it, with a copy of every element on it (new ids; arrows pinned between copied elements stay
  pinned between the copies). Pages after it move along, their content with them. An article's
  copy is a new flow with a copy of its writing (new block ids) right after the article.
- **Move left** / **Move right**: swaps the page with its neighbour (a whole article counts as one
  neighbour); both sides' content moves with them. Disabled at the row's ends.
- **Delete page**: removes the page **and everything on it** (arrows pinned to it too); the pages
  after it close the gap. Offered while there is more than one page.
- **Rename**: the panel's name field; empty clears the name.
- Each is one tab edit (one undo step, synced to everyone). At the page limit (**100** pages,
  `MAX_ILLUSTRATE_PAGES`) Duplicate is disabled (also when an article's copy would pass it), like
  Add page is absent; Move left / right are disabled at the row's ends.
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
  the dragged sheet dims; release moves it there with its content, one edit. Escape cancels. An
  article page's label drags its whole article, every sheet dimming; no slot falls inside an
  article.
- **The label fits its page**: it truncates to the page's width on screen less the title bar's
  buttons, and hides when under 40 px.
- **Snapping to the pages**: while a move or a resize is in hand in Illustrate mode, an element
  snaps to the edges, the centre lines and the margins (7% of the short side) of every page, with
  the same guides as element-to-element alignment (not to the pages' spacing: equal-spacing snaps
  stay element to element).
- **The page navigator**: under each page, while there are two pages or more, a small bar at one
  screen size: **Previous page**, the page's place ("2 of 5"), **Next page** (disabled at either
  end). An arrow fits that neighbouring page in the view, as a press on its label does, gliding
  there (an ease-out over `VIEW_GLIDE_MS`, 280ms, `apps/live/lib/viewport-glide.ts`) so the eye follows the
  move; a page just added glides into view the same way, and under reduced motion each lands at
  once. A second press mid-glide starts from where the view has got to. For everyone who can see
  the pages; not in zen or isometric view.
- **A page is something in view**: the canvas's "Nothing's in view" nudge counts every page, an
  empty one or an article's, as content, so it never shows while a page is on screen.

## Export

In Illustrate mode the Export dialog exports **pages**, not the tab's content bounds.

- **Formats**: **PDF**, **PNG** and **SVG**, plus **JSON** (the tab itself, a backup that imports
  back). The diagram-tool formats (Mermaid, Markdown, Excalidraw) are not offered: a page is not
  a diagram.
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
- Each page exports **exactly its sheet**: its size, its background and pattern, and the elements on
  it clipped to its edges, as the canvas shows them. The surround is not exported. The plain paper
  exports white; elements are inked for the page's own surface. An element (an arrow by its
  resolved ends) that reaches onto the page is drawn; the rest are left out of the file.
- A PDF page is the page's size in print points (CSS px x 0.75: A4 is 595.5 x 842.25 pt).
- The Isometric and Background pattern options are not offered: a page is its own background and
  is never tilted.
- Outside Illustrate mode, export is unchanged.

## Import

In Illustrate mode the Import dialog offers **JSON** only (a livediagram tab, which may carry
pages). Mermaid, Markdown, Excalidraw and draw.io are diagram formats and are not offered.

## Telemetry

`Tab · Changed ·` `PageAdded`, `PageRemoved`, `PagePortrait`, `PageLandscape`, `PageSize`,
`PageBackground`, `PagePattern`, `PageRenamed`, `PageDuplicated`, `PageMoved`, `PageLayout`,
`PagesLaidOut`, `SlidePageAdded`, `PageKindInfographic` / `PageKindArticle` / `PageKindSlide`
(the first page's own choice);
`Document · Exported · IllustratePNG / IllustrateSVG / IllustratePDF` (one page) and
`IllustratePNGPages / IllustrateSVGPages / IllustratePDFPages` (all pages);
`UI · Added · PageSlide`; `UI · Opened · SlideDeck`. Never a colour, name or layout content.

## Into pages

- When a tab enters Illustrate mode (a switch, or opening in it), an editor's client lays its
  loose content out into pages (a viewer or a locked tab is left alone):
  - **No pages stored**, and content that does **not fit inside the first page**: the whole tab is
    laid out afresh.
  - **Pages stored**: each cluster (below) less than half on the pages, by area, is **stray**.
    Stray clusters go onto new pages after the last; or, when nothing else is on a page and no
    page is an article page (its writing keeps it in use), the tab is laid out afresh (the stored
    pages replaced). A cluster mostly on a page that bleeds off
    its edge is left as it is.
  - So content left in the surround is gathered onto pages the next time the tab enters the mode.
  - The content splits into **clusters**: elements joined by a pinned arrow, and elements within
    120 px of each other (edge to edge), belong together.
  - Clusters go in **reading order**: rows top to bottom (a cluster joins a row while its top is
    above the row's first cluster's bottom), each row left to right.
  - Each cluster gets an **A4 page**, landscape when it is more than 1.1 times wider than tall,
    portrait otherwise; its content is centred on the page and, where it does not fit the margin
    box, scaled down as one (text elements' text and arrows' bends with it).
  - At most 20 pages (`PAGINATE_MAX_PAGES`), all infographic pages: clusters past the twentieth share the last page.
- It is **one edit**: one undo puts the tab back. A toast says so: "Laid out into n pages. Undo
  puts it back." (or "Laid out onto a page." for one). Telemetry: `Tab · Changed · PagesLaidOut`.
- The modes share their elements, so the Diagram view shows the new arrangement too.

## Slides

- In Illustrate mode the Slide Deck panel adds slides **a page at a time**: a page picker (each
  page by its label) and **Add as slide**, in place of "Select elements to make a slide".
- A **page slide** (`Slide.pageId`, docs/specs/012-collaboration/presentation-mode.md) is the page,
  resolved live: it shows whatever is on the page now and is framed to exactly the page, so it
  follows the page's edits, reorders and size changes. Its row reads `<tab> · <page label>`; its
  thumbnail is the page on its background. A page deleted leaves its slide empty (shown, fixable),
  as an element slide's deleted elements do.
- **A slide page's deck button**: beside its cog (left of it), for an editor on a desktop, a slide
  page shows its place in the deck. While the deck has no slide of the page (on this tab) it is
  **Add to slide deck** (the Slide Deck icon), which adds the page slide at the deck's end, as Add
  as slide does. Once the deck has one it is an eye that toggles that slide's visibility in the
  presentation: **Hide from the presentation** (an open eye, pressed) or **Show in the
  presentation** (a crossed eye, dimmed), the same as the slide's Visibility in the Slide Deck.
  Telemetry as the Slide Deck's own (`UI · Added · PageSlide`, `UI · Toggled · SlideHidden /
SlideShown`).
- **A page slide presents full screen**: it is fitted with no margin, the page edge to edge on the
  screen's limiting side, and everything round the sheet is black (a letterbox), so a 16:9 slide
  fills a 16:9 screen and any other shape sits between black bars, as a projector shows it.
- Zen, presenting and the isometric view show the sheets alone: no labels, cogs, layout invites or
  add button. While a
  page slide presents, the canvas shows that page's sheet alone (its neighbours are not drawn), as
  it shows only a slide's elements.

## Chrome in Illustrate mode

- **Slides button**: in the bottom-right cluster, where Layers sits in the other modes (left of
  the brush), a **Slides** button opens the Slide Deck panel as a popover hanging above it (an
  outside press closes it; the button shows pressed while open). An infographic is likely to be
  presented, so its deck is one press away. Desktop only, as the Slide Deck itself is.
  Telemetry: `UI · Opened · SlideDeck`.
- **No Layers**: the Layers button and panel are not offered (a page is arranged by its pages, not
  layers); the tab's layers are untouched and come back in the other modes.

## Non-goals

- Image backgrounds (an image element sent to the back does the job).
- Per-page themes or fonts: the tab's theme and font apply to every page.
- Master pages or shared headers and footers.
