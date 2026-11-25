# Sidebar width

The left sidebars the editors dock down the canvas (Pages mode's **Contents** sidebar in livedocuments and livedesign,
each product's `docs/specs/007-editor/pages-mode.md` "Contents"; liveknowledge's **page tree**,
`liveknowledge/docs/specs/030-knowledgebase/knowledgebases-and-pages.md` "The page tree") share one rule for how wide
they are: a default that grows on wide windows, and an edge the person can drag. Each sidebar names its own base
width; everything else is this page's, in `@liveworkspace/workbench`, so no product keeps a copy.

A fixed width cut long page names off on every window, even where a 1920 px screen had room to spare (Work Tracker
1439). The owner chose both halves on 2026-11-25: the default grows, and people can drag the edge, remembered.

## The default

- Up to 1,439 px of window the sidebar keeps its base width (Contents 236 px, the page tree 264 px), as it always had.
- From 1,440 px it steps up: at least **272 px** from 1,440, **296 px** from 1,520 and **320 px** from 1,600 px on.
  A sidebar whose base is already wider than a step keeps its base there (the page tree is 264 at 1,280, 272 at 1,440).
- It changes in those steps only, when the window crosses one, never on every pixel of a window being resized: the
  steps are media queries, so the list reflows at most three times across the whole range.
- The steps are chosen so liveknowledge's page rail still docks where it did (it needs the tree, the rail and a 760 px
  column side by side): 272 + 312 + 856 fits 1,440, and 320 + 312 + 856 fits 1,600.
- Widths are at the panels' UI scale, as every chrome width is: at 125% the 320 px sidebar is 400 px on screen.

## Resizing

- The sidebar's right edge is a **resize handle** on a desktop with a mouse or a trackpad. Dragging it sets the width
  live, between **200 px** and **480 px**; the canvas chrome beside it (the menu box joined to its head, the left corner
  stacks, the bottom-right cluster's left bound, a photo page's flyout) follows as it moves. Contents' pictures and
  the page framed beside it wait for the drag to end, then the page in view is framed again beside the new width, so
  a drag never reflows every picture each frame and the sidebar never ends up over the page. The same reframing
  follows any settled change: a window step crossed, the first paint, a key, a reset.
- **Double-click** the handle to go back to the default for the window (the steps above), forgetting the chosen width.
- **Keyboard**: the handle is a focusable vertical `separator` named "Resize Contents" or "Resize Pages", with its
  value, minimum and maximum. Left and Right Arrow narrow or widen it by 8 px (32 px with Shift), Home and End go to
  the minimum and the maximum, and Enter resets it to the default.
- **Escape** during a drag puts the width back to where the drag began, wherever the focus is (pressing the handle
  does not move the focus).
- It shows a resize cursor, and on hover (after a short pause, so a pointer passing over the edge does not flash it)
  or keyboard focus a 2 px brand line down the edge, in light and in dark. While dragging, the line stays and the
  whole page wears the resize cursor, with text selection off.
- The handle's tooltip names it ("Resize Pages"), after the usual hover pause; its description for a screen reader
  says what it does: "Drag to resize. Double-click to reset."
- The chosen width is kept in this browser, per sidebar (`localStorage`), so each person keeps their own on each
  device: a width that suits a 2,560 px monitor is not forced onto a laptop. A width kept outside 200 to 480 px (an
  older build, a hand edit) is clamped on read.
- Who may resize: everyone who sees the sidebar, Editor, Participant and Viewer alike. It changes only how this
  browser draws the sidebar, never the item, so no share role gates it.

## What stays as it was

- A phone has no docked sidebar (Contents is a button, the page tree a sheet), so neither the default nor the handle
  reaches it.
- A touch-only device (no hover, a tablet) has no handle: there is no pointer to aim at a 6 px edge. Its sidebar still
  takes the default for its window.
- The page tree's collapsed rail keeps its 48 px and has no handle; the tree peeking out over the page from the rail
  is drawn at the person's width.

## Cut-off names

- A name still too long for the sidebar ends in an ellipsis and shows its full title in a tooltip: after the usual
  hover pause over the name, and at once when its row takes keyboard focus. In Contents the name stands above the
  row's stretched button, so the pointer reaches it; a press on it still opens the page. A name shown whole gets no tooltip.
- Contents' film pictures and names fill the sidebar's width: a wider sidebar draws larger pictures and longer names,
  the way a slide editor's filmstrip does.
