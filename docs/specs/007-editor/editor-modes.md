# Editor modes

A general tab is drawn on in one of three **editor modes**: **Diagram**,
**Draw** and **Infographic** (Infographic is an experiment under review). A mode decides which tools and rules are in focus; it never decides
what the tab is. Like a drawing tool that switches between a pixel mode and a
vector mode over the same picture, switching mode keeps every element exactly
where it is and changes only how the next mark is made.

## Domain language

| Term                 | Means                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **tab kind**         | What a tab **is** ([Document](../006-document/document.md)). Reserved for specific uses.                               |
| **editor mode**      | How a general tab is **worked on** right now: `diagram`, `draw` or `infographic` (`EditorMode`).                       |
| **Diagram mode**     | Structured drawing: the palette, shapes, arrows, icons, templates, snapping and guides.                                |
| **Draw mode**        | Freehand whiteboarding: the dock, preset pens, eraser, shape recognition ([Draw mode](../023-draw-mode/draw-mode.md)). |
| **Infographic mode** | Visual pages: A4 pages on the canvas, the palette narrowed to icons, stickers, charts, components, devices and media.  |
| **mode switch**      | The control beside the page switcher that changes the editor mode.                                                     |

- "Whiteboard" names the activity and Draw mode's look, never a tab kind and
  never a type of document.
- "Mode" on its own is ambiguous here (Zen mode, Presentation mode, Power user
  mode); in specs and code say **editor mode**. The interface says **Diagram**,
  **Draw** and **Infographic**.

## Kinds versus modes

- **A tab kind is for a very specific use** whose notation, rules and data are
  its own: the [event-storming board](../021-event-storming/event-storming.md)
  is one. A new kind is added only when a use cannot be served by a mode.
- **Everything else is the general tab** (`kind: 'diagram'`, the default). It
  carries every element type; every mode works on it.
- **Whiteboarding is a mode, not a kind.** `TabKind` is `'diagram' |
'event-storming'`; there is no `'whiteboard'` kind.
- **Content is shared between modes.** A stroke drawn in Draw mode is a
  `freehand` element in Diagram mode too, and a shape placed in Diagram mode
  is there in Draw mode. Nothing is hidden, converted or locked by a switch.

## The mode switch

- **Placement:**
  - **Toolbar layout:** directly beside the menu (hamburger) button, in its
    card at the top left, or inline at the strip's left end where a phone
    puts the button ([Toolbar layout](toolbar-layout.md)).
  - **Floating layout:** in the **Palette** panel's title row, beside its help
    and minimise buttons, **labelled** (the mode's name beside its icon,
    the header has the room). The Palette stays in Draw mode, showing Draw's
    tools ([Draw mode](../023-draw-mode/draw-mode.md#what-a-whiteboard-shows)).
  - Both stay up in Draw mode, so the switch never moves when the mode
    changes.
  - Not in the tab bar or the Explorer.
- **A dropdown chip** (`EditorModeSwitch`): a fixed-width chip showing the
  current mode's icon and a chevron, with its name in the Floating layout, on the faint tint the
  editor's menu-like controls use. A press opens a menu **below** it, hanging
  from the edge with room (left beside the menu button, right in the
  Palette header), with one compact row per mode at the palette dropdowns' size: its
  icon and name, a check on the current mode and **Shift+D** on the row the
  key leads to. Choosing a row switches and closes the menu; Escape or a
  press outside closes it.
  - **No hover card:** it would cover the menu the chip opens.
  - Semantics: a menu button (`aria-haspopup="menu"`, `aria-expanded`) named
    "Editor mode: Diagram", over a `menu` of `menuitemradio` rows; arrow keys
    open it and move within it, wrapping, Home and End jump.
  - The same for everyone, power user mode or not.
- **Two options, one chosen:** Diagram and Draw. Exactly one is active.
- **Switching is instant and lossless:** no dialog, no reload, no change to the
  document; the selection is kept, an in-progress gesture or text edit is
  finished first, and the canvas viewport does not move.
- **Where it is offered:** on general tabs, to anyone who can edit. A view-role
  visitor sees no switch and sees the tab in its opening mode.
- **Not on event-storming boards:** the tab kind keeps its own tools and
  notation, and shows no switch.
- **Zero layout shift:** the switch has a fixed size, and nothing next to it
  moves when the mode changes.
- **Shift+D** toggles between the two modes (with more modes, it moves to
  the next), shown in the switch's menu, `aria-keyshortcuts` and Settings ›
  Keyboard; a switch by key is announced politely ("Draw mode"). It obeys
  the character-key shortcuts setting.
- **Accessible:** reachable by keyboard, its state exposed to assistive
  technology, its text and focus ring at least WCAG 2.2 AA.

## Where the mode lives

- **Per person, per tab.** Each person chooses their own editor mode on each
  tab; switching changes nothing for anyone else. Two collaborators may work
  on the same tab in different modes at once.
- **The tab says what it opens in.** A general tab stores the mode it
  **opens in** (`Tab.opensIn`, `diagram` when absent). A person who has not
  switched on that tab sees it in that mode; the Whiteboard template, Quick
  Start entry and whiteboard imports set it to `draw`.
- **A switch is remembered** for that person and tab, in this browser, and
  wins over the tab's opening mode from then on.
- **Switching never changes the opening mode.**
- **New documents and new tabs open in Diagram.** Whatever mode its creator
  is in, a new document or a tab added from the tab bar (or Quick Start)
  opens in Diagram. Only the template chosen for it changes that: the
  **Whiteboard** opens in Draw (switching its maker there too), an
  **Event Storming** board is always Diagram, and every other template,
  Blank included, opens in Diagram. An import that sets its own opening
  mode wins.
- **Opens in:** the tab menu holds an **Opens in** submenu for editors,
  listing every editor mode (Diagram, Draw) as a radio choice with the
  current one checked. Choosing one sets `Tab.opensIn` for everyone and
  switches the chooser's own mode on that tab to it (remembered like any
  switch), so the choice visibly lands; nobody else's current mode changes.
  Choosing the already-checked mode still switches the chooser to it. The
  submenu lists modes from one catalogue, so a further mode joins it as one
  entry. Not offered on event-storming boards; greyed out on a locked tab.
- **The tab pill shows your mode on it.** Each tab pill leads with the icon
  of the mode this person works in on that tab (the same glyph the mode
  switch and the Opens in choices use), resolved as the canvas resolves it:
  their remembered switch, else the tab's opening mode. It is tinted with the
  tab's theme accent. The switch, Shift+D and Opens in all update it at
  once; a visitor who cannot edit sees the opening mode. An event-storming
  board is always Diagram, so it shows the Diagram icon.

## One look

There is one look, the diagram look, with the whiteboard's best parts merged
into it. **A mode chooses the defaults written into new content and the
backdrop behind it; it never re-colours what is already there.** Every colour
is stored on the element, so collaborators in different modes see the same
element in the same colour.

- **Off-white light canvas.** The Default theme's light canvas is the board's
  off-white (`#fbfaf7`); its dark canvas stays `#0d121a`.
- **Ink is one colour everywhere.** **Ink**, the drawing colour (`#1c1917`
  on a light canvas, `#e2e8f0` on a dark one), is the same on every theme and
  stored by name. Any element can take it: in Draw mode from the pen and
  quick style rows, in Diagram mode as the **eighth swatch, after the theme's
  colours**, in the quick style panel's colour rows and the element menu's
  colour rows.
  - Pen strokes and text with no colour of their own are drawn in Ink, in
    both modes.
  - Shapes keep their theme defaults: a shape added in Diagram mode is filled
    and outlined as today.
- **Draw mode writes Ink, unfilled.** A shape, line or arrow made in Draw mode
  is written with an Ink outline and no fill, so it looks the same in Diagram
  mode and to every collaborator.
- **Marker colours are first-class.** The stock colours (Ink, Blue, Red,
  Orange, Green, Teal, Violet, Pink) are stored by name on any element and
  drawn in the version tuned for **the canvas behind them**, light or dark,
  on every tab, in every export, thumbnail and image the api or MCP renders.
  On the Default theme that canvas follows the viewer's appearance; a theme
  with a fixed canvas keeps its ink readable whichever appearance is on.
- **One backdrop colour in both modes.** The canvas colour is the tab's
  own: its theme's canvas, or the custom background colour when one is set;
  on the Default theme, the off-white or dark canvas.
- **The pattern:** in Diagram mode, the tab's stored pattern, shared by
  everyone. In Draw mode, the person's own: Plain, Dots or Grid as they last
  chose it in Draw mode (synced preferences, Grid until chosen), not stored
  on the tab, so choosing it changes nothing for anyone else.
- **Exports, thumbnails and api or MCP images** use the tab's Diagram
  backdrop: its colour and stored pattern, whoever exports and in whichever
  mode.

## What a mode brings into focus

- **Diagram mode** is the editor as described by
  [Canvas and palette](../008-canvas/canvas-and-palette.md),
  [Toolbar layout](toolbar-layout.md) and the canvas specs.
- **Draw mode** is what the whiteboard was: the dock with its pens, shapes,
  history and settings; the whiteboard's keyboard shortcuts; pen versus touch;
  picking by the drawn line; strokes that stay open; nothing animating in; no guides for pens; shape recognition and the two
  erasers ([Draw mode](../023-draw-mode/draw-mode.md)).
- **What a mode writes, stays.** A rule that shapes content is stored on the
  element when it is made, never read from the mode: a text box made in Draw
  mode **hugs its text** in both modes and for everyone; one made in Diagram
  mode does not. A rule about input (what a click picks, which keys do what)
  follows the person's current mode.
- **A text box's sizing** is one field, `TextElement.sizing`:
  - `'fit'`: the width follows the words up to the wrap width, and the height
    hugs the lines (a text box clicked into place in Draw mode);
  - `'wrap'`: the width is set, and the height hugs the lines (dragged out or
    resized in Draw mode);
  - absent: a fixed box, its text wrapping inside it (Diagram mode).
  - It replaces `autoWidth`: `autoWidth: true` becomes `'fit'`; text on a
    migrated whiteboard without it becomes `'wrap'`, as it hugged there.
- **Entering Draw mode**, by opening a tab or by switching, puts the active
  pen in hand on an empty tab and Select on a tab with content.
- **Infographic mode** is Diagram mode drawn as pages, with the palette
  narrowed (both below); every other rule, tool and shortcut is Diagram mode's.
- **No further cue:** the dock (in place of the palette) and the switch's
  own label say which mode is on; no tint, accent or notice is added.
- **Leaving a mode puts its tool down**, as leaving a whiteboard did: a pen,
  the eraser or an armed shape never carries over into the other mode.

## The palette per mode

Each mode has its own **palette layout**
(`apps/live/components/palette/palette-layouts.ts`): the categories its
palette offers, in order, what each is called there, and which tiles each
holds.

- **Identity is shared, arrangement is per mode.** A category's glyph and its
  default label, blurb and band live in the category catalogue
  (`PALETTE_CATEGORIES`); a tile's identity in the tile catalogue
  (`PALETTE_TILES`). A layout only arranges them, so one tile can sit in
  different categories in different modes, and a category can be renamed,
  re-banded or re-filled for one mode without touching another.
- **A layout entry** names a category and may override its `label`,
  `description` and `band`, and list its `tiles` by id, in order. With no list
  it holds the category's own tiles (`tilesForCategory`), so a layout spells
  out only where a mode differs. `boardOnly` keeps a category to
  event-storming boards.
- **Catalogue categories** (Favourites, My shapes, Icons, Stickers, Tech) are
  bodies with their own content and take no tile list.
- **A body decides presentation only** (a grid, rows with a blurb, the
  Behaviours group browser, Media's and Components' collapsed groups); it
  renders whatever tiles the layout hands it. A category with no body of its
  own, such as Popular, is a tile grid.
- **Every surface reads the layout:** the floating Palette, the Toolbar
  layout's strip, and the Edit Favourites dialog (Diagram's layout, since
  Favourites is Diagram's category).
- Draw mode shows its own tools in place of the palette, so it borrows
  Diagram's layout.

Today the two layouts differ as below. Within the shared categories,
Infographic's **Write** leaves out **Page** (the page is the canvas there) and
**Annotation**, its **Build** leaves out **Mind node**, **Lane** and **Frame**
(they organise a diagram, not a visual page), and its **Components** leaves
out **Entity**; Diagram's
**Media** leaves out the **Embed** group (YouTube, Vimeo, Loom, Figma, Google
Docs, Website), keeping Image and Avatar.

| Category       | Diagram | Infographic |
| -------------- | ------- | ----------- |
| Favourites     | yes     | no          |
| Popular        | no      | yes         |
| Shapes         | yes     | yes         |
| My shapes      | yes     | yes         |
| Write          | yes     | yes         |
| Draw           | yes     | no          |
| Build          | yes     | yes         |
| Components     | no      | yes         |
| Devices        | no      | yes         |
| Event Storming | board   | no          |
| Icons          | yes     | yes         |
| Stickers       | yes     | yes         |
| Tech           | yes     | no          |
| Media          | yes     | yes         |
| Data           | no      | yes         |
| Behaviours     | yes     | no          |

- **The landing category** is Favourites in Diagram mode, **Popular** in
  Infographic mode, and the notation on an event-storming board
  (the layout's `landing`). Switching mode re-lands the palette there, so it
  never shows a category the new mode leaves out.
- **Popular** is twelve tiles an infographic is most often built from, each
  reachable from another category Infographic mode offers, listed in its
  layout entry: Text, Square, Circle,
  Image, Speech bubble, Pie, Bar, Donut, Stat row, Process, Timeline, Callout.
  It is not a category of Edit Favourites.
- Elements already on the canvas are untouched: narrowing the palette only
  changes what is offered to add.

## The pages

Infographic mode draws **A4 pages** on the canvas, in a row, like artboards in
a design tool.

- **The pages** are sheets of paper (white in light chrome, slate-900 in dark)
  with a soft shadow, under every element. The first is centred on the canvas
  origin; each further page sits **96** px (`INFOGRAPHIC_PAGE_GAP`) to the right
  of the one before, every page centred on the row's horizontal axis.
  - **A4** at 96 px per inch: **794 x 1123** in portrait, **1123 x 794** in
    landscape (`A4_SHORT_SIDE`, `A4_LONG_SIDE`,
    `packages/document/src/infographic-page.ts`).
  - The pages are the tab's (`Tab.pages`: `{ id, orientation }[]`, in row
    order), so everyone lays out on the same ones. A tab with no `pages` has one
    page, in its legacy `pageOrientation` (portrait when absent); the legacy
    field is dropped the first time the pages change. At most **20** pages
    (`MAX_INFOGRAPHIC_PAGES`).
- **The surround** is the tab's own canvas: its colour and pattern, and every
  canvas setting, apply behind the pages exactly as in Diagram mode.
- **Each page's name** sits above its top-left corner (**A4 · Portrait**, or
  **Page 2 · A4 · Landscape** once there is more than one), and **its settings
  cog** above its top-right, both held at one screen size at any zoom. The cog
  (tooltip **Page settings**, or **Page 2 settings**) opens a menu under it with
  an **Orientation** heading, **Portrait** / **Landscape** radio rows, and,
  while there is more than one page, **Delete Page**. Escape or an outside
  press closes it. A viewer who cannot edit (a view role, a locked tab) gets no
  cog and no add button.
- **Adding a page:** a round **+** (tooltip **Add page**) sits in the gap's
  width to the right of the last page, on the row's axis. It adds a page after
  the last, in the last page's orientation; it is gone at the limit.
- **Content moves with its page.** Turning or deleting a page moves the pages
  after it; every element whose centre lies on a page that moves (and an arrow's
  free ends) moves with it, re-centred on the page's centre, so a turned page
  keeps its content about its middle. Elements on a deleted page, or on no
  page, stay where they are. Each change is one tab edit (one undo step, synced
  to everyone) (`withInfographicPages`).
- **Turning, adding and deleting animate:** the sheets ease to their new places
  and shapes over 200 ms (none under reduced motion).
- **Centred in the viewport:** entering Infographic mode or opening a tab in it
  fits a square of the long side around the first page
  (`infographicPageFitBox`), so either orientation fits at the same zoom and
  turning it never moves the view. Where the Toolbar layout's strip lies over
  the canvas's top edge, the page centres in the band below it
  (`computeFitBelow`).
- **Only the pages are drawn on.** A draw, tap-to-place or double-click-to-add
  that starts off every page is ignored (`pressIsOffPage`); elements already on
  the canvas still move freely, on or off the pages.
- **Elements are cut off at the page edges.** Whatever part of an element hangs
  off a page is hidden and cannot be pressed, as if the pages were the only
  paper (`InfographicPageClip`, a layer clipped to the pages that holds the
  element views). The selection handles are drawn above it, so an element
  hanging off a page still shows all of them. Not in the isometric view, whose
  3D stack a clip would flatten.
- **The sheets are a view, never elements.** They take no pointer events (a
  press on one is a press on the empty canvas); exports and thumbnails see the
  tab's own backdrop and the elements whole.
- The sheets are `apps/live/components/canvas/InfographicPages.tsx`; the pages'
  edits and the centring are `apps/live/hooks/editor/useInfographicPage.ts`.

## Experimental modes

Infographic mode is an experiment, offered only once **Settings ›
Experimental › Infographic Mode** is on (off by default; the
`infographicModeEnabled` preference). The **Experimental** category is listed
after **AI Tools**.

- While it is off, Infographic is offered nowhere: not on the mode switch, not
  in Opens in, and Shift+D skips it (`apps/live/lib/offered-editor-modes.ts`).
- A tab stored as opening in Infographic, or remembered in it, opens in Diagram
  for a person who has it off. Nothing stored changes.
- Turning it on fires `UI` · `Toggled` · `InfographicModeOn` (and `…Off`).

## Existing whiteboards

- A stored tab with `kind: 'whiteboard'` reads as a general tab that opens in
  Draw mode. Its elements, background and layers are unchanged.
- Imports that landed on a whiteboard (Excalidraw, Microsoft Whiteboard) land
  on a general tab in Draw mode.
- The **Whiteboard** template and Quick Start entry create a general tab that
  opens in Draw mode.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- `Editor` · `Changed` · `ModeDiagram` / `ModeDraw` / `ModeInfographic`, fired by
  the switch before the mode applies.
- `Tab` · `Changed` · `OpensInDiagram` / `OpensInDraw` / `OpensInInfographic`, fired
  by Opens in.
- `Tab` · `Changed` · `PagePortrait` / `PageLandscape`, fired by a page's
  orientation in Infographic mode, and `PageAdded` / `PageRemoved` by its add
  button and Delete Page.
- Draw mode's own events are the **`Draw`** category (pens, shapes, eraser,
  recognition, background, snap colours,
  [Draw mode](../023-draw-mode/draw-mode.md#telemetry-telemetry--public-transparency-dashboard)).
  It was named `Whiteboard`; the stored history is rewritten to `Draw` so the
  dashboard's lines continue.

## Naming in the interface

- The mode is **Draw** on the switch and in Settings, where it names the
  **Editor › Draw** sub-category (Dock Position) as the switch names it, and
  **Draw mode** in prose: the help article (**Draw mode**, at a new address,
  the old one redirecting) and the command palette.
- The template and Quick Start card stays **Whiteboard**: it names the
  activity a person comes for, and creates a tab that opens in Draw mode.

## Non-goals

- Further editor modes beyond Infographic until use asks for one.
- A mode per element or per layer.
- Converting content between modes (a stroke into a shape on switching).

## References

[Document](../006-document/document.md), [Draw mode](../023-draw-mode/draw-mode.md),
[Event storming](../021-event-storming/event-storming.md),
[Toolbar layout](toolbar-layout.md), [Zen mode](zen-mode.md).
