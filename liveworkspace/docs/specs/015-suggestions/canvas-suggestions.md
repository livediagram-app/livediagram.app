# Canvas suggestions

Status: built (Work Tracker 931)

Anyone who may take part on a canvas can **suggest** a change instead of making it: the change waits beside the
canvas, drawn as a ghost in its author's colour, until an Editor **accepts** it (it becomes the canvas, as one
changeset) or **rejects** it (it goes). The same in every product with a canvas: livediagram's tabs, livedesign's
pages, liveplanner's canvas tabs, and livedocuments' slides and infographics, built once in `@liveworkspace/suggestions`
(`packages/suggestions`). It is how a reviewer, a client or a student proposes a change to someone else's work
without being able to break it, as Google Docs' Suggesting mode does for text, Figma's branch review does for a
file, and livedocuments' own [suggestions](../../../livedocuments/docs/specs/007-editor/suggestions.md) do for
articles.

## Domain language

- **Suggestion**: one person's proposed change to one tab's elements: elements put in, changed or taken out. It holds
  each target as its author found it (its **base**), its author (name, colour, collab key) and when it was made.
- **Suggesting**: the mode in which a person's changes on the canvas become suggestions.
- **Suggest Only**: a Participant setting an Editor turns on in the Share dialog: that Participant always suggests,
  and the server refuses any change they make to the canvas directly.
- **Conflict**: a suggestion whose targets changed since it was made (by anyone, or by a suggestion accepted before
  it). It is flagged and never applied.

## Suggesting

- **An Editor** switches between **Editing** and **Suggesting** in the canvas's Suggestions bar, at the top edge of
  the canvas. Suggesting is per person and per visit; it starts off.
- **A Participant on Suggest Only** always suggests: the bar shows a **Suggesting** chip in place of the switch, and
  the title bar's role pill reads **Suggesting**. While suggesting, they may make any change to the active tab's
  elements an Editor could (draw, move, resize, restyle, write, delete, paste); each becomes a suggestion.
- **One gesture is one suggestion**: a drag that lands, a paste, a typed label, a burst of nudges (changes within half
  a second of each other) gathers into one. While gathering, the change draws as a ghost in the person's own colour
  with the chip **Suggesting**; it is sent when the gesture ends.
- **What a suggestion can't hold** is refused with one short notice and left as it was: a change to another tab, to the
  tab's own settings (its name, theme, layers, page size), adding or removing tabs, or reordering alone.
- **Live fields pass through**: a comment, a reaction, a vote or another live multi-writer field on an element is
  never a suggestion; it lands as it does for anyone who may make it.
- **Undo** is untouched by suggesting: a suggestion never enters the canvas's history. Taking one back is **Take Back**
  in the review list.

## Seeing a suggestion

- **Ghosts**: over the canvas, above its elements and below the selection, each suggestion draws in its author's
  colour: an element put in as a softly tinted dashed box where it would land, holding its words; an element changed as
  a dashed box where it would end up, with a dotted outline where it is now and a dashed line between them when it
  moves; an element taken out as its box struck with a hatch. Each carries a chip with a dot in the author's colour,
  a mark (+, pencil, minus) and the author's name; a conflicted one adds **Changed since**.
- **The review list** opens from the bar's count (**3 Suggestions**): one row per suggestion, oldest first, with its
  author's dot and name (**(you)** on your own), how long ago, what it does in words (**Add 2 elements**, **Add 1,
  change 1**; never the elements' text) and a **Changed since** flag when it is a conflict. Pointing at a row or
  focusing it brings its ghosts forward and steps the others back. Escape closes it.
- **Who sees them**: every Editor and Participant on the tab. A Viewer sees none, and the room tells a Viewer nothing
  about them.

## Reviewing

- **An Editor** has **Accept** and **Reject** on each row and **Accept All** and **Reject All** at the top of the
  list. Accept and Accept All write the accepted suggestions to the tab as **one changeset** by the Editor, summarised
  **Accepted a suggestion** or **Accepted 3 suggestions**, so they show in the canvas's changeset history like an
  assistant's and Revert takes them back together. Reject removes without touching the canvas.
- **In the order made**: Accept All applies the suggestions oldest first, each against the canvas as the ones before
  it left it.
- **A stale suggestion is never applied**: accepting compares each target with the base the suggestion recorded (the
  element without its live fields). A target changed, gone, or an added id now taken makes the suggestion a conflict:
  it stays in the list flagged **Changed since**, its Accept is disabled, and the Editor is told **The canvas changed
  since that suggestion was made, so it was not applied.** The rest of an Accept All still lands. The author may Take
  Back and suggest again; an Editor may Reject.
- **A Participant** takes back its own suggestions; it never accepts or rejects anyone's.

## Suggest Only

- **Set in the Share dialog's Suggestions section**, for an Editor, in every product: each Participant link (named by
  the tab it opens, or **Whole Diagram**, **Whole Design**, **Whole Plan**, **Whole Document**, and when it was made)
  with a **Suggest Only** switch, and each person who has joined as a Participant with the same switch. It is the
  setting livedocuments' articles already have
  ([Suggest Only](../../../livedocuments/docs/specs/007-editor/suggestions.md#suggest-only)), the same rules and
  storage: a link turned on makes everyone who opens it suggest; a person turned on suggests through any Participant
  link; someone who opens a Suggest Only link stays on it on later visits while the link is on. livedocuments keeps its
  **Assistants Suggest** switch; the other products have no such row.
- **The server is the rule**: a Participant on Suggest Only has every direct change to a tab's elements refused by the
  room (the sender's copy reloads, as any refused write does), but for the live fields above. Their suggestions go
  through the suggestion routes.
- **Live**: a change reaches every open Participant at once.

## Share roles

| Role                           | Suggestions                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Editor**                     | Edits or suggests (the switch), sees every suggestion, accepts and rejects each or all, sets Suggest Only.             |
| **Participant (Suggest Only)** | Suggests any change to the active tab's elements, sees every suggestion, takes back its own; never writes straight in. |
| **Participant**                | Writes as a Participant does, sees every suggestion, takes back its own (made while it was on Suggest Only).           |
| **Viewer**                     | Sees no suggestion and makes none; the routes refuse it (403 `viewer_cannot_suggest`).                                 |

A tab-scoped link reaches its own tab's suggestions only. An API token reaches the routes at its grant's level; an
assistant's own edits keep [agent changesets](../../../livediagram/docs/specs/024-agents/agent-changesets.md).

## Stored on the item

- Suggestions wait in the item's own storage (its room), one row each, **beside its tabs, never inside them**. So
  exports (PDF, PNG, SVG, every file), thumbnails, the Community, copies, templates, version history, the MCP and every
  agent read, the Map and presenting show the canvas without them, with nothing to filter.
- Deleting a tab leaves its suggestions unreachable; they are never shown on another tab.
- Suggest Only settings live where livedocuments keeps them, on the item's own row in its room (`review`).

## Limits

- At most 100 suggestions wait on one tab; a further one is refused (**Too many suggestions are waiting on this tab.**).
- One suggestion holds at most 200 changes and 192 KiB.
- A suggestion's change must leave a valid tab (the product's own element rules), and must find what it changes (an
  element it changes or removes is there; an element it adds is not).

## Telemetry

- `Element · Changed · CanvasSuggesting`, `CanvasEditing` (the switch), `CanvasSuggestionMade`,
  `CanvasSuggestionSuggestOnly` (a suggestion made), `CanvasSuggestionAccepted`, `CanvasSuggestionRejected`,
  `CanvasSuggestionsAcceptedAll`, `CanvasSuggestionsRejectedAll`.
- `<Item> · Shared · SuggestOnlyLinkOn`, `SuggestOnlyLinkOff`, `SuggestOnlyPersonOn`, `SuggestOnlyPersonOff`.
- Never content, never a name.

## Non-goals

- livehuddle: its canvas is its own, not the shared editor; it takes suggestions when it shares this code.
- Suggesting a tab's settings, a new tab, a z-order change alone, or a sheet's cells (liveplanner's Sheet tabs) and a
  board's cards (Board tabs): those are not canvas elements.
- Comments on a suggestion itself (a comment on the element carries the talk).
- Assistants suggesting on a canvas (an assistant's canvas edits keep Show and Undo).
