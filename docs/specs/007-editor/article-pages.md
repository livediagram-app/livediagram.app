# Article pages

An **article page** is the second kind of page in Illustrate mode ([Illustrate pages](illustrate-pages.md)
"Page kinds"): a page to **write** on, like a page of a Google Doc or a Word document. Most of it
is text, typed straight onto the page with no text boxes to place or size; pictures, charts,
tables and drawings go into the writing from the palette or the toolbar and sit in it inline or
with the text wrapping round them. Writing that runs past the foot of a page flows onto the next
page of the same article, which is added for it.

It supersedes the earlier Document mode experiment (a fourth editor mode that made each paragraph
a text element): the text here is the page's own, one continuous piece of writing, never elements.

## Domain language

| Term              | Means                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **article page**  | A page of kind `article` (`IllustratePage.kind`).                                                                                               |
| **article**       | One or more article pages in a row, linked by one **flow** id (`IllustratePage.flow`), and the writing that flows through them (`ArticleFlow`). |
| **lead page**     | An article's first page in the row. Positions inside the article are measured from its top-left corner.                                         |
| **writing**       | The article's text: its **blocks** in order (`ArticleFlow.blocks`).                                                                             |
| **block**         | One unit of the writing, with an id (`ArticleBlock`): a paragraph, a list item, a code block, a divider, a page break or a zone.                |
| **run**           | A stretch of a block's text with the same formatting (`ArticleRun`).                                                                            |
| **zone**          | A block that holds canvas elements instead of text: an **object zone** hugs one object; a **drawing zone** is an area to draw and connect in.   |
| **wrap**          | How a zone sits in the writing: **In line** (on its own line), **Wrap left** or **Wrap right** (the text runs down beside it).                  |
| **article style** | The article's look (`ArticleFlow.style`): fonts, accent, text size, spacing, heading rules, margins, page numbers.                              |
| **look**          | A named article style to start from (Clean, Classic, Report, Notebook, Bold).                                                                   |
| **page toolbar**  | The formatting bar at the top of the page being written on.                                                                                     |
| **margin note**   | A comment thread or an action on a stretch of the writing: a marker in the page's right margin beside that text, which carries a `note` mark.   |
| **writer**        | The person whose edit changed the writing's layout; only they write the layout's consequences (zone moves, pages added or removed).             |

An **article** is named so to keep **document** for what it already means across the app: the
livediagram file that holds tabs ([Document](../006-document/document.md)). The interface says
**Article** for the kind of page and for the run of pages it writes on ("Duplicate article",
"Article style"); it never calls the writing a document.

## An article

- Pressing **+** and choosing **Article** adds a new article of one page after the last page:
  A4 portrait (or the last page's paper size and orientation when it is A4, US Letter or A3), on
  plain paper, with an empty **Title** and an empty paragraph, the caret in the title, the view
  framing the page.
- `IllustratePage.flow` names the article a page belongs to; every page of one article carries
  the same flow, and the pages of a flow always sit together in the row, in order. The writing is
  stored once, on the tab: `Tab.articles[flow]` (`ArticleFlow = { blocks, style? }`).
- **Shared by its pages**: size, orientation, background and pattern, and the style. Changing any
  of them from any of its pages' panels changes every page of the article, as one edit.
- **Names**: each page keeps its own name as any page does; the panel's name field names the page.
- A page of an article is never turned into an infographic page, nor the other way round (the
  kind is fixed when a page is made).

## Flowing onto pages

- The writing is laid out down the first page's text area (the page less its margins), then the
  next page's, and so on, **at line granularity**: a paragraph that does not fit at the foot of a
  page breaks between two lines and continues at the top of the next. A zone never splits: one
  that does not fit moves to the next page whole. A heading is never left alone at the foot of a
  page: it moves to the next page with the line after it.
- **More pages as needed**: when the writing reaches past the last page of its article, a page
  is added after it (same size, orientation, background, kind and flow). It is part of the edit
  that made it necessary (one undo step), written by the writer.
- **Fewer pages as it shrinks**: a page at the end of an article that the writing no longer
  reaches, and that has no elements on it, is removed, the same way. An article always keeps at
  least one page.
- **Page break**: a block that ends its page; what follows starts at the top of the next page,
  which is added if needed.
- **Limit**: a tab holds at most **100** pages (`MAX_ILLUSTRATE_PAGES`). At the limit no page is
  added: the writing past the last page's foot is cut off at it, and a notice sits at the foot of
  that page, "This tab has reached 100 pages: the writing below this line is hidden", until
  pages are freed. Nothing is lost: the blocks are kept.
- **Page numbers** sit centred in the bottom margin of each page of an article ("2"), in small
  muted type, whenever the style has them (off by default), one page or many.
  They are a view, never elements; exports draw them.

## Blocks

| Block       | Attributes                                                          | Shows as                                                          |
| ----------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `paragraph` | `style`: body, title, subtitle, h1, h2, h3, quote; `align`          | Text in the style's type; quote with an accent bar, italic        |
| `list`      | `list`: bullet, numbered, todo; `level` 0 to 4; `checked` (todo)    | A marker in a gutter, the text after it; level indents 28 px each |
| `code`      | none (plain text, no runs formatting)                               | Monospaced on a tinted panel, lines kept as typed                 |
| `divider`   | none                                                                | A hairline across the text width                                  |
| `pageBreak` | none                                                                | On screen, a dashed line with "Page break"; ends the page         |
| `zone`      | `zone`: object or drawing; `wrap`; `align`; `width`; `height`; `at` | A box the size of the zone, its elements drawn over it            |

- `align`: left (default), centre, right, justify; on paragraphs and list items.
- **Numbered lists** count each level 1, 2, 3 through a run of list items; a bullet or to-do at a
  level restarts that level's count; any other block ends the run. Level 0 counts 1, 2, 3;
  level 1 a, b, c; level 2 i, ii, iii; then repeat. Bullets by level: •, ◦, ▪.
- A **done to-do** is struck through and muted. Pressing its box toggles it, for anyone who may
  edit (one edit).
- **Empty blocks** show a faint placeholder to someone writing: the title "Title", a heading
  "Heading 1", a list "List", an empty article's first paragraph after the title "Start
  writing, or press / for blocks".

### Text formatting (runs)

Bold, italic, underline, strikethrough, inline code, superscript, subscript, a **link** (an
http, https or mailto address), a **text colour** and a **highlight** (each a hex colour from the
article's swatches), and a line break inside a block (Shift+Enter). Code blocks keep plain text.

## Writing

- **A press on the writing puts the caret there**, at once, in any tool that is not a drawing
  tool; a drag selects text across blocks and pages; double-click selects a word, triple-click a
  block. Text selection spans blocks, lists and pages freely.
- **Typing**, the arrow keys, Home / End, word jumps (Alt / Ctrl+Arrow), Page Up / Down, Shift to
  extend, the browser's spell check, IME composition, dictation and the system emoji picker all
  work as in any editor. The canvas's own shortcuts (tool keys, Delete for elements, arrow nudges,
  Shift+D) are off while the caret is in the writing.
- **Enter** splits the block: after a heading, the new block is a paragraph; in a list item, a
  new item of the same kind and level (unticked); in a quote, a quote; on an empty list item,
  the level steps out, then at level 0 it becomes a paragraph; on an empty quote, a paragraph.
  **Shift+Enter** is a line break in the block.
- **Backspace** at the start of a block: a list item steps out a level, then becomes a paragraph;
  a quote or heading becomes a paragraph; otherwise it joins the block before (a divider or page
  break before it is removed instead; a zone before it is selected, then a second Backspace
  removes it). **Delete** at the end joins the next block in the same way.
- **Tab** / **Shift+Tab** in a list item move it a level in or out; Tab at the start of a
  paragraph makes it a bullet.
- **Markdown as you type**, at the start of a block followed by Space: `#`, `##`, `###` headings;
  `-`, `*` or `+` bullet; `1.` or `1)` numbered; `[]`, `[ ]` or `[x]` to-do; `>` quote. Typed as
  a block's whole text: three backticks a code block; `---`, `***` or `___` a divider, as the third
  character lands. Inline: `**bold**`, `*italic*` or `_italic_`, `~~struck~~`, `` `code` `` as the
  closing mark is typed. Backspace right after a conversion puts the characters back.
- **Keyboard**: ⌘B, ⌘I, ⌘U, ⌘⇧X (strikethrough), ⌘E (inline code), ⌘K (link), ⌘⌥0 (body),
  ⌘⌥1 to ⌘⌥3 (headings), ⌘⇧7 (numbered), ⌘⇧8 (bullets), ⌘⇧9 (to-do), ⌘⇧L / E / R / J (align left,
  centre, right, justify), ⌘\ (clear formatting), ⌘Z / ⌘⇧Z (undo, redo), ⌘A (all the
  article's writing), Escape (leave the writing; the caret goes, nothing is selected).
- **Paste**: from a web page or another editor, its headings, lists, quotes, code, links and
  bold / italic / underline / strike are kept, everything else dropped; Markdown text is read as
  Markdown (headings, lists, to-dos, quotes, code fences, dividers, inline marks, links); other
  plain text pastes as paragraphs, one per line. Pasted images go into object zones. A paste of
  canvas elements (copied from a canvas) lands as a drawing zone holding them.
- **Links**: ⌘K or the toolbar opens a small field under the selection (address, then Enter).
  Hovering a link shows its address with **Open**, **Edit** and **Remove**; ⌘-press opens it in
  a new tab.
- **The slash menu**: `/` at the start of a block or after a space opens a menu of blocks, filtered
  as you type (names, then keywords), Up / Down to move, Enter or Tab to choose, Escape to close;
  it closes when the caret leaves the `/`. Entries: **Text**, **Title**, **Subtitle**, **Heading
  1 to 3**, **Bulleted list**, **Numbered list**, **To-do list**, **Quote**, **Code**,
  **Divider**, **Page break**, **Image**, **Table**, **Bar chart**, **Pie chart**, **Line chart**,
  **Drawing**, **Callout**, **Sticky note**, **Icon**.
- **Commits**: typing is written to the tab when the writing pauses for **600** ms
  (`ARTICLE_IDLE_COMMIT_MS`), when the caret leaves the writing, before any edit that is not typing
  (a toolbar change, an insert, a zone move) and before an undo. Each commit is one undo step and
  one sync, so a collaborator sees words as they settle and a closed tab loses at most the last
  pause.
- **Undo and redo** in the writing are the editor's own (the same history as every edit): ⌘Z
  undoes the last commit, with the caret put back where that edit was.

## The page toolbar

- **Where**: a card fixed at the top of the page, inside it, centred in the top margin. An article
  page's top margin is never less than 72 px (`ARTICLE_TOP_MIN_PX`), whatever its margins, so at
  100% the first line always starts below the card; zoomed out until the margin is thinner than
  the card, the card shrinks to fit it (to 55%) rather than cover the writing; it never leaves the page: a page
  narrower on screen than the card narrows it (its controls scroll), and it goes from view with
  the page's top. Held at one screen size at any zoom. It never takes focus from the writing.
- **When**: for someone who may edit, on the page of the article being worked on, from the moment
  its writing takes the caret until a press lands off that article's pages (a press on its paper,
  on its toolbar, menus or zone bar, its label row and cog, its page panel, or an element on it
  keeps it); else on the article page
  under the pointer (a moment's grace after the pointer leaves, so it can cross to the card). A
  control used while hovering acts on the article's own selection and puts the caret back in it.
- **Look**: the Toolbar layout's card exactly (`toolbar-surface.ts`): the same surface, 36 px
  controls, hairline dividers, and the Style menu's trigger in the brand tint of the palette's
  pickers, so it reads as the same product as the panels around it.
- **Controls**, left to right, each with a tooltip naming it and its shortcut, pressed state shown
  (`aria-pressed`); the formats used all the time are buttons, the rest menus:
  - **Style** (a menu, each entry drawn in its own type: Text, Title, Subtitle, Heading 1, Heading
    2, Heading 3, Quote, Code); on a phone its button names the style short (H1, H2, H3, and
    Bullets, Numbers, To-do for a list) and is only as wide as the name shown, the menu keeping
    the full names;
  - **Bold**, **Italic**, **Underline**;
  - **Colour** (a menu: **Text** then **Highlight**, each led by its clearing choice, **Default
    colour** / **No highlight**; text offers the article's **Accent** and nine fixed colours chosen
    to read on paper (Gray, Red, Orange, Amber, Green, Teal, Blue, Purple, Pink); highlight nine
    pale tints (Yellow, Orange, Red, Green, Teal, Blue, Purple, Pink, Gray));
  - **Link**;
  - **Lists** (a menu: bulleted, numbered, to-do; indent and outdent);
  - **Alignment** (a menu: left, centre, right, justify);
  - **More formatting** (a menu: strikethrough, inline code, superscript, subscript, clear
    formatting, Article style, which opens the page panel on Style);
  - **Insert** (a menu: Image, Table, Chart, then Divider, Page break, Quote, Code; a drawing
    starts from a shape dropped on the page or the slash menu's **Drawing**, a callout from the
    slash menu).
  - **Comment** (⌘⌥M) and **Assign Action**, with text selected (see "Comments and actions").
- No undo or redo (the canvas controls have them) and no word count.
- **Narrow**: when the toolbar is wider than the canvas, it scrolls sideways.
- **On a phone** the toolbar is a bar fixed along the top of the canvas, across it (its controls
  scroll sideways), in the Toolbar strip's place: the strip (its menu and palette) stands aside
  while the bar shows, so the writing has the room, and comes back when the caret leaves the
  article. The bar stays there whatever the page, the zoom or the keyboard does, and its menus
  open down from it.
- **A finger on a page** (a phone or any touch screen): a finger that travels more than a few px
  (`TOUCH_PAN_SLOP`) on an article page's writing or paper pans the view, as a thumb scrolls a
  document, whatever the tool; one that lifts where it landed is a tap, which puts the caret there;
  one held still for a long press (`LONG_PRESS_MS`) is the browser's, selecting text, so a slide
  after it stretches the selection rather than panning. Selected writing keeps the phone's Copy
  and Paste callout.
  A second finger hands the view to the pinch.
  The writing taking the caret frames its page for writing: its text column across the screen,
  the margins off it, so the text reads at a usable size; the view glides there as a page framed
  from its label does (at once under reduced motion). The panel opens as a bottom sheet as on
  any page.
- **Framing an article page** (a press on its label, the page navigator, a new article): the
  page seen whole, as an infographic page is.

## Zones

A **zone** is how anything other than text sits in the writing: it is a block of the writing,
laid out with it, holding ordinary canvas elements that move with it.

- **Object zone** (`zone: 'object'`): one element (an image, a chart, a table, a code element, a
  video, an icon, a sticker, a sticky note, a component), the zone hugging it exactly, with no
  boundary of its own. Resizing the element
  resizes the zone.
- **Drawing zone** (`zone: 'drawing'`): an area of the page for shapes, text labels
  and the arrows between them, worked on with every Diagram tool. It is a size of its own (by
  default the text width x 240 px) with grips on its bottom edge (taller or shorter), its right
  edge (wider or narrower, up to the text width, a wrapped zone two thirds of it) and its
  bottom-right corner (both); it grows to keep its elements inside it with 24 px to spare, and never
  shrinks past them.
- **Wrap**: **In line** (default; on its own line between blocks, aligned left, centre (default)
  or right), **Wrap left** (at the left of the text, the text running down its right) or **Wrap
  right**. A wrapped zone is at most two thirds of the text width; it keeps 14 px clear of the
  text beside it.
- **Elements belong to a zone** while their centre (an arrow: the midpoint of its ends) is inside
  it, and **move with it** whenever the writing moves it (typing above it, a page break, a new
  style, a page turned). **An object dragged** (an image, a chart, any object zone's element)
  shows the drop caret once its centre leaves its zone over its own article's pages, and on release
  its zone moves to that block boundary, the object with it; dropped by its own place, it settles
  back. Any other element dragged so its centre leaves its zone is no longer in it: it stays where
  it is dropped, fixed to the page in front of the text (a **loose element**), as is an object
  dropped off its article's pages.
- **A drawing zone is a window**: whatever of a drawing element pokes past its edge (a member near
  its edge, or a shape overlapping it from outside) is cut off there, on the canvas; objects are
  never cut. While a selection is moved it shows whole, so a shape dragged out stays in view. An
  element dragged into a drawing zone joins it; one whose centre stays inside but pokes out grows
  the zone.
- **The zone bar**: a small bar under a zone's bottom edge while the zone or one of its elements
  is selected: a **grip** (tooltip **Drag to move**), then **In line**, **Wrap left**, **Wrap
  right**, **Float**, then (In line) **Align left / centre / right**, then **Delete** (the zone and
  its elements). **Float** lets the zone go: its block leaves the writing and its elements stay
  where they are, in front of the text, as loose elements. A floating object (loose boxes on an
  article page, in no zone) shows the same bar with **Float** pressed and no grip or Delete;
  choosing **In line**, **Wrap left** or **Wrap right** puts it back into the writing at the block
  boundary nearest it.
- **Moving a zone**: dragging the grip carries a dashed ghost of the zone with the pointer, the
  zone itself dimmed in place, and a **drop caret** (a brand line across the column, a ring at each
  end) at the block boundary nearest the pointer. Release moves the zone there, its elements with
  it, as one edit; Escape, or a release where it already sits, leaves it be. Hovering a zone shows its outline faintly
  for someone who may edit.
- **Selecting a zone**: a press on a drawing zone's empty area selects the zone (outlined); the
  arrow keys then move the caret off it, Backspace / Delete remove it (its elements with it), ⌘X
  cuts it the same way. Copying a zone's elements is done on the canvas: select them and ⌘C, then
  paste them into the writing (they come in as a zone of their own). A press on an element in a
  zone selects the element as on any canvas.
- **Into the writing** (palette, slash menu, Insert, paste):
  - A palette tile **pressed** puts its element at the caret (or, with no caret in the article,
    after the last block); a tile **dragged** onto a page puts it where it is dropped. On a drawing
    zone it joins that zone at that point. Elsewhere on the writing it starts a new zone at the
    block boundary nearest the drop: a **drawing zone** for drawing elements (shapes of the
    Shapes and Flowchart families, arrows, text, mind nodes, frames), an **object zone** for
    everything else, a sticky note included (a sticky dropped into a drawing joins it there). The **Text** tile dropped on the writing puts the caret there
    instead.
  - The new zone, and its element, are selected; the zone bar shows.
- **Loose elements** (on an article page but in no zone) stay fixed to their page in front of the
  text, as on an infographic page; they never move with the writing.

## Comments and actions

A comment or an action can be put on any stretch of the writing, as on an element, and everything
a comment or an action does on an element it does here (threads, mentions, resolving, assignees,
due dates, Activity, email), because it lives on an element: a **margin note**.

- **Putting one on**: with text selected, the page toolbar's **Comment** (⌘⌥M) or **Assign
  action** button. The text is tinted (amber for a comment, sky blue for an action, translucent so
  it reads on a dark page) and underlined; a marker (an annotation, `articleNote`, 32 px) appears
  in the page's right margin, centred in the margin and level with the text's first line; the
  comment thread opens on it, or the Assign Action dialog. One edit.
- **The marker** is a small rounded chip in its note's colour: for a comment an amber speech
  bubble holding the open comment count (a dot before the first comment), for an action a tick
  in a circle, filled once the action is done. It carries its own count, so no badge strip rides
  on it. A click on it, or a plain click on its tinted text, opens its thread, or its action (the
  Assign Action dialog while none is assigned).
- **It stays beside its text**: as the writing moves (typing above it, a new style, a page added),
  the marker moves with the text's first line, onto another page too, settled by the writer as a
  zone is.
- **Several close together** (notes on one line, or lines apart) stack down the margin in the
  writing's order, 6 px apart, rather than covering each other.
- **Deleting the marker** takes the tint off its text. **Deleting the text** (all of it the note
  was on) deletes the marker, and with it the comment thread or action, in the same edit (undo
  brings both back).
- **Never printed**: exports leave the markers out and the text untinted.
- A tint is never taken from a paste.

## Leaving Illustrate

Diagram and Draw draw no pages and no writing. An editor switching a tab with articles out of
Illustrate (the mode switch or Shift+D; not Opens in) is asked first, in a dialog **Turn Articles
Into Pages?**:

- **Turn Into Pages** (the default button): every article page becomes a **Page** element
  ([The Page element](../009-elements/page-element.md)) covering its sheet, holding the writing
  that was laid out on that page as rich text: headings as headings, list items led by their
  marker and indented, a divider as a rule, bold, italic, underline, strikethrough, links and
  colours kept; the article's title and subtitle become the first Page's masthead. Zones' elements
  stay where they are, on top; margin-note markers become ordinary annotations. The pages stay, as
  infographic pages; the writing goes. One edit (undo brings the articles back), then the switch.
- **Keep as Articles**: the switch, the articles left as they are for Illustrate.
- **Cancel**: no switch.

A visitor, a locked tab, or a tab with no articles switches straight away.

## Article style

Set from the page panel's **Style** and **Text** tabs (an article page's panel has **Page**,
**Style** and **Text**; it has no Layouts). **Style** holds Looks, Accent, Headings in accent,
Margins and Page numbers; **Text** holds Fonts, then Text size, Line spacing, Paragraph spacing and
Lines under text (under **Size and Spacing**). Every change is one edit, previewed on the page while
a choice is hovered.

- **Looks** (a row of cards, each drawn as a miniature page in that look):
  - **Clean**: Inter throughout; ink headings; no rules; normal spacing.
  - **Classic**: Lora throughout; ink headings; a rule under the title; 1.5 spacing.
  - **Report**: Poppins headings, Inter body; accent headings; a rule under every heading.
  - **Notebook**: Nunito throughout; accent headings; the page ruled in lines aligned to the text.
  - **Bold**: Oswald headings, Inter body; accent title and headings; large text.
    Choosing a look sets every field below; a field changed afterwards keeps the rest.
- **Fonts**: **Headings** and **Body**, each a font from the font catalogue
  ([Fonts](../004-interface-design/fonts.md)).
- **Accent**: the colour of headings (when accented), links, quote bars, bullets, rules and to-do
  boxes: **Theme** (the tab theme's accent, the default) or one of eight presets.
- **Headings in accent**: on or off (off: headings in ink).
- **Text size**: Small (14 px), Normal (16 px, default), Large (18 px); headings scale with it.
- **Line spacing**: Single (1.3), 1.5 (default 1.5), Double (2.0).
- **Paragraph spacing**: None, Normal (default, 0.75 of a line), Wide (1.5 lines).
- **Lines under text**: **None** (default), **Under the title**, **Under headings** (the title and
  every heading), a hairline in the accent under the block's last line.
- **Margins**: Narrow (48 px), Normal (96 px, default), Wide (144 px); the top margin is never
  less than 72 px, room for the page toolbar.
- **Page numbers**: on or off (default).
- **Ruled lines**: the page's **Lines** pattern on an article page is drawn on the text's own
  baselines, at the body line height, inside the margins: lined paper the writing sits on.

## Type

At Normal text size, before line spacing:

| Style    | Size (px) | Weight | Space before / after (lines) |
| -------- | --------- | ------ | ---------------------------- |
| body     | 16        | 400    | 0 / paragraph spacing        |
| title    | 36        | 700    | 0 / 0.5                      |
| subtitle | 20        | 400    | 0 / 1, muted                 |
| h1       | 28        | 700    | 1.2 / 0.4                    |
| h2       | 22        | 650    | 1 / 0.3                      |
| h3       | 18        | 650    | 0.8 / 0.2                    |
| quote    | 18        | 400    | 0.5 / 0.75, italic           |
| code     | 14        | 400    | 0.5 / 0.75, monospace        |

Small and Large scale every size by 14/16 and 18/16. Text is drawn in the page's ink: dark on a
light page, light on a dark one ([Illustrate pages](illustrate-pages.md) "A dark page has light
ink").

## Everywhere a page goes

- **Reordering, duplicating, deleting** an article page act on its whole article
  ([Illustrate pages](illustrate-pages.md) "Page actions").
- **Slides**: any page of an article can be added as a page slide; it shows that page as it is
  now, the writing on it included.
- **Present**: an article page presents like any page, its writing drawn, no toolbar, no caret.
- **Export**: PDF, PNG and SVG draw an article page's writing exactly as on screen (text as real
  text in SVG output; rasterised in PNG, and in PDF, whose pages are images), with its zones'
  elements, its page number and its ruled lines; nothing of the editing chrome.
- **The Map** shows each page's text as soft grey lines.
- **Diagram and Draw modes** show the tab's elements as always; the writing belongs to the pages
  and shows only in Illustrate mode (its zones' elements stay on the canvas where they are).
- **Viewers** (a view role, a locked tab) read the writing and cannot change it; no caret, no
  toolbar, no zone bar.

## Collaboration

- Everyone on the tab sees the writing change as each person's commits land. The writing syncs
  **block by block**: two people writing in different paragraphs never overwrite each other; two
  in the same paragraph at once is last commit wins for that paragraph.
- **Where others are writing**: a collaborator's caret shows in their colour, with their name for
  a moment after it moves and on hover, and a thin bar in the margin beside the block they are
  in. A caret travels as presence (`article-caret`: the block's id and how many characters into
  its text, or null when their writing loses the caret), at the cursor's rate, never stored or
  replayed, and it is placed again in your own copy of the writing, so it stays in its block
  whatever either of you typed. Only carets on the tab you are on show; a caret leaves with its
  writer, and none go out while a hide-cursors vote is open. Collaborators' carets never appear in
  an export or thumbnail.
- Only the writer of a change writes its consequences (zone moves, pages added or removed), so
  two people's views never fight over them.

## Telemetry

- `Tab · Changed · ArticleAdded` (the add popover's Article); `ArticleLook<Name>` (Clean,
  Classic, Report, Notebook, Bold); `ArticleStyle` (any other style field); `ArticlesToPages`
  (**Turn Into Pages** on leaving Illustrate).
- `Element · Added · Article<Insert>` for an insert from the toolbar's Insert, the slash menu or
  a palette drop: `ArticleImage`, `ArticleTable`, `ArticleChart`, `ArticleCallout`,
  `ArticleSticky`, `ArticleDrawing`, `ArticleObject`, `ArticleDivider`, `ArticlePageBreak`,
  `ArticleQuote`, `ArticleCode`; and `ArticleComment`, `ArticleAction` for a margin note.
- `Element · Changed · ArticleFormat` (a mark from the toolbar), `ArticleBlockStyle` (style menu,
  lists), `ArticleLink`, `ArticlePaste` (Markdown pasted as blocks), `ArticleZoneWrap`,
  `ArticleZoneFloat`, `ArticleZoneResized`, `ArticleZoneMoved`, `ArticleZoneRemoved`.
- Never text.

## Non-goals

- Tables as part of the text (a table is an object zone holding a table element).
- Headers and footers beyond page numbers, footnotes, a table of contents, columns, suggestions
  and tracked changes, find and replace, Word / Google Docs import.
- Character-level merging of two people typing in the same paragraph at the same moment.
- The writing in Diagram or Draw mode, and the writing read or written by AI tools (MCP).
