# The page surface

Status: **spec**, not built. Asked for by the owner on 2026-11-20: "the page feels very similar to livedocuments;
it is supposed to be closer to the designs, no changing background, text etc. Style should become a knowledgebase
level setting."

A knowledgebase page is a page of a website to read and write on, never a sheet of paper on a canvas. This spec
replaces what the fork still shows around the writing.

## What a page looks like

- **No paper, no canvas.** The writing sits straight on the app's ground: no sheet with a border or shadow, no dotted
  canvas behind it, no page edge. The ground is white in the light theme and the chrome's dark ground in the dark
  theme, following the app's appearance and nothing else.
- **A reading column.** The writing is one centred column, 760 px wide at most, with 48 px of room either side on
  a desktop and 20 px on a phone. It scrolls with the window as any web page does: the wheel, the scrollbar, Page
  Up and Down, Home and End, and the browser's find all behave as on a web page.
- **No zoom and no panning.** The zoom cluster, Fit to Screen, the minimap and the hand tool are not in
  liveknowledge. The browser's own zoom is the zoom. A wide table or a wide drawing scrolls sideways inside its own
  box.
- **Above the writing:** the breadcrumb, then the Title (40 px, bold, tight tracking), then the meta row
  ([Verification](verification.md)). **Beside it** on a wide window, the right rail (On This Page, Page Health).
  **Below it,** Linked From.
- **The formatting bar** is a slim bar pinned to the top of the writing column while writing: block style, bold,
  italic, underline, colour, link, lists, alignment, more formatting, insert, comment. It holds formatting only.
  Selection mode, the Library and every canvas tool leave the bar; pictures, charts, drawings and embeds are added
  from **Insert** and the slash menu, and a drawing zone shows its own drawing tools while it is being edited.
- **Undo and Redo** stay, in the formatting bar.

## What a page no longer has

The page's own **Style**, **Text**, **Background** and **Lock** controls are not in liveknowledge, with the page
panel behind them: a page cannot have its own background, pattern, fonts, text size, margins or paper. Every page of
a knowledgebase looks the same.

A page stored with its own background or style (an imported livedocuments file) is shown in the knowledgebase's
style; the stored fields are ignored and dropped on the next save.

## Knowledgebase Style

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
