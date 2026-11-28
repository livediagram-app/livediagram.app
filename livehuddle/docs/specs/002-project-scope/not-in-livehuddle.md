# Not in livehuddle

Status: **approved, built** (Work Tracker #423, owner, 2026-11-04; its five parts have shipped, and Work Tracker #583
took the leftovers). The diagram tools' element engine, which nothing offered, was deleted in Work Tracker #459
([The element engine](#the-element-engine)).

livehuddle is for meeting in Spaces ([Purpose](../001-project-vision/purpose.md)). Everything below came over from
livediagram at the fork and **leaves livehuddle**; livediagram keeps all of it, and its specs there are the ones to
read. A spec in this tree marked **Leaving livehuddle** describes code that is still here until the part named below
removes it: fix nothing in it but a bug that breaks a Space, and build nothing new on it.

## Why

The owner (2026-11-04): livehuddle carried the whole of Workshop mode, but livehuddle isn't about retros and
workshops; it is all about the meet aspect in Spaces. A facilitator running a retro has livediagram's Workshop mode,
which has every one of these tools, so nothing is lost to anyone: each tool now has one home.

## What leaves

| What                                                                                                                                                                                                                                                                                                                                                                   | Its specs in this tree (until removed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Removed in                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Slide decks, building a deck, presenting, the Page element                                                                                                                                                                                                                                                                                                             | [Presentation mode](../012-collaboration/presentation-mode.md), [The Page element](../009-elements/page-element.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Part 2 (done)                                                                                                              |
| The retrospective, workshop, planning and strategy templates, and the quizzes and games                                                                                                                                                                                                                                                                                | [Templates by mode](../007-editor/templates-by-mode.md) (rewritten), [Quiz and game templates](../012-collaboration/quiz-and-game-templates.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Part 3 (done)                                                                                                              |
| Every Collaborate element: Dot vote, Poll, Quiz, the estimate scales, Temperature check, Idea box, Q&A board; Timer, Stopwatch, Reveal zone, Done check, Picker; Comment panel, Action card, Agenda, Decision record, Roll call                                                                                                                                        | [Live poll](../012-collaboration/live-poll.md), [Keeping a poll's results](../012-collaboration/poll-result-capture.md), [Vote integrity](../012-collaboration/vote-integrity.md), [Quiz](../012-collaboration/quiz.md), [Estimate card](../012-collaboration/estimate-card.md), [Temperature check](../012-collaboration/temperature-check.md), [Idea box](../012-collaboration/idea-box.md), [Q&A board](../012-collaboration/qa-board.md), [Per-participant responses](../012-collaboration/participant-responses.md), [Done check](../012-collaboration/done-check.md), [Picker](../012-collaboration/picker.md), [Reveal zone](../009-elements/reveal-zone.md), [The Comment Panel](../012-collaboration/comment-pin.md), [The Action Panel](../012-collaboration/action-panel.md), [Agenda](../012-collaboration/agenda.md), [Decision record](../012-collaboration/decision-record.md), [Roll call](../012-collaboration/roll-call.md) | Part 3 (done); code: part 4 (done)                                                                                         |
| The Session strip's Poll, the Session button, the Workshop tour                                                                                                                                                                                                                                                                                                        | [Session button](../012-collaboration/session-button.md), [Workshop tour](../012-collaboration/workshop-tour.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Part 3 (done); code: part 4 (done)                                                                                         |
| The diagram tools: the Shapes and My shapes categories, arrows and lines, the Draw tools (pencil, highlighter), the Layout containers but the frame (lane, stack, boundary, timeline, diagram key, card, badge, step number), pointer notes, tables and checklists, the Data charts and progress and rating, code blocks, the components, the video and website embeds | [The lane](../009-elements/lane.md), [The stack](../009-elements/stack.md), [The boundary](../009-elements/boundary.md), [Timeline](../009-elements/timeline.md), [The diagram key](../009-elements/diagram-key.md), [The card](../009-elements/card.md), [The badge](../009-elements/badge.md), [The step number](../009-elements/step-number.md), [The pointer note](../009-elements/pointer-note.md), [Checklist](../009-elements/checklist.md), [Data charts](../009-elements/pie-chart.md), [Progress](../009-elements/progress.md), [Rating](../009-elements/rating.md), [Code block](../009-elements/code-block.md), [Web components](../009-elements/web-components-and-no-groups.md), [YouTube video](../009-elements/youtube-video.md), [More than YouTube](../009-elements/embed-providers.md), [Website embed](../009-elements/website-embed.md), and the arrow, shape and pen specs in `008-canvas/`                             | Part 3 (offered nowhere, done); their UI leftovers: part 4 (done); element code: #459 (done, [parts](#the-element-engine)) |

Each leaving spec has its twin in livediagram under the same path (`livediagram/docs/specs/`), which stays the one
to change.

## What stays

- **Spaces, avatars, rooms and calls**: Avatar mode, the Space elements (Travel, Seats, Rooms, Perks), the Selection Mode
  buttons, the four Spaces templates, proximity audio and calls.
- **Light meeting tools**: the
  [facilitator baton](../012-collaboration/facilitator.md) it answers to, and Follow-me. The Session strip's Timer went
  later, for the [Timer and Stopwatch](../009-elements/timer-and-stopwatch.md) pieces ([The Session strip's
  Timer](#the-session-strips-timer)), and so did the Vote ([Vote](#the-vote)). The laser, the spotlight and the Reaction Pads went later
  ([The presenting tools](#the-presenting-tools-isometric-and-zen)); the Avatar panel's Reactions (a burst around your
  own character, keys `1` to `5`) stay.
- **Light content**: sticky notes, text, images and stickers. The Frame went later ([The Frame](#the-frame)), and so
  did the Icons category ([Icons](#icons)) and adding link cards ([Media](#media-image-and-link-card)). Images went
  with the link cards and came back, under **Write** ([Images are back](#images-are-back)).
- **Talking without a call**: speech bubbles. Comments with mentions, comment reactions, assigned actions, links
  and notes on elements, the Collaborate Panel and the Explorer's Inbox went later
  ([Comments, actions, links and notes](#comments-actions-links-and-notes)).
- **Every platform feature** ([v1 scope](v1-scope.md) section 7) but the MCP server, the CLI and workbenches
  ([The MCP server, the CLI and workbenches](#the-mcp-server-the-cli-and-workbenches)) and the Inbox.

## Comments, actions, links and notes

The owner (2026-11-11, Work Tracker #714, "Remove Comments, Actions, Links, Notes And The Inbox"): people don't add
comments or actions in livehuddle. In a Space you say it to the person, in the call or in a speech bubble, and a
sticky on the wall holds what has to stay; a thread pinned to a piece of furniture, or work assigned on it, belongs to
a diagram or a plan. Links and notes on elements go with them: they were the element menu's other two attachments,
and a Space's way to point somewhere is a Portal or a Door. This reverses the line above that kept them. livediagram,
liveplanner, livedocuments and livedesign keep all four and the Inbox, and livediagram's specs are the ones to read:
[Assigned actions](../../../../livediagram/docs/specs/012-collaboration/assigned-actions.md),
[Comment mentions](../../../../livediagram/docs/specs/012-collaboration/comment-mentions.md),
[Comment reactions](../../../../livediagram/docs/specs/012-collaboration/comment-reactions.md),
[Rich-text notes](../../../../livediagram/docs/specs/009-elements/rich-text-notes.md) and
[Element indicators](../../../../livediagram/docs/specs/008-canvas/element-indicators.md). Their copies in this tree
stay, marked **Gone from livehuddle**, because the stored data they describe stays (below) and the shared code that
reads it cites them.

- **Gone from every door**, for every role:
  - the element menu has no quick bar and offers no **Assign Action**, **Add Comment**, **Add Link** or **Add Note**;
    **Clear Styles** went later too ([Format Painter and Clear Styles](#format-painter-and-clear-styles));
  - the Participant's and the Viewer's element menu has no comments, **Open Link** or **View Note** row; it keeps
    **Copy Text**;
  - the selection toolbar has no **Add Comment** or **Show Comments**, so a Participant and a Viewer, whose only
    button it was, get no selection toolbar at all;
  - the command palette has no **Add / Edit Note** or **Add Comment**;
  - a deep link's `?open=action` or `?open=comments` (an email's or an old Inbox row's) opens the Space and selects
    the element, opening nothing;
  - a copy, a duplicate and a paste drop the element's comments, actions, link and note, so no copy adds one (a link
    card's link is the card itself, and a retired annotation's note is its marker: those two keep theirs);
  - an agent's edit writes no note (Work Tracker 737): `note=` or `noteRich=` with a value is refused, a shape's
    label over 40 characters is cut to its heading with a warning rather than moved into the note, and `note=` on
    its own is the one way left to remove a note stored from before
    ([Edit operations](../024-agents/edit-operations.md) "No element notes").
- **Gone from the canvas**: the Collaborate Panel and its Settings switch, the comment thread, note and action
  popovers, the Assign Action dialog, the element link picker, and the indicators on an element (a link, a note, an
  open action, unresolved comments) with their Settings. A stored link card keeps its own **Link** category.
  Settings offers no **Someone Comments on My Space**, **Someone Mentions Me in a Comment** or **Someone Assigns Me an
  Action** email switch; the stored account preference is left as it is, for the apps that still send them.
- **The Explorer has no Inbox** in livehuddle, its editor panel and its pages alike: no Inbox row, rail section,
  count badge or Home pill, and no `GET /inbox` read. An Inbox address opens Home, and a browser that remembered the
  panel's Inbox opens Home. The switch is the Explorer's own (`appHasInbox`, `packages/explorer/src/inbox-apps.ts`,
  [One Explorer: Inbox](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md#inbox)); every other
  app keeps its Inbox, and a test pins all four.
- **Nothing is sent about them.** The canvas pushes no comment threads or actions to the index (the outbox drops a
  tab's collab key unpushed), so livehuddle adds no Inbox rows. The rows it pushed before are cleared from the index
  once by the index's cleanup ([One Explorer: Inbox](../../../../liveworkspace/docs/specs/004-index/one-explorer-contracts.md#inbox),
  Work Tracker 736), which the owner runs; until then they stay until their canvas is deleted. No mention or action-assigned email goes: the team notify routes answer `410 gone`.
- **The API refuses new writes and keeps the reads.** Adding, replying to, deleting, resolving and reopening a comment
  (`/api/documents/:id/tabs/:tabId/comments…`) answer `410 comments_gone`; listing a canvas's threads
  (`GET /api/documents/:id/comments`) still answers what is stored. The write routes leave the OpenAPI document. The
  room drops a comment delta (`comment-add`, `comment-remove`, `comment-rekey`, `comment-resolve`, `comment-react`)
  from an older client at its op gate, as it drops a retired op kind.
- **Stored data is untouched.** An element's `commentThread`, `action`, `actions`, `link` and `note` load and save
  exactly as stored: no migration strips them, nothing shows them, and the threads still answer the API's read. The
  shared model code that reads them (`@livehuddle/document`'s comments, actions and deltas) stays.
- **Help and telemetry**: the Comments, Assigned Actions, Links, Linking Tabs, Notes, Element Indicators and Inbox
  articles go, with their figures; old addresses redirect to the [Collaboration](/help/collaboration/) overview (or
  the nearest article that stays). The editor's `Comment`, `Action`, `Note` and `Activity` (the Inbox's) events, and
  the Collaborate Panel's open and switch events, are no longer sent (`lib/telemetry-manifest.ts`).
- **Share roles**: a Participant no longer comments or reacts to a comment; a Viewer has no comments to show
  ([Share roles](../013-workspace/share-roles.md)).

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
- **The 3D view is not Isometric coming back** (Work Tracker 1043, [3D view](../008-canvas/3d-view.md)). Isometric
  was a canvas tool of its own that turned the board 45 degrees with no perspective, raised a block under every
  element and turned editing off while it showed. The 3D view is a switch on walking: a perspective camera tilts the
  Space back like a map, only walls stand up (the lines that already block walking) and the characters stand on the
  floor, and it never locks editing, because switching to Edit flattens it. The `isometric` mode and tool stay gone.

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
- **Agents and imports make no Frame.** The kind is not in the agent schema; an agent that names `frame` is refused,
  as for every kind livehuddle does not have ([The element engine](#the-element-engine), part 5). The graph tool's groups and its shape key, a Mermaid
  subgraph, and an Excalidraw frame are drawn as a [boundary](../009-elements/boundary.md) (Inset style: the title
  inside the top-left corner) instead, and the edit operation is `wrap <sel…> in boundary|lane`. Those are the
  diagram engine's (#459), and left with part 3 of it ([The element engine](#the-element-engine)).

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

## Element and Tab Locking

The owner (2026-11-07, Work Tracker #625): "There is no benefit to locking elements in livehuddle, remove the UI and
code that enables it to simplify. Same goes with tabs, I don't need to lock tabs to prevent changes etc". Locking
protects a finished diagram from a stray drag; a Space is a place people meet in, built once and walked round, and
the share roles already decide who may change it. livediagram keeps both locks, and its
[Canvas and palette](../../../../livediagram/docs/specs/008-canvas/canvas-and-palette.md) spec ("Locking", the tab
menu's Lock) is the one to read for them.

- **Gone from every surface**: the selection popover's **Lock / Unlock** button, the multi-selection toolbar's
  **Lock**, `⌘⇧L` / `Ctrl+Shift+L`, the command palette's **Lock / Unlock Selection**, the tab menu's **Lock Tab** /
  **Unlock Tab**, the padlock before a locked tab's name and the padlock badge on a locked element, and the help
  articles Locking Elements and Locking a Tab.
- **Every rule that turned on a lock goes with it.** Nothing refuses a move, resize, rotation, nudge, delete, cut,
  label, format paint, colour snap, tidy or quick style because an element is locked; no tab pauses undo, refuses
  adds, imports, clearing, deleting or a theme change, or keeps its style from Apply to All Tabs because it is locked.
  Server-side, the participant content check has no `locked` or `tab-locked` refusal, and agent changesets
  ([Edit operations](../024-agents/edit-operations.md)) have no `element_locked` rejection (it leaves
  `EDIT_REJECTION_CODES`).
- **What locking did to Space pieces goes too.** A Door can no longer be locked: its padlock and darker shading are
  gone, and an Editor or a Participant opens and closes any door ([Room builder](../009-elements/room-builder.md)). A
  Suggestion Box closed only by being locked, so it no longer closes: it takes notes until it is full, and the
  `box_closed` refusal is gone ([Team pieces](../009-elements/team-pieces.md#suggestion-box)). A Notice Board and a
  Calendar Wall always take notes, a portal's tour and what a Screen shows are an Editor's on any one, and an image
  always takes a new picture.
- **Kept, because they are other things**: Lock Aspect Ratio (`aspectLocked`), the concurrent-selection lock ("Locked
  to <name>", [Editor app](../007-editor/editor-app.md)) and the facilitator freeing it, and a stored layer's `locked`
  as `tab-fields` settles it for the products that still have layers (livehuddle drops layers first,
  [Layers](../006-document/layers.md)).
- **Its telemetry**: `Element Locked`, `Element Unlocked`, `Tab Locked` and `Tab Unlocked` are no longer sent. The
  `Locked` and `Unlocked` actions stay in the vocabulary, so the events already recorded keep their label (and the
  facilitator's `Unlocked` type still rides on `Facilitator Changed`).
- **An element or a tab saved with `locked: true`** loads, saves and behaves unlocked; nothing is dropped or
  refused. `dropRetiredLocks` (`packages/document/src/retired-locks.ts`) drops `locked` from a tab and from each of
  its elements on read. The stored-tab migration runs it beside the other retired cleanups, and the editor runs it on
  a peer's `tab` op and `tab-meta` patch, so no data migration is needed and the tab is saved without it next time.
  The `locked` field leaves the element and tab types.
- **Help**: the two articles go; their old addresses redirect (router `legacy-help-route.ts`): Locking Elements to
  [Selecting Many Elements](/help/canvas/selecting-and-grouping/), Locking a Tab to
  [Tabs](/help/tabs/using-tabs/). The marketing FAQ's "Can I stop a finished tab being changed?" goes.
- **Share roles**: nothing changes in who may do what. The rules that turned on a lock go: a locked tab no longer
  makes an Editor read-only, and a Participant swings any Door ([Share roles](../013-workspace/share-roles.md)).

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
  (`auto-layout-clusters`) drew a `graph`'s groups as boundaries until the element engine's part 3 deleted it with the
  graph input ([The element engine](#the-element-engine)).

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
- **A Space's own Quick Style came back** (the owner, 2026-11-18): a panel at the same edge holding a room's Walls,
  Floor and Floor Colour and a piece's Type, the element menu's Tools choices beside the selection
  ([space-quick-style.md](../008-canvas/space-quick-style.md)). The colour swatch rows and everything above stay gone.
- **A stored `quickStylePanelEnabled`** is not read. The key is kept in the preferences blob, unread, like any key
  this version does not know, so no migration is needed. Stored custom swatches (`quickSwatchOverrides`) are kept the
  same way; nothing in livehuddle shows or edits them any more.
- **What stays for styling**: **Tab Style** themes the tab. The element menu's **Appearance** flyout went later
  ([Element looks, layers, opacity and rotation](#element-looks-layers-opacity-and-rotation)), and so did **Clear
  Styles** and the **Format Painter** ([Format Painter and Clear Styles](#format-painter-and-clear-styles)).
- **Telemetry**: the panel's `Element Changed` tokens (`QuickStroke`, `QuickBackground`, `QuickTextColour`,
  `QuickStrokeWidth`, `QuickStrokeStyle`, `QuickTextAlign`, `QuickIconAlign`), `UI Changed QuickSwatchCustom` and
  `QuickSwatchReset`, and `QuickStylePanelOn` / `Off` are no longer sent. `QuickClearStyles` went with Clear Styles.
- **The code.** The panel's components (`QuickStylePanel`, its rows, More colours, the Marker and Highlighter rows,
  the swatch override popover) are deleted with their tests; the headless `ClearStylesHost` that kept the Quick Style
  view for Clear Styles went with it ([Format Painter and Clear Styles](#format-painter-and-clear-styles)). The panel's placement hook and the Clear Styles store are
  `@liveworkspace/workbench`'s, shared with livediagram, and stay.

## Element looks, layers, opacity and rotation

Status: **built** (owner, 2026-11-27): the selection toolbars, the element and multi-selection menus, the keyboard,
Search and the help centre. Rotating Elements and Colours, Borders and Opacity are no longer livehuddle help articles;
their livehuddle paths redirect to Turning Furniture and Context Menus.

The owner (2026-11-27): "remove Appearance category from selected element toolbar in livehuddle, also remove
rotation, and Layer options and opacity, simplify". A Space is furnished, not drawn: a piece looks the way its kind
and its Type draw it, and a room the way its Walls and Floor make it. livediagram keeps all of this, and its specs
there are the ones to read.

- **Gone from the selection toolbar**: **Rotate Left** and **Rotate Right**, and **Bring to Front** and **Send to
  Back**, on one element and on a multi-selection. The toolbar now holds **More**, **Duplicate**, **Send to Plan**
  where it applies, and **Delete** (the Format Painter and Edit Text went later,
  [Format Painter and Clear Styles](#format-painter-and-clear-styles), [Edit Text](#edit-text-on-the-selection-toolbar))
  ([Selection popover](../008-canvas/canvas-and-palette.md#selection-popover)).
- **Gone from the element menu**: the **Arrange** category (Bring to Front, Send to Back and the Opacity slider), the
  **Rotation** category (the 45° tiles) and the **Appearance** flyout (Presets, Colours, Border, Shadow, Finish, the
  Text flyout's Font, Size, Padding, Alignment and Markers, and an icon's Icon and Weight). The menu now holds
  **Size** (a boxed element that has one) and the element's own section (Desk, Room, Portal and the rest), then an
  image's or a link card's content section; its Clear Styles quick bar went later ([Format Painter and Clear Styles](#format-painter-and-clear-styles)). A menu with
  none of these to show does not open.
- **Gone from the multi-selection menu**: its Arrange, Rotation, Appearance and Text sections and its icon Icon and
  Weight rows. It holds **Size** (Lock Aspect Ratio and, for shapes, Reset Aspect Ratio) and the right-clicked
  piece's **Type**; with neither to show it opens nothing.
- **Gone from the keyboard and Search**: **⌘⇧]** (Bring to Front) and **⌘⇧[** (Send to Back), their rows in the
  Keyboard Shortcuts dialog, and the **Bring to Front**, **Send to Back**, **Rotate 90°**, **Rotate 180°**,
  **Rotate 270°** and **Reset Rotation** commands. With no handler the chords are left to the browser.
- **A piece still turns.** Furniture never rotated freely; it faces four ways
  ([Turning furniture](../009-elements/furniture-facing.md)). The four facing tiles in its own menu section and the
  **Rotate Left** / **Rotate Right** commands in Search turn it, and **Space** turns it while it is being placed.
- **What a Space already holds is kept as it is.** An element keeps its stored colours, opacity, rotation and order:
  they still draw, save and copy, and an undo still restores them. Nothing in livehuddle changes them any more, so no
  migration is needed. A new element lands at the front, as before.
- **Telemetry**: `Element · Changed · Rotation`, `Opacity`, the colour, border, shadow, finish, preset, font, size,
  padding, alignment, marker and icon tokens the menu sent, and the layer moves are no longer sent from the menu or
  the toolbar. A piece's turn still sends `Element · Changed · <Kind>`.
- **Share roles**: unchanged. Each of these was an Editor's; a Participant and a Viewer had none of them
  ([Share roles](../013-workspace/share-roles.md)).
- **The code.** livehuddle's own menu sections for them (`ElementAppearanceSections`, `ElementColourBorderSections`,
  `MultiStyleSections`, the Arrange and Rotation blocks of `EditorContextMenu` and `MultiPlacementSections`), the
  helpers only they used (presets, typography, border, finish, the colour and marker rows, the animation tiles) and
  the menu props and style setters that fed them are deleted with their tests; the toolbar's `TurnButtons` leaves
  `@livehuddle/avatar`. The shared toolbar, menu and section primitives in
  `@liveworkspace/workbench` are livediagram's too and stay unchanged.

## Format Painter and Clear Styles

Status: **built** (owner, 2026-11-27): "Format Painter and Clear Styles go too in livehuddle". With the element menus'
looks gone ([Element looks, layers, opacity and rotation](#element-looks-layers-opacity-and-rotation)) there is no
look to copy or clear: a piece looks the way its kind, its Type and the tab's theme draw it. livediagram keeps both.

- **Gone from the selection toolbar**: the **Format Painter** button. The single-element toolbar holds **More**,
  **Duplicate**, **Send to Plan** where it applies, and **Delete** (Edit Text went later,
  [Edit Text](#edit-text-on-the-selection-toolbar)).
- **Gone with the painter**: its held mode (the "Format Painter" pill at the top centre and its Done, the copy
  cursor, a press painting instead of selecting, Escape leaving it), its **Format** panel
  ([Format Panel](../008-canvas/format-panel.md)) and the panel's saved place. A stored panel position for it is
  ignored.
- **Gone from the element menu**: the quick bar and its **Clear Styles** eraser
  ([Element menu quick bar](../008-canvas/element-menu-quick-bar.md)).
- **No empty menu**: a right-click, a long press or More on an element whose menu would have nothing in it (no Size,
  no section of its own, no content section) opens nothing, as the multi-selection menu already does.
- **Keyboard and Search**: neither had an entry for either (Search's Format Painter left on 2026-11-06), so nothing
  changes there.
- **What a Space already holds is kept as it is**: an element keeps any style it was given; nothing in livehuddle
  changes or clears it. No migration.
- **Telemetry**: `Element · Changed · FormatPainter`, `Canvas · Used · FormatPainter`, the Format panel's
  `UI · Changed` tokens and `Element · Changed · QuickClearStyles` are no longer sent.
- **Share roles**: unchanged. Both were an Editor's; a Participant and a Viewer had neither.
- **Help**: the Format Painter article is no longer a livehuddle article, and its livehuddle address redirects to
  Context Menus. The toolbar and menu articles drop both.
- **The code.** livehuddle's painter (`useFormatTool`, `lib/format-painter.ts`, the Format panel and its config, the
  `'format'` canvas tool and every branch on it), the menu's quick bar (`ElementMenuClearStyles`), the headless
  `ClearStylesHost` and its Quick Style view (`useQuickStyle`, `lib/quick-style.ts` where only it used them), and the
  style hover preview (`useStylePreview`) with the autosave's `previewingRef` that only it set, are deleted with
  their tests. The shared toolbar, the Clear Styles store and the placement hooks in `@liveworkspace/workbench` are
  livediagram's too and stay unchanged.

## Edit Text on the selection toolbar

Status: **built** (owner, 2026-11-27): "Remove the Text button from the selected element toolbar". A Space's pieces
are named, not written on: a Room's name is set in its settings ([Office](../009-elements/office.md) "Room"), and a
piece that takes a name is still renamed in place. livediagram keeps the button.

- **Gone from the selection toolbar**: the **Edit Text** / **Add Text** button (the serif `T`), on every element. The
  single-element toolbar holds **More**, **Duplicate**, **Send to Plan** where it applies, and **Delete**
  ([Selection popover](../008-canvas/canvas-and-palette.md#selection-popover)).
- **Still renamed in place**: a double-click, Enter or typing on a selected piece that takes a label opens its inline
  editor as before; a Room's settings dialog and the Quick Style panel carry a **Room name** field.
- **Share roles**: unchanged. The button was an Editor's; a Participant and a Viewer had no toolbar.
- **Help**: the toolbar article and the Elevator article no longer name the button.
- **The code.** The toolbar's `onEditText` / `hasText` props and their wiring in `CanvasSelectionToolbars`, and
  `elementHasText` in `@livehuddle/document` (only the button read it), are deleted with their tests.
  `elementSupportsText` stays: the read-only menu and the share-roles tests read it. The shared `TextIcon` in
  `@liveworkspace/workbench` stays for the shared read-only menu.

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
rooms and pieces and written on with stickies, text and stickers; pinning bookmark cards to the floor is a board's
habit, not a meeting place's. livediagram keeps link cards, and its spec is the one to read:
[Link cards](../../../../livediagram/docs/specs/009-elements/link-cards.md). That page in this tree carries a
**Gone from livehuddle** banner. Images came back two days later ([Images are back](#images-are-back)).

- **Gone from every surface**:
  - the palette: the **Media** category (its Link card tile, and the Image, which now lives in **Write**), the Link
    card in **Popular** and in **Travel**, and the Image in a Participant's **Participate** category (a Participant
    has no palette now, [A Participant walks](../013-workspace/share-roles.md#a-participant-walks));
  - the strip's Search and the search panel's Add to Canvas name no Link card (they list only what the palette
    offers);
  - the `9` key (Image) and its row in the keyboard reference: the Image is back, its key is not;
  - the help article Link Cards (its old address redirects to the nearest article that stays) and the marketing
    copy.
- **Not this part, so they stay**: the **Screen** piece and the video links it plays, a **Notice Board**'s notes, an
  element's **link** (Add Link: a URL or a tab an element opens), the account's **Image Gallery** in the Explorer
  (uploads and where each is used; it now lists only what older Spaces hold) and a profile picture. Tab and Export pictures (PNG, the live image) are pictures of a tab, not image
  elements.
- **A stored link card stays.** It is an ordinary element: a Space that already holds one draws its unfurled
  preview, and it selects, moves, resizes, copies, restyles and deletes as before, and its URL can still be changed,
  so a stored one is never stuck half set up. Nothing migrates.
- **Agents are not this part.** The api's and MCP's image tools (`list_images`, an element's `imageId`) and a
  `link-card` element in a changeset are the agent tools' (Work Tracker #459) and stay until that part decides them.
- **Telemetry**: `Element Added LinkCard` is no longer sent from the editor; the type stays in the allowlist, since
  livediagram and agents still add link cards. `Element Added Image` is sent again ([Images are back](#images-are-back)).
- **The code.** The Media entry leaves the meeting layout, the Image and Link card tiles leave Popular and Participate,
  and the Link card tile leaves Travel (its `tileGroup` goes; it files under `media` with the Image). The Link card's
  definition stays in the catalogue, like the diagram tools' ([What stays](#the-diagram-tools-still-in-livehuddles-ui)),
  so a stored one still finds its name and glyph; nothing offers it. The `9` key is deleted. (The Image tile and the
  paste and drop upload came back: [Images are back](#images-are-back).)

### Images are back

The owner (2026-11-07): "Let me add images to the space, via the Write category. We did take them away, but they
are useful for adding branding and stuff. So I want them back". A logo on the reception wall or a team photo by the
door makes a Space a place of its own. livehuddle's [Images](../009-elements/images.md) spec is the one to read again.

- **The Image tile was in Write** (gone with it, [The Write category](#the-write-category)), after Text and the Sticky note ([Workshop mode](../012-collaboration/workshop-mode.md#the-palette)),
  and so in the strip's Search and the search panel's Add to Canvas. It arms the draw-to-size gesture; the new image
  lands as its empty placeholder and its picker (Upload, Gallery, Search) fills it.
- **A picture pasted or dropped on the canvas lands as an image element**, uploaded to the person's gallery through
  liveworkspace's media service (an offline Space embeds it instead), as in livediagram. Any other file is still
  refused, with one notice ("The canvas takes pictures, not other files."); a livehuddle tab's JSON dropped there
  still points at Import.
- **An Editor's alone.** A Participant and a Viewer have no palette and paste or drop nothing; they see every image
  ([Share roles](../013-workspace/share-roles.md#feature-by-feature-v1)).
- **Not back**: the Media category (Write holds the one tile), the Link card, the Image in Popular, and the `9` key.
- **The code.** `tools:image` joins Write's tiles in the meeting layout (`palette-layouts.ts`). The paste and the drop
  run in `useClipboard` over `hooks/canvas/image-file-place.ts` (which picture a paste carries, the pasted name, the
  upload, the placed element), and load the upload code (`lib/upload-image.ts`) only when a picture arrives.
- **The help**: the Write Elements article names the Image; the Images article and its redirect are not restored
  (the Write article covers adding one).

### The Write category

The owner (2026-11-27): "Remove the Write category from the palette in livehuddle, don't keep it on existing spaces,
just remove them". A Space is built from its pieces; words and notes are what livediagram is for.

- **No Write category**, on any Space, new or old: the palette is one layout for every Space, so there is nothing to
  keep it on. The strip opens on **Rooms**: `Rooms, Seats, Perks, Play, Garden, Meet | Travel`.
- **Popular loses Sticky note and Text**: it held Room, Meeting Table, Chair, Bring Focus and Avatar Pad (Bring Focus went later, [Bring Focus](#bring-focus)).
- **The T, 8 and N keys go too** (they added text and a note), with their rows in the keyboard reference.
- **The Image tile goes with Write**, so the palette adds no image. A picture pasted or dropped on the canvas still
  lands as an image ([Images are back](#images-are-back)): that is not the palette.
- **The code.** The `write` entry leaves the meeting layout and `tools:text` and `tools:sticky` leave Popular
  (`palette-layouts.ts`); the tiles' definitions stay in the catalogue, so a stored image still finds its name and
  glyph, and the strip's Search finds none of them (it lists only what the palette offers).

The owner (2026-11-27), later the same day: "why do I still see sticky notes and textboxes on the floor btw, I asked
for them to be removed". Taking the tiles away left every text and note a Space already held, and the ones its
template wrote. They go too:

- **No text and no sticky note in any Space**, new or existing. A stored `text` or `sticky` element is **dropped when
  its tab is read** (`dropRetiredNotes`, `packages/document/src/retired-notes.ts`), beside the other read-time drops in
  `migrateStoredTab`: the api's tab read and thumbnail, the offline store, an import and a peer's whole tab all run it,
  so there is no data migration; the tab is saved without them the next time it is saved. Nothing else in the tab
  changes: a stored arrow pinned to a dropped note stays as stored and draws from its other end, as an arrow pinned to
  any deleted element does ([The element engine](#the-element-engine), part 4), and a link to a dropped note leads
  nowhere, as a link to any deleted element does.
- **Nothing brings one in**: elements pasted from the clipboard, a shape library or a file pass through
  `migrateIncomingElements`, which drops them the same way, and a peer's single added or updated text or note (an old
  client) is ignored (`applyRoomOpToTabs`). An agent's or a script's changeset, MCP edit or seeded document that
  adds one is refused (`invalid_value`, "text and sticky notes are no longer supported in livehuddle: pin a note on a
  notice-board", [Edit operations](../024-agents/edit-operations.md)). Pasting plain text makes nothing, as
  before.
- **Nothing makes one**:
  - **Double-clicking the empty canvas makes nothing** with a mouse, a trackpad or a pen (the [Quick text
    drop](../008-canvas/canvas-and-palette.md#quick-text-drop) is gone); a finger's double-tap still zooms.
  - **No template writes one**: the arrival is the Avatar Pad alone, with no how-to line under it
    ([Avatar Pad](../009-elements/avatar-pad.md#every-space-and-blank-tab-has-one)); a Space opens with no heading
    above its plan (no title, sticker or one-line description; the band it stood in stays, so every plan sits where it
    did); and the Team Pod has no Team Board of four stickies (its Timer stays, by the pod's right wall). A Space's
    words live on its Notice Boards, Room Signs and room names.
  - **An automation's Post in a Space** pins a note on the tab's first Notice Board instead of adding a sticky
    ([Automations](../013-workspace/automations.md)).
- **Images stay**: a picture pasted or dropped on the canvas still lands as an image ([Images are
  back](#images-are-back)).
- **Send to Plan goes with them**: a Space's stickies were its action items and the one thing it sent, so the
  selection toolbar's Send to Plan (one element or several), a walking reader's footer, the tab menu's Send Stickies
  to Plan, Wrap Up's Send Actions to Plan and the "call ended with stickies" suggestion are removed; a Participant or a
  Viewer gets no selection toolbar. The host stays, so a card sent before keeps its chip ([Send to
  Plan](../013-workspace/send-to-plan.md)).
- **Dormant, not removed**: the text and note renderers stay in the code with nothing to act on; the palette's
  `addText` and `addSticky` actions, and the `text` and `sticky` draw intents they arm (`draw-mode.ts`,
  `draw-commit.ts`), stay typed while the palette's tile code names them, with no tile or key that arms them.

### Bring Focus

The owner (2026-11-27): "remove bring focus element". Nothing offers it any more; livediagram keeps it.

- **Not offered anywhere**: no tile in Popular or Travel, so none in Search (Travel opens on Portal and runs
  `Portal, Avatar Pad, Directory, Signpost, Elevator, Stairs, Avatar Button`; Popular holds Room, Meeting Table, Chair
  and Avatar Pad).
- **No template places one**: the All-Hands Hall, Training Room, Classroom, Hackathon Hall, Wellness Studio and every
  campus, venue, hotel, school, expo, festival and tower hall that carried one are built without it, and their
  descriptions no longer name it.
- **A stored one stays**: a Bring Focus button already on a Space still draws, can be selected, moved and deleted, and
  still works for an Editor when walked to or clicked ([Bring Focus](../012-collaboration/bring-focus.md), kept as the
  record of what a stored one does). Nothing new places one, so it ages out as Spaces are rebuilt.
- **The code.** `tools:focus-button` leaves Popular and the Space categories (`palette-layouts.ts`, `NOT_OFFERED`); its
  tile definition stays in the catalogue so a stored one finds its name and glyph, and the `focus-button` shape kind,
  its face and its press stay.

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
presenting tools, the `frame` ([The Frame](#the-frame)), the diagram tools' kinds [the element engine](#the-element-engine)
deleted, any other shape kind livehuddle does not know, and an element of a retired element type (an
`type` the engine deleted: `video`, then `table`, then `arrow`, `freehand`, `path` and `annotation`).

- **Kept untouched.** Its kind and every field it carries (a poll's question, a board's notes, its responses) stay in
  the document exactly as stored. Nothing in livehuddle reads or writes them, so a save, a sync, a copy and an undo
  carry them through; livediagram still opens them as they were.
- **Drawn as a placeholder.** A plain card in the element's own box: a dashed outline, a muted fill, the kind's name
  ("Q&A Board", "Poll", "Bar Chart", "Embed", "Table"; "Unknown Element" for a kind livehuddle never had) and, beneath it,
  "No longer supported in livehuddle", so the two lines read as one sentence about this element. Its stored label
  shows below that when it has one. The export and the thumbnail draw the same card, without the Delete button.
  A Shape Library preview draws its dashed outline alone, without the words, which a tile is too small to read
  (Work Tracker 695, [Shape libraries](../013-workspace/shape-libraries.md#api)).
- **Deleting it.** An Editor sees a small **Delete** button (a bin icon, a 24px target that keeps its size on screen
  at every zoom, as the selection grips do) in the card's top-right corner while the pointer is over the card, it has
  keyboard focus or the card is selected (a touch screen has no hover, so selecting it shows the button). While hidden
  it takes no press, so a tap on an unselected card never deletes it unseen. It sits far
  enough in that a tap on it never lands on a resize grip, and when the card shows indicators in that corner (its
  comment pip, its link, note or action) it steps left of them, so a tap meant for the comments never deletes the
  card. It only ever shows inside the card. A card smaller than 72 by 48 on screen, or with no room for it clear of
  the indicators and the words, shows none: an Editor selects it and uses the selection toolbar's **Delete**, which
  is also how a phone at its Fit zoom removes one. Pressing it removes the element as Delete would, as one undo step; it never selects or drags the element
  on its way. It has a tooltip and an accessible name ("Delete <kind name>"), takes a keyboard focus ring, and draws in
  the card's own quiet ink in light and dark. A Participant and a Viewer never see it (`can.remove`), and an Editor
  with Delete, the context menu or a multi-selection removes one the usual way too. Because its face can hold this
  control, a screen reader meets the card as a named group, not a picture. A stored embed walks in Walk mode as a
  retired shape does.
- **What it does.** It selects, moves, resizes, copies and deletes like any element. It takes no typed label
  (double-clicking it opens nothing), has no settings or context-menu section of its own, presses nothing and starts
  nothing. It offers no styling: no Colours, Border or Finish in its menu or a multi-selection's (`supportsColours`
  and `supportsFinish` answer false for it), since a placeholder draws none of them. Selected, its selection
  toolbar holds **Delete** alone for an Editor (no Turn, Duplicate, Format Painter, Bring Forward, Send
  Backward or More); a Participant and a Viewer get no toolbar, as for any element (Work Tracker 639). Agents read it
  by its stored kind, and their edits leave it as stored: `set` on one is refused, and a replace keeps it as it was
  ([Edit operations](../024-agents/edit-operations.md)).
- **Nothing new.** No palette entry, Search result, template, agent verb, CLI command or paste makes one; an agent that
  names a retired kind, or any kind livehuddle does not have, is refused ([The element engine](#the-element-engine),
  part 5). Until part 5 such a kind was coerced to a square, which is itself retired now.

The session state that only these elements used goes the same way: a stored running poll is never shown, and the
Session strip offered the Timer only (it has since left, [The Session strip's Timer](#the-session-strips-timer)). A document's stored deck (`presentation`) stays as part 2 left it: carried
and redacted by the api, never read or written by the editor.

### The diagram tools still in livehuddle's UI

Part 4 also removes the diagram tools livehuddle's UI still offered after part 3, with their help articles (each old
address redirects to the nearest article that stays): Tidy Up's Auto Layout tiles (Auto-Align stays, in the command palette, and its
cleanup), the Explorer's Shape Libraries page and library import, the draw.io, Mermaid, Markdown and Microsoft
Whiteboard imports, Settings' Auto-Attach Arrows, and the search panel's Add to Canvas results for tiles the meeting
palette does not offer (it adds only what the palette offers). The element engine under the diagram tools (shapes, arrows,
pens, the layout containers) is Work Tracker #459's, not this part's: a stored one still draws, moves and deletes.

### Shape libraries: kept read-only (Work Tracker #515)

Part 4 removed Shape Libraries from livehuddle's UI but left the api's routes and the person's store. The decision
(the dev loop's, 2026-11-07; the owner can overturn it): **keep both, read-only**.

- `GET /api/shape-libraries` and `GET /api/shape-libraries/:id/previews` keep working, so a library someone imported
  stays reachable.
- `POST`, `PUT` and `DELETE` on `/api/shape-libraries` are refused for every caller (Editors, Participants, Viewers,
  anonymous callers and tokens alike) with `403` and `{ "error": "shape_libraries_read_only" }`, the status this api
  already uses for a write it will not take (`read_only_token`). Nothing is created, changed or removed.
- Account deletion still purges the person's store, and a guest signing in still has theirs adopted by the account's
  (`db/account.ts`), so nobody's libraries are stranded or kept after their account closes.
- No stored library is deleted or migrated. Retiring the store would delete people's data, so it is not done here.
- Download All My Data does not read shape libraries: the export service asks each app for its items (Spaces) and
  never for a person's store, so a library is not in the zip. They can still be read through the api above.

## The element engine

Work Tracker #459 deletes the diagram tools' own code from livehuddle's element engine (the element union, the
renderers, the ops and the palette code under them), now that part 3 offers them nowhere and part 4 took their UI. It
was cut into five parts, each one PR, so each stayed reviewable; all five are done, so livehuddle's element union
holds only what the engine keeps.

**What the engine keeps** is what a Space is made of and what the meeting palette offers, plus the kinds earlier
parts kept for stored content: the sticky note, text, the sticker, the Space pieces (every Travel, Seats, Rooms and
Perks kind: the chair to the Arcade Machine, the Room, Door, Window and Stairs, the Directory and Elevator, the
Screen and Room Sign, the Timer and Stopwatch), the Selection Mode button, the portal and the Avatar
Pad, and, kept for what a Space already holds ([Icons](#icons), [Media](#media-image-and-link-card)), the icon, the
image and the link card.

| Part | What leaves the engine                                                                                                                                                                                                                                                                                                                                    | State |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1    | The content widgets and the embeds: the data charts (`pie-chart`, `bar-chart`, `line-chart`, `legend`), progress (`progress-bar`, `progress-ring`), `rating`, `code-block`, `checklist`, the Page (`page`), the web components but the card (`banner`, `stat-row`, `process`, `site-header`), and the video and website embeds (the `video` element type) | Done  |
| 2    | Tables (the `table` element type) and their cell links and styles                                                                                                                                                                                                                                                                                         | Done  |
| 3    | The layout containers: `lane`, `stack`, `boundary`, the Timeline (`timeline-rail`), `diagram-key`, `card` and `callout`, `badge`, `step`, `pointer-note`, an image's hero caption, and the graph input and cluster layout that draw groups as boundaries                                                                                                  | Done  |
| 4    | Arrows and lines (the `arrow` type, its routing, anchors and gestures), the pens and paths (`freehand`, `path`), annotations (`annotation`), with card #583's pen leftovers                                                                                                                                                                               | Done  |
| 5    | The diagram shapes (`square`, `circle`, `diamond` and the rest of the Shapes category) and the agent-side diagram code left (`diagram-lint`, the edit operations' diagram verbs)                                                                                                                                                                          | Done  |

What every part does:

- **A stored element of a deleted kind loads, saves unchanged and shows its placeholder.** It becomes a [retired
  element](#retired-elements): its kind and every field stay in the document exactly as stored, nothing migrates and
  nothing is dropped. A deleted shape kind leaves `SHAPE_KINDS`, so a stored one is retired by the rule that already
  covers any kind livehuddle does not know. A deleted element type joins `RETIRED_ELEMENT_TYPES`
  (`packages/document/src/retired-kinds.ts`): validation still accepts one (a box and an id, as before), and the
  canvas, the export and the thumbnail draw the placeholder in its box.
- **No migration rewrites one.** A load-time cleanup that only served a deleted kind (part 1: the chart rows'
  settling) goes with it, so the stored fields are never touched.
- **Gone with the code**: the kind's face, its menu sections, its edit dialog, its palette tile definition, its
  factory, its defaults, its validation rules, its export renderer, its agent view's state and summary, and its spec here,
  which turns to a **Gone from livehuddle** banner (livediagram's twin stays the one to read).
- **The names stay.** Each deleted kind keeps the name a person knew it by (`RETIRED_SHAPE_NAMES`,
  `RETIRED_TYPE_NAMES`), so its placeholder, its selection and Search say "Bar Chart", not "Unknown Element".
- **Agents.** The api's agent schema and the edit operations already make none of them (part 3). Until part 5 an
  agent that named a deleted shape kind got a square, as with any kind it did not know; since part 5 it is refused
  (see part 5 below), and `add video` is refused ("embeds are no longer supported in livehuddle"), as is `add table`
  ("tables are no longer supported in livehuddle"). Reading a stored one, an agent's views print it as an unknown
  kind (`?`) with no state or summary, and `find` still searches the text it stored.
- **Part 2, tables.** A stored `table` keeps its cells, its cell styles and cell links (`cellStyles`), its column
  and row sizes, its header settings and its table look (`tablePreset`) exactly as stored, and draws as the
  placeholder named **Table**. Gone with it: the table face and its cell editor, the cell menu and cell link picker,
  the row and column controls, the table looks in Style Presets, the table animations, the cell search results
  (Search no longer matches a table's cell text; agents' `find` still does) and the export's grid.
- **Part 3, the layout containers.** A stored `lane`, `stack`, `boundary`, `timeline-rail`, `diagram-key`, `card`,
  `callout`, `badge`, `step` or `pointer-note` keeps every field it stored (a lane's heading, a stack's arrangement, a
  boundary's style, a Timeline's milestones, a key's rows and meanings, a card's slots and tags, a badge's look and
  the host it was attached to, a step's number, a pointer note's tip) and draws as the placeholder named **Lane**,
  **Stack**, **Boundary**, **Timeline**, **Diagram Key**, **Card**, **Callout**, **Badge**, **Step Number** or
  **Pointer Note**. Details:
  - **No migration rewrites one.** A stored `callout` stays a `callout` (it no longer becomes a card on read), and a
    Timeline saved with the old point fields (`railCount`, `railLabels`) keeps them (no milestones are made from them).
  - **Containers carry nothing.** The containment rule (a lane, stack or boundary holds whatever its box holds, and
    carries it when it moves) goes with them: dragging a stored lane, stack or boundary moves only its placeholder,
    and what sat in it stays put. Like a stored Frame, the three still paint behind everything else, so their
    placeholders never cover what sat on them.
  - **Attachments let go.** A stored badge, step or pointer note keeps its `attachedTo` and `attachAt` as stored, but
    no longer follows its host: it stays where it is when the host moves, and stays when the host is deleted.
  - **The hero caption.** An image's caption card (`heroCaption`) is no longer drawn on the canvas or in the export;
    the field stays on the image exactly as stored. The image itself is unchanged.
  - **Tag colours.** The tab's tag colour map (`tagColours`), which only cards and the diagram key read, is kept on
    the tab as stored and never read; its menu block is gone.
  - **The graph input goes.** An api seed or a changeset `replace` with a `graph` (nodes and edges by id) is refused
    (400: a `replace` takes exactly one of template or elements; a seeded tab needs `elements` or a template), so no
    layout engine draws a graph's groups as boundaries or its lanes as swimlanes. The cluster layout
    (`auto-layout-clusters`) and the graph's look and lane code go with it, and so do the diagram lint's graph
    entry points, which linted a graph input before it was laid out. A tab's lint is unchanged.
  - **Agents.** `add lane`, `add boundary` and the rest of part 3's kinds get a square (any kind livehuddle does not
    know); `wrap … in boundary|lane` and `unwrap` are gone, and so are the `in:` selector and the `inside:` placement,
    which named a container. A changeset that names them is refused as unknown vocabulary.
  - **Gone with the code**: each kind's face, menu section, palette tile and Build category entry, setters,
    factories, defaults, validation rules, export renderer, animation rules, agent view state and summary, help
    articles and specs; the stack's reflow, the lane's seam snapping, the boundary's nesting tint, the attachment
    engine, the diagram key's derived rows, and the Timeline's concept animations.
- **Part 4, arrows, pens, paths and annotations.** The `freehand`, `path` and `annotation` element types
  join `RETIRED_ELEMENT_TYPES`, and a stored `arrow`, which has no box, is its own retired type
  (`RetiredArrowElement`); `isRetiredElement` is true for all four. A stored one keeps every field it stored (an arrow's ends and what they are pinned to,
  its label, heads, style, bends and flow; a stroke's packed points, pen and pressures; a path's nodes and contours;
  an annotation's note) and is named **Arrow** (**Line** when it has no heads), **Drawing**, **Path** or
  **Annotation**. Details:
  - **A stroke, a path and an annotation** have a box, so each draws as the placeholder in its own box, as a table
    does. An annotation's 44 by 44 marker is too small for the Delete button: an Editor selects it and uses the
    toolbar's Delete.
  - **An arrow has no box**: it is two ends, each a free point, pinned to an element's anchor, or a point along another
    arrow. A retired arrow draws as a faint dashed straight line between its ends, in the placeholder's quiet ink,
    with the placeholder card (160 by 96) centred on the line's middle. The card is what selects, opens the context
    menu and holds the Delete button; the line takes no press. Its menu offers what a boxed placeholder's
    does; there is no quick bar and no comment, note or action (Work Tracker 714, Work Tracker 739). A free end sits at its point, a pinned end
    at its anchor on its element's box (turned with the element), and an end on another arrow at its fraction of that
    arrow's straight line (four hops at most). An end whose element is gone, or is not one with a box, takes the
    other end's point; an arrow with neither end left draws its card at the canvas origin, so it can still be
    selected and deleted.
  - **It does not move.** A retired arrow is not dragged, nudged, resized or carried by a selection's drag: its free
    ends stay where they were drawn and its pinned ends follow the elements they are pinned to, as they always did,
    because they are worked out each time it is drawn. Nothing about it is written back.
  - **What it pinned to.** Moving an element a retired arrow is pinned to moves that end of the line with it. Deleting
    one leaves the arrow exactly as stored (Delete no longer takes the arrows pinned to an element with it); that end
    then sits on the other end's point. Copying a selection copies a retired arrow with a new id and otherwise as
    stored, except where it points: an end pinned to a copied element is pinned to its copy, and a free end moves with
    the copy (the rule copies always had, so a copied pair still reads as joined).
  - **Auto layout goes.** With no arrow ever drawn, no tab is a graph the layered layout could arrange, so the auto
    layout code goes too. The agents' `layout` keeps its one remaining job: it sweeps the boxes it is given into rows
    below the ones it leaves alone.
  - **Multicolour themes** read a stored arrow's pinned ends, read only, to give a tree's branches their colours,
    until part 5 deleted that diagram theming.
  - **The whiteboard engine goes with them**: the pen, Path and Fill intents and their gestures (the stroke capture,
    the live ink and the whiteboard pen preview, the path draft and point editing, the fill's region search), shape
    recognition, the arrow's gestures (drawing, re-pinning an end, bending, the label editor and its drag), the
    anchors and their dots, routing (the orthogonal router, route-behind, collision avoidance, the fans), the arrow
    menus and presets, and the arrow and pen sections of format painting, style memory, quick style and Tab Style.
  - **Agents.** `connect` (an arrow from one element to another), `rewire` (moving an arrow's ends) and `insert`
    (a box put on an arrow, with its `between`) are gone, as are the flags that only meant something to arrows
    (`again`, `keep-arrows`, and `layout`'s `style=` and `direction=`); a changeset naming one is refused as unknown
    vocabulary. `add arrow`, `add line`, `add freehand`, `add path` and `add annotation` are refused ("arrows are no
    longer supported in livehuddle", and the like). Views print a stored one as `? arrow` (or its kind) and `show`
    prints a stored arrow's `from=` and `to=`; the edges view lists no edge, and the arrow selectors (`from:`, `to:`,
    `a->b`, `downstream:`) still read stored arrows but nothing writes them. `after:` places like `below:`. The
    diagram lint's arrow checks go with them (crossings, arrows behind boxes, dangling arrows, label collisions,
    isolated nodes, backwards flow, arrow names), and so do `box-overlap` and `aspect-extreme`, which judge only boxes
    an arrow joins. The wire keeps its fields (lint measures, result deltas, `arrows_freed`, every lint code), always
    empty or zero, so an agent written against them keeps parsing.
  - **Gone with the code**: each kind's face, its menu sections, its palette tile definition, its factory, defaults,
    validation, export renderer, animation rules (the arrow's flow), agent view state and summary, help sections and
    specs, which turn to **Gone from livehuddle** banners.
- **Part 5, the diagram shapes and the agents' diagram code.** The 15 shape kinds of the Shapes category leave
  `SHAPE_KINDS` and the `ShapeKind` union: `square`, `circle`, `diamond`, `cylinder`, `parallelogram`, `hexagon`,
  `document`, `stadium`, `actor`, `final-state`, `cloud`, `triangle`, `trapezoid`, `star` and `speech-bubble`. A
  stored one is retired by the rule that covers any kind livehuddle does not know, keeps every field it stored (its
  label, colours, border, icon, text settings, note, link, comments) and is named **Square**, **Circle**,
  **Diamond**, **Cylinder**, **Parallelogram**, **Hexagon**, **Document**, **Stadium**, **Actor**, **Final State**,
  **Cloud**, **Triangle**, **Trapezoid**, **Star** or **Speech Bubble** (the Avatar panel's speech bubbles, which
  are a character's chat, are not this kind and stay). Details:
  - **No Space piece depends on them.** No Space template, Room, Door, the Receptionist, the pets, the Avatar Pad
    or any kept kind builds, draws or hit-tests itself as one of these kinds; each kept kind keeps its own face.
  - **No fallback kind.** `coerceShapeKind`, which turned an unknown kind into a square, goes. An agent's
    `add <kind>` of a kind livehuddle does not have is refused (`invalid_value` on `kind`, naming the kinds `add`
    takes), and so are `add shape` and the removed kinds ("shapes are no longer supported in livehuddle: add a
    sticky"); `set … shape=<kind>` takes only a kind livehuddle has. A `replace` or a seeded tab whose new element is
    a shape of a kind livehuddle does not have is refused the same way; an element the tab already holds rides
    through a `replace` exactly as stored, whatever its kind (until now a stored lane sent back was rewritten into a
    square). A seeded tab is refused only when an agent (an api token) creates the document: a person's own create
    (a copy, or Offline Mode committing a document) carries its stored elements as they were.
  - **The diagram lint goes** (`packages/diagram-lint`): a changeset's result keeps its `lint` member on the wire,
    always `null`, so an agent written against it keeps parsing; the footer no longer names a lint; the `lint` tab
    view is gone (`view=lint` is refused as an unknown view).
  - **The edit operations' diagram vocabulary goes**: the arrow selectors (`a->b`, `from:`, `to:`, `downstream:`,
    `upstream:`) and the `after:` placement, which named arrows; a changeset naming one is refused as unknown
    vocabulary. `layout` stays: it sweeps any boxes (stickies, text, Space pieces) into rows.
  - **The diagram theming goes**: the multicolour themes' branch walk over stored arrows (`hierarchy.ts`) and the
    themes' per-shape colour overrides for the diagram kinds. A palette theme paints each box the next hue in
    document order, as it always painted boxes no arrow joined.
  - **Radius and the accent edge go.** Only the removed kinds took a corner radius or an accent edge, so no kept
    kind offers either control; the accent edge's fields leave the element type, and a stored one stays on the
    element as stored.
  - **Gone with the code**: each kind's palette tile definition and shortcut (`R`, `O`, `D`, `C`), its outline,
    geometry and hit outline, its CSS and SVG faces, its default size and factory branch, its label fitting, its
    finish (sketch and marker) outline, its export renderer, its agent view summary and its specs, which turn to
    **Gone from livehuddle** banners.
- **The count.** Part 1 started from a read-only count: the build machine's two local document stores hold no tab,
  and no checked-in fixture outside a test names a deleted kind. Production tabs live in each document's Durable
  Object, which no read-only query reaches, so the owner counts them after merging and the placeholder keeps them
  safe meanwhile. Part 5 counted again: the build machine's local document stores hold 5 tabs, none holding a
  removed shape kind, and no checked-in fixture outside a test names one.
- **Share roles**: as any retired element ([Share roles](#share-roles)); only an Editor deletes one, from its Delete
  button or the usual ways.

## Hand, Eraser and Format as modes

The owner (2026-11-06): "change the selection mode dropdown so it just lets me toggle between Editor and ...
whatever using the board is without too long a name". The Selection Mode picker (Build: Select, Hand; Edit: Eraser,
Format) and the cluster's Walk button gave way to one [Edit | Walk toggle](../008-canvas/avatar-mode.md#the-edit--walk-toggle)
at the start of the strip. livediagram keeps its modes.

- **Hand** is not a mode: Space-drag, the trackpad, the middle button, and on a touch screen a drag on empty canvas
  (the device's default, unchanged) pan. `H` does nothing; Search has no Hand Tool.
- **Eraser** leaves livehuddle with its panel, brush ring, cursor, settings and the `E` and `0` keys
  ([Eraser Panel](../008-canvas/eraser-panel.md), retired): Delete removes a selection. `E` now means Edit.
- **Format** stayed as the painter on the selection toolbar for a while, then left livehuddle too
  ([Format Painter and Clear Styles](#format-painter-and-clear-styles)).
- **Select** is **Edit**, the toggle's other side (`E`, `V`); Search's Select Tool and Avatar Mode are **Edit** and
  **Walk**.
- **Stored boards** load as before: a Selection Mode button only ever hands out Avatar in livehuddle, and one that
  carried Select, Hand, Eraser or Format loads as an Avatar button (`legacy-mode-buttons`).
- **Help**: the Hand and Eraser articles go and their addresses redirect; the Select article says where it now lives.

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
  (`/ai`) with its header link, FAQ answers, landing card and sitemap entry. The marketing header is Explorer alone
  (no header shows Choose Template, Work Tracker 1317).
- **Workbenches go with them.** A workbench opened a document inside a developer tool through the CLI
  (liveworkspace's [Workbench](../../../../liveworkspace/docs/specs/011-workbench/workbench.md)), so livehuddle no longer
  pairs one: the `/embed/workbench` frame, Settings' list of workbench pairings, the editor's workbench chrome and
  messages, and the api's `lvw_` session and its confinement are gone. An `lvw_` bearer now identifies nobody, and the
  router's `/api/workbench` answers 404 from the api, but for the one route a Screen needs to show a file
  live, `/api/workbench/embed-tickets`, which the router forwards to liveworkspace (Work Tracker 1427, [A file on the
  Screen](../009-elements/screen-and-room-sign.md#a-file-on-the-screen)). liveworkspace's pairing service is unchanged; livehuddle simply
  never redeems a pairing. The room's share of the pairing contract went too (Work Tracker #583): no session
  carries a pairing, the api has no workbench-close door, and a platform close for a pairing matches nobody.
- **Help**: the Connect an AI Tool, CLI and Workbenches articles go, and the developer articles show `curl` only. Old
  addresses redirect (router `legacy-help-route.ts`): the AI and MCP articles to [API Tokens](/help/account-and-data/api-tokens/),
  the CLI and Workbench articles to the [API overview](/help/developers/api-overview/).
- **What stays**: the REST API and API tokens (full or read-only), agent changesets, document views, agent presence
  (agent comments went with comments, [Comments, actions, links and notes](#comments-actions-links-and-notes): the
  list still reads, a write answers 410), and everything else a script reaches over HTTP. The changeset front door still parses the `door` of a
  changeset an MCP client or the CLI sent, and telemetry still parses `Mcp`, `Cli` and the `Ai` marketing surface, so
  old events and stored history read as before.
- **Status page**: livehuddle has no MCP row ([Status](../../../../liveworkspace/docs/specs/009-status/status.md)).
- **The owner's steps after merging**: delete the `livehuddle-mcp` and `livehuddle-mcp-staging` Workers, their custom
  domains and DNS, their `livehuddle-mcp-oauth` KV namespaces and secrets, and deprecate `@livehuddle/cli` on npm.
  Deploys find Workers from the workspaces a change reaches, so a deleted app is never deployed.

## Tab style

The owner (2026-11-27): "remove tab style menu from livehuddle, don't let me change these options". Nothing in
livehuddle opens or changes a tab's style any more: no **Style** button in the bottom-right cluster, no Open Theme or
Open Canvas Options command in the palette, and so no Tab Style dialog ([Tab Style dialog](../011-theme/canvas-and-theme-dialog.md),
**Leaving livehuddle**), its Show Me tour or its Looks. A Space looks as livehuddle's own defaults make it.

- **Stored styles stay**: a tab that holds a theme, finish, font, floor or background draws it exactly as before, and
  the file loads and saves it unchanged. No data migration.
- **Shared code stays**: `@liveworkspace/workbench`'s Tab Style dialog and `ThemeStrip` are kept for the other
  products; livehuddle just never mounts them (it passes no handler, as a read-only session does).
- **Kept**: a room's walls, floor and floor colour in the element menu and the
  [Quick Style](../008-canvas/space-quick-style.md) panel are a room's own settings, not the tab's style.
- Test: `editor-commands.test.ts` pins that no command opens the theme or canvas options.

## The Map

The owner (2026-11-27): "remove the map from livehuddle". The **Map** panel (the bottom-left overview of the whole
tab, once it held four elements, with its lit current-view window to tap, drag or scroll on) is gone from livehuddle.
A Space is walked, and Walk, Fit to Screen and the view dial already get anyone anywhere. livediagram, livedocuments,
livedesign and liveknowledge keep their Maps. The [spec](../008-canvas/minimap.md) and
[Panel corner docking](../007-editor/panel-docking.md) in this tree carry a **Gone from livehuddle** banner and record
what livehuddle had.

- **Gone from every surface**: the panel, the **Settings › Panels › Map** rows (**Enable Map**, **Dim Outside the
  View**, **Map Size**), the Receptionist's "The minimap" topic, and the help article (its old address lands on Panel
  Layout). The Map had no keyboard shortcut or menu entry, so none goes.
- **The corner docking went with it.** The Map was livehuddle's last corner panel, so the four corner stacks, their
  drag-to-snap slot and the device-local `livehuddle:panel-layout:v1` layout are gone too. A stored layout stays in
  old browsers' storage, unread.
- **The freed space is used.** Fit to Screen and the fit a tab opens on fill the whole canvas again: nothing moves a
  fit beside or above a panel in the bottom-left. While walking, the Call dock centres in the bottom row with nothing
  to stand clear of on its left; it still stands on a line of its own above the bottom-right buttons when the row has
  no room for both.
- **Stored settings stay, unread**: `showMinimap`, `mapDimOutside` and `mapSize` are common settings the other apps
  still read ([User preferences](../007-editor/user-preferences.md)), so livehuddle leaves them in the blob as they are.
  No migration.
- **Telemetry**: `MinimapOn` / `MinimapOff`, `MapDimOn` / `MapDimOff`, `MapSize*` and `UI Moved PanelDock` are no
  longer sent from livehuddle.
- **Shared code stays**: `@liveworkspace/workbench`'s `MinimapMap`, `fit-clear-of-panel`, panel layout and dock hook
  serve the other products; livehuddle no longer imports them.
- Tests: `settings-catalogue.test.ts` pins that no Map rows are offered; `call-dock-row.test.ts` that the Call dock's
  row keeps no left clearance.

## Share roles

Nothing changes in who may do what with what stays ([Share roles](../013-workspace/share-roles.md)). A leaving
element's role rules no longer apply: its placeholder follows the Editor, Participant and Viewer rules of any element
(an Editor moves, copies and deletes it; a Participant changes nothing, as with any element, and
comments on it; a Viewer sees it).

## Testing

- Part 2: no route, menu, palette entry or help article offers a deck, presenting or the Page: `EditorHeader.test.tsx`
  (no Present button), `editor-commands.test.ts` (no Slide Deck command), `settings-catalogue.test.ts` (no Presenting
  settings), `palette-search.test.ts` (no Page result) and `view-transitions.test.ts` (no slide moves); the router's
  `legacy-help-route.test.ts` pins the help redirects.
- Part 3: the catalogue test pins the five templates; a link, an agent or a seed naming a leaving template is answered
  with Blank Space (`retired-templates.test.ts`); a palette test pins the meeting palette.
- The Session strip's Timer: a stored tab with a `timer` field loads and saves without it (`retired-timer.test.ts`);
  the cluster has no Session strip (`CanvasChrome` has no `session-tools` strip); the palette offers Timer and
  Stopwatch in Meet (`palette-layouts.test.ts`).
- Part 4: a stored tab holding each deleted kind loads, saves unchanged and shows its placeholder
  (`retired-kinds.test.ts` in `packages/document`, `RetiredElementFace.test.tsx` and the e2e
  `retired-elements.spec.ts` in the editor); the export draws the placeholder (`svg-render-retired.test.ts`); no
  palette entry, Search result or agent schema names a deleted kind; Import and Settings show no diagram
  tool; the router's `legacy-help-route.test.ts` pins the retired help addresses.
- The presenting tools: a stored Reaction Pad loads as a retired element named Reaction Pad (`retired-kinds.test.ts`),
  a stored Laser, Spotlight or Isometric button loads with no mode (`legacy-mode-buttons.test.ts`), the picker and
  the command palette name none of them (`useCanvasTool.test.ts`, `editor-commands.test.ts`), and the router pins
  their old help addresses.
- The Frame: a stored Frame loads as a retired element named Frame, still paints at the back and carries nothing
  (`retired-kinds.test.ts`); the keyboard map has no `F` (`useEditorKeyboardShortcuts.test.ts`); the agent schema
  offers no frame.
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
  loads no panel chunk (`document-lazy-load.test.ts`), and the router pins the old help address.
- Icons: the palette and the category bar offer no Icons category (`palette-layouts.test.ts`,
  `bar-categories.test.tsx`), the strip Search and the search panel list no icon (`palette-catalogue-search.test.ts`,
  `palette-search.test.ts`), a stored icon still draws and its menu still edits it, and the router pins the old help
  address.
- Media: the palette and the bar offer no Media category and no Image or Link card tile anywhere, Popular and
  Participate included (`palette-layouts.test.ts`, `bar-categories.test.tsx`, `share-roles.test.ts`), the search
  panel lists neither (`palette-search.test.ts`), `9` adds nothing (`useEditorKeyboardShortcuts.test.ts`), a pasted
  or dropped picture is refused with the notice (`useClipboard.drop.test.tsx`), and the router pins the old help
  addresses.
- Element and Tab Locking: a stored tab and its elements with `locked: true` load and save without it
  (`retired-locks.test.ts`), and so does a peer's `tab` op or `tab-meta` patch; the selection toolbars, the tab menu
  and the command palette offer no Lock; the participant content check and the role tests (`share-roles.test.ts` in
  the api and the editor) refuse nothing for a lock, a Participant swings any Door, and an edit right is still
  checked as before; agent changesets refuse nothing as `element_locked`; and the router pins the two old help
  addresses.
- The element engine (#459): a stored tab holding each deleted kind and type loads, saves unchanged and shows its
  placeholder (`retired-kinds.test.ts`, `retired-element-types.test.ts` and `svg-render-retired.test.ts` in
  `packages/document`, `RetiredElementFace.test.tsx` in the editor); the placeholder's Delete shows for an Editor
  only and removes the element without selecting it (`RetiredElementFace.test.tsx`, `editor-capabilities.test.ts`);
  validation accepts a stored element of a retired type (`validate.test.ts`).
  Part 2: a stored table (cells, cell styles and links included) loads deep-equal, saves unchanged, passes
  validation and is named Table (`retired-kinds.test.ts`); the canvas draws its placeholder and only an Editor gets
  its Delete (`RetiredElementFace.test.tsx`); `add table` is refused (`packages/edit-operations`).
  Part 3: a stored tab holding each layout container kind loads deep-equal, saves unchanged, passes validation and is
  named (`retired-kinds.test.ts`); a stored `callout` stays a callout and a Timeline's old point fields stay; a stored
  lane, stack and boundary paint at the back and carry nothing; an image's `heroCaption` loads and saves unchanged and
  is not drawn (`svg-render-retired.test.ts`); the canvas draws each kind's placeholder and only an Editor gets its
  Delete (`RetiredElementFace.test.tsx`); the api refuses a `graph` replace (`request.test.ts`).
  Part 4: a stored tab holding an arrow (pinned at both ends, with a label, bends and flow), a line, a pen stroke, a
  highlighter stroke, a path and an annotation loads deep-equal, saves unchanged, passes validation and is named
  (`retired-kinds.test.ts`); a retired arrow's ends resolve free, pinned, on another arrow and with its element gone
  (`retired-arrow.test.ts`), and the export draws its line and card (`svg-render-retired.test.ts`); the canvas draws
  each placeholder, a retired arrow's line and card, and only an Editor gets its Delete, never a Participant or a
  Viewer (`RetiredElementFace.test.tsx`, `RetiredArrowView.test.tsx`); moving and deleting what an arrow pinned to
  leaves the arrow as stored; `connect` and `add arrow` are refused (`packages/edit-operations`).
  Part 5: a stored tab holding each of the 15 removed shape kinds loads deep-equal, saves unchanged, passes
  validation and is named (`retired-kinds.test.ts`); the export draws their placeholders
  (`svg-render-retired.test.ts`); the canvas draws each placeholder and only an Editor gets its Delete
  (`RetiredElementFace.test.tsx`); `add square`, an unknown kind and a `replace` with a new square are refused, and
  a stored square sent back by a `replace` stays as stored (`packages/edit-operations`); a changeset's `lint` is
  `null` and `view=lint` is refused (`apps/api`); the palette and Search offer no shape (`palette-search.test.ts`);
  every Space template still builds and validates (`packages/templates`).
- Comments, actions, links and notes: the element menu has no quick bar (`EditorContextMenu.retired.test.tsx`), the
  read-only menu offers no comments, link or note row (`ReadOnlyElementMenuHost.test.tsx`), the command palette has
  no note or comment command (`editor-commands.test.ts`), a copy drops the four (`duplicate.test.ts`,
  `clipboard-payload.test.ts`), the outbox pushes no collab (`document-outbox.test.ts`), the comment write routes and
  the notify routes answer 410 while the list still reads (`comment-routes.test.ts`, `team-notify-routes.test.ts`),
  the op gate drops a comment delta (`room-op-gate.test.ts`), the Explorer shows livehuddle no Inbox while the other
  four keep it (`packages/explorer` `inbox-apps.test.tsx`), and the router pins the old help addresses.
- Every part: the help path tests (`repo-paths-in-docs`, `article-links`, the heading anchors) pass.
