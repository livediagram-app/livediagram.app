# Template starts: Start Diagramming, Start Drawing, Start Facilitating, Start Illustrating

An empty tab starts from a choice, not a blank page and a modal. A Plan tab has offered **Start Planning** since
Plan shipped ([Plan mode](../026-plan/plan-mode.md) "Starting a board"); Diagram, Draw, Facilitate and Illustrate tabs
now offer their own: **Start Diagramming**, **Start Drawing**, **Start Facilitating** and **Start Illustrating**. Each is the same wide
panel in the middle of the canvas, its rail of groups beside a grid of the mode's templates, so the templates sit
where the work begins instead of in a step before it. The New Document wizard asks only for a mode
([New document route](new-document-route.md) "Choosing a mode"), and the document opens on that mode's start.

## The panel

One shared panel, `StartPanel` (`apps/live/components/start/StartPanel.tsx`), draws all five starts (Start Planning
included, `components/plan/start/StartPlanning.tsx`); each start says what its groups and cards are, the panel
draws them.

- **Header:** the title ("Start Diagramming"), one line under it, the search box, and in the top right corner the
  **Help** link and (where the start can be closed) **Close** (×). On a phone the search takes its own row under the
  title, the help and × staying beside the title.
- **Rail:** led by the mode switch over a hairline ([Changing mode](#changing-mode)), then **Recommended** and the
  mode's groups, each with its glyph and count; long names wrap beside the glyph on a wide rail. Below a further
  hairline, **Something Else** opens the Quick Start on every mode.
- **Cards:** each template's preview on a soft plate, its name and its description in full. Choosing a card lands
  the template on the tab at once (`chooseTemplate`), as the Quick Start does.
- **Search:** the catalogue's own search (`templateMatchesQuery`, as the Quick Start and the marketing gallery),
  across the mode's templates; matches are grouped under their group, each once, in rail order. Escape clears a
  search first. No match offers **Browse More Templates** (the Quick Start).
- **Picking a category** opens it at the top of its cards, never part way down the last one's.
- **Keyboard:** the search is focused on a fine pointer; Up and Down move along the rail, choosing as they go.

### Recommended and groups

Recommended is the mode's Popular shelf (`popularKindsFor`, the picks the Quick Start leads with), **its blank
first**, less **Timeline**, which is left to its group. The groups (`components/start/start-template-items.ts`,
`TEMPLATE_STARTS`):

- **Diagram:** the catalogue's categories that hold a Diagram template ([Canvas and
  palette](../008-canvas/canvas-and-palette.md) "Template categories"), in the catalogue's order, by their short names
  (Flowcharts, Org Charts, Timelines and so on).
- **Draw**, whose templates are drawn, by what each is for: **Visual Notes**, **Workshops**, **Prototypes**.
- **Facilitate**, whose templates nearly all share one category, by the session each runs: **Retrospectives**, **Meetings**, **Workshops** and **Decisions** (the boards with a dot vote).
- **Illustrate**, likewise, by what each makes: **Slides**, **Infographics**, **Documents**, **Posters**, **Logos**.

A template of the mode in none of its groups is placed in the last group, so every listed template is reachable.
The blank appears only in Recommended. Choosing the blank closes the panel, as the × does, since it leaves the tab
empty.

## When it shows

`templateStartMode` (`components/start/template-start-mode.ts`) decides, from the editor's state:

- To someone who can edit (an **Editor**), after hydration, outside zen and an embed, with the Quick Start closed
  and no draw tool armed. Draw keeps a pen in hand on an empty tab, so there an armed pen does not hide it.
- While the tab is empty: no elements, and on an Illustrate tab its one page still has no kind.
- In Diagram, Draw, Facilitate or Illustrate. Plan has Start Planning.

A **Participant** or **Viewer** never sees a start: they keep the empty-canvas card ([New document
route](new-document-route.md) "The empty-canvas hint"), which tells a Viewer the owner can build it out and points a
Participant at what they may add.

A new tab opens on its mode's start with no Quick Start over it (`newTabOpening` in
`apps/live/lib/new-tab-seed.ts`).

## Bringing it back

The × starts from a blank canvas: the start stays closed on that tab in that mode, for this person in this browser
(`empty-card-dismissed.ts`, under the key `<tab id>:<mode>`, `startClosedKey`). Closing Start Diagramming leaves
Start Facilitating to show when the tab switches to Facilitate. On a phone, dragging the sheet's grab handle down
closes it too.

While a closed start's tab is still empty, the **palette tray** (the strip that hangs from the palette, as the mode
banners do, [Toolbar layout](toolbar-layout.md)) reads "Tab 1 is empty" with **Show Templates**, which opens the
start again (`StartAgainTray`). It goes with the emptiness: the first element ends it. Without a strip on screen
(Draw's dock) it is the same message as a pill standing just clear of the dock: under it when the dock is at the top, over it when at the bottom. The closed list is shared state: the panel and the
tray read the same key and follow each other as it changes.

## Changing mode

The rail is led by the editor's own mode switch, named and full width (`StartModeSwitch`, `ModeMenuChip` with
`labelled`), so a tab begun in the wrong mode changes before anything is made. Its menu is the top chrome's, the
list of modes and the preview of one ([Editor modes](editor-modes.md) "The mode switch"), with the same rules.

**An empty tab crosses Plan's line.** Plan stands apart ([Editor modes](editor-modes.md)): a tab never switches into
or out of it, and the mode menu offers a new tab instead. An empty tab has nothing either side's tools could not
hold, so while a general tab has no elements it switches freely into and out of Plan, from the start's switch, the
top switch and Shift+D (`crossPlan` on `useEditorMode`). The first element closes the line again. Meanwhile the mode menu
shows Plan (or, on a Plan tab, the other modes) as a plain switch: no New tab mark, and choosing its row switches.

A mode change swaps one start for another. The new one **turns in place**: the frame stays still and the old content
crossfades into the new (the start's mode switch runs the change as a View Transition, `withViewTransition`), so a
mode change reads as the same panel turning rather than a second one flying up or its content blinking out
(`startPanelJustLeft`, a start mounting within 400 ms of another leaving). The new content arrives whole, its rail and
cards not cascading in until the category or search changes. Without View Transitions, or with reduced motion, the
content swaps at once.

## Start Illustrating

The tab's first page is drawn only once the start is done: while Start Illustrating is open there is no page behind
it (`EditorCanvasHost` passes no pages), so nothing waits under the panel. Picking a template lands its pages;
closing the panel, or choosing **Blank Illustration**, shows the first page with its own **What Is This Page For?**
([Illustrate pages](illustrate-pages.md)).

**The last page can be deleted.** Deleting it (or the last article) clears the tab, its pages, its writing and its
elements, as one edit that Undo puts back, and brings Start Illustrating back even if it was closed. The agents'
page edits keep their own rule (`pageRemoved` refuses the last page, `last_page`).

## Default folders

A template picked here on a document `/new` just made goes to that template's default folder, unless the person
chose the folder themselves on the Location step ([Default folders](../013-workspace/default-folders.md) "A template
picked after creation"). The move loads only at the pick (`useTemplatePickMove`, a dynamic import of
`move-on-template-pick.ts`).

## The tours wait

A tour's welcome never lands over a start: while one is on screen the Diagram, Facilitate, Draw and Illustrate
tours hold their offer, and make it once a template is picked or the start closed (`start-panel-open.ts`,
`useStartPanelOpen`). Start Planning shows only on a tab with no board or Sheet, where the Plan tour has nothing to
show, so it needs no hold.

## Search handed over

A `/new?q=<words>` link (the marketing site's **Build yours**, a gallery search) chooses a mode in the wizard, and
its words become the search of that mode's start on the new document, so the templates it meant are the ones shown.
They are kept for the browser tab only and read once (`start-query.ts`).

## Look

- **The tab's colours.** The panel's paper is the tab's canvas colour, its accent (the chosen category, the focus
  ring, a card's hover) the theme's stroke and its ink the theme's text, through `planPalette` as a coloured Plan
  board's, which keeps the ink readable on the paper (`start-palette.ts`, `useStartPalette`). A theme with no colours
  of its own (Default) leaves the app's light or dark look. The tours wear the same palette
  ([Diagram tour](editor-tour.md) "Look").
- **Entrance.** The panel rises in with the dialog entrance (`animate-dialog-in`; a fade alone under reduced
  motion), and its cards and rail cascade in after it (`lvd-cascade`).
- **On a phone** the panel is a sheet risen from the bottom edge (`animate-sheet-up`), full width below the top bar,
  over the tab bar, clear of the home indicator, with the grab handle every phone sheet has. A start that cannot
  close (Start Planning) settles back when dragged.

## Telemetry

None added. A template chosen fires `Template · Used · <kind>` through `chooseTemplate`, as from the Quick Start.

## Tests

- `components/start/start-template-items.test.ts`: every mode's Recommended, groups and search.
- `components/start/template-start-mode.test.ts`: when a start shows.
- `components/start/StartFromTemplates.test.tsx`: titles per mode, choosing, the blank closing, the per-mode close,
  scroll to top.
- `components/start/StartModeSwitch.test.tsx`, `hooks/editor/useEditorMode.test.tsx` (crossing Plan while empty).
- `components/start/start-palette.test.ts`, `start-panel-open.test.tsx`, `start-query.test.ts`.
- `components/start/StartAgainTray.test.tsx`, `components/canvas/empty-card-dismissed.test.ts` (bringing a start back), `hooks/editor/illustrate-page-edits.test.ts`
  (the last page).
