# Editor modes

A general tab is drawn on in one of three **editor modes**: **Diagram**,
**Draw** and **Workshop**. A mode decides which tools and rules are in focus; it never decides
what the tab is. Like a drawing tool that switches between a pixel mode and a
vector mode over the same picture, switching mode keeps every element exactly
where it is and changes only how the next mark is made.

## Domain language

| Term              | Means                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **tab kind**      | What a tab **is** ([Document](../006-document/document.md)). Reserved for specific uses.                                                          |
| **editor mode**   | How a general tab is **worked on** right now: `diagram`, `draw` or `workshop` (`EditorMode`).                                                     |
| **Diagram mode**  | Structured drawing: the palette, shapes, arrows, icons, templates, snapping and guides.                                                           |
| **Draw mode**     | Freehand whiteboarding: the dock, preset pens, eraser, shape recognition ([Draw mode](../023-draw-mode/draw-mode.md)).                            |
| **Workshop mode** | Running a session with a team: the Collaborate elements, stickers and the Session strip ([Workshop mode](../012-collaboration/workshop-mode.md)). |
| **mode switch**   | The control leading an empty tab's start that changes the editor mode.                                                                            |

- "Whiteboard" names the activity and Draw mode's look, never a tab kind and
  never a type of document.
- "Mode" on its own is ambiguous here (Zen mode, Presentation mode, Power user
  mode); in specs and code say **editor mode**. The interface says **Diagram**,
  **Draw** and **Workshop**.

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
  Once a tab has content it keeps its mode: to work on that content another way, make a new tab in the other mode.
- **Nowhere else.** No switch sits beside the menu (hamburger) button, the tab menu holds no Mode section, and the
  tab bar and the Explorer offer none. The top-chrome chip and the tab menu's Mode rows were retired on 2026-10-18:
  changing a full tab's mode was a hangover from before new tabs opened in a chosen mode,
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
    mode's tint, its name, then a check on the current mode.
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
    picture): Diagram sky, Draw orange, Workshop violet. The current row and the focus ring stay
    the brand colour.
- **The mode descriptions** say what each mode is for, in the catalogue (`EDITOR_MODE_CATALOGUE`):
  - Diagram: "Flowcharts, architecture and org charts with snapping shapes."
  - Draw: "Sketch freehand with pens, tidied into shapes as you go."
  - Workshop: "Run a live session: timers, votes, polls and reveals."
- **One switch:** every start panel's rail carries the same chip and menu. The New Canvas wizard's mode cards are
  a choice of what to make, not a switch.
- **One mode chosen:** Diagram, Draw or Workshop.
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
- **Shift+D** moves an **empty** tab to the next mode, wrapping round through all three, shown in the switch's
  preview, `aria-keyshortcuts` and Settings › Keyboard; a switch by key is announced politely ("Draw mode"). On a tab
  with content it does nothing, as the switch is not offered there. It obeys the character-key shortcuts setting.
- **Accessible:** reachable by keyboard, its state exposed to assistive
  technology, its text and focus ring at least WCAG 2.2 AA.

## Where the mode lives

- **The mode is the tab's, the same for everyone.** A general tab stores its editor mode
  (`Tab.opensIn`, `diagram` when absent; the field keeps its stored name). Everyone on the tab
  works in that mode at once: a view that differed from person to person would be inconsistent.
- **Switching is a tab edit.** The start's switch, Shift+D on an empty tab and a start's template from another
  mode, used by an editor on a general, unlocked tab, set the tab's mode: **one tab edit** (one undo step,
  synced to everyone).
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
  (`livediagram:v2:editor-mode:<tab>`) is no longer read: the tab's own mode wins. The keys are
  left in place and ignored.
- **A new tab opens in the mode it was made from.** A tab added from the tab bar's **+** or the command palette's
  **Create New Tab** opens in the mode of the tab its maker was on (the active tab's mode, for everyone on the new
  tab): made from a Draw tab it is a Draw tab, from a Workshop tab a Workshop tab, and from an event-storming board, always Diagram, a Diagram tab. The
  **+** makes the tab straight away, with no picker: it is a general tab (never the source's kind) carrying the
  source's look ([Canvas and palette](../008-canvas/canvas-and-palette.md) "Selecting & adding"), and only its mode
  follows. A new tab
  opens empty on its mode's own start (Start Diagramming, Start Drawing, Start a
  Workshop: [Template starts](start-diagramming.md); `newTabOpening` in `apps/editor/lib/new-tab-seed.ts`), whose
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
  event-storming board is always Diagram, so it shows the Diagram icon.

## One look

There is one look, the diagram look, with the whiteboard's best parts merged
into it. **A mode chooses the defaults written into new content and the
backdrop behind it; it never re-colours what is already there.** Every colour
is stored on the element, so collaborators in different modes see the same
element in the same colour.

- **Each mode's default canvas.** The canvas colour is the tab's in every mode; the pattern behind it suits the
  mode. Diagram shows the tab's pattern (the theme's dot grid until someone picks another). Draw shows the person's
  own board pattern (graph paper until chosen, [Draw mode](../023-draw-mode/draw-mode.md#board-background)).
  A pattern someone picked shows in every mode but Draw. None is stored, so exports, thumbnails and other people's modes keep the tab's own (`MODE_PATTERNS`,
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
- **Workshop mode** is Diagram mode with its own palette for running a session (the Collaborate
  and Stickers categories, which Diagram does not offer) and the Session strip's three tools
  ([Workshop mode](../012-collaboration/workshop-mode.md)).
- **Each mode's mark**: Diagram a flowchart (two steps joined), Draw a marker,
  Workshop a flipchart on an easel; the same glyph on the switch and the tab pill.
- **No further cue:** the dock (in place of the palette) and the switch's
  own label say which mode is on; no tint, accent or notice is added.
- **Leaving a mode puts its tool down**, as leaving a whiteboard did: a pen,
  the eraser or an armed shape never carries over into the other mode. A mode's tool can still
  be **picked up** in another on purpose: the Toolbar strip's Search offers Draw mode's markers
  in Diagram and Workshop ([Toolbar layout](toolbar-layout.md#search-every-element-type)),
  and one picked there is put down by a switch like any other.

## The tool a mode starts with

- Every mode starts on **Select**. On a phone every mode starts on **Hand**, so a drag moves the canvas.
- The tool is picked whenever the mode changes, the first mode a tab opens in included; any tool can be picked
  after. An embedded viewer always starts on Hand.

## The palette per mode

Each mode has its own **palette layout**
(`apps/editor/components/palette/palette-layouts.ts`): the categories its
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
- **Every surface reads the layout:** the Toolbar strip, its category bar and flyouts (Diagram and Workshop:
  [The category bar](toolbar-layout.md#the-category-bar), which shows the layout without Popular, with
  one-word names, Write and Draw apart,and Workshop's session tools as Session).
- Draw mode shows its own tools in place of the palette, so it borrows
  Diagram's layout.

Today the layouts differ as below. Diagram offers no **Stickers** and no **Collaborate**: both are Workshop's ([Workshop mode](../012-collaboration/workshop-mode.md#the-palette)), though Search still finds and places them in Diagram. Within the shared categories,
**Sankey** sits in **Concepts**, after the concept graphics, in Diagram: a flow drawn as wide as
what it carries explains an idea the way a funnel or a cycle does. Workshop offers no **Concepts**: concept
graphics lay out an idea for a diagram, which a session does not stop to draw.
Diagram's
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
("Collaborate's six" below), and offers **Data**: every chart and meter, since a session reads results
and sets targets.

| Category          | Diagram | Workshop |
| ----------------- | ------- | -------- |
| Popular           | yes     | yes      |
| Shapes            | yes     | yes      |
| My shapes         | yes     | yes      |
| Write             | yes     | yes      |
| Draw              | yes     | yes      |
| Build             | no      | no       |
| Diagrams          | yes     | no       |
| Layout            | yes     | yes      |
| Concepts          | yes     | no       |
| Event Storming    | board   | no       |
| Icons             | yes     | yes      |
| Stickers          | no      | yes      |
| Tech              | yes     | no       |
| Media             | yes     | yes      |
| Data              | no      | yes      |
| Collaborate's six | no      | yes      |

- **The landing category** is the mode's **Popular**, and the notation on an
  event-storming board
  (the layout's `landing`). Switching mode re-lands the palette there, so it
  never shows a category the new mode leaves out.
- **Popular** is the landing category of every mode: the tiles that mode is most
  often built from (twelve at most), listed in its layout entry, fixed (not edited or
  reordered). A layout may put a divider of its own between two entries (`DIVIDE`), shown on the strip as a
  tile's own fixed divider is. An entry may be an **opener** instead of a tile (`palette-openers`): it stands for a whole category, or
  one group of a catalogue, and on the strip opens it in a popover under itself, drawn with a chevron as the
  catalogue groups are ([Toolbar layout](toolbar-layout.md) "More"); in the Palette panel it moves the palette to
  that category. An opener places nothing and is not a search result. It replaced the per-browser **Favourites**
  ([Palette Favourites](../010-palette/palette-favourites.md), removed).
  - **Diagram**: Square, Circle, Diamond, Text, Arrow, Frame, Mind node, Flowchart node, Sankey, Table, the
    **AWS** opener (Technology's AWS marks), Entity.
  - **Workshop**: Square, Sticky note, Text, Frame, Arrow, then, behind a divider, the session kit as four openers: **Ask**, **Tools**,
    **Record**, **React** (each its Collaborate category)
    ([Workshop mode](../012-collaboration/workshop-mode.md#the-palette)).
- Elements already on the canvas are untouched: narrowing the palette only
  changes what is offered to add.

## Every mode, always offered

Every mode of the catalogue is offered to everyone: the mode switch and the template picker's
mode filter always list all three, and a tab always opens in its stored mode. Shift+D, on an empty tab, steps through
all three.

Plan had a switch in **Settings › Experimental** while it was new. It graduated on 2026-10-06, and the
**Experimental** category went with it. Its `planModeEnabled` preference is a retired key ([User
preferences](user-preferences.md) "Retired keys"). Its `UI` · `Toggled` · `PlanMode{On,Off}` events are retired from
the dashboard ([Telemetry](../017-telemetry/telemetry.md) "Retired features").

## Plan moved to liveplanner

Plan mode (boards of cards, Sheets, dashboards and forms, each on a Board, Sheet, Dashboard or Form tab) was a fourth
mode until it moved out into its own product, liveplanner (https://liveplanner.app). livediagram no longer has it:

- A stored tab whose mode is Plan (`opensIn: 'plan'`), or whose kind is Board, Sheet, Dashboard or Form, reads as an
  ordinary Diagram tab (`dropRetiredPlan`, run from `migrateStoredTab` beside `dropRetiredPages`): its `kind` and
  `opensIn` go, with its Plan-only fields, and so do its Plan board and Sheet elements. A chart that read a Sheet keeps
  the data it last read and loses its `chartSource`. The tab is saved without them the next time it is saved.
  That is why nothing on the old site is ever read this way: the migration splits each old document's Plan tabs
  out to liveplanner from the raw rows first, and a browser's Local only documents are split before the editor
  reads them ([docs/migration.md](../../../../docs/migration.md), steps 3 and 6).
- The help articles about Plan, boards, cards, Sheets, dashboards and forms redirect to Editor Modes, which points to
  liveplanner, and the marketing site's Plan, Sheets and Forms feature pages redirect to liveplanner.app.
- Workshop's Q&A board and the diagram [card](../009-elements/card.md) are not Plan, and stay.

## Pages moved to livedocuments

Pages mode (slides, articles, infographics, logos and wireframes laid out on pages) was a fifth mode until it moved
out into its own product, livedocuments (https://livedocuments.app). livediagram no longer has it:

- A stored tab whose mode is Pages (`opensIn: 'pages'`, or its older names `'illustrate'` and `'infographic'`)
  reads as a Diagram tab (`parseEditorMode`, through `LEGACY_EDITOR_MODES`), so a former Pages tab opens with its
  ordinary elements on the canvas.
- The stored-tab migration drops what only Pages read (`dropRetiredPages`, `packages/document/src/retired-pages.ts`):
  the tab's `pages`, `articles` and `pageOrientation`, and the elements that only made sense on a page (a tab
  window, an article's margin note). It runs wherever a tab is read, and the tab is saved without them the next
  time it is saved. Content still wanted elsewhere is moved before this can run: the migration splits Pages tabs
  out to livedocuments (and logo, wireframe and photo pages to livedesign) from the old site's raw rows, and a
  browser's Local only documents are split before the editor reads them
  ([docs/migration.md](../../../../docs/migration.md), steps 3 and 6). The same object comes back when there is nothing to drop.
- A former Pages tab's ordinary elements keep what Pages gave them, and livediagram still draws and exports it, though
  it no longer offers the controls that set it: a text's **wordmark type** (its tracking, weight, case and arc,
  `packages/document/src/wordmark.ts`), and a **combined** or **mirrored** path of several contours (Combine's
  union, subtraction, intersection and exclusion, or Mirror's merged twin). A path of several contours moves and
  restyles as a whole; its points are not edited one by one.

## Existing whiteboards

- A stored tab with `kind: 'whiteboard'` reads as a general tab that opens in
  Draw mode. Its elements, background and layers are unchanged.
- Imports that landed on a whiteboard (Excalidraw, Microsoft Whiteboard) land
  on a general tab in Draw mode.
- The **Blank Whiteboard** template (kind id `whiteboard`) creates a
  general tab that opens in Draw mode, as the other Draw templates do
  ([Templates by mode](templates-by-mode.md)).

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- `Editor` · `Changed` · `ModeDiagram` / `ModeDraw` / `ModeWorkshop`, fired by
  the switch and Shift+D before the mode applies (never by a collaborator's
  switch arriving, an undo or a redo).
- `Tab` · `Changed` · `OpensInDiagram` / `OpensInDraw` / `OpensInPlan` were
  fired by the retired Opens in submenu, whose successor (the tab menu's Mode) is retired too.
- Draw mode's own events are the **`Draw`** category (pens, shapes, eraser,
  recognition, background, snap colours,
  [Draw mode](../023-draw-mode/draw-mode.md#telemetry-telemetry--public-transparency-dashboard)).
  It was named `Whiteboard`; the stored history is rewritten to `Draw` so the
  dashboard's lines continue.

## Naming in the interface

- The help article **Editor Modes** (`/help/canvas/editor-modes/`) explains all three modes, the
  start's switch and new tabs in a mode, and links to each mode's own article.
- The mode is **Draw** on the switch and in Settings, where it names the
  **Editor › Draw** sub-category (Dock Position) as the switch names it, and
  **Draw mode** in prose: the help article (**Draw mode**, at a new address,
  the old one redirecting) and the command palette.
- The template card is **Blank Whiteboard**, one of three blanks (Blank Diagram,
  Blank Whiteboard, Blank Workshop), one per mode, that lead Popular
  ([Templates by mode](templates-by-mode.md)); the document it makes is named "Untitled
  Whiteboard", for the activity a person comes for.
- **Workshop** is the mode for running a session ([Workshop mode](../012-collaboration/workshop-mode.md)), its name
  everywhere: the switch, Settings, the New Canvas wizard, help, the marketing site and the agents' tools. Its
  template start is **Start a Workshop** and its tour **The Workshop Tour**. It was called **Facilitate**. Every
  stored trace of the old name reads as Workshop: `opensIn: 'facilitate'`, a recorded creation intent, a create's
  intent, a `/new?mode=` link and a recently opened document's mode (`parseEditorMode`), an `opens-in:facilitate`
  Explorer filter, and a default-folder key `mode:facilitate`, which liveworkspace's index, now keeping default folders,
  reads. Tab bodies are not rewritten. The tour's preference `facilitateTourSeen` is renamed
  `workshopTourSeen` (`upgradeLegacyPreferences` upgrades any older copy), and telemetry history
  moves to the new event names and help slugs. The help articles moved to `/help/canvas/workshop-mode/`, the
  `/help/canvas/facilitate-mode/` addresses redirecting. The **facilitator** keeps its name.

## Non-goals

- Further editor modes beyond these three until use asks for one.

- A mode per element or per layer.
- Converting content between modes (a stroke into a shape on switching).

## References

[Document](../006-document/document.md), [Draw mode](../023-draw-mode/draw-mode.md),
[Event storming](../021-event-storming/event-storming.md),
[Toolbar layout](toolbar-layout.md), [Zen mode](zen-mode.md).
