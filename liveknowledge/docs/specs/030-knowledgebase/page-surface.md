# The page surface

Status: **being built, not yet verified in a browser** ([blueprint](blueprints/page-surface.md), which says what is
built and what is left). Asked for by the owner on 2026-11-20: "the page feels very similar to livedocuments;
it is supposed to be closer to the designs, no changing background, text etc. Style should become a knowledgebase
level setting."

A knowledgebase page is a page of a website to read and write on, never a sheet of paper on a canvas. This spec
replaces what the fork still shows around the writing.

## What a page looks like

- **No paper, no canvas.** The writing sits straight on the app's ground: no sheet with a border or shadow, no dotted
  canvas behind it, no page edge. The ground is white in the light theme and the chrome's dark ground in the dark
  theme. Under a Knowledgebase Style whose theme is not the product's own, both follow the theme (owner,
  2026-11-21): the dark surfaces take its hue, and in the light theme the white ground and the palest greys
  (slate-50 to 200) take a pale wash of its accent (`hooks/ui/useEditorAccent.ts`), so the page, the sidebar and
  the rail read as the theme in either appearance. Text greys stay neutral.
- **A reading column.** The writing is one centred column, 760 px wide at most (the stored page is 856 px wide
  and keeps 48 px either side), with 48 px of room either side on a desktop and 20 px on a phone. It
  scrolls with the window as any web page does: the wheel, the scrollbar, Page Up and Down, Home and End, and the
  browser's find all behave as on a web page. **A page is always shown at 100%** (owner 2026-11-21: "this should
  just render normally without zoom like a news webpage"): never scaled up or down, its text at its normal size,
  and nothing scrolls sideways. A phone has no Undo and Redo buttons (the edit bar stood over them), and its Pages,
  Ask and AI tabs are as wide as their names.
- **A narrow window reflows the writing.** Where the window has no room for the 760 px column and its side room
  (a phone, a narrow desktop window, the page tree taking room), the column is as wide as the room less the side
  room, and the writing re-wraps to it, as a news site's does. What is placed in the writing (a picture, a chart, a
  drawing, an embed) wider than that column is shown smaller to fit it; a wide table or code block scrolls sideways
  inside its own box. **The narrow layout is the viewer's own and is never stored**: the page keeps its stored
  856 px width, its height and where its placed things stand, so two people at different window widths never
  write over each other and a phone reader writes nothing by reading. Writing typed on a phone is saved as any
  writing is; only what the narrow layout worked out stays in that browser.
- **As short as its writing.** A page of one line is one line long: it does not scroll on a short window, and
  Linked From stands right under the writing. The stored page is never taller than its writing needs; a press
  anywhere in the window under the last line still puts the caret in the writing, which is the view's doing and
  stores nothing.
- **No zoom and no panning.** The zoom cluster, Fit to Screen, the minimap and the hand tool are not in
  liveknowledge. The browser's own zoom is the zoom. A wide table or a wide drawing scrolls sideways inside its own
  box. On the page itself the canvas's bare-ground gestures do not exist: held Space scrolls the page, the middle
  button is the browser's, a drag on the ground draws no marquee (selecting text is the browser's own), the ground's
  cursor is the plain one, and a letter typed outside the writing adds no shape. Nothing moves the page by itself
  once it is scrolled: a press anywhere leaves it where it stands, so a jump from On This Page, Search or an Ask
  source stays where it lands (WI-1372).
- **Above the writing:** the page's cover when it has one ("The cover"), the breadcrumb, the page's icon when it
  has one ("The page icon") to the left of the Title, the Title (40 px,
  bold, tight tracking), then the meta row ([Verification](verification.md); a **Suggested Edits** pill after its
  verified badge while agents' edits wait, [AI Knowledge](ai-knowledge.md) "On the page"; the page's labels last,
  "Page labels"). **Beside it** on a wide window, the right rail (Page Health, then On This Page, then Suggested Edits while any wait, then AI Context, a hairline between each section, owner 2026-11-22; 312 px wide, with a Hide Page Info button at its top right that collapses it to a 48 px strip with Show Page Info, kept on the device like the page tree's, owner 2026-11-21): docked from 1,280 px,
  and only where the page keeps its full width beside it (1,400 px with the page tree open), a Page Info button
  below that; the page's scrollbar stands between the writing and the docked rail, never under it.
  **Below it,** Linked From.
- **The logo** (mark, and the wordmark on a desktop) is always top left: heading the page tree, leading the top row
  left of the menu button when the tree is folded away, and leading the Ask and AI Knowledge header. A phone shows
  the mark alone. It opens the Explorer on the place that holds the knowledgebase.
- **Sidebars slide.** Opening or folding the page tree slides it in from, or out to, the left (200 ms; at once with
  reduced motion). Folded to its rail, resting a mouse on the rail for 150 ms slides the whole tree out over the page
  (a shadow, the page not moving), with **Keep Pages Open** in place of Hide Pages (both a bordered button at the tree's foot, New Page and its chevron wearing the same border and ground, right of
  New Page as livedocuments' Contents Options, so the knowledgebase's name has its row to itself; owner 2026-11-21); it slides back 300 ms after the
  pointer leaves it, unless a menu opened from it is still open. Touch has no hover, so a phone keeps its Pages sheet.
  The Page Info rail on the right slides the same way (owner 2026-11-21): **Hide Page Info** slides it out to the right
  as its strip takes its place, and **Show Page Info** slides it back in (200 ms; at once with reduced motion).
- **On This Page's jump:** pressing a heading scrolls the page's own column (not the canvas) to put it near the top,
  smoothly or at once under reduced motion, and lights it for a moment so the eye finds it (owner 2026-11-22);
  the picked heading is marked current at once and stays so until the
  reader scrolls themselves (WI-1359).
- **Reading time:** On This Page's heading carries how long the page takes to read ("4 min read"), at 230 words a
  minute over its text, lists, tables and code, rounded, at least 1 minute; an empty page shows none, and a page with
  writing but no headings shows the time alone. It follows the committed writing, never each keystroke.
- **The formatting bar** is the left of the top row ("The footer") while writing: block style, bold,
  italic, underline, colour, link, lists, alignment, more formatting, insert, comment. It holds formatting only.
  Pictures, charts, tables, drawings and embeds are added from the slash menu (`/`). The formatting bar has no
  Insert (+) menu (owner, 2026-11-21: "the / menu does a better job, it's just visual noise"). **In the Title**
  (owner, 2026-11-21) every control rests, dimmed, saying "The Title keeps its own style.": nothing on the bar
  applies to the Title.
- **A drawing's tools.** While a drawing zone is being edited the formatting controls give their place in the row
  to that drawing's tools, and only then: four categories (Shapes, Write, Concepts, Icons), each opening its tiles.
  They stay up while they are reached for and used, and go with the next press or typing elsewhere. The marquee,
  the element keys (R for a square and the rest) and a held-Space or middle-button drag exist while they are up.
- **No Selection mode.** liveknowledge has no Selection mode dropdown and none of its tools: no Select, Laser or
  Spotlight tool, key or command. The pointer always selects; the Format Painter stays, from an element's menu and
  the command search. No Library.
- **Undo and Redo** stay, in the formatting bar.

**Size and spacing** (owner, 2026-11-21: "a bit bigger, hard to see, space them out nicely"): in the top row the
controls are 40 px targets with 18 px glyphs in slate-700 at rest, and the gap between them grows with the room the
row has (up to 12 px), so a wide window spreads them across the top. Undo and Redo match.

## Who made the page

Owner, 2026-11-21: "In the header, when we aren't editing there is nothing in the top left. It would be nice to see the
avatars of everybody who has created or edited that page, creator first, then all the editors, hovering the avatar
shows their name."

- **Where.** The top row's left while the page is read (edit mode gives it to the formatting controls).
- **What.** 28 px discs side by side, 4 px apart, never overlapping (owner 2026-11-22), the creator first, then everyone else who saved the page in the order they
  first did: a person by their initials in a colour of their name (a person nobody here can name is "Guest"), an
  agent as a sparkle. Six at most; past that the sixth is "+N". Hovering or focusing a disc names them: "Priya Shah,
  Created", "Claude, Edited".
- **Kept.** One row a page and writer, `page_editors` (schema step V33), written in the same batch as the creator and
  last change (`page_authors`) on every write that counts; a person is one row, each agent its own. Page Health
  returns them as `editors`, the first writer first, 12 at most. A page not saved since the table began shows none.
- **Roles.** Everyone who can read the page sees it. Offline there is no Page Health, so no stack.

Owner, 2026-11-21: "Let me also add a cover to a page in a knowledgebase, a bit like how I do it on forms, fill the
top space above the page with it between the sidebars" and "The add cover button should also be placed next to the
1 min read bit, and make it a bit better looking." Then: "The cover should also allow gradients and animated like
forms do" and "The gradients offered should be related to the knowledgebases theme."

- **Under the band.** The page's blank top margin tucks under the band, so the Title stands 36 px below it (owner
  2026-11-21: "too much space under the cover"; `COVER_TITLE_GAP`).
- **What it is.** A page may have one cover, of three kinds: a **picture**, a **gradient** or an **animated**
  background. It is the page's own (`Tab.cover`), never the
  knowledgebase's, and it is not part of the writing: no block, no draft, no undo step of the writing.
- **Where it stands.** A band across the top of the page area, full-bleed between the page tree and the right rail:
  its left edge where the tree (or its folded rail) ends, its right edge where the docked rail begins, or the
  window's edge when the rail is not docked. It follows the tree opening and folding as the column does; the tree
  sliding out over the page on hover covers the band as it covers the page, and moves nothing. Under it, the
  breadcrumb, the Title and the writing, as on a page with none. It scrolls with the page.
- **Its height** is 220 px on a desktop and 140 px on a phone (a window under 640 px wide), whatever the picture's
  shape: a picture fills the band, cropped, never stretched. The band's height is kept from the moment the page is
  shown, before its picture arrives, so nothing under it moves when the picture lands (no layout shift).
- **A picture** comes from the image picker every picture in a page uses: **Upload**, **Your Images** and
  **Search** (openly licensed pictures, credited). It is stored as the knowledgebase's pictures are, so it is
  served to everyone who can read the page, kept by the knowledgebase's reference index and copied with it. A
  Search pick's credit stands small in the band's bottom left.
- **A gradient** is one of the **theme's gradients**, the fourteen a page background's Theme row and a form's cover
  offer, worked out from the knowledgebase's [Knowledgebase Style](#knowledgebase-style): its writing accent (the
  theme's own, or the one picked) and the theme's next colours. Seven are light (Theme Dawn, Mist, Glow, Haze,
  Sorbet, Pastel, Bloom) and seven bold and deep (Theme Bright, Vivid, Aurora, Ember, Dusk, Twilight, Ink), so a
  cover suits a light page and a dark one. Drawn at one angle, with no pattern.
- **An animated** cover is one of the moving backgrounds a slide and a form's cover offer (Aurora, Mesh, Waves,
  Starfield and the rest), drawn over its gradient in one of the theme's six **colourings** (Theme Deep, Night,
  Vivid, Bright, Soft, Mist), at a **speed** (25% to 300%, its own pace by default). Colours of one's own are not
  offered: a cover keeps the theme's.
- **It follows the style.** A gradient or animated cover is kept by its role (`theme-dawn`; `aurora` in `deep`),
  never as colours, and painted as it is drawn, so changing the knowledgebase's theme or accent recolours every
  cover at once, with nothing written to the pages.
- **Motion and its cost.** The moving parts move by transform and opacity alone, on the compositor: no repaint and
  no script per frame. With Reduce Motion on (the system's or the app's) they stand still where they rest, a
  finished still frame. They pause while the band is scrolled out of sight or the browser tab is hidden, and lay
  themselves out again only when the band's width changes by a step (160 px), not on every frame of a sliding tree.
- **While loading**, a picture's band shows a soft tint of the knowledgebase's accent, and the picture fades in over
  it (150 ms; at once with reduced motion). A picture that cannot be fetched leaves the tint.
- **Add Cover** sits in the meta row, after "N min read": a quiet ghost button, a picture icon and "Add Cover", the
  row's own size and colour, taking the accent on hover, with a hover card "Add a picture or a gradient across the
  top of this page." It opens the cover menu: **Choose a Picture** (the picker), the theme's gradients as two rows of
  swatches, each named in a tooltip, and **Motion**: the animated backgrounds six to a carousel page, each tile
  playing in the theme's colours, then their Colours and Speed. A picture or a gradient sets the cover and closes
  the menu; a motion sets it and the menu carries on from the band's Change Cover, for its colours and speed. A page with no writing and no cover still shows the row, with Add Cover alone,
  to whoever may add one.
- **On a page with a cover**, resting the pointer on the band shows, at its bottom right, **Change Cover**,
  **Reposition** (pictures only) and **Remove** (a trash icon), each a small frosted button with a tooltip; the
  keyboard reaches them too. Change Cover opens the cover menu; Remove takes the cover away at once, with an Undo in
  the toast that says so ("Cover removed").
- **Reposition** puts the band in a reposition state: the picture can be dragged up and down to choose which part
  shows (its focus, 0 the top and 100 the bottom of the picture, 50 when unset), the cursor a grab hand, a line
  "Drag the picture to reposition" across the band, and **Save Position** and **Cancel** in place of the hover
  buttons. The arrow keys move it by 5 while the band has the focus; Enter saves and Escape cancels. Nothing is
  stored until Save Position.
- **Who changes it.** An Editor or a Participant, and only where the page can be edited: whenever the page is
  editable today, and only in edit mode once [read and edit modes](editing.md) land. A Viewer and a link visitor see
  the cover and none of its controls ([Share roles](knowledgebases-and-pages.md#share-roles)). The room and the api
  refuse a cover from anyone else.
- **It is saved at once**, as the page's name is, whether or not the page is being edited: it is not part of the
  draft, and Save and Cancel neither keep nor drop it. Everyone with the page open sees it change.
- **Agents.** `read_page` (and the api's page read) answers the cover with its `kind`: `{ kind: "image", imageId,
focus }`, `{ kind: "gradient", preset }` (`theme-dawn` to `theme-ink`) or `{ kind: "animated", preset, colouring,
speed }` (a motion id such as `aurora`; a colouring `deep`, `night`, `vivid`, `bright`, `soft` or `mist`).
  `write_page` takes the same `cover` (an image from `upload_image` or `list_images`; an animated cover's colouring
  is `deep` when left out, its speed 1), or `null` to remove it; with or without `markdown`. An agent's cover write is strict: a cover it cannot take is refused, by name, and nothing is
  written. A cover alone is not a rewrite of the writing, so it is taken on a verified page too; it needs the
  `write` scope as any write does. The CLI has no cover option yet.
- **Exports.** A copy of the knowledgebase, its Drive file and a snapshot carry the cover. The PDF, Word and Markdown
  exports of a page leave it out: they are the writing.
- **Offline.** A knowledgebase kept Offline keeps its covers in this browser, as its other pictures are kept.
- **Cost.** A page with no cover draws nothing for it. A picture is fetched once per page open, its shown copy made as
  every page picture's is (at most 4,096 px on its longer side, 2,048 on a touch screen), and decoded off the main
  thread; the band never re-renders for a scroll or a keystroke.
- **Telemetry:** `Element` `Added` `Cover` when a cover is set, `Element` `Deleted` `Cover` when it is removed.

## The page icon

Owner, 2026-11-21: "Add ability to add icon to page title, then it shows in the sidebar like confluence. button
should be to the right of Add Cover under the title."

- **What it is.** A page may have one icon: an **emoji** (`{ emoji: "🚀" }`, one emoji as the system draws it) or an
  **icon** from the line-art catalogue the drawings use (`{ iconId: "rocket" }`). It is the page's own
  (`Tab.icon`), never the knowledgebase's, and it is not part of the writing: no block, no draft, no undo step of
  the writing.
- **Where it shows.** Large to the left of the Title, on its first line (owner 2026-11-21: "left of the title, not
  above it"), under the breadcrumb (and under the cover when there is one): an emoji at 48 px (36 px on a phone),
  an icon at the same size in the writing's accent. A long Title wraps beside it; the meta row starts under both. In the **page tree**, the row's
  icon stands before its title at 16 px, from the first paint (the knowledgebase's page summaries carry each page's
  icon, as they carry its parent, so a page not yet opened shows its icon too); a page with none shows its title
  alone, as today. The **breadcrumb** names
  each ancestor with its icon too.
- **Add Icon** sits in the meta row, right after Add Cover (or where Add Cover would be, on a page with a cover):
  the same quiet ghost button, a smile icon and "Add Icon", with a hover card "Add an emoji or an icon beside this
  page's title, shown in the page tree too." It opens the icon picker.
- **On a page with an icon**, the icon left of the Title is a button, for whoever may change it: it takes a soft
  ground on hover, a tooltip "Change Icon", and opens the picker. For anyone else it is a picture and nothing more.
- **The picker** is a popover (a sheet on a phone) titled "Change Icon" or "Add Icon", with **Remove** at its top
  right when the page has an icon, then two tabs, **Emoji** and **Icons**, a search field ("Search Emoji", "Search
  Icons") that takes the focus when it opens, and the grid. Emoji come in groups (Recent, Smileys, People, Nature,
  Food, Travel, Activities, Objects, Symbols, Flags), each found by its name and words; **Recent** is this browser's
  last 16 picks and shows only when it has some. Icons are the catalogue's categories, found by their names and
  words. A pick sets the icon and closes the picker. The arrow keys move through the grid, Enter picks, Escape
  closes. An empty search says "No emoji match" or "No icons match".
- **Remove** takes the icon away at once, with an Undo in the toast that says so ("Icon removed").
- **Who changes it.** The cover's rule: an Editor or a Participant, and only in edit mode. A Viewer and a link
  visitor see the icon, in the page and the tree, and none of its controls. The room and the api refuse an icon from
  anyone else, as they refuse a cover.
- **It is saved at once**, as the cover is: not part of the draft, and Save and Cancel neither keep nor drop it.
  Everyone with the knowledgebase open sees it change, in the page and in their tree.
- **Agents.** `read_page` (and the api's page read) answers the icon as `{ kind: "emoji", emoji }` or `{ kind:
"icon", iconId }`. Agents cannot set it yet.
- **Exports.** A copy of the knowledgebase, its Drive file and a snapshot carry the icon. The PDF, Word and Markdown
  exports leave it out: they are the writing.
- **Cost.** A page with no icon draws nothing for it. An emoji is text: nothing is fetched. An icon uses the line-art
  catalogue, which loads once (an async chunk) only when a page with an icon of the catalogue, or the picker's Icons
  tab, is shown. The emoji list loads only when the picker opens. A tree row's icon is a plain value of the row, so
  a tree of 500 pages renders no row for a change that is not its own.
- **Starter structures.** A knowledgebase made from a structure (describe-to-set-up.md "The start screen")
  opens with icons on its section pages and plain-named leaves, and a cover on each top-level section page and the
  first page: the catalogue's line-art icons, and a theme gradient, so each is the page's own and changed or removed
  as any other. Every id a structure uses is one the picker offers (a test holds it), so none draws the placeholder.
- **Telemetry:** `Element` `Added` `PageIcon` when an icon is set on a page with none, `Element` `Changed`
  `PageIcon` when it is changed, `Element` `Deleted` `PageIcon` when it is removed.

## Page labels

Owner, 2026-11-21 (Work Tracker 1343): "The page tree gives one way to organise pages; teams also need a second one
(team, product, audience, Onboarding) that cuts across sections." Built in [blueprint](blueprints/page-labels.md).

- **What a label is.** The knowledgebase's own: a **name** (1 to 40 characters, its spaces trimmed and runs of them
  made one, no comma since a comma separates the labels a search names, unique ignoring case) and a **colour**. A knowledgebase holds at most 100 labels and a page carries at
  most 10. A label means the same on every page: renaming it or changing its colour changes it everywhere at once.
- **Where they are kept.** The labels themselves (each an id, its name and its colour) are kept once, with the
  knowledgebase's settings (`knowledgeSettings.labels`, beside the Review Period); a page keeps only which of them it
  carries (`Tab.labels`, the labels' ids). So a rename, a new colour or a deleted label is **one write**, whatever
  the number of pages that carry it: no page is rewritten or re-saved. A page's label whose label was deleted reads
  as none.
- **On the page.** The page's labels stand in the meta row, after its other notes: each a small pill, its colour as a
  dot before its name, in the label's own words. Pressing one **filters the page tree** to that label ("The label
  filter"), opening the tree where it is folded to its rail, and the Pages sheet on a phone. Its hover card says
  "Show Pages Labelled <name>".
- **Adding and changing them.** For whoever may label the page, **Add Label** (a tag icon) sits after Add Cover and
  Add Icon, the same quiet ghost button, with a hover card "Add a label to group this page with others, across
  sections."; on a page that has labels it is a small **Edit Labels** button (a plus) after its pills.
  Both open the **label picker**, a popover (a sheet on a phone) titled **Labels**:
  - a field, **Find or Create a Label**, that takes the focus as it opens;
  - the knowledgebase's labels, those on the most pages first (then by name), each a row with its dot, its name,
    how many pages carry it, and a tick when this page does. Pressing a row puts the label on the page or takes it
    off, at once, and the picker stays open for the next. These are the **suggestions**: only labels already in use
    are offered, so a team keeps to one word for one thing;
  - what is typed narrows the list (a label whose name starts with it first, then one that holds it); where no
    label is called that, the first row is **Create "<what was typed>"**, which makes the label, in the next
    colour of the standard colours not yet taken, and puts it on the page. Enter does the highlighted row; Up and
    Down move; Escape closes;
  - each row's **Edit Label** button (a pencil, at its end on hover or focus, always on touch) opens the label in
    place under the shared back bar: its **Name** (a rename, kept as it is typed when Enter or Done is pressed),
    its **Colour** (the one colour picker: the standard colours, and colours of one's own) and **Delete Label**, which
    asks first ("Delete the Label <name>?", "It comes off the N pages that carry it. This cannot be undone.");
  - a name already taken by another label, ignoring case, is refused in place ("A label is already called that.");
    the 101st label and an 11th on one page are refused in words ("This knowledgebase has 100 labels, the most it
    can hold." and "A page carries at most 10 labels.").
- **Who changes them.** An Editor or a Participant (a page's writers), whenever the page is shown to them: labelling
  is how pages are found, not how a page looks, so it is not held to edit mode as the cover and the icon are. Putting
  a label on, taking it off, making, renaming, recolouring and deleting one are all theirs. A Viewer and a link
  visitor see the pills, and pressing one filters their tree too; they have no Add Label, Edit Labels or picker. The
  room and the api refuse a label change from anyone else.
- **It is saved at once**, as the icon is: not part of the draft. Everyone with the knowledgebase open sees it change,
  in the page, the tree's filter and the picker.
- **The label filter.** The page tree can show only the pages carrying one or more labels:
  - **Filter by Label** (a tag icon) stands at the right of the tree's Pages heading, where the knowledgebase has
    labels, with a tooltip. It opens a menu of the labels (most used first), each with a tick, to add or take away;
    pressing a page's label pill sets the filter to that label alone.
  - While a filter is on, a bar under the heading says **Labelled** and shows each label of it as a pill with a
    remove button ("Remove the Filter <name>"), then **Clear**. The filter button shows how many labels it holds.
  - The tree then shows the pages that carry **any** of the labels, and the pages above them, so each keeps its
    place: those above are drawn quieter (they are the way there, not results) and opened, whatever was closed.
    Nothing else changes: the rows, their buttons, the drag and the keys work as without a filter.
  - Where no page carries them: "No pages have these labels." and **Clear Filter**.
  - **Search follows it.** This Knowledgebase, the search panel's first group, finds only those pages while the
    filter is on; its heading says so ("Labelled Engineering") with a button that clears it
    ([Search and Ask](search-and-ask.md#search)).
  - The filter is this person's, in this browser tab, for this knowledgebase: it is not kept, so a reload shows every
    page again. A label deleted while it filters leaves the filter.
- **Ask and agents** can be told to answer from the pages of a label only ([Search and Ask](search-and-ask.md)).
  `read_page` and `list_pages` carry each page's labels by name.
- **Exports.** A copy of the knowledgebase, its Drive file and a snapshot carry the labels and which pages carry
  them. The PDF, Word and Markdown exports leave them out: they are the writing.
- **Offline.** A knowledgebase kept Offline keeps its labels in this browser, and labels, filters and searches the
  same way.
- **Cost.** A page with no labels draws nothing for them. The tree reads each page's labels from the page summaries,
  as it reads its icon, so a filter needs no request and no page's writing; working out what a filter shows is one
  pass over the pages (500 at most), done when the filter or the pages change, and a row renders only when what it
  shows changes. A rename is one write and one message to the open editors.
- **Telemetry:** `Element` `Added` `Label` when a label is put on a page, `Element` `Deleted` `Label` when it is taken
  off; `Element` `Changed` `Label` for a rename or a new colour; `UI` `Used` `LabelFilter` when a filter is set
  (from the menu or a pill).

## The footer

Owner, 2026-11-20: "Pages, Ask and AI Knowledge should be represented like tabs in the footer."

- The views are **tabs in the footer**, where the other liveworkspace editors show their tab bar, with the
  same look: **Pages**, **Ask**, **AI Knowledge**, **Connect** ([Connect](mcp-connect.md)), each with its icon, the current one raised as a tab pill is.
  They are links (`?view=`, so Back works) with `aria-current`, reachable by keyboard, each with a hover card of a
  title and one line. They are views, not a person's tabs: no add, close, drag or menu.
- The footer is a bar across the bottom of the content area: the tabs at its left, then Get Started, Tools,
  Settings, notifications and the appearance at its right. It never floats over the writing; the reading column
  scrolls above it.
- **The top row.** The content area starts with one row, the same height in the three views (48 px; 56 px on a
  phone): a hairline under it, nothing floating. On Pages its left holds the formatting controls while a page is
  being written; on Ask, AI Knowledge and Connect it holds the view's name and its own buttons. **Share** and the account
  button stand at its right end, always; the floating corner card is gone. The page scrolls under the row, never
  behind it, and the right rail starts below it. Below 1,280 px the **Page Info** button is in the row, left of
  Share, so nothing stands over the reading column at any width.
- On a phone the four tabs are the footer's row, icons with short labels (Pages, Ask, AI, Connect), 44 px targets; the
  notification list stays beside them and the footer's other items go behind one **More** button. Its card opens above the Ask, AI Knowledge and Connect
  views too (at the popover layer), so Get Started, Tools and Settings stay in reach on every view. The top row
  there leads with the menu button and **Pages** (the tree's sheet); while the caret is in the writing, the phone's
  writing bar takes the row and the row's own buttons step aside until the caret leaves.
- With the page tree collapsed to its rail, the menu button leads the top row, which then runs the window's width.

## The slash menu

Owner, 2026-11-21: "Make the / blocks menu look truly amazing, not just a boring list." A `/` typed at a block's
start or after a space opens it under the caret ([Article pages](../007-editor/article-pages.md) "Writing" says when
it opens and closes). It never takes the caret from the writing: what is typed after the `/` filters it. It never
opens in the Title (owner, 2026-11-21): a `/` typed there is just a character of the page's name.

- **What it offers**: only the blocks a knowledgebase page has, in five groups, in this order:
  - **Text**: Text, Heading 1, Heading 2, Heading 3, Subtitle, Quote, Code.
  - **Lists**: Bulleted List, Numbered List, To-Do List.
  - **Media and Embeds**: Image, Bar Chart, Pie Chart, Line Chart, Drawing.
  - **Knowledge**: Link to Page, Embed (a live file from another liveworkspace app), Footnote, Table of Contents.
  - **Layout**: Table, Divider.
  - Not offered: Title (a page has one, its name), Page Break (a page is continuous), Callout and Sticky Note (canvas
    shapes, not writing), and anything of slides, infographics or the canvas.
- **Each entry** is a tile with its own icon, its name, and one short line on what it is ("A big section heading").
  The highlighted entry is tinted in the theme's accent, its tile filled.
- **Recent** heads the menu, before the groups, while nothing is typed: the three entries this person picks most,
  the more recent first among equals (each pick weighs less the older it is: a pick a day old counts half). It is
  kept in this browser only, for this person; with nothing picked yet, or storage refused, there is no Recent. An
  entry in Recent is in its group too.
- **Filtering**: what is typed matches an entry's name loosely, letters in order with gaps allowed ("hd2" finds
  Heading 2, "tbl" Table), then its keywords ("ul" finds Bulleted List, "diagram" Drawing). A name starting with
  what is typed ranks first, then a word of the name starting with it, then a name holding it, then the loose
  matches, then keywords. The letters matched are drawn bold in the name. The groups stay, each ordered by its best
  match, the best match of all highlighted. Nothing matching says "No blocks match" with what was typed.
- **Keys**, the caret staying in the writing: Up and Down move through every entry (wrapping), Tab and Shift+Tab jump
  to the next or previous group's first entry (wrapping), Enter chooses, Escape closes. The pointer: resting on an
  entry highlights it, a press chooses it.
- **The preview** (desktop, where the window has room beside the list): a pane at the menu's right draws the
  highlighted block as it will look on the page, in the knowledgebase's own fonts and accent (a heading at its
  size, a list's bullets, a quote's bar, a table's grid, a chart's bars, a footnote's number and note), with its
  name, a line on what it does and its shortcut (the key, or the Markdown typed at a block's start).
- **Where it sits**: under the `/`, its left edge at the `/`; where it would run past the window's foot it opens
  above the `/` instead, and it never runs past the window's sides (8 px from them). With no room for the preview
  beside the list, the list alone shows.
- **Motion**: it unfolds from the `/` (the menus' 150 ms open, from its top-left corner, or its bottom-left when it
  opens above); with reduced motion it appears at once.
- **On a phone** it is a sheet along the foot of the visible screen, above the on-screen keyboard, the window's
  width less 8 px a side, at most 45% of the visible height: entries 44 px tall, group names standing at its top
  as it scrolls, no preview. It slides up (250 ms, at once with reduced motion).
- **Light and dark**: it follows the app's appearance, a white or dark panel with the theme's accent.
- **Screen readers**: a listbox "Insert a block" of groups named by their heading, each entry an option named by
  its name and line; the writing points at the highlighted one (`aria-activedescendant`).
- **Cost**: it draws only while open, and opening it measures nothing of the writing but the `/`'s place; typing
  with it closed costs what it did.
- **Telemetry**: a block put in from it counts as `Element` `Added`, the block's type.
- **Share roles**: an Editor and a Participant have it; a Viewer does not.

## What a page no longer has

The page's own **Style**, **Text**, **Background** and **Lock** controls are not in liveknowledge, with the page
panel behind them: a page cannot have its own background, pattern, fonts, text size, margins or paper. Every page of
a knowledgebase looks the same.

A page stored with its own background or style (an imported livedocuments file) is shown in the knowledgebase's
style; the stored fields are ignored and dropped on the next save.

## Knowledgebase Style

Owner, 2026-11-20: "Tab Style functionality needs to exist at a knowledgebase level, but be suited to
knowledgebases, not generic. Canvas probably makes no sense."

Knowledgebase Style is the platform's [Tab Style dialog](../011-theme/canvas-and-theme-dialog.md), kept whole where
it suits writing and cut where it only suits a canvas. It styles the **whole knowledgebase at once**: there is no
per-page and no per-tab style.

- **Opening it.** **Style** in the footer, left of Tools (a palette glyph; owner 2026-11-21, moved out of the
  knowledgebase's menu), and the command search, Editor only. The dialog is titled **Knowledgebase Style**, and its line reads "Pick a look for every page of this
  knowledgebase." It is the centred dialog (a bottom sheet on a phone), and its Fine-tune panels keep the home's
  height, so it does not move as a panel opens. It has no Show Me: the platform's tour walks a tab's finish and
  canvas, which are not here.
- **Confirming** (owner 2026-11-21: "it affects the whole knowledgebase"). A pick is previewed at once on this
  screen only; nothing is saved or sent. Closing the dialog (Close, Escape) with a change asks **Apply This Style to
  the Whole Knowledgebase?** ("Every page of this knowledgebase takes this style, for everyone who reads it."):
  **Apply to Knowledgebase** saves the last pick for everyone as one undo step; **Discard Changes** puts the saved
  style back. Closing with nothing picked asks nothing.
- **Looks.** The same carousel of looks, each card a small **page of writing** drawn in that look (a title, a
  heading, two lines, a link, a quote and a small table), never a diagram: a look is a theme (its colours) and a
  font. Each card's name is set in the look's typeface too, and the Text row's "Aa" in the heading font worn now,
  so the dialog itself shows the type change as a look or a font is picked (owner 2026-11-21: "the tab style menu
  itself doesn't seem to change font"), as the Text panel's sample and its two font lists already do. The faces
  load only as the dialog draws them (the one fonts stylesheet's `@font-face` rules fetch a family when it is
  first used): about 150 KB of woff2 on a first open, measured 2026-11-21. Seasonal looks and their toggle stay, as
  does **Mashup** (it rolls a theme and a font). A card reads as
  selected while the knowledgebase's theme and font are the look's; a knowledgebase whose headings and body are in
  two fonts wears no look. A card's line names the two ("Steel, Inter"); the product's own theme is named **Lime**.
  Picking a look sets the theme and both fonts, keeps the size, spacing and heading style, and puts the accent back
  on the theme's own.
- **Fine-tune**, under the shared back bar, holds two panels, both about writing:
  - **Text**: the heading font and the body font, text size (Small, Medium, Large), line spacing (Compact,
    Comfortable, Relaxed) and heading style (plain, or with a rule under the largest headings).
  - **Colours**: the theme, and within it the accent the writing's headings, links, quotes, tables and code blocks
    take: the theme's own, or one picked with the one colour picker (the theme's own palette first). Picking a
    theme puts the accent back on that theme's own.
  - Text leads with a sample (a heading and a line with a link) that follows each choice as it is made. Colours
    lists the themes six to a carousel page, each a small page of writing in that theme and the knowledgebase's own
    fonts (never the editors' theme card, which is a diagram on a canvas), named by the theme alone; the accent is
    one row under them, its swatch opening the picker.
- **What the accent colours.** Headings, links, the bar beside a quote, a table's header and the caret take the
  accent, held to 4.5:1 on the page in both appearances (deepened or lightened, hue kept, where the theme's own
  falls short). The page's **Title stays in the ink** in every style: it is the page's name. The product's own theme
  gives a lime accent; a multi-colour theme (Rainbow, Pastel, Tropical, and the seasonal ones) gives its first
  branch's colour, since its own stroke is a neutral grey meant for a diagram's root.
- **Not in liveknowledge:** the Canvas panel and everything it held (the surround, patterns, Around the Pages), New
  Page Background, the Finish filter and panel (stroke finishes belong to drawn shapes), per-shape and formal theme
  colours, margins, page numbers, and Apply to All Tabs (the style always applies to every page). A drawing or chart
  inside a page takes the knowledgebase's theme with the plain finish.
- **The chrome follows the theme**, as in every liveworkspace editor: the accent the sidebar, tabs, buttons and
  links use is the knowledgebase's theme accent, in the light and dark halves the theme defines. **Review Due** stays
  amber and errors stay red in every theme; the Verified tick takes the theme accent.
  - The top row and the footer follow it too (the formatting bar's active state, Share, the footer's tabs): unlike
    the other editors' header and tab bar, they carry no opt-out. Only the logo keeps the product's own colours.
  - A theme whose accent is too pale to carry text (a pastel's rose, a yellow, a mid orange) is deepened, hue kept,
    until white reads on its solid fills and its deeper step reads on its wash at 4.5:1.
  - In the dark appearance the page's ground is the chrome's own dark surface, so under a theme that tints the dark
    surfaces the reading column is the same ground as the top row and the sidebar.
  - **The chrome keeps its edges** (owner 2026-11-21: "The everyday theme loses the borders on the sidebar and
    header etc so it all blends into one mess"). The sidebar's right edge, the top row's foot, the rail's left edge
    and the footer's top are one edge colour, a fixed step off the ground (the ground mixed 16% toward slate-900 in
    the light, 13% toward white in the dark), and the sidebar stands a shade off the page (4% toward slate-900 in
    the light, 30% toward black in the dark). Mixed from the ground, they read alike under every look, Everyday
    included, in both appearances: about 1.4:1 for an edge, where the plain slate stops gave Everyday 1.06:1 in the
    dark.
  - A picked accent colours the writing only, never the chrome.
  - Page links take the theme's accent (lime under the product's own theme), held to 4.5:1.
- **Stored once**, on the knowledgebase (`knowledgeStyle` in the document's metadata: the theme, the heading and
  body fonts, text size, spacing and heading style, and the accent when one was picked), and every page's writing is
  drawn with it. Changing it changes every page at once, for everyone, as one undoable edit; pages are not rewritten
  or re-saved, and pages not on screen are not laid out. A stored style is read forgivingly (a field it cannot use
  is the default's); a write is strict (a field it cannot take refuses the save, by name).
- **No tab has a style.** A tab's stored theme, font, text size, finish, surround and New Page Background (an
  imported livedocuments file carries them) are ignored and dropped as the tab is read, as a page's own looks are.
- **Drawings and charts** inside a page are drawn in the knowledgebase's theme, in the plain finish: each colour an
  element leaves unset is the theme's when it is drawn, and a colour someone picked is kept. Nothing is written to
  the element, so a style change saves no page.
- **A new knowledgebase** starts in the Everyday look with the product's lime theme.
- Exports (PDF, Word, Markdown) use the knowledgebase's style, with the writing's accent as the page shows it (lime
  under the product's own theme, a multi-colour theme's branch, or the one picked).
- **The preview follows the style** (owner, 2026-11-21: "Make sure that the preview for a knowledge base follows its
  theme"). A knowledgebase's picture in the Explorer, Drive, Recent and a share card
  ([previews](../../../../liveworkspace/docs/specs/006-media/previews.md)) is its first page drawn in its style, as
  its readers see it in the light appearance: the theme's light ground (white under the product's own theme, the
  theme's pale wash under any other), the heading and body fonts, the text size, spacing and heading style, the
  writing's accent, and drawings in the theme with the plain finish. There is no finish, surround or pattern to
  draw (they are not in liveknowledge). A picture cannot load a web font, so each typeface falls back to its
  family's generic stack (serif, sans-serif, monospace) where the font is not installed on the viewer's device. A
  style change is an edit: the knowledgebase's last save moves, so the Explorer shows the new look the next time it
  asks for the picture. The preview is the same in either appearance.
- **Agents** cannot set a page's look: the article write takes no `look` or `accent`, and one that names either is
  refused with a line that says the style is a knowledgebase setting and what to send instead. The style is read
  with the knowledgebase's metadata (`GET /api/documents/<id>`, every role) and set with its metadata write (`PUT
/api/documents/<id>` with `knowledgeStyle`, any of its fields), by an Editor's token with the `write` scope. The
  CLI's `article set` has no `--look` or `--accent`; the CLI and the MCP have no verb of their own for the style yet.
- **Telemetry:** the Tab Style events as they are: `Tab` `Changed` `Look`, `SeasonalLook`, `Mashup`, `Text` and
  `Colours`, and `UI` `Opened` `ThemePicker` for the dialog. `Knowledgebase` is not a category of the telemetry
  vocabulary, and adding one is a change to the platform's schema and dashboard, so the object stays `Tab`.

## Share roles

Changing the Knowledgebase Style is Editor only: a Participant is never offered it and the api refuses its style
write ([Knowledgebases and pages](knowledgebases-and-pages.md#share-roles)). Everyone sees the same look. A page's
cover and its icon are changed by an Editor or a Participant, and seen by everyone.

| Labels                                                  | Editor | Participant | Viewer |
| ------------------------------------------------------- | ------ | ----------- | ------ |
| See a page's labels, filter the tree and search by them | yes    | yes         | yes    |
| Put a label on a page or take it off                    | yes    | yes         | no     |
| Make, rename, recolour or delete a label                | yes    | yes         | no     |

## Performance

Dropping the canvas must not cost typing speed: the writing commits as it does today, and a 100,000 character page
must scroll and type without long tasks (measured in the perf spec of
[e2e smoke](../003-system-architecture/e2e-smoke.md)). The right rail and the formatting bar do no work per
keystroke.
