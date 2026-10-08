# Side by side tabs

On a desktop, a person can drag a tab to the right side of the screen to open it beside the tab
they are working on. Both tabs stay on screen, each on its own side, under one site header. The
editor's toolbars and panels follow the person to whichever side they work in.

## Why

Tabs hold related work: the context diagram and the container diagram, the retro board and the
action plan, the draft and the reference. Comparing two tabs today means flicking between them and
holding one in your head. Side by side puts both on screen, with the gesture people already know
from browsers and code editors: drag the tab to where you want it.

## Scope

- **Wide screens only.** Either pane can hold the editor, so each keeps the editor's floor of
  **640 px** (Tailwind's `sm`, the width its palette, Explorer and canvas are laid out for). The
  split is offered only when the browser window's inner size is at least **1,400 × 700 px**, so the
  even split it opens at leaves each pane room to spare: 1,440 px and wider laptops and desktops
  qualify; 1,280 px and 1,366 px laptops, tablets and phones, where two editors read as cramped,
  keep one tab at a time. A window resized below the floor hides the split; widening it again
  brings it back.
- **Two panes, one editor.** Each pane shows one tab of the same document and keeps its side. The
  editor (canvas, palette, Explorer, panels, zoom) sits in the pane of the active tab. The other
  pane draws its tab live. Moving between the panes moves the editor, never the tabs.
- **One header, one footer.** The site header (document title, share, account) runs across the top
  of both panes, and the tab bar (tabs, Search, Settings, System) across the bottom, as they do
  with one tab.
- **No quick style panel.** The [quick style panel](../008-canvas/quick-style-panel.md) stands down
  while a split shows: half a window has no room for it beside the selection. Every style stays in
  the element's menu.
- **Steps aside, is kept.** Zen mode, embeds and presenting hide the split; leaving them brings it
  back. A window that becomes too narrow hides it the same way.
- **Per browser.** The split is remembered on this device, per document. It is not shared with
  collaborators and not part of the document.

## Opening

**By dragging.** While a tab pill is being dragged (the tab bar's existing drag), the right edge of
the screen wakes:

1. A glowing rail appears along the right edge, with a **Drop to Open Side by Side** hint beside
   it. The rail brightens as the pointer heads toward it.
2. When the pointer enters the **drop zone** (the right 28% of the window, at least 160 px, and
   above the tab bar so a drop near the last pill is still a reorder), a ghost of the pane slides
   in at the width it will open, headed **Open _name_ Side by Side** and showing the tab's own
   drawing, with a **Release to Open** chip.
3. Releasing there opens the tab on the right. Releasing anywhere else does what it did before
   (reorder on a pill, nothing elsewhere).

Which tab goes where:

- Dragging a tab that is **not** active opens it on the right; the editor stays on the left with
  the tab it was on.
- Dragging the **active** tab sends it right, and the editor goes with it. Its **companion** takes
  the left: the tab you were on before it, else its left neighbour, else its right neighbour.
- With a split already open, the drop zone is the right pane (**Show _name_ Here**), and a drop
  puts the dragged tab there. If the editor was in the right pane it now edits that tab. Dropping
  the left pane's tab trades the two sides. Dropping the right pane's own tab does nothing.
- A document with one tab offers nothing to drop on.

**From the menu.** The tab's ⋯ menu (and the canvas right-click menu) has **Side by Side** in its
quick-action row: it does what dragging the active tab does. With a split open the same button
reads **Close Side by Side**.

## Moving between the panes

- **Click** anywhere in the other pane and the editor moves there at once.
- **Rest** the pointer in the other pane for **120 ms** and the editor follows it: under the
  ~150 ms people read as a delay (measured ~190 ms from entering the pane to the chrome landing,
  against ~470 ms at the first 400 ms), yet long enough that skimming a pane's edge doesn't. It
  never happens while a mouse button is held (a drag crossing the seam), a dialog is open, or text
  is being edited.
- **Nothing moves on screen.** The editor takes over the exact view the pane was showing (zoom and
  position), and the pane it leaves keeps the exact view the editor had. Only the chrome changes
  sides. The tab-entry fit-to-screen is skipped for that move.
- Selecting a **third** tab from the tab bar opens it in the pane the editor is in; the other pane
  keeps its tab.

## The other pane

- **Body:** the tab drawn with the export renderer, in the viewer's appearance, with the document's
  Plan items and the tab's photos, on the tab's own paper and pattern (in the mode it opens in
  here), laid out in canvas space exactly as the editor lays it out. On opening it is fitted to the
  pane (never enlarged past 125%) and stays fitted as the tab grows until the person moves it.
- **Moving around:** scroll pans; Ctrl or Cmd + scroll (and a trackpad pinch) zooms about the
  pointer (5% to 400%).
- **Chrome:** a chip at the top left names the tab with its mode icon and a **Live** badge. No
  hint covers the drawing: the editor follows the pointer here, so the pane needs no instructions.
  Its buttons live on the seam (below).
- **Live:** an edit to the tab, by anyone, redraws it at a deferred priority, so it never competes
  with the editor. A drawing that grows up or left keeps every element where it was.
- **States:** _Loading name…_ while a never-opened tab's content is fetched (it is fetched as soon
  as it is placed, or when its drag starts); _Couldn't load name. Click to try again._ when that fetch
  fails (clicking in loads it as the editor does, with its Retry); _Nothing on this tab yet. Click to
  start on it._ for an empty tab. Resting the pointer here never moves the editor while a text field
  has focus.

## Closing, and tab changes

- **Close** (on the seam, or in the tab menu) slides the other pane out and gives the editor
  the whole window, on the tab it was on.
- If either tab of the split is deleted (by anyone), the split closes.
- The tab in the other pane has a small side-by-side mark and a dashed brand outline on its pill.

## Presence

Someone working side by side has two tabs on screen, so they show on **both** tabs' pills in
everyone's tab bar (and on their own): online on whichever tab the viewer is on, away elsewhere, as
for one tab. The tab they edit travels as `tab-focus`'s `tabId`, as ever; the other pane's tab
rides the same op as an optional `besideTabId`. The room remembers it with the tab, clamped to the
same length, and echoes it in the presence list so a late joiner sees it too; a `tab-focus` without
it clears it, as does closing the split. Older clients ignore the field.

## The seam

Two buttons sit on the seam, stacked just above the resize grip: **Fit Both Sides** (fits the
editor's canvas and the other pane at once) and **Close Side by Side**. The seam belongs to
neither pane, so reaching for them never moves the editor (as a pointer resting in a pane does),
and the editor's own chrome never covers them. They sit above the separator's hit area, so a click
on them is never taken as a resize.

## Resizing

The seam between the panes is a separator: drag it, or focus it and use the arrow keys (24 px;
96 px with Shift; Home and End for the extremes). Double-click restores halves. The width is a
fraction of the window, remembered once for every document. The editor keeps whatever it was
centred on when its pane opens, closes or is resized.

## How the editor fits in its pane

The editor's surface (canvas, floating panels, tab bar, banners) lays out inside its pane: with a
split showing, its box is a containing block for its `fixed` chrome, and clips, so nothing of it
spills over the other pane. Its menus, popovers and dialogs render to the page body in client
coordinates, so they land where they always do, and the canvas maps the pointer from its own
rectangle, so the editor works the same on either side. In the editor's column spacers of the
header's and the tab bar's heights stand where they were, so its layout is unchanged.

Chrome that sizes itself to the room it has measures the editor's box, not the window
(`apps/live/lib/editor-viewport.ts`: the pane in a split, the window otherwise), and watches that box's size.
The [Toolbar layout](toolbar-layout.md)'s palette strip is the first: in a pane it fits the tiles
a window of the pane's width would, and refits as the divider moves.

## Motion

The other pane arrives from the right when the split opens (250 ms, house ease-out) and leaves the
same way (200 ms). When the editor moves between panes, the canvas holds still and its chrome
(floating panels, the zoom cluster, the Toolbar strip and its menu button) slides 24 px in from the
side it left while fading up (250 ms, house ease-out), so the toolbars read as travelling rather
than blinking. The animation ends on each element's own style (no held end frame), and keeps the
chrome's own arrival fade in its animation list, so lifting it neither snaps a translucent panel nor
replays the fade. The drop ghost and hint slide in (200 ms). All of it collapses under reduced
motion.

## Telemetry

- `Tab` · `Opened` · `SideBySideDrag` | `SideBySideMenu` when a tab is opened beside.
- `Tab` · `Selected` · `SideBySideClick` | `SideBySideHover` when the editor moves to the other pane.
- `Tab` · `Closed` · `SideBySide` when the split is closed.

## Performance

- The other pane, the SVG renderer and the icon catalogues load with the first split; a document
  never split pays nothing for them.
- Rendering a tab's SVG takes ~0.5 ms for 50 elements, ~4 ms for 500 and ~9 ms for 2,000 (measured
  in jsdom). It reruns only when that tab, the appearance or the Plan items change.
- Moving the editor between panes re-renders the editor on the other tab (the same work as a tab
  switch) and mounts the other pane's SVG once.
- The pointer is tracked through the drag at most once a frame; the divider resizes at most once a
  frame.

## Known gaps

- The other pane is drawn by the export renderer, so a few canvas-only details (inline icons in
  some labels, animations, comment badges) appear once the editor moves in.
