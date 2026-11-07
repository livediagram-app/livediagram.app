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

- **Spaces, avatars, rooms and calls**: Avatar mode, the Space elements (Travel, Seats, Rooms, Perks), the Selection Mode
  buttons, the four Spaces templates, proximity audio and calls.
- **Light meeting tools**: [Bring Focus](../012-collaboration/bring-focus.md), the
  [facilitator baton](../012-collaboration/facilitator.md) it answers to, and Follow-me. The Session strip's Timer went
  later, for the [Timer and Stopwatch](../009-elements/timer-and-stopwatch.md) pieces ([The Session strip's
  Timer](#the-session-strips-timer)), and so did the Vote ([Vote](#the-vote)). The laser, the spotlight and the Reaction Pads went later
  ([The presenting tools](#the-presenting-tools-isometric-and-zen)); the Avatar panel's Reactions (a burst around your
  own character, keys `1` to `5`) stay.
- **Light content**: sticky notes, text and stickers. The Frame went later ([The Frame](#the-frame)), and so did
  the Icons category ([Icons](#icons)) and adding images and link cards ([Media](#media-image-and-link-card)).
- **Talking without a call**: speech bubbles, comments with mentions, comment reactions, and assigned actions from
  any element's menu with the Collaborate Panel.
- **Every platform feature** ([v1 scope](v1-scope.md) section 7) but the MCP server, the CLI and workbenches
  ([The MCP server, the CLI and workbenches](#the-mcp-server-the-cli-and-workbenches)).

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
  it. The Isometric **background** is not Isometric mode; it went later with the other diagram patterns
  ([The diagram canvas patterns](#the-diagram-canvas-patterns)).

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
a banner; the Session strip's Timer stayed then, and left later ([The Session strip's Timer](#the-session-strips-timer)).

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
- **Share roles**: a Participant comments and reacts (it no longer adds stickies or writes either,
  [A Participant walks](../013-workspace/share-roles.md#a-participant-walks)); casting dots is no longer one of its
  acts ([Share roles](../013-workspace/share-roles.md)).

## The Session strip's Timer

The owner (2026-11-05): "The Timer button should be removed, and instead have elements we can place in rooms that are
Timer or Stopwatches". A tab-wide timer button is a workshop's: one facilitator, one timebox. A Space holds several
rooms, each with its own meeting, so a meeting's clock is now a piece on a room's wall: the
[Timer and Stopwatch](../009-elements/timer-and-stopwatch.md), in the Meet category. livediagram keeps its Session
strip and Timer, and its [Session tools](../../../../livediagram/docs/specs/012-collaboration/session-tools.md) spec is
the one to read for them; livehuddle's [Session tools](../012-collaboration/session-tools.md) is kept as the record.

- **Gone from every surface**: the Session strip in the bottom-right cluster and its Timer button (the live clock on
  the button, the dial, the extensions), its popover and the session studio's Timer pane, the timer's hover card, the
  `session-timer` dock popover, and the help copy that sent people to the bottom bar. There was no keyboard shortcut
  or command for it. The Session Tools article and its Timer sub-article now teach the pieces, at the same addresses.
- **Its telemetry**: `Tab Started` / `Ended` `CountdownTimer` / `StopwatchTimer`, `Tab Toggled TimerPaused` /
  `TimerResumed`, `Tab Changed TimerReset` / `TimerExtended` and `UI Opened SessionTimer` are no longer sent. The
  `Started` and `Ended` actions stay: tours, the baton and the new pieces send them.
- **A tab saved with a `timer` field** loads: `dropRetiredTimer` (`packages/document/src/retired-timer.ts`) drops it
  on read, beside `dropRetiredVote`, in the stored-tab migration and on a peer's `tab` op and `tab-meta` patch. An old
  running timer simply stops showing; no data migration.
- **The facilitator baton** no longer governs a clock: the pieces belong to their rooms and anyone who takes part runs
  them ([Timer and Stopwatch](../009-elements/timer-and-stopwatch.md#share-roles)).

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

## Icons

The owner (2026-11-05): "Remove Icons from livehuddle, keep Stickers". The Icons category is a searchable catalogue
of single-colour line glyphs (server, database, user, lock...) for labelling a diagram's boxes. A Space is decorated
with Stickers, the colour emoji and word badges people react and mark status with, and two decoration catalogues side
by side is one more place to look. livediagram keeps the Icons category, and its specs are the ones to read:
[Canvas and palette](../../../../livediagram/docs/specs/008-canvas/canvas-and-palette.md) (the Icons tab, icons
inside shapes, swapping an icon) and
[Browsing the palette by category](../../../../livediagram/docs/specs/010-palette/palette-category-browse.md).

- **Gone from every surface**: the Icons button on the category bar (between Meet and Stickers) and its two-pane
  browse of icon groups; the Toolbar strip Search's icon matches; the search panel's Add to Canvas icon results;
  dragging a palette icon onto a shape (an inline icon) or onto an icon (a swap), and clicking a palette icon while a
  shape is selected (no palette icon is left to drag or click); the Technology marks (AWS, React...) in the Toolbar
  strip's Search and the search panel; the help article and the marketing copy that named it. An old help address for it redirects to
  the Stickers article. The Icons category had no keyboard shortcut or command palette entry, so none goes.
- **A stored icon stays.** The `icon` shape kind, a shape's inline icon (`iconId`, `iconPosition`) and the renderer,
  the export and the icon catalogue are untouched, so a Space that already holds one draws it, and it moves, copies,
  restyles and deletes as before. Its element menu keeps the Icon section (position, size, weight, Remove Icon) and
  the icon animations; dragging a stored icon element onto a shape still folds it in, and onto another icon still
  swaps the glyph. Nothing migrates.
- **What stays for decoration**: Stickers, with its own browse and search, as it was. A sticker is its own shape kind
  (`sticker`), not an icon, so nothing it needs goes.
- **Agents are not this part.** The api's `GET /icons` catalogue, the MCP's `search_icons` and an agent's `iconId` on
  an element are the agent tools' (the diagram engine, Work Tracker #459) and stay until that part decides them.
- **Telemetry**: `Element Added Icon` and `Element Added TechIcon` from the palette (a tap, a drag, a drop onto a
  shape) and `Element Changed IconSwapped` from a palette drop are no longer sent. The types stay in the allowlist:
  livediagram's palette and an agent still add icons.
- **The code.** The Icons category's entry and body (`IconPickerTab`), its strip groups and strip tiles, its
  catalogue Search entries, the search panel's `icon` results, the dynamic icon tile (`iconTileDef`) and the browse's groupings
  (`ICON_CATEGORIES`, `iconsInCategory`, `getLineArtIconCatalog` in `lib/icons.ts`, with their tests) are deleted.
  The plumbing under them goes too: the `icon` and `tech-icon` tile actions, `addIcon` and `addTechIcon` (and their
  `onAddIcon` / `onAddTechIcon` handlers), the `ICON_DND_MIME` and `TECH_ICON_DND_MIME` drag payloads and the drop's
  icon branch, the Technology dynamic tile (`techTileDef`) and its strip Search catalogue, the search panel's `tech:`
  entries, and the shape's palette-icon drop target (`useIconDropTarget`, `IconDropPreview`, `onDropIcon`,
  `dropIconOnElement`). What a stored icon still needs stays: `dropIconElementOnShape` (a stored icon dragged onto a
  shape or an icon) and `removeIconFromElement`. The icon catalogue and its loader are `@liveworkspace/icons` and
  `@liveworkspace/workbench`'s, shared with livediagram, and stay.

## The Participant's palette and content

The owner (2026-11-05): "dont let participants add notes or text elements, they shouldn't have a palette and always
be in avatar mode". livediagram's Participant adds stickies and text, writes on others' elements, moves stickies and
removes what it added, from a one-category palette ([its Share roles](../../../../livediagram/docs/specs/013-workspace/share-roles.md#what-a-participant-changes)).
In livehuddle that all goes: a Participant has no palette, adds, writes, moves and removes nothing, and is always in
Avatar mode. It keeps the piece actions (a Notice Board's pin and unpin of its own notes, a Door's swing, a Timer's
controls, the Jukebox, knocking), speech, reactions, comments and session answers. The detail is
[A Participant walks](../013-workspace/share-roles.md#a-participant-walks).

- **Stored content stays.** Stickies and text a Participant added earlier load and draw as they are, still signed
  with its adder key; only an Editor changes them now. Nothing migrates.
- **The code.** The `participate` palette category (`participantPaletteCategories`, `participantTiles`,
  `PARTICIPANT_TILES`), the `participantPalette` strip variant, `PARTICIPANT_KEYS`, the keyboard's `participant` flag
  and the participant content rule's add, remove and content-field branches (`PARTICIPANT_ADDABLE_TYPES`,
  `PARTICIPANT_TEXT_FIELDS`, `PARTICIPANT_STICKY_FIELDS`, `PARTICIPANT_PLACE_TYPES`, `PARTICIPANT_IMAGE_FIELDS`,
  `participantWritesOn`, `isParticipantPlaceable`) are deleted.

## Media: Image and Link card

The owner (2026-11-05): "remove the Media category, Image and Link from livehuddle". A Space is furnished from its
rooms and pieces and written on with stickies, text and stickers; pinning pictures and bookmark cards to the floor is
a board's habit, not a meeting place's. livediagram keeps both, and its specs are the ones to read:
[Images](../../../../livediagram/docs/specs/009-elements/images.md),
[Image search](../../../../livediagram/docs/specs/009-elements/image-search.md) and
[Link cards](../../../../livediagram/docs/specs/009-elements/link-cards.md). Those pages in this tree carry a
**Gone from livehuddle** banner.

- **Gone from every surface**:
  - the palette: the **Media** category (its Image and Link card tiles), the Image and Link card in **Popular**, the
    Link card in **Travel**, and the Image in a Participant's **Participate** category (a Participant has no palette
    now, [A Participant walks](../013-workspace/share-roles.md#a-participant-walks));
  - the strip's Search and the search panel's Add to Canvas (they list only what the palette offers, so neither names
    an Image or a Link card);
  - the `9` key (Image) and its row in the keyboard reference;
  - **pasting or dropping a picture file onto the canvas**: it used to upload the file and land an image element.
    Now a file pasted or dropped on the canvas is refused like any other file the canvas does not take, with one
    notice ("The canvas does not take files."); a livehuddle tab's JSON dropped there still points at Import;
  - the help articles (Images, Link Cards; their old addresses redirect to the nearest article that stays) and the
    marketing copy.
- **Not this part, so they stay**: the **Screen** piece and the video links it plays, a **Notice Board**'s notes, an
  element's **link** (Add Link: a URL or a tab an element opens), the account's **Image Gallery** in the Explorer
  (uploads and where each is used; it now lists only what older Spaces hold) and a profile picture. Tab and Export pictures (PNG, the live image) are pictures of a tab, not image
  elements.
- **A stored image or link card stays.** Both are ordinary elements: a Space that already holds one draws it (an
  image shows its picture, a link card its unfurled preview), and it selects, moves, resizes, copies, restyles and
  deletes as before. Double-clicking a stored image still opens its picker to swap the picture, and a link card's URL
  can still be changed, so a stored one is never stuck half set up. Nothing migrates.
- **Agents are not this part.** The api's and MCP's image tools (`list_images`, an element's `imageId`) and a
  `link-card` element in a changeset are the agent tools' (Work Tracker #459) and stay until that part decides them.
- **Telemetry**: `Element Added Image` and `Element Added LinkCard` are no longer sent from the editor. Both types stay
  in the allowlist: livediagram and agents still add them.
- **The code.** The Media entry leaves the meeting layout, the Image and Link card tiles leave Popular and Participate,
  and the Link card tile leaves Travel (its `tileGroup` goes; it files under `media` with the Image). The tile
  definitions stay in the catalogue, like the diagram tools' ([What stays](#the-diagram-tools-still-in-livehuddles-ui)),
  so a stored element still finds its name and glyph; nothing offers them. The paste and drop image upload
  (`pasteImageFile`, `addImageFromGallery`) and the `9` key are deleted.

## The diagram canvas patterns

The owner (2026-11-05): the canvas options "are all great for other apps", but a Space wants floors (concrete, grass,
mud, carpet). livehuddle's canvas wears a floor ([Floors](../011-theme/floors.md)) and the diagram backdrops leave:
the static patterns **Grid** (dots), **Lines**, **Graph**, **Crosshatch**, **Confetti**, **Stripes**, **Diagonal**,
**Waves**, **Bricks**, **Isometric**, **Checkerboard**, **Hexagonal** and **Engineering**, and the animated **Flow**,
**Drift**, **Aurora**, **Ripple** and **Ribbons** with their Speed slider. livediagram keeps every one, and its
[Canvas and palette](../../../../livediagram/docs/specs/008-canvas/canvas-and-palette.md) spec is the one to read.
**Blank** stays as None, and the seasonal looks keep their motifs.

- **Gone from every surface**: the Canvas panel's Static and Animated carousels (one Floor carousel now), the Pattern
  colour swatch (it shows only for a seasonal motif), the Speed slider, every look that wore one (each now wears a
  floor), and the help articles' pattern lists.
- **A tab saved with one** loads on the floor nearest it, from one table, or on None for the animated ones
  ([Floors](../011-theme/floors.md#stored-data)); nothing else on the tab changes. The ids stay in livehuddle's
  `BackgroundPattern` type so such a tab still validates.
- **Code**: the animated backdrop's overlay, its Looks-card still and the tab's speed setter are removed. A stored
  `backgroundAnimationSpeed` stays in the `Tab` type so an old tab still validates, and is ignored.

## A Space that already holds a leaving element

A stored Space may already hold a retro board, a poll card or a Page.

- **Part 2 is done**: no route, menu, palette entry, command, shortcut or help article offers a deck, presenting or
  the Page. A document's stored deck (its `presentation` field) is kept: the editor never reads or writes it, so a
  save leaves it as it was, and livediagram still presents it. A stored Page is a shape kind like any other: it still
  draws, moves, copies, edits and deletes.
- **Part 3 is done**: no palette entry, Search result, template, shortcut or help article adds a leaving element,
  and the Session strip offered the Timer (until it left too, [The Session strip's Timer](#the-session-strips-timer)). A stored one still draws, moves, copies and deletes as it did, and a
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
Session strip offered the Timer only (it has since left, [The Session strip's Timer](#the-session-strips-timer)). A document's stored deck (`presentation`) stays as part 2 left it: carried
and redacted by the api, never read or written by the editor.

### The diagram tools still in livehuddle's UI

Part 4 also removes the diagram tools livehuddle's UI still offered after part 3, with their help articles (each old
address redirects to the nearest article that stays): Tidy Up's Auto Layout tiles (Tidy Up keeps Auto-Align and its
cleanup), the Explorer's Shape Libraries page and library import, the draw.io, Mermaid, Markdown and Microsoft
Whiteboard imports, Settings' Auto-Attach Arrows, and the search panel's Add to Canvas results for tiles the meeting
palette does not offer (it adds only what the palette offers). The element engine under the diagram tools (shapes, arrows,
pens, the layout containers) is Work Tracker #459's, not this part's: a stored one still draws, moves and deletes.

## Hand, Eraser and Format as modes

The owner (2026-11-06): "change the selection mode dropdown so it just lets me toggle between Editor and ...
whatever using the board is without too long a name". The Selection Mode picker (Build: Select, Hand; Edit: Eraser,
Format) and the cluster's Walk button gave way to one [Edit | Walk toggle](../008-canvas/avatar-mode.md#the-edit--walk-toggle)
at the start of the strip. livediagram keeps its modes.

- **Hand** is not a mode: Space-drag, the trackpad, the middle button, and on a touch screen a drag on empty canvas
  (the device's default, unchanged) pan. `H` does nothing; Search has no Hand Tool.
- **Eraser** leaves livehuddle with its panel, brush ring, cursor, settings and the `E` and `0` keys
  ([Eraser Panel](../008-canvas/eraser-panel.md), retired): Delete removes a selection. `E` now means Edit.
- **Format** stays as the painter, started from the selection toolbar's **Format Painter** button
  ([Format painter](../008-canvas/canvas-and-palette.md#format-painter)); Search has no Format Painter entry.
- **Select** is **Edit**, the toggle's other side (`E`, `V`); Search's Select Tool and Avatar Mode are **Edit** and
  **Walk**.
- **Stored boards** load as before: a Selection Mode button only ever hands out Avatar in livehuddle, and one that
  carried Select, Hand, Eraser or Format loads as an Avatar button (`legacy-mode-buttons`).
- **Help**: the Hand and Eraser articles go and their addresses redirect; the Select and Format Painter articles say
  where the two now live.

## The MCP server, the CLI and workbenches

The owner (2026-11-06, Work Tracker #562 and #563): "We previously weren't sure whether we needed the MCP for
livehuddle, but I now know that we do not. Remove the MCP for this app and cleanup", and the same for the CLI. Every
other product keeps its MCP server and CLI (the platform rule that a fork keeps them no longer holds for livehuddle).
livediagram's specs ([MCP server](../../../../livediagram/docs/specs/015-api/mcp-server.md),
[CLI](../../../../livediagram/docs/specs/015-api/cli.md)) are the ones to read for what they did.

- **Gone**: the MCP Worker (`apps/mcp`, `mcp.livehuddle.app` and its staging host), its OAuth sign-in for AI tools
  (the editor's `/oauth/consent` and device pages, the api's `/api/oauth/exchange`, the capabilities' `oauthIssuer`),
  the CLI (`apps/cli`, `@livehuddle/cli` on npm, the capabilities' `cli` minimum version), the verbs package they shared
  (`packages/agent-verbs`), the MCP Registry listing (`server.json`), and the marketing site's **Build with AI** page
  (`/ai`) with its header link, FAQ answers, landing card and sitemap entry. The marketing header is Choose Template
  and Explorer.
- **Workbenches go with them.** A workbench opened a document inside a developer tool through the CLI
  (liveworkspace's [Workbench](../../../../liveworkspace/docs/specs/011-workbench/workbench.md)), so livehuddle no longer
  pairs one: the `/embed/workbench` frame, Settings' list of workbench pairings, the editor's workbench chrome and
  messages, and the api's `lvw_` session and its confinement are gone. An `lvw_` bearer now identifies nobody, and the
  router's `/api/workbench` answers 404 from the api. liveworkspace's pairing service is unchanged; livehuddle simply
  never redeems a pairing. The room keeps its share of the platform's pairing contract (closing a room with code 4006
  when a pairing ends), unused, until that contract is next changed.
- **Help**: the Connect an AI Tool, CLI and Workbenches articles go, and the developer articles show `curl` only. Old
  addresses redirect (router `legacy-editor-route.ts`): the AI and MCP articles to [API Tokens](/help/account-and-data/api-tokens/),
  the CLI and Workbench articles to the [API overview](/help/developers/api-overview/).
- **What stays**: the REST API and API tokens (full or read-only), agent changesets, document views, agent comments
  and presence, and everything else a script reaches over HTTP. The changeset front door still parses the `door` of a
  changeset an MCP client or the CLI sent, and telemetry still parses `Mcp`, `Cli` and the `Ai` marketing surface, so
  old events and stored history read as before.
- **Status page**: livehuddle has no MCP row ([Status](../../../../liveworkspace/docs/specs/009-status/status.md)).
- **The owner's steps after merging**: delete the `livehuddle-mcp` and `livehuddle-mcp-staging` Workers, their custom
  domains and DNS, their `livehuddle-mcp-oauth` KV namespaces and secrets, and deprecate `@livehuddle/cli` on npm.
  Deploys find Workers from the workspaces a change reaches, so a deleted app is never deployed.

## Share roles

Nothing changes in who may do what with what stays ([Share roles](../013-workspace/share-roles.md)). A leaving
element's role rules no longer apply: its placeholder follows the Editor, Participant and Viewer rules of any element
(an Editor moves, copies and deletes it; a Participant changes nothing, as with any element, and
comments on it; a Viewer sees it).

## Testing

- Part 2: no route, menu, palette entry or help article offers a deck, presenting or the Page: `EditorHeader.test.tsx`
  (no Present button), `editor-commands.test.ts` (no Slide Deck command), `settings-catalogue.test.ts` (no Presenting
  settings), `palette-search.test.ts` (no Page result) and `view-transitions.test.ts` (no slide moves); the router's
  `legacy-editor-route.test.ts` pins the help redirects.
- Part 3: the catalogue test pins the five templates; a link, an agent or a seed naming a leaving template is answered
  with Blank Space (`retired-templates.test.ts`); a palette test pins the meeting palette.
- The Session strip's Timer: a stored tab with a `timer` field loads and saves without it (`retired-timer.test.ts`);
  the cluster has no Session strip (`CanvasChrome` has no `session-tools` strip); the palette offers Timer and
  Stopwatch in Meet (`palette-layouts.test.ts`).
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
- Icons: the palette and the category bar offer no Icons category (`palette-layouts.test.ts`,
  `bar-categories.test.tsx`), the strip Search and the search panel list no icon (`palette-catalogue-search.test.ts`,
  `palette-search.test.ts`), a stored icon still draws and its menu still edits it, and the router pins the old help
  address.
- Media: the palette and the bar offer no Media category and no Image or Link card tile anywhere, Popular and
  Participate included (`palette-layouts.test.ts`, `bar-categories.test.tsx`, `share-roles.test.ts`), the search
  panel lists neither (`palette-search.test.ts`), `9` adds nothing (`useEditorKeyboardShortcuts.test.ts`), a pasted
  or dropped picture is refused with the notice (`useClipboard.drop.test.tsx`), and the router pins the old help
  addresses.
- Every part: the help path tests (`repo-paths-in-docs`, `article-links`, the heading anchors) pass.
