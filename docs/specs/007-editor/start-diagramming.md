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
  mode's groups, each with its glyph and count; long names wrap beside the glyph on a wide rail.
- **Cards:** each template's preview on a soft plate, its name and its description in full. Choosing a card lands
  the template on the tab at once (`chooseTemplate`), painted in the **tab's theme**: the
  panel picks no theme, so the scaffold takes the colours the tab already wears (its own theme, or the one a new
  tab inherited from the tab it was added beside) rather than the template's built-in ones. The tab's backdrop is
  left as it is.
- **Search:** the catalogue's own search (`templateMatchesQuery`, as the marketing gallery's),
  across the mode's templates; matches are grouped under their group, each once, in rail order, then the matches of
  every other mode ([Found in other modes](#found-in-other-modes)). Escape clears a search first.
- **There is no way out to a bigger picker.** Each start holds every listed template of its mode, the mode switch
  reaches the others, and a search finds a template in any mode; the start is the whole catalogue. (Its
  **Something Else** row and **Browse More Templates** button opened the Quick Start, a modal of every template, which
  was removed: [New document route](new-document-route.md).)
- **Picking a category** opens it at the top of its cards, never part way down the last one's.
- **Keyboard:** the search is focused on a fine pointer; Up and Down move along the rail, choosing as they go. Down
  in the search box moves to the first card it found.
- **Undo and redo reach the editor through an empty search.** An undo that takes a tab back to empty (a template
  picked, then undone) brings the start back with its search focused, where Cmd/Ctrl+Z and redo were the text box's
  own and did nothing, so the template could not be redone from the keyboard. While the search is empty those chords
  are the editor's (`data-editor-history` on the box, `passesHistoryChords` in `lib/typing-target.ts`); once something
  is typed in it they undo the typing, as in any text box.

### Recommended and groups

Recommended is the mode's Popular shelf (`popularKindsFor`, the picks the marketing gallery leads with), **its blank
first**, less **Timeline**, which is left to its group. Start Illustrating swaps two of the shelf's picks for blanks
of a page kind, a page already of its kind being the quicker start: **Blank Infographic** in place of Blank
Illustration and **Blank Article** in place of the Article template, so it leads Blank Infographic, Blank Article,
Blank Slide Deck. The shelf itself (the gallery's) is unchanged. The groups (`components/start/start-template-items.ts`,
`TEMPLATE_STARTS`):

- **Diagram:** the catalogue's categories that hold a Diagram template ([Canvas and
  palette](../008-canvas/canvas-and-palette.md) "Template categories"), in the catalogue's order, by their short names
  (Flowcharts, Org Charts, Timelines and so on).
- **Draw**, whose templates are drawn, by what each is for: **Visual Notes**, **Workshops**, **Prototypes**.
- **Facilitate**, whose templates nearly all share one category, by the session each runs: **Retrospectives**, **Meetings**, **Spaces** (offices and halls to walk round together in Avatar mode), **Quizzes & Games**, **Workshops**, **Planning** (goals, roadmaps and who does what), **Strategy** (the business, the people and the opportunities) and **Decisions** (the boards with a dot vote).
- **Illustrate**, likewise, by what each makes: **Slides**, **Infographics**, **Articles**, **Posters and Social**, **Logos**, **Design** (wireframes, storyboards and floor plans, [Templates by mode](templates-by-mode.md#design-templates)).
  Slides, Infographics, Articles and Logos each lead with their blank of that page kind (Blank Slide Deck, Blank
  Infographic, Blank Article, Blank Logo: [Templates by mode](templates-by-mode.md#blanks-of-a-page-kind)), one empty
  page of the kind meant.

A template of the mode in none of its groups is placed in the last group, so every listed template is reachable.
The blank appears only in Recommended (Illustrate's, Blank Illustration, not at all: closing the panel leaves the
same empty tab). Choosing the blank closes the panel, as the × does, since it leaves the tab empty.

## When it shows

`templateStartMode` (`components/start/template-start-mode.ts`) decides, from the editor's state:

- To someone who can edit (an **Editor**), after hydration, outside zen and an embed, with
  no draw tool armed. Draw keeps a pen in hand on an empty tab, so there an armed pen does not hide it.
- While the tab is empty: no elements, and on an Illustrate tab its one page still has no kind.
- In Diagram, Draw, Facilitate or Illustrate. Plan has Start Planning.

A **Participant** or **Viewer** never sees a start: they keep the empty-canvas card ([New document
route](new-document-route.md) "The empty-canvas hint"), which tells a Viewer the owner can build it out and points a
Participant at what they may add.

A new tab opens on its mode's start (`newTabOpening` in `apps/live/lib/new-tab-seed.ts`).

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
list of modes and the preview of one ([Editor modes](editor-modes.md) "The mode switch"), with the same rules. On a
phone its menu spans the row it opens from, each mode a roomy row with its description across the full width.

**An empty tab crosses Plan's line.** Plan stands apart ([Editor modes](editor-modes.md)): a tab never switches into
or out of it, and the mode menu offers a new tab instead. An empty tab has nothing either side's tools could not
hold, so while a general tab has no elements it switches freely into and out of Plan, from the start's switch, the
top switch and Shift+D (`crossPlan` on `useEditorMode`). The first element closes the line again. Meanwhile the mode menu
shows Plan (or, on a Plan tab, the other modes) as a plain switch: no New tab mark, and choosing its row switches.

A mode change swaps one start for another. The new one **turns in place**: the frame stays still and the old content
crossfades into the new (the switch runs the change in `startTransition` typed `start-mode`, which the start's
`<ViewTransition>` cross-fades over `short`), so a
mode change reads as the same panel turning rather than a second one flying up or its content blinking out
(`startPanelJustLeft`, a start mounting within 400 ms of another leaving). The new content arrives whole, its rail and
cards not cascading in until the category or search changes. Without View Transitions, or with reduced motion, the
content swaps at once.

## Found in other modes

A search looks beyond the tab's mode. Someone on a Plan tab who types "sailboat" wants the Sailboat retrospective,
not an empty result: the start finds it in Facilitate, shows it, and choosing it takes the tab there.

- **What is searched.** Every listed template of every other mode (`otherModeMatches` in
  `components/start/other-mode-matches.ts`): a template's mode is `templateEditorMode`, the mode its tab opens in, so a
  template is in exactly one mode and never shows twice. From Start Planning that is every other mode's templates;
  from the others it includes Plan's templates. The same search as the mode's own (`templateMatchesQuery`), so the
  same words find the same templates wherever they are typed. A mode's blank is a template like the rest ("whiteboard"
  finds Blank Whiteboard).
- **Where it shows.** Under the mode's own results, after a hairline, a section headed **In Other Modes**, with the
  line "Choosing one switches this tab to its mode." Then one block per mode that matched, in the modes' order
  (Diagram, Draw, Facilitate, Illustrate, Plan): a header with the mode's icon on a soft tile of the accent, the mode's
  name and its count, then its cards in the same grid as every other result.
- **Each card says where it leads.** Under its line, a quiet chip with the mode's icon and "Opens in Facilitate", so a
  card seen alone still says it is not of this mode; assistive technology hears the template's name, "in Facilitate",
  then its description.
- **At most six a mode** (`OTHER_MODE_CARDS_MAX`), so a word that matches dozens of one mode's templates does not bury
  the rest; **Show All N** (N the mode's count) opens that mode's every match in place. The list clears with the search.
- **Nothing in this mode, something elsewhere.** The mode's own empty state is not shown; a single line opens the
  results instead, "No diagram templates match “sailboat”." with "Found in other modes." under it, then the other modes'
  blocks. **Nothing anywhere** shows the empty state, "Try another word."
- **Choosing one** lands the template on the tab at once, as any card does (`chooseTemplate`), and the template brings
  its mode: its tab opens in that mode (`templateCanvasOverrides`' `opensIn`), so the tab switches, through Plan's
  line too (an empty tab crosses it freely, [Changing mode](#changing-mode)). The start goes with the empty tab. A
  blank of the other mode (Blank Whiteboard from Start Diagramming) closes that mode's start, as choosing a start's own
  blank does, so the tab opens on the empty canvas asked for. The pick is a start-screen pick for
  [Default folders](#default-folders): a document `/new` just made moves to the template's default folder.
- **Only where the mode may change.** When the tab's mode is locked (the mode switch shows its lock,
  `canSwitch` false) the start searches its own mode alone, as before.

## Start Illustrating

The tab's first page is drawn only once the start is done: while Start Illustrating is open there is no page behind
it (`EditorCanvasHost` passes no pages), so nothing waits under the panel. Picking a template lands its pages;
closing the panel, or choosing **Blank Illustration**, shows the first page with its own **What Is This Page For?**
([Illustrate pages](illustrate-pages.md)). A blank of a page kind (Blank Slide Deck, Blank Article, Blank Infographic,
Blank Logo) lands one page of that kind, already chosen, so it asks nothing and the start does not come back over it.

**The last page can be deleted.** Deleting it (or the last article) clears the tab, its pages, its writing and its
elements, as one edit that Undo puts back, and brings Start Illustrating back even if it was closed. The agents'
page edits keep their own rule (`pageRemoved` refuses the last page, `last_page`).

## Default folders

A template picked here on a document `/new` just made goes to that template's default folder, unless the document
was made into a folder on purpose (a `/new?folder=` or `?team=` link, [Default folders](../013-workspace/default-folders.md) "A template
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

A template chosen fires `Template · Used · <kind>` through `chooseTemplate`. A template chosen from another mode's
results also fires `UI · Used · StartOtherMode`, so how often a search crosses modes is measurable.

## Tests

- `components/start/start-template-items.test.ts`: every mode's Recommended, groups and search, and every listed
  template reachable from its mode's start.
- `components/start/other-mode-matches.test.ts`: which modes and templates another mode's search finds, in order,
  never the tab's own mode, and the worst-case query within its budget.
- `components/start/StartPanel.test.tsx`: the In Other Modes section, its cap and Show All, the one-line no-match,
  Down from the search, choosing a card from another mode.
- `components/start/template-start-mode.test.ts`: when a start shows.
- `components/start/StartFromTemplates.test.tsx`: titles per mode, choosing, the blank closing, the per-mode close,
  scroll to top.
- `components/start/StartModeSwitch.test.tsx`, `hooks/editor/useEditorMode.test.tsx` (crossing Plan while empty).
- `components/start/start-palette.test.ts`, `start-panel-open.test.tsx`, `start-query.test.ts`.
- `components/start/StartAgainTray.test.tsx`, `components/canvas/empty-card-dismissed.test.ts` (bringing a start back), `hooks/editor/illustrate-page-edits.test.ts`
  (the last page).
