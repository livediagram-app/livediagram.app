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
  theme, following the app's appearance and nothing else.
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
- **Above the writing:** the breadcrumb, then the Title (40 px, bold, tight tracking), then the meta row
  ([Verification](verification.md)). **Beside it** on a wide window, the right rail (On This Page, Page Health): docked from 1,280 px,
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
  Pictures, charts, tables, drawings and embeds are added from **Insert** and the slash menu.
- **A drawing's tools.** While a drawing zone is being edited the formatting controls give their place in the row
  to that drawing's tools, and only then: four categories (Shapes, Write, Concepts, Icons), each opening its tiles.
  They stay up while they are reached for and used, and go with the next press or typing elsewhere. The marquee,
  the element keys (R for a square and the rest) and a held-Space or middle-button drag exist while they are up.
- **No Selection mode.** liveknowledge has no Selection mode dropdown and none of its tools: no Select, Laser or
  Spotlight tool, key or command. The pointer always selects; the Format Painter stays, from an element's menu and
  the command search. No Library.
- **Undo and Redo** stay, in the formatting bar.

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

Changing the Knowledgebase Style is Editor only. Everyone sees the same look.

## Performance

Dropping the canvas must not cost typing speed: the writing commits as it does today, and a 100,000 character page
must scroll and type without long tasks (measured in the perf spec of
[e2e smoke](../003-system-architecture/e2e-smoke.md)). The right rail and the formatting bar do no work per
keystroke.
