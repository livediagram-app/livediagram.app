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
- **A reading column.** The writing is one centred column, 760 px wide at most (724 px as built: the stored page
  is 820 px wide and keeps 48 px either side), with 48 px of room either side on a desktop and 20 px on a phone. It
  scrolls with the window as any web page does: the wheel, the scrollbar, Page Up and Down, Home and End, and the
  browser's find all behave as on a web page.
- **A narrow window.** Where the window has no room for the column and its side room, the whole page is shown
  smaller to fit, and nothing scrolls sideways. The column does not re-wrap: what is placed in the writing (a
  picture, a chart, a drawing) is stored against the page's width
  ([blueprint](blueprints/page-surface.md) "The choice").
- **No zoom and no panning.** The zoom cluster, Fit to Screen, the minimap and the hand tool are not in
  liveknowledge. The browser's own zoom is the zoom. A wide table or a wide drawing scrolls sideways inside its own
  box.
- **Above the writing:** the breadcrumb, then the Title (40 px, bold, tight tracking), then the meta row
  ([Verification](verification.md)). **Beside it** on a wide window, the right rail (On This Page, Page Health): docked from 1,280 px,
  and only where the page keeps its full width beside it (1,364 px with the page tree open), a Page Info button
  below that; the page's scrollbar stands between the writing and the docked rail, never under it.
  **Below it,** Linked From.
- **The formatting bar** is the left of the top row ("The footer") while writing: block style, bold,
  italic, underline, colour, link, lists, alignment, more formatting, insert, comment. It holds formatting only.
  Selection mode, the Library and every canvas tool leave the bar; pictures, charts, drawings and embeds are added
  from **Insert** and the slash menu, and a drawing zone shows its own drawing tools while it is being edited.
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

**Not built yet** ([blueprint](blueprints/page-surface.md) "Not built"): every page is drawn in the Clean look
at the Medium size until it is.

The look is chosen once, for the whole knowledgebase.

- **Knowledgebase Settings > Style** (the knowledgebase menu), Editor only: a **look** (Clean, Classic, Report,
  Notebook, Bold: the article looks the fork brought, as a row of preview tiles), the **accent** (the brand lime by
  default; a small set of swatches), and **text size** (Small, Medium, Large). Nothing else.
- It is stored once on the knowledgebase (`knowledgeStyle` in the document's metadata) and every page's writing is
  drawn with it. Changing it changes every page at once, for everyone, as one edit; pages are not rewritten.
- Page links, the Verified pill and the chrome keep the brand colour whatever the accent: trust reads the same in
  every knowledgebase.
- Exports (PDF, Word, Markdown) use the knowledgebase's style.

## Share roles

Changing the Knowledgebase Style is Editor only. Everyone sees the same look.

## Performance

Dropping the canvas must not cost typing speed: the writing commits as it does today, and a 100,000 character page
must scroll and type without long tasks (measured in the perf spec of
[e2e smoke](../003-system-architecture/e2e-smoke.md)). The right rail and the formatting bar do no work per
keystroke.
