# The tab window

## What

A **Tab Window**: an element that shows another tab of the same document, live, fitted inside it. Build a diagram
on its own tab, put a window onto it on a slide, and the slide follows every change to the diagram. A
`shape: 'tab-window'` holding the tab it shows in `windowTabId`.

## Why

A deck explains the work done on the document's other tabs: the architecture, the flow, the board. Copying those
elements onto a slide makes a second copy that goes stale the moment the diagram changes, and someone has to
remember to paste it again. A window is one source of truth: the diagram is edited where it lives and every slide
showing it is up to date.

## The element

- **What it shows** (`windowTabId`): one tab of the document, never the tab the window is on. A Plan tab (a Board,
  Sheet or Dashboard tab, or any tab in Plan mode) is offered like any other. Absent until chosen.
- **The drawing**: the tab's content drawn as the editor shows it (the export renderer, in this person's appearance,
  the tab's own theme, its photos and the document's cards), **zoomed to fit** inside the window on the tab's own
  canvas, centred, never cropped: its paper and its pattern (dots, grid, lines, at the tab's pattern size and
  opacity), as the editor paints them for that tab in its mode, at the drawing's zoom and lined up with it, filling
  the window edge to edge, so the window reads as that tab and not as a picture on a blank card. A Plan tab is drawn
  as laid out, as its image export draws it: its cards, its Sheets' cells and its plan views' pictures. A **Pages**
  tab is drawn as its pages, where they lie on the canvas, each as its page export draws it (its sheet, its
  background, its article writing and what reaches onto it, cut at its edges), on the desk between them; an article's
  writing is the editor's own where that article is laid out, else as estimated without a browser (the agents'
  previews' estimate). A **Form** tab is drawn as its form on its tab's look, as respondents see it (the picture its
  thumbnail and an agent's preview draw). Every mode is drawn: Diagram, Draw, Workshop (its timer and vote are live
  session tools, never drawn), Event Storming, Pages and Plan. It follows every change to the tab (an edit, a
  collaborator's) at a deferred priority, so a burst of edits never competes with the canvas.
- **Moving**: the drawing moves as the tab does on the canvas. Each shown element's animation plays in the window
  with its own Speed and Repeat, by the same motion the canvas draws: the Shape set's motions (Blink, Heartbeat,
  Breathe, Bounce, Wobble, Shake, Jelly, Float, Swing) and swells (Shimmer, Highlight), a sticky's Flutter, Sway,
  Wiggle and Drop, a photo's Develop, Focus, Wipe and Iris, a drawing's Glow, and every arrow flow that runs along
  its line (all but Dots and Comet). The animations that need the canvas's own pieces (a Pulse ring, a Glow halo, a
  Trace light or a Gradient sheet, a sticky's Peel, Lift and Slap, letters that type or ripple, a table's cells, a
  photo moving inside its frame, a chart's, icon's, progress bar's or rating's own motion, a travelling dot) show
  their rest frame, as every export does. Loops run on one clock, so an edit on the shown tab redraws the window
  without restarting them. Reduced Motion stills the drawing, as it stills the canvas. A window off screen holds
  its drawing still until it is back in view.
- **Still to the touch**: the drawing never scrolls, zooms or takes a click of its own; the window is an ordinary
  element (select, move, resize, copy, layer, lock, delete).
- **Its frame**: rounded corners (12 px) and a hairline in the element's stroke (the theme's hairline when unset);
  a Stroke and Opacity change it like any shape. Its fill is the shown tab's paper; it takes no label.
  Under a hand-drawn finish (Marker, Sketch) the frame's line wobbles into the box, so the drawing sits 6 px inside
  it, clear of the line, with the window's fill around it; nothing the tab shows ever reaches past its frame.
- **A window inside the tab it shows** (a slide showing a tab that itself holds a window) is drawn as its **frame
  named for its tab**, never the tab inside it, so windows can never recurse.
- **Default size**: 640 by 360 (16:9); it resizes like any element, its words and buttons growing with it.

## States

| State                                                  | The window shows                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| No tab chosen                                          | "Show a tab here" with **Choose a Tab** (an Editor); "No tab chosen" (anyone else) |
| The tab's content on its way                           | "Loading <name>…"                                                                  |
| Its fetch failed                                       | "Couldn't load <name>." with **Retry**                                             |
| Loaded with nothing on it (no elements, pages or form) | "Nothing on <name> yet."                                                           |
| The tab deleted, or not shared with this person        | "This tab isn't available." with **Choose a Tab** (an Editor)                      |
| Loaded                                                 | The drawing                                                                        |

A tab's content arrives only when it is opened or fetched (per-tab storage), so a window asks for its tab's content
as it is shown, as a Dashboard's Diagram slot does. A fetch of that tab already under way elsewhere (the visit-time
load, the side pane, an export, the search sweep) is waited for, not repeated, and the window shows how it ended:
the drawing, or "Couldn't load" with **Retry**. Nothing asks again on a timer. **Retry** shows Loading until it
settles, also for a tab the editor's own visit failed on, and a tab that then loads clears that failure everywhere.
A tab the person may not see is never fetched or drawn: the window says it is not available rather than leaking it.

## Choosing the tab

**Choose a Tab** (the empty window's button, and the menu's **Tab Window** section, offered only where the session
may edit and the window is not locked) opens a list of the tabs a window
may show, in tab-bar order, each its mode icon and name, the current one marked. A press shows that tab (one edit,
one undo). With no tab to offer it says "No other tab to show yet." The list follows the tab bar live (a tab added,
renamed or deleted).

## Opening the tab

**Open <name>** goes to the shown tab: a button in the window's top-right corner while it is hovered or selected,
and the menu's Tab Window section. Opening is navigation, so it is everyone's who can see the tab.

## Copying the document

A copy of the whole document (Make a Copy, the Explorer's Duplicate, a Drive import) gives
its tabs fresh ids and re-points each window at the copy's own tab, as tab links are (`remapTabLinks`), so the copy's
windows show the copy rather than "This tab isn't available".

## Exports

A PDF, PNG or SVG export draws each window's tab inside it, fitted, as on screen: the export fetches each shown tab's
content and photos first, waiting for a fetch already under way rather than drawing the tab's empty placeholder. It
fetches every tab a window shows, a Plan tab included. A Pages tab draws as its pages and a Form tab as its form, as on
screen. A Board or Dashboard tab draws laid out, as on screen; a Sheet's cells and a Dashboard's figures from Sheets
are not read for a window in an export, so a Sheet draws its frame and headers alone and a figure its placeholder. A window inside a shown tab is drawn as its frame (no recursion). Ids inside a shown tab's
drawing are prefixed per window, so its gradients, patterns and markers never collide with the page's. Thumbnails
(Contents, the Slide Deck, layouts) and the API's tab render draw the frame, named for its tab where the caller
knows it, else "Tab Window".

## Palette

| Mode     | Where                                                 |
| -------- | ----------------------------------------------------- |
| Pages    | **Media**: Tab Window, after Image, before the embeds |
| Diagram  | none (Search still finds and places it)               |
| Draw     | none                                                  |
| Workshop | none                                                  |
| Plan     | none                                                  |

A window placed or pasted on any tab still draws there.

## The menu

A **Tab Window** section in the menu's **Tools**, closed until opened: **Shows** (the tab list above) and
**Open <name>**.

## Share roles

| Role        | May                                                                    |
| ----------- | ---------------------------------------------------------------------- |
| Editor      | Place, choose the tab, move, resize, restyle, delete                   |
| Participant | Look, and open the shown tab; cannot place one or change what it shows |
| Viewer      | Look, and open the shown tab                                           |

Gated on the session's `can` (`edit` for choosing the tab), never on read-only alone.

## Cost

- Each window renders its tab once per change to that tab, at a deferred priority, and never while the tab is
  unchanged. The renderer loads only once a window is on screen.
- The drawing is one inline SVG: its node count is the shown tab's, so a window onto a very large tab costs the page
  what that tab costs the export.
- Nothing runs per frame; moving or resizing a window only re-lays its frame.

## Telemetry

`Element · Added · TabWindow` (as any palette tile); `Element · Changed · TabWindowTab` on choosing a tab;
`UI · Used · TabWindowOpen` on opening it. Never a tab name.

## Agents

The REST API and the MCP server take `tab-window` with `windowTabId` (a tab id of the same document). An agent
building a deck puts a window onto the tab it drew the diagram on rather than copying the diagram.

## Non-goals

- Panning or zooming inside a window, or showing a region of a tab: a window shows the whole tab, fitted.
- Editing the shown tab through the window: it opens the tab instead.
- Showing a tab of another document.

## Element tour

The **Tab Window tour** is offered beside the first tab window a person selects, as an Editor on an unlocked element, and walks through it on the element
itself ([Element tours](../007-editor/element-tours.md) "The Tab Window tour").
