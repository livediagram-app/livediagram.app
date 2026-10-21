# Editor modes

A general tab is drawn on in one of five **editor modes**: **Diagram**,
**Draw**, **Workshop**, **Pages** and **Plan**. A mode decides which tools and rules are in focus; it never decides
what the tab is. Like a drawing tool that switches between a pixel mode and a
vector mode over the same picture, switching mode keeps every element exactly
where it is and changes only how the next mark is made.

## Domain language

| Term              | Means                                                                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **tab kind**      | What a tab **is** ([Document](../006-document/document.md)). Reserved for specific uses.                                                                                                                   |
| **editor mode**   | How a general tab is **worked on** right now: `diagram`, `draw`, `pages`, `plan` or `workshop` (`EditorMode`).                                                                                             |
| **Diagram mode**  | Structured drawing: the palette, shapes, arrows, icons, templates, snapping and guides.                                                                                                                    |
| **Draw mode**     | Freehand whiteboarding: the dock, preset pens, eraser, shape recognition ([Draw mode](../023-draw-mode/draw-mode.md)).                                                                                     |
| **Pages mode**    | Pages on the canvas, of four kinds: infographic pages to lay out, article pages to write, slide pages to present and logo pages to design a logo on ([Pages](pages-mode.md), [Logo pages](logo-pages.md)). |
| **Plan mode**     | Boards of items: Plan boards, cards, the item panel ([Plan mode](../026-plan/plan-mode.md)).                                                                                                               |
| **Workshop mode** | Running a session with a team: the Collaborate elements, stickers and the Session strip ([Workshop mode](../012-collaboration/workshop-mode.md)).                                                          |
| **mode switch**   | The control leading an empty tab's start that changes the editor mode.                                                                                                                                     |

- "Whiteboard" names the activity and Draw mode's look, never a tab kind and
  never a type of document.
- "Mode" on its own is ambiguous here (Zen mode, Presentation mode, Power user
  mode); in specs and code say **editor mode**. The interface says **Diagram**,
  **Draw**, **Workshop**, **Pages** and **Plan**.

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

- **A tab's mode is chosen while it is empty.** The switch leads every start panel's rail ([Template
  starts](start-diagramming.md) "Changing mode"), so a tab begun in the wrong mode changes before anything is made.
  Once a tab has content it keeps its mode: to work on that content another way, make a new tab in the other mode,
  or show the tab live in a [Tab Window](../009-elements/tab-window.md) there.
- **Nowhere else.** No switch sits beside the menu (hamburger) button, the tab menu holds no Mode section, and the
  tab bar and the Explorer offer none. The top-chrome chip and the tab menu's Mode rows were retired on 2026-10-18:
  changing a full tab's mode was a hangover from before new tabs opened in a chosen mode and tab windows existed,
  and it confused more than it helped.
- **A dropdown chip** (`ModeMenuChip`, placed by `StartModeSwitch`): a full-width row at the top of the rail,
  showing the current mode's icon, its name and a chevron, on the faint tint the editor's menu-like controls use.
  A press opens the **mode menu** below it, hanging from its left edge. Choosing a row switches and closes the menu;
  Escape or a press outside closes it.
  - **No hover card:** it would cover the menu the chip opens. The menu's preview does that job.
  - Semantics: a menu button (`aria-haspopup="menu"`, `aria-expanded`) named
    "Tab mode: Diagram", over a `menu` of `menuitemradio` rows; arrow keys
    open it and move within it, wrapping, Home and End jump.
  - The same for everyone, power user mode or not, on a phone as on a computer.
- **The mode menu** is two panes: a **list** of the modes and a **preview** of one.
  - **The list:** one row per mode in catalogue order, each its mark on a small tile in the
    mode's tint, its name, then a check on the current mode, or a **New tab** mark on a mode across
    Plan's line ("Plan stands apart").
  - **The preview** shows the row under the pointer, else the focused row, else the current mode:
    a picture of the mode's work on its tint, its name with **Shift+D** when the key leads there,
    its **description** (one line on what the mode is for, from the mode catalogue) and the mode's
    **main tools** as small chips. It holds **no button**: choosing is the row's alone, by a click
    or by Enter or Space on the focused row.
  - The preview is for the pointer: assistive technology hears each row's name and description
    on the row itself, and the preview is hidden from it.
  - **Narrow (under 640px wide):** the preview is left out and the list stands alone, each row
    showing its description under its name, the menu spanning the panel's width.
  - **Each mode has a tint**, used only by the mode menu (the list's tiles and the preview's
    picture): Diagram sky, Draw orange, Workshop violet, Pages pink, Plan
    emerald. The current row and the focus ring stay the brand colour.
- **The mode descriptions** say what each mode is for, in the catalogue (`EDITOR_MODE_CATALOGUE`):
  - Diagram: "Flowcharts, architecture and org charts with snapping shapes."
  - Draw: "Sketch freehand with pens, tidied into shapes as you go."
  - Workshop: "Run a live session: timers, votes, polls and reveals."
  - Pages: "Lay out slides, infographics, articles and logos on pages."
  - Plan: "Boards of cards moving through columns, with types and fields."
- **One switch:** every start panel's rail carries the same chip and menu. The New Document wizard's mode cards are
  a choice of what to make, not a switch.
- **One mode chosen:** Diagram, Draw, Workshop, Pages or Plan.
  Exactly one is active.
- **Switching is instant and lossless:** no dialog, no reload, and no element changes (the tab's
  mode is the one field it writes, with what the mode brings: "Where the mode lives"); the
  selection is kept, an in-progress gesture or text edit is finished first, and the canvas
  viewport does not move.
- **Where it is offered:** on the start of a general, unlocked, empty tab, to anyone who can edit. A view-role
  visitor, and everyone on a locked tab, sees no switch and sees the tab in its mode.
- **Not on event-storming boards:** the tab kind keeps its own tools and
  notation, and shows no switch.
- **Zero layout shift:** the switch fills its row, and nothing next to it moves when the mode changes.
- **Shift+D** moves an **empty** tab to the next mode, wrapping round through all five, shown in the switch's
  preview, `aria-keyshortcuts` and Settings › Keyboard; a switch by key is announced politely ("Draw mode"). On a tab
  with content it does nothing, as the switch is not offered there. It obeys the character-key shortcuts setting.
- **Accessible:** reachable by keyboard, its state exposed to assistive
  technology, its text and focus ring at least WCAG 2.2 AA.

### Plan stands apart

A tab never switches **into Plan** from another mode, nor **out of Plan** into another (`crossesPlan`): Plan works on
boards, sheets and dashboards, which need tabs of their own, and the other modes on a canvas. In the mode switch the
mode across that line is still listed; picking it asks **Open a New <Mode> Tab?** ("Plan works in tabs of its own.",
or on a Plan tab "A Plan tab stays in Plan.", then "Its mode can’t change, but you can carry on in a new <Mode>
tab.") and **New <Mode> Tab** opens one after the others, with its mode's own start: Start Diagramming, Start a
Workshop, Start Making Pages or Start Drawing (a pen in hand) ([Template starts](start-diagramming.md)), and
Start Planning for Plan. A session that cannot add
tabs (a tab-scoped link, docs/specs/013-workspace/tab-scoped-share-links.md) is offered no new tab: those rows show,
inert (`aria-disabled`), and ask nothing. Since the switch shows only on an empty tab's start, the line holds in
practice for a Board, Sheet or Dashboard tab, whose kind keeps it in Plan (`lockedReason`).

**Except on an empty tab.** A general tab with no elements has nothing either side's tools could not hold, so it
crosses the line freely, into Plan and out of it, as one plain switch (`crossPlan` on `useEditorMode`): the start's
switch lists every mode unlocked, and Shift+D steps through all five. The first element ends switching altogether. A Board, Sheet or Dashboard tab keeps its kind's lock (`lockedReason`). See
[Template starts](start-diagramming.md) "Changing mode".

## Where the mode lives

- **The mode is the tab's, the same for everyone.** A general tab stores its editor mode
  (`Tab.opensIn`, `diagram` when absent; the field keeps its stored name). Everyone on the tab
  works in that mode at once: a view that differed from person to person would be inconsistent.
- **Switching is a tab edit.** The start's switch, Shift+D on an empty tab and a start's template from another
  mode, used by an editor on a general, unlocked tab, set the tab's mode: **one tab edit** (one undo step,
  synced to everyone). Everything the switch brings with it lands in the same edit: entering
  Pages puts a board that does not fit its first page onto a page made around it
  ([Pages](pages-mode.md) "Into pages"), and leaving Pages with **Turn Into
  Pages** turns the articles into Page elements ([Article pages](article-pages.md#leaving-pages)).
- **Undo switches back.** Undo after a switch puts the tab back exactly as it was, in the mode it
  was in, for everyone; Redo switches again. Undoing further back past a switch returns the tab to
  that earlier mode too.
- **Everyone follows a switch.** When the tab's mode changes under someone (a collaborator's
  switch, their undo or redo), their view switches at once:
  - a text edit in progress is kept, so nothing typed is lost; a gesture in progress (a drag, a
    stroke) is finished first, as a switch of one's own finishes it;
  - a toast says who switched: "<Name> switched this tab to <Mode>." ("Someone" when the room
    gives no name); no toast for one's own switch, undo or redo.
- **Who can switch:** an editor on a general tab. A view-role visitor and everyone on a locked tab
  follow the tab's mode and see no switch. An event-storming board is always Diagram and shows no switch.
- **The tab says what it opens in** because its mode is stored: a tab opens in its mode for
  everyone, including a person opening it for the first time. The Whiteboard template, Quick
  Start entry and whiteboard imports set it to `draw`.
- **Nothing is remembered per person.** A mode chosen before this change and kept in a browser
  (`liveplanner:v2:editor-mode:<tab>`) is no longer read: the tab's own mode wins. The keys are
  left in place and ignored.
- **A new tab opens in the mode it was made from.** A tab added from the tab bar's **+** or the command palette's
  **Create New Tab** opens in the mode of the tab its maker was on (the active tab's mode, for everyone on the new
  tab): made from a Pages tab it is a Pages tab, from a Draw tab a Draw tab, from a Plan tab (a Board,
  Sheet or Dashboard tab included) a Plan tab, and from an event-storming board, always Diagram, a Diagram tab. The
  **+** makes the tab straight away, with no picker: it is a general tab (never the source's kind) carrying the
  source's look ([Canvas and palette](../008-canvas/canvas-and-palette.md) "Selecting & adding"), and only its mode
  follows. A tab asked for in a mode (**New <Mode> Tab**, "Plan stands apart") opens in that mode instead. A new tab
  opens empty on its mode's own start (Start Diagramming, Start Drawing, Start a
  Workshop, Start Making Pages, Start Planning: [Template starts](start-diagramming.md), [Plan
  mode](../026-plan/plan-mode.md#starting-a-board); `newTabOpening` in `apps/live/lib/new-tab-seed.ts`), whose
  search also finds every other mode's templates. Only the template chosen for it changes that:
  every template opens in its own mode ([Templates by mode](templates-by-mode.md)), the **Whiteboard** in Draw,
  Blank in Diagram, and an **Event Storming** board is always Diagram. **Duplicate** is not a new tab: the copy
  keeps the original's mode. Adding a tab is an Editor's alone: a Participant, a Viewer and any tab-scoped link add
  no tab ([Share roles](../013-workspace/share-roles.md), [Tab-scoped share
  links](../013-workspace/tab-scoped-share-links.md)), so who may add one is unchanged by the mode it opens in.
- **A new document opens in Diagram** unless its maker chose otherwise: a new document's Mode step on `/new` picks
  its mode's blank, so the document opens in that mode ([New document route](new-document-route.md)). An import that
  sets its own mode wins.
- **No Mode in the tab menu.** The tab menu offers no mode choice; it was retired with the top chrome's chip
  (above).
- **The tab pill shows the tab's mode.** Each tab pill leads with the icon of its mode (the same
  glyph the mode switch uses), tinted with the tab's theme accent. An
  event-storming board is always Diagram, so it shows the Diagram icon. A Board, Sheet or Dashboard tab, always Plan,
  shows its kind's glyph instead ([Plan tabs](../026-plan/plan-tabs.md#the-kinds)).

## One look

There is one look, the diagram look, with the whiteboard's best parts merged
into it. **A mode chooses the defaults written into new content and the
backdrop behind it; it never re-colours what is already there.** Every colour
is stored on the element, so collaborators in different modes see the same
element in the same colour.

- **Each mode's default canvas.** The canvas colour is the tab's in every mode; the pattern behind it suits the
  mode. Diagram shows the tab's pattern (the theme's dot grid until someone picks another). Draw shows the person's
  own board pattern (graph paper until chosen, [Draw mode](../023-draw-mode/draw-mode.md#board-background)).
  Pages shows a **plain** surround, because its pages are the paper and a pattern behind them competes with
  the layout; Plan shows a **blank canvas** too, so boards, sheets and dashboards carry the page. Pages mode's
  and Plan's apply only while the tab keeps its theme's pattern: a pattern someone picked shows in every mode but
  Draw. None is stored, so exports, thumbnails and other people's modes keep the tab's own (`MODE_PATTERNS`,
  `resolveViewBackdrop`).
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
- **Marker colours are first-class.** The stock colours (Ink, Grey, Blue, Red,
  Orange, Yellow, Green, Teal, Violet, Pink) are stored by name on any element and
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
- **Pages mode** is Diagram mode drawn as pages, with the palette
  narrowed (both below); every other rule, tool and shortcut is Diagram mode's.
- **Plan mode** is Diagram mode with the palette narrowed to boards and
  cards, and Plan boards taking input as a planning tool
  ([Plan mode](../026-plan/plan-mode.md)).
- **Workshop mode** is Diagram mode with its own palette for running a session (the Collaborate
  and Stickers categories, which Diagram does not offer) and the Session strip's three tools
  ([Workshop mode](../012-collaboration/workshop-mode.md)).
- **Each mode's mark**: Diagram a flowchart (two steps joined), Draw a marker,
  Pages a page with a little chart above two lines of writing (its first two
  page kinds, infographic and article), Plan a board of three columns with a raised card, Workshop a flipchart on an easel; the same glyph on the switch and the tab pill.
- **No further cue:** the dock (in place of the palette) and the switch's
  own label say which mode is on; no tint, accent or notice is added.
- **Leaving a mode puts its tool down**, as leaving a whiteboard did: a pen,
  the eraser or an armed shape never carries over into the other mode. A mode's tool can still
  be **picked up** in another on purpose: the Toolbar strip's Search offers Draw mode's markers
  in Diagram, Pages and Plan ([Toolbar layout](toolbar-layout.md#search-every-element-type)),
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
- **A body decides presentation only** (a grid, rows with a blurb, Media's
  and Components' collapsed groups); it
  renders whatever tiles the layout hands it. A category with no body of its
  own, such as Popular, is a tile grid.
- **Every surface reads the layout:** the Toolbar strip, its category bar and flyouts (Diagram, Workshop,
  Pages: [The category bar](toolbar-layout.md#the-category-bar), which shows the layout without Popular, with
  one-word names, Write and Draw apart, and Workshop's session tools as Session) and its More popover (Plan).
- Draw mode shows its own tools in place of the palette, so it borrows
  Diagram's layout.

Today the layouts differ as below. Diagram offers no **Stickers** and no **Collaborate**: both are Workshop's ([Workshop mode](../012-collaboration/workshop-mode.md#the-palette)), though Search still finds and places them in Diagram. Within the shared categories,
**Sankey** sits in **Concepts**, after the concept graphics, in Diagram and Pages: a flow drawn as wide as
what it carries explains an idea the way a funnel or a cycle does. Workshop offers no **Concepts**: concept
graphics lay out an idea for a diagram, which a session does not stop to draw.
Pages's **Write** leaves out **Page** (the page is the canvas there) and
**Annotation**, it offers **no Build** (mind maps, flowcharts, lanes and frames organise a diagram, not a visual
page: its **Components** ends with the **Stack**, and its **Data** with the **Timeline** and the **Table**), and its
**Components** leaves out **Entity**; Diagram's
**Media** leaves out the **Embed** group (YouTube, Vimeo, Loom, Figma, Google
Docs, Website), keeping Image and Avatar; it offers Build's tiles as two categories, **Diagrams** (Mind node, Org
chart, Flowchart, Sequence, Table and the **Entity**, Popular's alone until the category bar had no Popular) and
**Layout** (Lane, Frame, Stack, **Boundary**, Timeline, then Diagram key and the **Card**, **Badge** and **Step
Number** from Components: [The card](../009-elements/card.md), [The badge](../009-elements/badge.md),
[The step number](../009-elements/step-number.md), [The boundary](../009-elements/boundary.md)), so what is built
sits apart from what it is laid out in ([Toolbar layout](toolbar-layout.md#the-category-bar)); and its **Write**
adds the **Callout** from Components (a headed note belongs to a diagram as much as a page) ahead of the Comment
panel and Action card, which close it as their own Comments group. Workshop's **Write** holds Text, Sticky note and Pointer note, then Table and Checklist (no Page or Annotation), its
**Draw** leaves out **Shape Pen** and **Polygon**: a session needs none of them, and it shares Diagram's **Layout**. Workshop offers the Collaborate elements as
six categories, **Ask**, **Tools**, **Record**, **React**, **Selection Mode** and **Navigate**
("Collaborate's six" below), and shares Pages mode's **Data**: every chart and meter, since a session reads results
and sets targets as often as a page reports them.

| Category          | Diagram | Pages     | Plan | Workshop |
| ----------------- | ------- | --------- | ---- | -------- |
| Popular           | yes     | yes       | no   | yes      |
| Plan's seven      | no      | no        | yes  | no       |
| Logo              | no      | logo page | no   | no       |
| Shapes            | yes     | yes       | no   | yes      |
| My shapes         | yes     | yes       | no   | yes      |
| Write             | yes     | yes       | no   | yes      |
| Draw              | yes     | no        | no   | yes      |
| Build             | no      | no        | no   | no       |
| Diagrams          | yes     | no        | no   | no       |
| Layout            | yes     | no        | no   | yes      |
| Components        | no      | yes       | no   | no       |
| Concepts          | yes     | yes       | no   | no       |
| Devices           | no      | yes       | no   | no       |
| Event Storming    | board   | no        | no   | no       |
| Icons             | yes     | yes       | no   | yes      |
| Stickers          | no      | yes       | no   | yes      |
| Tech              | yes     | no        | no   | no       |
| Media             | yes     | yes       | no   | yes      |
| Data              | no      | yes       | no   | yes      |
| Collaborate's six | no      | no        | no   | yes      |

Pages offers **Logo** only while the tab has a logo page, and turns to it when one is added
or pressed into ([Logo pages](logo-pages.md#the-logo-palette)).

Plan shows no palette: its boards, sheets and dashboards carry their own tools
([Plan mode](../026-plan/plan-mode.md#no-palette)).

- **The landing category** is the mode's **Popular** (Plan's is **Cards**), and the notation on an
  event-storming board
  (the layout's `landing`). Switching mode re-lands the palette there, so it
  never shows a category the new mode leaves out.
- **Popular** is the landing category of every mode but Plan: the tiles that mode is most
  often built from (twelve at most), listed in its layout entry, fixed (not edited or
  reordered). A layout may put a divider of its own between two entries (`DIVIDE`), shown on the strip as a
  tile's own fixed divider is. An entry may be an **opener** instead of a tile (`palette-openers`): it stands for a whole category, or
  one group of a catalogue, and on the strip opens it in a popover under itself, drawn with a chevron as the
  catalogue groups are ([Toolbar layout](toolbar-layout.md) "More"); in the Palette panel it moves the palette to
  that category. An opener places nothing and is not a search result. It replaced the per-browser **Favourites**
  ([Palette Favourites](../010-palette/palette-favourites.md), removed).
  - **Diagram**: Square, Circle, Diamond, Text, Arrow, Frame, Mind node, Flowchart node, Sankey, Table, the
    **AWS** opener (Technology's AWS marks), Entity.
  - **Pages**: Text, Square, Circle, Image, Speech bubble, Pie, Bar,
    Donut, Stat row, Process, Timeline, Callout, each also reachable from
    another category the mode offers.
  - **Workshop**: Square, Sticky note, Text, Frame, Arrow, then, behind a divider, the session kit as four openers: **Ask**, **Tools**,
    **Record**, **React** (each its Collaborate category)
    ([Workshop mode](../012-collaboration/workshop-mode.md#the-palette)).
- Elements already on the canvas are untouched: narrowing the palette only
  changes what is offered to add.

## The pages

Pages mode draws **pages** on the canvas, in a row, like artboards in
a design tool. What a page is and offers (sizes, backgrounds, layouts, page
actions, snapping, export, putting content onto a page, page slides) is
[Pages](pages-mode.md); this section is the basics.

- **The pages** are sheets of paper (white in light chrome, slate-900 in dark)
  with a soft shadow, under every element. The first is centred on the row
  anchor (`Page.rowAt`, the canvas origin when absent; [Pages
  pages](pages-mode.md) "A page"), so a board put onto a page keeps its
  place; each further page sits **96** px (`PAGE_GAP`) to the right
  of the one before, every page centred on the row's horizontal axis.
  - A page is **A4** unless it has a size of its own: at 96 px per inch,
    **794 x 1123** in portrait, **1123 x 794** in landscape (`A4_SHORT_SIDE`,
    `A4_LONG_SIDE`, `packages/document/src/page.ts`); the other
    sizes are in [Pages](pages-mode.md) "Sizes".
  - The pages are the tab's (`Tab.pages`: `Page[]`, in row
    order), so everyone lays out on the same ones. A tab with no `pages` has one
    page, in its legacy `pageOrientation` (portrait when absent); the legacy
    field is dropped the first time the pages change. At most **100** pages
    (`MAX_PAGES`).
- **The surround** is the tab's own canvas: its colour, and every canvas setting, apply behind the pages exactly
  as in Diagram mode. Its pattern is **plain** while the tab keeps its theme's pattern (see One look, "Each mode's
  default canvas"); a pattern someone picked shows as it does in Diagram mode.
- **Each page's label** sits above its top-left corner (**A4 · Portrait** on an infographic page, or
  **A4 · Landscape · Article**, its name first when it has one, never "Page n": the page
  navigator shows its place), and
  **its settings cog** above its top-right, both held at one screen size at any
  zoom. The cog (tooltip **Page settings**, or **Page 2 settings**) opens the
  **page panel** ([Pages](pages-mode.md) "The page panel").
  A viewer who cannot edit (a view role, a locked tab) gets no cog and no add
  button.
- **Adding a page:** a round **+** sits in the gap's width to the right of the
  last page, level with its middle, adding another page like the last; under it
  a smaller button opens **Add a Page** to choose a page of any kind
  ([Pages](pages-mode.md) "Adding a page"). The page goes after the last; both
  are gone at the limit, and the view then frames the new page.
- **Content moves with its page.** Turning, resizing, moving or deleting a page
  moves the pages after it; every element whose centre lies on a page that
  moves (and an arrow's free ends) moves with it, re-centred on the page's
  centre (`withPages`); on an article page it keeps its place from
  the page's top-left corner, where the writing starts. A deleted page takes its content with it; a
  turned or resized page re-fits its own content
  ([Pages](pages-mode.md) "Sizes"). Elements on no page stay
  where they are. Each change is one tab edit (one undo step, synced to
  everyone).
- **Turning, adding and deleting animate:** the sheets ease to their new places
  and shapes over 200 ms (none under reduced motion).
- **Centred in the viewport:** entering Pages mode or opening a tab in it
  fits the first page itself (`pageFitBox(page)`), never the whole row of
  pages: the tab's own fit on landing, and the fit after a template or an import
  lands on it, frame the first page too (only Fit to Screen fits everything), and going to a page
  (its label, the page navigator, a new page) fits that page, so whatever its shape
  (a landscape slide on a wide screen too) it fills the view; turning or resizing a
  page re-fits it. Where the Toolbar strip lies over
  the canvas's top edge, the page centres in the band below it
  (`computeFitBelow`).
- **Only the pages are drawn on.** A draw, tap-to-place or double-click-to-add
  that starts off every page is ignored (`pressIsOffPage`); elements already on
  the canvas still move freely, on or off the pages.
- **Elements are cut off at the page edges.** Whatever part of an element hangs
  off a page is hidden and cannot be pressed, as if the pages were the only
  paper (`PageClip`, a layer clipped to the pages that holds the
  element views). The selection handles are drawn above it, so an element
  hanging off a page still shows all of them. Not in the isometric view, whose
  3D stack a clip would flatten.
- **The sheets are a view, never elements.** They take no pointer events (a
  press on one is a press on the empty canvas). Thumbnails see the tab's own
  backdrop and the elements whole; the Export dialog in Pages mode exports
  the pages ([Pages](pages-mode.md) "Export").
- The sheets are `apps/live/components/canvas/CanvasPages.tsx`; the pages'
  edits and the centring are `apps/live/hooks/editor/usePagesMode.ts`.

## Leaving Pages

Diagram and Draw show no pages, so an editor's switch away from Pages on a tab that has
something on it asks first:

- **A tab with articles** asks Turn Articles Into Pages? (Convert, Keep as Articles, Cancel;
  [Article pages](article-pages.md#leaving-pages)).
- **A tab with content but no articles** asks a lighter question: a small card hanging from the
  mode switch that asked (a start's, `data-mode-switch`), pointing at it, below
  it or above when there is no room below. A warning glyph in an amber disc, the title "Switch to
  <Mode>?" and one sentence: "<Mode> mode doesn't show pages. Changes you make there may not fit
  back onto your pages when you return to Pages." Its buttons are **Cancel** and **Switch** (the
  target mode's glyph on it, focused). Escape or a press outside stays.
  With no switch on screen (a Shift+D press, a start's template from another mode), the card sits centred near
  the top of the screen.
- An empty tab, a visitor or a locked tab switches straight away.
- Confirming sends `Editor` · `Changed` · `LeavePagesConfirmed`, beside the switch's own
  `ModeDiagram` / `ModeDraw`.

## Every mode, always offered

Every mode of the catalogue is offered to everyone: the mode switch and the template picker's
mode filter always list all five, and a tab always opens in its stored mode. Shift+D, on an empty tab, steps through
all five.

Pages and Plan each had a switch in **Settings › Experimental** while they
were new. Both graduated on 2026-10-06, and the **Experimental** category went
with them. Their `pagesModeEnabled` and `planModeEnabled` preferences are
retired keys ([User preferences](user-preferences.md) "Retired keys"), so a
person who had switched either off sees it again. Their `UI` · `Toggled` ·
`PagesMode{On,Off}` / `PlanMode{On,Off}` events are retired from the
dashboard ([Telemetry](../017-telemetry/telemetry.md) "Retired features").

## Existing whiteboards

- A stored tab with `kind: 'whiteboard'` reads as a general tab that opens in
  Draw mode. Its elements, background and layers are unchanged.
- Imports that landed on a whiteboard (Excalidraw, Microsoft Whiteboard) land
  on a general tab in Draw mode.
- The **Blank Whiteboard** template (kind id `whiteboard`) creates a
  general tab that opens in Draw mode, as the other Draw templates do
  ([Templates by mode](templates-by-mode.md)).

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- `Editor` · `Changed` · `ModeDiagram` / `ModeDraw` / `ModePages` / `ModePlan` /
  `ModeWorkshop`, fired by
  the switch and Shift+D before the mode applies (never by a collaborator's
  switch arriving, an undo or a redo).
- `Tab` · `Changed` · `OpensInDiagram` / `OpensInDraw` / `OpensInPages` / `OpensInPlan` were
  fired by the retired Opens in submenu, whose successor (the tab menu's Mode) is retired too.
- `Tab` · `Changed` · `PagePortrait` / `PageLandscape`, fired by a page's
  orientation in Pages mode, `PageAdded` (an infographic page; `SlidePageAdded`,
  `ArticleAdded` and `LogoPageAdded` for the other kinds) by its add button, and `PageRemoved` by
  Delete Page.
- Draw mode's own events are the **`Draw`** category (pens, shapes, eraser,
  recognition, background, snap colours,
  [Draw mode](../023-draw-mode/draw-mode.md#telemetry-telemetry--public-transparency-dashboard)).
  It was named `Whiteboard`; the stored history is rewritten to `Draw` so the
  dashboard's lines continue.
- Pages mode's events were named for Infographic mode (`ModeInfographic`,
  `OpensInInfographic`, `InfographicModeOn` / `Off`); migration
  `0066_pages_telemetry.sql` rewrites the stored history to the Pages
  names so the dashboard's lines continue.

## Naming in the interface

- The help article **Editor Modes** (`/help/canvas/editor-modes/`) explains all five modes, the
  start's switch and new tabs in a mode, and links to each mode's own article.
- The mode is **Draw** on the switch and in Settings, where it names the
  **Editor › Draw** sub-category (Dock Position) as the switch names it, and
  **Draw mode** in prose: the help article (**Draw mode**, at a new address,
  the old one redirecting) and the command palette.
- The template card is **Blank Whiteboard**, one of five blanks (Blank Diagram,
  Blank Whiteboard, Blank Session, Blank Illustration, Blank Plan), one per mode, that lead Popular
  ([Templates by mode](templates-by-mode.md)); the document it makes is named "Untitled
  Whiteboard", for the activity a person comes for.
- **Pages** is the mode's name everywhere: the switch, Settings, the tab menu, the New Document
  wizard, help, the marketing site and the agents' tools. Its template start is **Start Making
  Pages**. It was called **Illustrate**, and before that **Infographic** while its pages were all
  infographics. Every stored trace of either old name reads as Pages: `opensIn: 'illustrate'` or
  `'infographic'`, a recorded creation intent, a create's intent and a `/new?mode=` link
  (`parseEditorMode`), a default-folder key `mode:illustrate` or `mode:infographic`
  (`parsePlacementDefaultKey`; clearing the default clears every name). Tab bodies are not
  rewritten. The tour's preferences `illustrateTourSeen` and `illustrateTourKinds` are renamed
  `pagesTourSeen` and `pagesTourKinds` (migration 0097 in D1, `upgradeLegacyPreferences` for any
  older copy). The `infographicModeEnabled` and `illustrateModeEnabled` preferences went with the
  mode's Settings switch (retired keys). "Infographic" now names a kind of page
  ([Pages](pages-mode.md) "Page kinds"), and "illustration" stays a plain word (the **Blank
  Illustration** template, help figures).
  The help articles moved to `/help/canvas/pages-mode/`, the `/help/canvas/illustrate/` and
  `/help/canvas/infographics/` addresses redirecting.
- **Workshop** is the mode for running a session ([Workshop mode](../012-collaboration/workshop-mode.md)), its name
  everywhere: the switch, Settings, the New Document wizard, help, the marketing site and the agents' tools. Its
  template start is **Start a Workshop** and its tour **The Workshop Tour**. It was called **Facilitate**. Every
  stored trace of the old name reads as Workshop: `opensIn: 'facilitate'`, a recorded creation intent, a create's
  intent, a `/new?mode=` link and a recently opened document's mode (`parseEditorMode`), an `opens-in:facilitate`
  Explorer filter, and a default-folder key `mode:facilitate` (`parsePlacementDefaultKey`; clearing the default
  clears both names). Tab bodies are not rewritten. The tour's preference `facilitateTourSeen` is renamed
  `workshopTourSeen` (migration 0098 in D1, `upgradeLegacyPreferences` for any older copy), and telemetry history
  moves to the new event names and help slugs. The help articles moved to `/help/canvas/workshop-mode/`, the
  `/help/canvas/facilitate-mode/` addresses redirecting. The **facilitator** keeps its name.

## Non-goals

- Further editor modes beyond these five until use asks for one.
- A mode per element or per layer.
- Converting content between modes (a stroke into a shape on switching).

## References

[Document](../006-document/document.md), [Draw mode](../023-draw-mode/draw-mode.md),
[Event storming](../021-event-storming/event-storming.md),
[Toolbar layout](toolbar-layout.md), [Zen mode](zen-mode.md).
