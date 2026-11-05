# Not in livehuddle

Status: **approved, being built** (Work Tracker #423, owner, 2026-11-04).

livehuddle is for meeting in Spaces ([Purpose](../001-project-vision/purpose.md)). Everything below came over from
livediagram at the fork and **leaves livehuddle**; livediagram keeps all of it, and its specs there are the ones to
read. A spec in this tree marked **Leaving livehuddle** describes code that is still here until the part named below
removes it: fix nothing in it but a bug that breaks a Space, and build nothing new on it.

## Why

The owner (2026-11-04): livehuddle carried the whole of Workshop mode, but livehuddle isn't about retros and
workshops; it is all about the meet aspect in Spaces. A facilitator running a retro has livediagram's Workshop mode,
which has every one of these tools, so nothing is lost to anyone: each tool now has one home.

## What leaves

| What                                                                                                                                                                                                                                                                                                                                                                   | Its specs in this tree (until removed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Removed in                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Slide decks, building a deck, presenting, the Page element                                                                                                                                                                                                                                                                                                             | [Presentation mode](../012-collaboration/presentation-mode.md), [The Page element](../009-elements/page-element.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Part 2 (done)                                                                         |
| The retrospective, workshop, planning and strategy templates, and the quizzes and games                                                                                                                                                                                                                                                                                | [Templates by mode](../007-editor/templates-by-mode.md) (rewritten), [Quiz and game templates](../012-collaboration/quiz-and-game-templates.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Part 3 (done)                                                                         |
| Every Collaborate element: Dot vote, Poll, Quiz, the estimate scales, Temperature check, Idea box, Q&A board; Timer, Stopwatch, Reveal zone, Done check, Picker; Comment panel, Action card, Agenda, Decision record, Roll call                                                                                                                                        | [Live poll](../012-collaboration/live-poll.md), [Keeping a poll's results](../012-collaboration/poll-result-capture.md), [Vote integrity](../012-collaboration/vote-integrity.md), [Quiz](../012-collaboration/quiz.md), [Estimate card](../012-collaboration/estimate-card.md), [Temperature check](../012-collaboration/temperature-check.md), [Idea box](../012-collaboration/idea-box.md), [Q&A board](../012-collaboration/qa-board.md), [Per-participant responses](../012-collaboration/participant-responses.md), [Done check](../012-collaboration/done-check.md), [Picker](../012-collaboration/picker.md), [Reveal zone](../009-elements/reveal-zone.md), [The Comment Panel](../012-collaboration/comment-pin.md), [The Action Panel](../012-collaboration/action-panel.md), [Agenda](../012-collaboration/agenda.md), [Decision record](../012-collaboration/decision-record.md), [Roll call](../012-collaboration/roll-call.md) | Part 3 (done); code: part 4 (done)                                                    |
| The Session strip's Poll, the Session button, the Workshop tour                                                                                                                                                                                                                                                                                                        | [Session button](../012-collaboration/session-button.md), [Workshop tour](../012-collaboration/workshop-tour.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Part 3 (done); code: part 4 (done)                                                    |
| The diagram tools: the Shapes and My shapes categories, arrows and lines, the Draw tools (pencil, highlighter), the Layout containers but the frame (lane, stack, boundary, timeline, diagram key, card, badge, step number), pointer notes, tables and checklists, the Data charts and progress and rating, code blocks, the components, the video and website embeds | [The lane](../009-elements/lane.md), [The stack](../009-elements/stack.md), [The boundary](../009-elements/boundary.md), [Timeline](../009-elements/timeline.md), [The diagram key](../009-elements/diagram-key.md), [The card](../009-elements/card.md), [The badge](../009-elements/badge.md), [The step number](../009-elements/step-number.md), [The pointer note](../009-elements/pointer-note.md), [Checklist](../009-elements/checklist.md), [Data charts](../009-elements/pie-chart.md), [Progress](../009-elements/progress.md), [Rating](../009-elements/rating.md), [Code block](../009-elements/code-block.md), [Web components](../009-elements/web-components-and-no-groups.md), [YouTube video](../009-elements/youtube-video.md), [More than YouTube](../009-elements/embed-providers.md), [Website embed](../009-elements/website-embed.md), and the arrow, shape and pen specs in `008-canvas/`                             | Part 3 (offered nowhere, done); their UI leftovers: part 4 (done); element code: #459 |

Each leaving spec has its twin in livediagram under the same path (`livediagram/docs/specs/`), which stays the one
to change.

## What stays

- **Spaces, avatars, rooms and calls**: Avatar mode, the Space elements (Travel, Seating, Rooms, Amenities), the Selection Mode
  buttons, the four Spaces templates, proximity audio and calls.
- **Light meeting tools**: the Session strip's **Timer** (countdown and stopwatch; the Vote went later, [Vote](#the-vote)),
  [Bring Focus](../012-collaboration/bring-focus.md), and the [facilitator baton](../012-collaboration/facilitator.md)
  they answer to, and Follow-me. The laser, the spotlight and the Reaction Pads went later
  ([The presenting tools](#the-presenting-tools-isometric-and-zen)); the Avatar panel's Reactions (a burst around your
  own character, keys `1` to `5`) stay.
- **Light content**: sticky notes, text, images (with image search and the gallery), stickers, icons and link cards.
  The Frame went later ([The Frame](#the-frame)).
- **Talking without a call**: speech bubbles, comments with mentions, comment reactions, and assigned actions from
  any element's menu with the Collaborate Panel.
- **Every platform feature** ([v1 scope](v1-scope.md) section 7).

## The presenting tools, Isometric and Zen

The owner (2026-11-05): "Remove Isometric Mode, Laser, Spotlight and Zen Mode from livehuddle", and the Reaction Pads
with them (only the pads: the Avatar panel's Reactions, the stickers and comment reactions stay). Each is a way to
point at or present a diagram, or to look at one differently; in a Space your character is the pointer, walking up to
the thing is the spotlight, and its own Reactions are the celebration. livediagram keeps all five, and its specs are
the ones to read: [Laser](../../../../livediagram/docs/specs/008-canvas/laser-panel.md),
[Spotlight](../../../../livediagram/docs/specs/008-canvas/spotlight-panel.md),
[Isometric view](../../../../livediagram/docs/specs/008-canvas/isometric-view.md),
[Zen mode](../../../../livediagram/docs/specs/007-editor/zen-mode.md) and
[Reaction Pad](../../../../livediagram/docs/specs/009-elements/reaction-pad.md). Their specs in this tree are deleted
with the code, not kept with a banner.

- **Gone from every surface**: the canvas-tool picker, the palette and its Search results, the command palette, the
  keyboard shortcuts (and the Settings Keyboard reference), the tool panels (Laser, Spotlight), the orbit button and
  the isometric depth layer, the Zen toggle and its chrome rules, the editor tour, the help articles and the marketing
  copy. An old help address for one of them redirects to the nearest article that stays.
- **A Selection Mode button that switched to one of the removed modes** (`laser`, `spotlight`, `isometric`) loads as
  a button with no mode, so it reads as the default (Avatar), the way a stored Highlighter button already does
  (`legacy-mode-buttons`). The `mode` field is dropped on load; nothing else on the button changes.
- **A Selection Mode button for Select, Hand, Eraser or Format** (`select`, `pan`, `eraser`, `format`) loads the same
  way: the palette's Selection Mode category is gone and Avatar is the one mode a button hands out
  ([Selection Mode button](../009-elements/mode-button.md#only-avatar)), so the stored `mode` is dropped and the
  button reads as an Avatar button.
- **A stored Reaction Pad** is a [retired element](#retired-elements) named "Reaction Pad": kept untouched, drawn as
  the placeholder, pressing and walking onto it do nothing.
- **The wire.** `laser` and `reaction` are retired op kinds, as the Vote's `vote` is ([The Vote](#the-vote)): the
  room drops one at its op gate before anything else reads it, so a tab on an older build that sends one costs
  nothing (never sequenced, relayed, logged or replayed). The editor no longer sends either.
- **Stored view choices.** A browser that stored Zen as on, or a laser or spotlight pen, keeps the key; nothing reads
  it. The Isometric dot-grid **background** is not Isometric mode and stays.

## The Frame

The owner (2026-11-05): "We don't need Frames in LiveHuddle". A Frame is a diagram's section: an outline with a
corner label drawn round a cluster of boxes. A Space already has its own ways to mark out an area (a Room, a Rug, a
Stage), and a section box with a heading is one more thing to learn that a meeting never needs. livediagram keeps it,
and [its spec there](../../../../livediagram/docs/specs/008-canvas/canvas-and-palette.md) is the one to read.

- **Gone from every surface**: the `F` key, the context menus' frame rules, the palette and its Search results (the
  Frame tile and the Frame category went first), the help articles and their keyboard lines, and the marketing copy.
- **A stored Frame** is a [retired element](#retired-elements) named "Frame": kept untouched, drawn as the
  placeholder in its own box. It still paints behind everything else (a backdrop, as it always was), so the
  placeholder never covers what sits on it. It is no longer a container: dragging it moves only the placeholder.
- **What sat in a Frame stays put.** Membership was never stored (a container holds whatever its box holds, the
  shared containment rule), so every element that sat in a Frame keeps its position, its look and its arrows.
- **Agents and imports make no Frame.** The kind is not in the agent schema; an agent that names `frame` gets a
  square (the shape coercion every unknown kind gets). The graph tool's groups and its shape key, a Mermaid
  subgraph, and an Excalidraw frame are drawn as a [boundary](../009-elements/boundary.md) (Inset style: the title
  inside the top-left corner) instead, and the edit operation is `wrap <sel…> in boundary|lane`. Those are the
  diagram engine's (#459): when it leaves, they go with it.

## The Vote

The owner (2026-11-05): "We don't need Vote in Livehuddle". The dot vote is a workshop tool: a facilitator puts
ideas on stickies and the room ranks them. A Space is for meeting, and a quick show of hands there is a word in the
call or a sticky of its own. livediagram keeps it, and its specs are the ones to read:
[Session tools](../../../../livediagram/docs/specs/012-collaboration/session-tools.md) (voting, the Vote panel, vote
privacy) and [Vote layer scope](../../../../livediagram/docs/specs/012-collaboration/vote-layer-scope.md). The vote's
own specs in this tree (the vote keys blueprint, the vote layer scope record) are deleted with the code, not kept with
a banner; the [Timer and Stopwatch](../012-collaboration/session-tools.md) stay.

- **Gone from every surface**: the Vote button in the bottom-right Session cluster beside the Timer, the Vote panel
  and the session studio's Vote pane, the dot-vote session itself (casting dots on stickies, images and shapes, one
  dot per element, the vote keys and number-key casting, vote privacy's Hide Cursors and Hide Counts, the results
  reveal and the results walkthrough), its keyboard shortcuts, the help articles and the marketing copy. An old help
  address for one of them redirects to the nearest article that stays.
- **Its telemetry**: `Tab Started Vote`, `Tab Ended Vote`, `Tab Revealed Vote`, `Tab Cleared Vote`, `Element Voted`
  and `Element Removed Vote` are no longer sent. The `Voted` and `Revealed` actions leave the telemetry allowlist, so an
  old client's event is filtered out at ingest.
- **A tab saved with a `vote` field** loads: `dropRetiredVote` (`packages/document/src/retired-vote.ts`) drops the
  field on read. The stored-tab migration runs it beside the retired layers, plan and pages cleanups, and a peer's
  `tab-meta` patch goes through it too, so no data migration is needed and the tab is saved without it next time. It
  also replaces the old `voteLayerId` handling in `retired-layers`.
- **The wire.** The room carries an op as `unknown`, so an old client's `vote` op still parses; the room drops it at
  the op gate (a retired op kind in `@livehuddle/api-schema`'s room messages), so it is never sequenced, relayed,
  logged for catch-up or noted in the collaboration ledger. A stored ledger entry for a tab's vote is ignored when a
  save is merged.
- **A stored Session Button** that started a vote is a [retired element](#retired-elements) like any other Session
  Button, and keeps its name "Dot Vote" (retired element naming is unchanged).
- **Share roles**: a Participant comments, adds stickies and writes (and reacts); casting dots is no longer one of its
  acts ([Share roles](../013-workspace/share-roles.md)).

## Imports from other tools

The owner (2026-11-05): "Import from other apps like mermaid makes no sense to huddle". Reading another tool's
board (an Excalidraw scene, a Mermaid flowchart) is how a diagram moves between diagram tools; a Space is built from
its rooms, furniture and stickies, and nobody brings a meeting in from Excalidraw. Part 4 already took the draw.io,
Microsoft Whiteboard, Markdown and Mermaid imports out of the editor
([above](#the-diagram-tools-still-in-livehuddles-ui)); this takes the rest. livediagram keeps all of it, and its specs
are the ones to read:
[Excalidraw import and export](../../../../livediagram/docs/specs/020-import-export/excalidraw-import-export.md),
[Mermaid](../../../../livediagram/docs/specs/020-import-export/mermaid.md),
[The board scene](../../../../livediagram/docs/specs/020-import-export/board-scene.md) and
[Board import](../../../../livediagram/docs/specs/020-import-export/board-import.md). Those pages in this tree carry a
**Gone from livehuddle** banner and record what livehuddle had.

- **Gone from every surface**:
  - the editor: Import to Tab's Excalidraw card; the `/import` page (the Explorer's Import from already listed no
    source for livehuddle, so nothing linked to it; an old `/import` address is the editor's not-found page); pasting
    an Excalidraw copy; dropping an `.excalidraw` file, or an Excalidraw PNG or SVG export, as its scene; the board
    scene paste notice; Export Tab's **Mermaid** and **Excalidraw** cards;
  - agents: the `mermaid` input everywhere it stood beside `graph` (the MCP's `create_document`, `add_tab` and
    `update_document`, the api's seeded tabs and a changeset's `replace`, the CLI's `-f` files and `graph lint` /
    `render`), and the CLI's `export --format mermaid`;
  - the help articles' Excalidraw, Mermaid and import sections, and the marketing copy.
- **What stays**: Import to Tab with a **livehuddle tab's JSON** (backup and restore; the one format left, so the
  dialog opens straight at its paste or pick-a-file panel), and Export Tab's JSON, Markdown (the tab's text as an
  outline, nothing another tool needs), PNG, SVG and PDF. The graph input (`graph`: nodes and edges by id) is the
  diagram engine's, Work Tracker #459, and goes with it, not here.
- **What a paste or a drop does now.** An Excalidraw copy is text like any other paste. A dropped `.excalidraw` file is
  refused like any other file the canvas does not take; an Excalidraw PNG or SVG export lands as the picture it is.
- **An agent that sends `mermaid`** is told plainly: the api answers 400 (a `replace` takes exactly one of graph,
  template or elements; a seeded tab with neither elements nor a source is refused as it always was), the MCP's schema
  has no `mermaid`, and the CLI reads a Mermaid file as edit-operation lines, which the line parser refuses by its
  first line; `graph lint` / `render` say the file holds no graph.
- **What an import already brought in stays.** Its elements are ordinary elements and draw, move and edit as before.
- **Telemetry**: `Element Imported Excalidraw`, `Tab Imported Excalidraw` (and its PNG and SVG kinds) and
  `Document Exported Mermaid` / `Excalidraw` are no longer sent. The `Imported` and `Exported` actions stay: the
  JSON import and the other export formats still send them, with their own types.
- **The groups-to-Boundary code.** A Mermaid subgraph and an Excalidraw frame came in as boundaries
  ([The Frame](#the-frame)); both importers are gone, so that mapping is gone with them. The cluster layout
  (`auto-layout-clusters`) still draws a `graph`'s groups as boundaries, so it stays until #459.

## Quick Connect

The owner (2026-11-05): "The Plus menu is pointless in livehuddle, remove it from elements". Quick Connect is the
four **+** buttons round a selected element, each opening a small menu to grow a diagram from that side: Duplicate,
Arrow, Pencil and Text (a table's Add Row and Add Column, a web component's Add Step and its kin). It is how a
diagram builds outward node by node; a Space is laid out from the palette, and a chair or a room has nothing to
connect to. livediagram keeps it, and [its spec there](../../../../livediagram/docs/specs/008-canvas/canvas-and-palette.md#quick-add--connect)
is the one to read.

- **Gone from every surface**: the four **+** buttons and their menus on every element (a chair, a room, a sticky,
  a stored table or web component alike), the **Quick-Add on Hover** setting (Settings, Editor, Mouse), its help
  article and its lines in the other articles, and the selection toolbar's wider gap that made room for the top
  **+** (the toolbar now sits close over every box). The element toolbar never had a **+** of its own, so nothing
  else goes. An old help address for the setting redirects to the nearest article that stays.
- **Drawing a new arrow goes with it.** The menu's Arrow was the last way to start one: the palette's Arrow tile left
  in part 3, and an element's edge midpoints are resize handles, not arrow anchors. A stored arrow stays as the
  diagram tools left it ([What stays](#the-diagram-tools-still-in-livehuddles-ui)): it draws, its ends drag and
  re-pin, it moves and deletes. The gesture engine under the drawn arrow (`beginAnchorDrag`, its click-to-place, tap
  and Shift-chain modes, and their hint) is the arrow engine's, Work Tracker #459, and goes with it, not here.
- **A stored `quickAddOnHover`** preference is not read. The key stays shared in `@liveworkspace/settings`
  (livediagram still has the setting), so a value stored there or in an old browser is kept, unread, like any key
  this version does not know.
- **Telemetry**: `UI` / `Toggled` / `QuickAddHoverOn` and `QuickAddHoverOff` are no longer sent; nothing else the
  menu sent was its own (Duplicate, Text and Pencil sent the ordinary creation events, which other paths still send).

## Quick Style

The owner (2026-11-05): "Remove the quick style panel from livehuddle". The Quick Style panel is the floating panel
on the left edge of the canvas that appeared beside a selection: Stroke, Background and Text colour swatch rows (the
theme's seven, Ink and More colours), the width, line style, corner, text and icon alignment rows, the Marker and
Highlighter rows, and its Actions section's **Clear Styles**. It restyles shapes and arrows in one click, a diagram
habit; a Space is furnished, not restyled shape by shape. livediagram keeps it, and
[its spec there](../../../../livediagram/docs/specs/008-canvas/quick-style-panel.md) is the one to read. The
[spec](../008-canvas/quick-style-panel.md) and [blueprint](../008-canvas/blueprints/quick-style-panel.md) in this tree
carry a **Gone from livehuddle** banner and record what livehuddle had.

- **Gone from every surface**: the panel itself (every row, its custom swatch popover and its More colours), the
  **Settings › Panels › Quick Style** page with its **Enable Quick Style Panel** switch, the help article (its old
  address lands on Colours, Borders and Opacity) and the help and marketing copy that sent people to it. The panel
  had no keyboard shortcut, dock button or tour step, so none goes.
- **Not the dock's Style button.** The bottom-right **Style** button opens **Tab Style** (the tab's look: theme,
  colours, finish, text and canvas), a different panel. It stays.
- **A stored `quickStylePanelEnabled`** is not read. The key is kept in the preferences blob, unread, like any key
  this version does not know, so no migration is needed. Stored custom swatches (`quickSwatchOverrides`) are kept the
  same way; nothing in livehuddle shows or edits them any more.
- **What stays for styling**: the element menu (right-click, long-press or a toolbar's More) stays the complete home
  of every element setting, as it always was: its **Style** flyout (colours, border, shadow, opacity, corners), the
  Text category, the colour picker with Custom colours, and the quick bar's **Clear Styles**
  ([Element menu quick bar](../008-canvas/element-menu-quick-bar.md)), which still puts the element's colours, width
  and line style back to the theme's. The multi-selection menu restyles a whole selection. **Tab Style** themes the
  tab. **Style memory** (the next element of a kind takes its last style) keeps working from the menu.
- **Telemetry**: the panel's `Element Changed` tokens (`QuickStroke`, `QuickBackground`, `QuickTextColour`,
  `QuickStrokeWidth`, `QuickStrokeStyle`, `QuickTextAlign`, `QuickIconAlign`), `UI Changed QuickSwatchCustom` and
  `QuickSwatchReset`, and `QuickStylePanelOn` / `Off` are no longer sent. `QuickClearStyles` stays: the quick bar's
  Clear Styles still sends it.
- **The code.** The panel's components (`QuickStylePanel`, its rows, More colours, the Marker and Highlighter rows,
  the swatch override popover) are deleted with their tests. A headless `ClearStylesHost` keeps the Quick Style view
  (`useQuickStyle`), which works out what Clear Styles resets, and publishes it to the quick bar. The panel's
  placement hook and the Clear Styles store are `@liveworkspace/workbench`'s, shared with livediagram, and stay.

## A Space that already holds a leaving element

A stored Space may already hold a retro board, a poll card or a Page.

- **Part 2 is done**: no route, menu, palette entry, command, shortcut or help article offers a deck, presenting or
  the Page. A document's stored deck (its `presentation` field) is kept: the editor never reads or writes it, so a
  save leaves it as it was, and livediagram still presents it. A stored Page is a shape kind like any other: it still
  draws, moves, copies, edits and deletes.
- **Part 3 is done**: no palette entry, Search result, template, shortcut or help article adds a leaving element,
  and the Session strip offers the Timer. A stored one still draws, moves, copies and deletes as it did, and a
  running poll ends as it did: the strip's Poll button shows while a stored Poll card's poll runs, so the
  person who started it can end it, and never offers a new one. The retired templates' builders and previews were
  deleted with them (the catalogue, the union and the builders move together); a document named after one still
  reads as unnamed.
- **Part 4 is done**: livehuddle's code for the Collaborate elements, the Session button, the live poll, the Q&A
  board's endpoint and the per-participant responses is deleted (see [Retired elements](#retired-elements) below). The
  count it started with, read only: no stored livehuddle tab on the build machine or in the checked-in fixtures holds
  a leaving kind (no local store holds any livehuddle tab, and no fixture names one of the kinds). Production tabs live
  in each document's Durable Object, which no read-only query reaches, so the placeholder is what keeps them safe.

### Retired elements

A **retired element** is a stored element whose kind livehuddle no longer has: the 14 shape kinds part 4 deleted
(`session-button`, `reveal`, `picker`, `comment-pin`, `action-card`, `done-check`, `estimate`, `temperature`,
`idea-box`, `qa-board`, `agenda`, `decision`, `roll-call`, `quiz`), the `reaction-pad` that went with the
presenting tools, the `frame` ([The Frame](#the-frame)), and any other shape kind livehuddle does not know.

- **Kept untouched.** Its kind and every field it carries (a poll's question, a board's notes, its responses) stay in
  the document exactly as stored. Nothing in livehuddle reads or writes them, so a save, a sync, a copy and an undo
  carry them through; livediagram still opens them as they were.
- **Drawn as a placeholder.** A plain card in the element's own box: a dashed outline, a muted fill, the kind's name
  ("Q&A Board", "Poll", "Agenda"; "Unknown Element" for a kind livehuddle never had) and, beneath it, "Not in
  livehuddle". Its stored label shows below that when it has one. The export and the thumbnail draw the same card.
- **What it does.** It selects, moves, resizes, copies, locks and deletes like any element, and takes
  comments. It takes no typed label (double-clicking it opens nothing), has no settings or context-menu section of its
  own, presses nothing and starts nothing. Agents read it by its stored kind.
- **Nothing new.** No palette entry, Search result, template, agent verb, CLI command or paste makes one; an agent that
  names a retired kind gets a square (the shape coercion every unknown kind gets).

The session state that only these elements used goes the same way: a stored running poll is never shown, and the
Session strip offers the Timer only. A document's stored deck (`presentation`) stays as part 2 left it: carried
and redacted by the api, never read or written by the editor.

### The diagram tools still in livehuddle's UI

Part 4 also removes the diagram tools livehuddle's UI still offered after part 3, with their help articles (each old
address redirects to the nearest article that stays): Tidy Up's Auto Layout tiles (Tidy Up keeps Auto-Align and its
cleanup), the Explorer's Shape Libraries page and library import, the draw.io, Mermaid, Markdown and Microsoft
Whiteboard imports, Settings' Auto-Attach Arrows, and the search panel's Add to Canvas results for tiles the meeting
palette does not offer (it adds only what the palette offers). The element engine under the diagram tools (shapes, arrows,
pens, the layout containers) is Work Tracker #459's, not this part's: a stored one still draws, moves and deletes.

## Share roles

Nothing changes in who may do what with what stays ([Share roles](../013-workspace/share-roles.md)). A leaving
element's role rules no longer apply: its placeholder follows the Editor, Participant and Viewer rules of any element
(an Editor moves, copies and deletes it; a Participant moves and deletes only what they added, as with any element, and
comments on it; a Viewer sees it).

## Testing

- Part 2: no route, menu, palette entry or help article offers a deck, presenting or the Page: `EditorHeader.test.tsx`
  (no Present button), `editor-commands.test.ts` (no Slide Deck command), `settings-catalogue.test.ts` (no Presenting
  settings), `palette-search.test.ts` (no Page result) and `view-transitions.test.ts` (no slide moves); the router's
  `legacy-editor-route.test.ts` pins the help redirects.
- Part 3: the catalogue test pins the five templates; a link, an agent or a seed naming a leaving template is answered
  with Blank Space (`retired-templates.test.ts`); a palette test pins the meeting palette; the strip test pins the
  Timer.
- Part 4: a stored tab holding each deleted kind loads, saves unchanged and shows its placeholder
  (`retired-kinds.test.ts` in `packages/document`, `RetiredElementFace.test.tsx` and the e2e
  `retired-elements.spec.ts` in the editor); the export draws the placeholder (`svg-render-retired.test.ts`); no
  palette entry, Search result or agent schema names a deleted kind; Tidy Up, Import and Settings show no diagram
  tool; the router's `legacy-editor-route.test.ts` pins the retired help addresses.
- The presenting tools: a stored Reaction Pad loads as a retired element named Reaction Pad (`retired-kinds.test.ts`),
  a stored Laser, Spotlight or Isometric button loads with no mode (`legacy-mode-buttons.test.ts`), the picker and
  the command palette name none of them (`useCanvasTool.test.ts`, `editor-commands.test.ts`), and the router pins
  their old help addresses.
- The Frame: a stored Frame loads as a retired element named Frame, still paints at the back and carries nothing
  (`retired-kinds.test.ts`); the keyboard map has no `F` (`useEditorKeyboardShortcuts.test.ts`); the agent schema
  offers no frame, and a graph's groups come out as boundaries (`auto-layout-clusters.test.ts`).
- Vote: a stored tab with a `vote` field loads and saves without it (`retired-vote.test.ts`), a `tab-meta` patch
  carrying one is dropped, the room drops a `vote` op at the op gate, the strip offers no Vote button, telemetry
  filters `Voted` and `Revealed` out at ingest, and the router pins the old voting help addresses.
- Imports from other tools: Import to Tab offers JSON alone (`ImportTabDialog.test.tsx`), Export Tab offers no
  Mermaid or Excalidraw card, a paste never lands a scene, the api refuses a `mermaid` replace (`request.test.ts`),
  the MCP and CLI schemas name no `mermaid`, and the router pins the old import help addresses.
- Quick Connect: the selection view derives no plus buttons (`canvas-selection.test.ts`), the toolbar takes the close
  gap over a box (`CanvasSelectionToolbars.gap.test.tsx`), Settings has no Quick-Add on Hover row
  (`settings-catalogue.test.ts`), and the router pins the old help address.
- Quick Style: Settings has no Quick Style page (`settings-catalogue.test.ts`, `SettingsDialog.test.tsx`), the editor
  loads no panel chunk (`document-lazy-load.test.ts`), the quick bar's Clear Styles still resets a selection
  (`ElementMenuQuickBar.test.tsx`, `useQuickStyle.test.tsx`), and the router pins the old help address.
- Every part: the help path tests (`repo-paths-in-docs`, `article-links`, the heading anchors) pass.
