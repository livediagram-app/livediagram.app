# Editor modes

A general tab is drawn on in one of four **editor modes**: **Diagram**,
**Draw**, **Illustrate** and **Plan**. A mode decides which tools and rules are in focus; it never decides
what the tab is. Like a drawing tool that switches between a pixel mode and a
vector mode over the same picture, switching mode keeps every element exactly
where it is and changes only how the next mark is made.

## Domain language

| Term                | Means                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **tab kind**        | What a tab **is** ([Document](../006-document/document.md)). Reserved for specific uses.                                              |
| **editor mode**     | How a general tab is **worked on** right now: `diagram`, `draw`, `illustrate` or `plan` (`EditorMode`).                               |
| **Diagram mode**    | Structured drawing: the palette, shapes, arrows, icons, templates, snapping and guides.                                               |
| **Draw mode**       | Freehand whiteboarding: the dock, preset pens, eraser, shape recognition ([Draw mode](../023-draw-mode/draw-mode.md)).                |
| **Illustrate mode** | Pages on the canvas, of two kinds: infographic pages to lay out and article pages to write ([Illustrate pages](illustrate-pages.md)). |
| **Plan mode**       | Boards of items: Plan boards, cards, the item panel ([Plan mode](../026-plan/plan-mode.md)).                                          |
| **mode switch**     | The control beside the page switcher that changes the editor mode.                                                                    |

- "Whiteboard" names the activity and Draw mode's look, never a tab kind and
  never a type of document.
- "Mode" on its own is ambiguous here (Zen mode, Presentation mode, Power user
  mode); in specs and code say **editor mode**. The interface says **Diagram**,
  **Draw** and **Illustrate**.

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
    card at the top left ([Toolbar layout](toolbar-layout.md)).
  - **Not on a phone.** A phone's top row belongs to the strip, so its menu card holds the menu
    button alone. A phone switches mode from the tab menu's **Opens in** (below), which switches
    the chooser too; Shift+D needs a keyboard. The tour's Diagram & Draw step is skipped there.
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
- **One mode chosen:** Diagram, Draw, Illustrate or Plan.
  Exactly one is active.
- **Switching is instant and lossless:** no dialog, no reload, no change to the
  document; the selection is kept, an in-progress gesture or text edit is
  finished first, and the canvas viewport does not move.
- **Where it is offered:** on general tabs, to anyone who can edit. A view-role
  visitor sees no switch and sees the tab in its opening mode.
- **Not on event-storming boards:** the tab kind keeps its own tools and
  notation, and shows no switch.
- **Zero layout shift:** the switch has a fixed size, and nothing next to it
  moves when the mode changes.
- **Shift+D** moves to the next mode, wrapping round, shown in the switch's menu, `aria-keyshortcuts` and Settings ›
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
- **An editor's switch moves the opening mode with it**, so a tab's **Opens in** always matches
  the mode its editors last worked in: on a general, unlocked tab, a switch by someone who may edit
  also sets `Tab.opensIn` (a consequence of the switch, with no undo step of its own), synced to
  everyone. Nobody else's current mode changes (each person's mode on the tab is pinned once it
  opens). A visitor's switch, a locked tab and an event-storming board leave it be.
- **New documents and new tabs open in Diagram.** Whatever mode its creator
  is in, a new document or a tab added from the tab bar (or Quick Start)
  opens in Diagram, **except from Plan**: a tab added while its maker is in Plan mode opens in Plan
  (its `opensIn` is Plan, for everyone) with no Quick Start, showing Plan's own **Start with a Board**
  picker ([Plan mode](../026-plan/plan-mode.md#starting-a-board)), whose **Open Quick Start** button
  brings the Quick Start back for another kind of tab. Only the template chosen for it changes that: the
  **Whiteboard** opens in Draw (switching its maker there too), an
  **Event Storming** board is always Diagram, and every other template,
  Blank included, opens in Diagram. An import that sets its own opening
  mode wins.
- **Opens in:** the tab menu holds an **Opens in** submenu for editors,
  listing every editor mode (Diagram, Draw, Illustrate, Plan) as a radio choice with the
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
- **Illustrate mode** is Diagram mode drawn as pages, with the palette
  narrowed (both below); every other rule, tool and shortcut is Diagram mode's.
- **Plan mode** is Diagram mode with the palette narrowed to boards and
  cards, and Plan boards taking input as a planning tool
  ([Plan mode](../026-plan/plan-mode.md)).
- **Each mode's mark**: Diagram a flowchart (two steps joined), Draw a marker,
  Illustrate a page with a little chart above two lines of writing (its two
  page kinds), Plan a board of three columns with a raised card; the same glyph on the switch, Opens in and the tab pill.
- **No further cue:** the dock (in place of the palette) and the switch's
  own label say which mode is on; no tint, accent or notice is added.
- **Leaving a mode puts its tool down**, as leaving a whiteboard did: a pen,
  the eraser or an armed shape never carries over into the other mode. A mode's tool can still
  be **picked up** in another on purpose: the Toolbar strip's Search offers Draw mode's markers
  in Diagram, Illustrate and Plan ([Toolbar layout](toolbar-layout.md#search-every-element-type)),
  and one picked there is put down by a switch like any other.

## The tool a mode starts with

- Every mode starts on **Select**, except **Plan**, which starts on **Hand** (a board's cards take the pointer
  themselves). On a phone every mode starts on **Hand**, so a drag moves the canvas.
- The tool is picked whenever the mode changes, the first mode a tab opens in included; any tool can be picked
  after. An embedded viewer always starts on Hand.
- Plan leaves **Eraser** and **Format** out ([Plan mode](../026-plan/plan-mode.md#tools)).
- Any tab switches into and out of Plan with everything on it kept: a board outside Plan is an element like any
  other ([Plan mode](../026-plan/plan-mode.md#switching-modes-keeps-the-tab)).

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
- **Catalogue categories** (My shapes, Icons, Stickers, Tech) are
  bodies with their own content and take no tile list.
- **A body decides presentation only** (a grid, rows with a blurb, the
  Behaviours group browser, Media's and Components' collapsed groups); it
  renders whatever tiles the layout hands it. A category with no body of its
  own, such as Popular, is a tile grid.
- **Every surface reads the layout:** the floating Palette, the Toolbar
  layout's strip (the Toolbar layout's).
- Draw mode shows its own tools in place of the palette, so it borrows
  Diagram's layout.

Today the two layouts differ as below. Within the shared categories,
Illustrate's **Write** leaves out **Page** (the page is the canvas there) and
**Annotation**, its **Build** leaves out **Mind node**, **Lane** and **Frame**
(they organise a diagram, not a visual page), and its **Components** leaves
out **Entity**; Diagram's
**Media** leaves out the **Embed** group (YouTube, Vimeo, Loom, Figma, Google
Docs, Website), keeping Image and Avatar.

| Category       | Diagram | Illustrate | Plan |
| -------------- | ------- | ---------- | ---- |
| Popular        | yes     | yes        | no   |
| Plan's seven   | no      | no         | yes  |
| Shapes         | yes     | yes        | no   |
| My shapes      | yes     | yes        | no   |
| Write          | yes     | yes        | no   |
| Draw           | yes     | no         | no   |
| Build          | yes     | yes        | no   |
| Components     | no      | yes        | no   |
| Devices        | no      | yes        | no   |
| Event Storming | board   | no         | no   |
| Icons          | yes     | yes        | no   |
| Stickers       | yes     | yes        | no   |
| Tech           | yes     | no         | no   |
| Media          | yes     | yes        | no   |
| Data           | no      | yes        | no   |
| Behaviours     | yes     | no         | no   |

Plan offers only its own seven categories (Cards, Boards, Widgets, Metrics,
Visualisations, Content and Tools) and opens on Cards
([Plan mode](../026-plan/plan-mode.md#the-palette)).

- **The landing category** is the mode's **Popular** (Plan's is **Cards**), and the notation on an
  event-storming board
  (the layout's `landing`). Switching mode re-lands the palette there, so it
  never shows a category the new mode leaves out.
- **Popular** is the landing category of every mode but Plan: twelve tiles that mode is most
  often built from, listed in its layout entry, fixed (not edited or
  reordered). It replaced the per-browser **Favourites**
  ([Palette Favourites](../010-palette/palette-favourites.md), removed).
  - **Diagram**: Square, Circle, Diamond, Text, Arrow, Frame, Sticky note,
    Image, Shape pen, Table, Code block, Entity (what were the default
    Favourites).
  - **Illustrate**: Text, Square, Circle, Image, Speech bubble, Pie, Bar,
    Donut, Stat row, Process, Timeline, Callout, each also reachable from
    another category the mode offers.
- Elements already on the canvas are untouched: narrowing the palette only
  changes what is offered to add.

## The pages

Illustrate mode draws **pages** on the canvas, in a row, like artboards in
a design tool. What a page is and offers (sizes, backgrounds, layouts, page
actions, snapping, export, laying content out into pages, page slides) is
[Illustrate pages](illustrate-pages.md); this section is the basics.

- **The pages** are sheets of paper (white in light chrome, slate-900 in dark)
  with a soft shadow, under every element. The first is centred on the canvas
  origin; each further page sits **96** px (`ILLUSTRATE_PAGE_GAP`) to the right
  of the one before, every page centred on the row's horizontal axis.
  - A page is **A4** unless it has a size of its own: at 96 px per inch,
    **794 x 1123** in portrait, **1123 x 794** in landscape (`A4_SHORT_SIDE`,
    `A4_LONG_SIDE`, `packages/document/src/illustrate-page.ts`); the other
    sizes are in [Illustrate pages](illustrate-pages.md) "Sizes".
  - The pages are the tab's (`Tab.pages`: `IllustratePage[]`, in row
    order), so everyone lays out on the same ones. A tab with no `pages` has one
    page, in its legacy `pageOrientation` (portrait when absent); the legacy
    field is dropped the first time the pages change. At most **100** pages
    (`MAX_ILLUSTRATE_PAGES`).
- **The surround** is the tab's own canvas: its colour and pattern, and every
  canvas setting, apply behind the pages exactly as in Diagram mode.
- **Each page's label** sits above its top-left corner (**A4 · Portrait · Infographic**, or
  **Page 2 · A4 · Landscape · Article** once there is more than one, or its name), and
  **its settings cog** above its top-right, both held at one screen size at any
  zoom. The cog (tooltip **Page settings**, or **Page 2 settings**) opens the
  **page panel** ([Illustrate pages](illustrate-pages.md) "The page panel").
  A viewer who cannot edit (a view role, a locked tab) gets no cog and no add
  button.
- **Adding a page:** a round **+** (tooltip **Add page**) sits in the gap's
  width to the right of the last page, on the row's axis. It opens **Add a
  page**, choosing the new page's kind ([Illustrate pages](illustrate-pages.md)
  "Page kinds"); the page goes after the last; the + is gone at the limit,
  and the view then frames the new page.
- **Content moves with its page.** Turning, resizing, moving or deleting a page
  moves the pages after it; every element whose centre lies on a page that
  moves (and an arrow's free ends) moves with it, re-centred on the page's
  centre (`withIllustratePages`); on an article page it keeps its place from
  the page's top-left corner, where the writing starts. A deleted page takes its content with it; a
  turned or resized page re-fits its own content
  ([Illustrate pages](illustrate-pages.md) "Sizes"). Elements on no page stay
  where they are. Each change is one tab edit (one undo step, synced to
  everyone).
- **Turning, adding and deleting animate:** the sheets ease to their new places
  and shapes over 200 ms (none under reduced motion).
- **Centred in the viewport:** entering Illustrate mode or opening a tab in it
  fits a square of the long side around the first page
  (`illustratePageFitBox(page)`), so either orientation fits at the same zoom and
  turning it never moves the view. Where the Toolbar layout's strip lies over
  the canvas's top edge, the page centres in the band below it
  (`computeFitBelow`).
- **Only the pages are drawn on.** A draw, tap-to-place or double-click-to-add
  that starts off every page is ignored (`pressIsOffPage`); elements already on
  the canvas still move freely, on or off the pages.
- **Elements are cut off at the page edges.** Whatever part of an element hangs
  off a page is hidden and cannot be pressed, as if the pages were the only
  paper (`IllustratePageClip`, a layer clipped to the pages that holds the
  element views). The selection handles are drawn above it, so an element
  hanging off a page still shows all of them. Not in the isometric view, whose
  3D stack a clip would flatten.
- **The sheets are a view, never elements.** They take no pointer events (a
  press on one is a press on the empty canvas). Thumbnails see the tab's own
  backdrop and the elements whole; the Export dialog in Illustrate mode exports
  the pages ([Illustrate pages](illustrate-pages.md) "Export").
- The sheets are `apps/live/components/canvas/IllustratePages.tsx`; the pages'
  edits and the centring are `apps/live/hooks/editor/useIllustratePages.ts`.

## Leaving Illustrate

Diagram and Draw show no pages, so an editor's switch away from Illustrate on a tab that has
something on it asks first:

- **A tab with articles** asks Turn Articles Into Pages? (Convert, Keep as Articles, Cancel;
  [Article pages](article-pages.md#leaving-illustrate)).
- **A tab with content but no articles** asks a lighter question: a small card hanging from the
  mode switch that asked (the Palette header's chip or the Toolbar layout's), pointing at it, below
  it or above when there is no room below. A warning glyph in an amber disc, the title "Switch to
  <Mode>?" and one sentence: "<Mode> mode doesn't show pages. Changes you make there may not fit
  back onto your pages when you return to Illustrate." Its buttons are **Cancel** and **Switch** (the
  target mode's glyph on it, focused). Escape or a press outside stays.
  With no switch on screen (zen, a Shift+D press), the card sits centred near the top of the
  screen.
- An empty tab, a visitor or a locked tab switches straight away.
- Confirming sends `Editor` · `Changed` · `LeaveIllustrateConfirmed`, beside the switch's own
  `ModeDiagram` / `ModeDraw`.

## Every mode, always offered

Every mode of the catalogue is offered to everyone: the mode switch, Opens in,
Shift+D and the template picker's mode filter always list all four, and a tab
always opens in the mode it is stored or remembered in.

Illustrate and Plan each had a switch in **Settings › Experimental** while they
were new. Both graduated on 2026-10-06, and the **Experimental** category went
with them. Their `illustrateModeEnabled` and `planModeEnabled` preferences are
retired keys ([User preferences](user-preferences.md) "Retired keys"), so a
person who had switched either off sees it again. Their `UI` · `Toggled` ·
`IllustrateMode{On,Off}` / `PlanMode{On,Off}` events are retired from the
dashboard ([Telemetry](../017-telemetry/telemetry.md) "Retired features").

## Existing whiteboards

- A stored tab with `kind: 'whiteboard'` reads as a general tab that opens in
  Draw mode. Its elements, background and layers are unchanged.
- Imports that landed on a whiteboard (Excalidraw, Microsoft Whiteboard) land
  on a general tab in Draw mode.
- The **Blank Whiteboard** template (kind id `whiteboard`) and Quick Start entry create a
  general tab that opens in Draw mode, as the other Draw templates do
  ([Templates by mode](templates-by-mode.md)).

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- `Editor` · `Changed` · `ModeDiagram` / `ModeDraw` / `ModeIllustrate` / `ModePlan`, fired by
  the switch before the mode applies.
- `Tab` · `Changed` · `OpensInDiagram` / `OpensInDraw` / `OpensInIllustrate` / `OpensInPlan`, fired
  by Opens in.
- `Tab` · `Changed` · `PagePortrait` / `PageLandscape`, fired by a page's
  orientation in Illustrate mode, and `PageAdded` / `PageRemoved` by its add
  button and Delete Page.
- Draw mode's own events are the **`Draw`** category (pens, shapes, eraser,
  recognition, background, snap colours,
  [Draw mode](../023-draw-mode/draw-mode.md#telemetry-telemetry--public-transparency-dashboard)).
  It was named `Whiteboard`; the stored history is rewritten to `Draw` so the
  dashboard's lines continue.
- Illustrate mode's events were named for Infographic mode (`ModeInfographic`,
  `OpensInInfographic`, `InfographicModeOn` / `Off`); migration
  `0066_illustrate_telemetry.sql` rewrites the stored history to the Illustrate
  names so the dashboard's lines continue.

## Naming in the interface

- The help article **Editor Modes** (`/help/canvas/editor-modes/`) explains all four modes, the
  switch and Opens in, and links to each mode's own article.
- The mode is **Draw** on the switch and in Settings, where it names the
  **Editor › Draw** sub-category (Dock Position) as the switch names it, and
  **Draw mode** in prose: the help article (**Draw mode**, at a new address,
  the old one redirecting) and the command palette.
- The template and Quick Start card is **Blank Whiteboard**, one of four blanks (Blank Diagram,
  Blank Whiteboard, Blank Illustration), one per mode, that lead Popular
  ([Templates by mode](templates-by-mode.md)); the document it makes is named "Untitled
  Whiteboard", for the activity a person comes for.
- **Illustrate** was called **Infographic** while its pages were all
  infographics. Every stored trace of the old name reads as Illustrate:
  `opensIn: 'infographic'`, a remembered mode, a recorded creation intent and
  a create's intent (`parseEditorMode`), a default-folder key
  `mode:infographic` (`parsePlacementDefaultKey`; clearing the default clears
  both names). Nothing stored is rewritten. The `infographicModeEnabled`
  preference went with Illustrate's Settings switch (a retired key). "Infographic" now
  names a kind of page ([Illustrate pages](illustrate-pages.md) "Page kinds").
  The help articles moved to `/help/canvas/illustrate/`, the old addresses
  redirecting.

## Non-goals

- Further editor modes beyond Illustrate until use asks for one.
- A mode per element or per layer.
- Converting content between modes (a stroke into a shape on switching).

## References

[Document](../006-document/document.md), [Draw mode](../023-draw-mode/draw-mode.md),
[Event storming](../021-event-storming/event-storming.md),
[Toolbar layout](toolbar-layout.md), [Zen mode](zen-mode.md).
