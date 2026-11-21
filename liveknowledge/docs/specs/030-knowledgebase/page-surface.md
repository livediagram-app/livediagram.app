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
  browser's find all behave as on a web page.
- **A narrow window.** Where the window has no room for the column and its side room, the whole page is shown
  smaller to fit, and nothing scrolls sideways. The column does not re-wrap: what is placed in the writing (a
  picture, a chart, a drawing) is stored against the page's width
  ([blueprint](blueprints/page-surface.md) "The choice").
- **As short as its writing.** A page of one line is one line long: it does not scroll on a short window, and
  Linked From stands right under the writing. The stored page is never taller than its writing needs; a press
  anywhere in the window under the last line still puts the caret in the writing, which is the view's doing and
  stores nothing.
- **No zoom and no panning.** The zoom cluster, Fit to Screen, the minimap and the hand tool are not in
  liveknowledge. The browser's own zoom is the zoom. A wide table or a wide drawing scrolls sideways inside its own
  box. On the page itself the canvas's bare-ground gestures do not exist: held Space scrolls the page, the middle
  button is the browser's, a drag on the ground draws no marquee (selecting text is the browser's own), the ground's
  cursor is the plain one, and a letter typed outside the writing adds no shape.
- **Above the writing:** the page's cover when it has one ("The cover"), the breadcrumb, then the Title (40 px,
  bold, tight tracking), then the meta row ([Verification](verification.md)). **Beside it** on a wide window, the right rail (On This Page, Page Health): docked from 1,280 px,
  and only where the page keeps its full width beside it (1,400 px with the page tree open), a Page Info button
  below that; the page's scrollbar stands between the writing and the docked rail, never under it.
  **Below it,** Linked From.
- **The logo** (mark, and the wordmark on a desktop) is always top left: heading the page tree, leading the top row
  left of the menu button when the tree is folded away, and leading the Ask and AI Knowledge header. A phone shows
  the mark alone. It opens the Explorer on the place that holds the knowledgebase.
- **Sidebars slide.** Opening or folding the page tree slides it in from, or out to, the left (200 ms; at once with
  reduced motion). Folded to its rail, resting a mouse on the rail for 150 ms slides the whole tree out over the page
  (a shadow, the page not moving), with **Keep Pages Open** in place of Hide Pages; it slides back 300 ms after the
  pointer leaves it, unless a menu opened from it is still open. Touch has no hover, so a phone keeps its Pages sheet.
- **Reading time:** On This Page's heading carries how long the page takes to read ("4 min read"), at 230 words a
  minute over its text, lists, tables and code, rounded, at least 1 minute; an empty page shows none, and a page with
  writing but no headings shows the time alone. It follows the committed writing, never each keystroke.
- **The formatting bar** is the left of the top row ("The footer") while writing: block style, bold,
  italic, underline, colour, link, lists, alignment, more formatting, insert, comment. It holds formatting only.
  Pictures, charts, tables, drawings and embeds are added from the slash menu (`/`). The formatting bar has no
  Insert (+) menu (owner, 2026-11-21: "the / menu does a better job, it's just visual noise").
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

## The cover

Owner, 2026-11-21: "Let me also add a cover to a page in a knowledgebase, a bit like how I do it on forms, fill the
top space above the page with it between the sidebars" and "The add cover button should also be placed next to the
1 min read bit, and make it a bit better looking." Then: "The cover should also allow gradients and animated like
forms do" and "The gradients offered should be related to the knowledgebases theme."

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

## The footer

Owner, 2026-11-20: "Pages, Ask and AI Knowledge should be represented like tabs in the footer."

- The three views are **tabs in the footer**, where the other liveworkspace editors show their tab bar, with the
  same look: **Pages**, **Ask**, **AI Knowledge**, each with its icon, the current one raised as a tab pill is.
  They are links (`?view=`, so Back works) with `aria-current`, reachable by keyboard, each with a hover card of a
  title and one line. They are views, not a person's tabs: no add, close, drag or menu.
- The footer is a bar across the bottom of the content area: the tabs at its left, then Get Started, Tools,
  Settings, notifications and the appearance at its right. It never floats over the writing; the reading column
  scrolls above it.
- **The top row.** The content area starts with one row, the same height in the three views (48 px; 56 px on a
  phone): a hairline under it, nothing floating. On Pages its left holds the formatting controls while a page is
  being written; on Ask and AI Knowledge it holds the view's name and its own buttons. **Share** and the account
  button stand at its right end, always; the floating corner card is gone. The page scrolls under the row, never
  behind it, and the right rail starts below it. Below 1,280 px the **Page Info** button is in the row, left of
  Share, so nothing stands over the reading column at any width.
- On a phone the three tabs are the footer's row, icons with short labels (Pages, Ask, AI), 44 px targets; the
  notification list stays beside them and the footer's other items go behind one **More** button. The top row
  there leads with the menu button and **Pages** (the tree's sheet); while the caret is in the writing, the phone's
  writing bar takes the row and the row's own buttons step aside until the caret leaves.
- With the page tree collapsed to its rail, the menu button leads the top row, which then runs the window's width.

## The slash menu

Owner, 2026-11-21: "Make the / blocks menu look truly amazing, not just a boring list." A `/` typed at a block's
start or after a space opens it under the caret ([Article pages](../007-editor/article-pages.md) "Writing" says when
it opens and closes). It never takes the caret from the writing: what is typed after the `/` filters it.

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

- **Opening it.** **Knowledgebase Style** in the knowledgebase's menu (the sidebar header,
  [Knowledgebases and pages](knowledgebases-and-pages.md#the-knowledgebases-menu)) and the command search, Editor
  only. The dialog is titled **Knowledgebase Style**, and its line reads "Pick a look for every page of this
  knowledgebase." It is the centred dialog (a bottom sheet on a phone), and its Fine-tune panels keep the home's
  height, so it does not move as a panel opens. It has no Show Me: the platform's tour walks a tab's finish and
  canvas, which are not here.
- **Looks.** The same carousel of looks, each card a small **page of writing** drawn in that look (a title, a
  heading, two lines, a link, a quote and a small table), never a diagram: a look is a theme (its colours) and a
  font. Seasonal looks and their toggle stay, as does **Mashup** (it rolls a theme and a font). A card reads as
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
- Exports (PDF, Word, Markdown) use the knowledgebase's style.
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
cover is changed by an Editor or a Participant, and seen by everyone.

## Performance

Dropping the canvas must not cost typing speed: the writing commits as it does today, and a 100,000 character page
must scroll and type without long tasks (measured in the perf spec of
[e2e smoke](../003-system-architecture/e2e-smoke.md)). The right rail and the formatting bar do no work per
keystroke.
