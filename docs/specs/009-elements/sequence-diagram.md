# The sequence diagram

## What

A **Sequence diagram**: one element holding a list of participants and the messages between them, laid out by itself
as a UML sequence diagram: headed boxes over dashed lifelines, a row per message, activation bars where a call is
answered, self-calls looping out and back, replies dashed. A `shape: 'sequence'`.

## Why

A sequence diagram drawn by hand is dozens of elements kept in exact alignment: heads, lifelines, bars and a row of
arrows per message, every one needing a nudge when a message is added in the middle. The editor already lays sequence
diagrams out for Mermaid imports and agents (`layoutSequence`, [Mermaid](../020-import-export/mermaid.md) "Sequence
diagrams (agents)"); this element keeps the list as the source, so inserting a message is typing one row.

## The element

- **Participants** (`sequenceParticipants: { id, label, actor? }[]`, 2 to 12): left to right. An actor draws as a stick
  figure, the rest as headed boxes. A label is at most 40 characters.
- **Messages** (`sequenceMessages: { from, to, label, kind }[]`, 0 to 60): top to bottom. `kind` is **Call** (solid,
  filled head), **Async** (solid, open head) or **Reply** (dashed, open head); `from === to` is a self-call. A label is
  at most 80 characters.
- **Numbered** (`sequenceNumbered`): prefixes each message with its number ("1: Place order"). Off by default.
- **Bars**: a call that is later answered by a reply opens an activation bar on the callee from the call to the reply,
  as Mermaid draws answered calls.
- **Layout**: the shared `layoutSequence`, scaled to fit the element's box with its aspect kept and centred; resizing
  the element scales the drawing. The element is drawn the same on the canvas and in every export.

Removing a participant removes the messages to and from it.

## Editing

A sequence is too much to edit in a menu, so it has its own dialog, as the [Sankey](sankey.md) has its Flows dialog.

### The menu

The **Sequence** section (Tools flyout), closed until opened: a one-line summary (`3 participants · 5 messages`), an
**Edit Sequence** button that opens the dialog, and **Numbered** on / off. The **Play** animation is the Sequence
section of the menu's Animation row.

### The Sequence dialog

- Opened by double-clicking the diagram or **Edit Sequence**. On a phone it rises from the bottom as a sheet, as the
  editor's other dialogs do (Edit Outline).
- **Header**: title **Sequence Diagram**, the line "Who calls whom, in order. Write the messages top to bottom and the
  diagram lays itself out.", the labelled **Help** link (the Sequence Diagrams article) and the close cross.
- Two tabs, **Messages** first and **Text**. Switching tabs carries the rows across.
- **Participants** run along the top as chips, left to right as the diagram draws them, each with its look's glyph (a
  box, or a stick figure for an actor). Clicking one opens it in place: its name, **Actor** on / off, **Move Left**,
  **Move Right** and **Remove** (which takes its messages with it; disabled at two participants). Enter or a click
  away closes it; Escape cancels the rename, not the dialog. A dashed **Add Participant** chip ends the strip
  (disabled at 12) and opens the new one, named with a name no other participant has, for renaming.
- **Messages** (the first tab): a numbered row per message, top to bottom:
  - **From** and **To**, picked from the participants; the same participant twice is a self-call.
  - The **kind**, one button between them drawn as the arrow it makes (a solid line with a filled head for **Call**,
    an open head for **Async**, a dashed line for **Reply**); clicking it moves to the next kind, and its tooltip and
    name say which it is.
  - The **words**, a wide box.
  - **Move Up**, **Move Down** (on hover or focus with a mouse, always on a touch screen) and **Remove**.
  - On a phone, From, the kind and To share the first line and the words take the second.
  - **Enter** in a message's words adds the next message under it, from that message's receiver to the participant
    after it (wrapping to the first), with the cursor in its words, so a conversation is typed straight down.
    **Backspace** in an empty message removes it and returns to the one above.
  - **Add Message**, a full-width dashed row under the last (disabled at 60), adds one after the last, the same way.
    It counts the messages (`5 of 60`).
  - With no messages, the list shows an empty state, "No messages yet", over the Add Message row.
- **Text**: the sequence as lines, edited in place:
  - `participant API` or `actor Customer` declares a participant (optional; any name a message uses is added, in the
    order it first appears);
  - `From -> To: words` is a call, `From ~> To: words` is async, `From --> To: words` is a reply;
  - lines starting with `//` are notes and are skipped;
  - lines it cannot read are named (`Line 4 was not read.`), and nothing else is lost.
    The common arrows other tools write (`->>`, `-->>`, `-)`) are read too. Participants keep their identity across a
    round trip by name, so their messages stay theirs. Two participants sharing a name are written apart (the second
    `API 2`), so editing the text never merges them, and a declared name holding a colon (`DB: Postgres`) is read
    whole after an arrow, its words after it.
  - Add Participant names the new one `Participant <n>` with the first number no other participant uses.
- A **preview** of the diagram sits beside the rows on a wide screen (above them on a narrow one), drawn on white
  whatever the appearance, from the draft as you type.
- The footer holds **Numbered** on the left and **Done** on the right.
- Every change is stored as one undo step: words when their box loses focus, anything structural (a pick, a move, an
  add, a remove, a kind) at once, and the text when its box loses focus. A store that would change nothing is skipped.
  Closing (Done, the cross, Escape, a tap outside) stores what is being typed.

## Animation

**Play** (`sequenceAnim: 'play'`, the Sequence section of the menu's Animation row) reveals the diagram top to bottom,
so the messages appear in the order they happen; the wipe takes 0.4 s per message at Normal speed (scaled by Speed; the default Slow doubles it) and plays once
unless Repeat is on. CSS only (a clip from the top); reduced motion and every export show the whole diagram.

## Palette

| Mode       | Where                                        |
| ---------- | -------------------------------------------- |
| Diagram    | **Build**: Sequence Diagram, after Flowchart |
| Illustrate | none                                         |
| Plan       | none                                         |
| Facilitate | none (Search still finds and places it)      |

A new one shows Browser, API and Database with five messages: a call, a self-call, a call to the database, its reply
and the reply to the browser.

## Share roles

| Role        | May                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------ |
| Editor      | Everything above (the dialog and the double-click are an Editor's, on an unlocked diagram) |
| Participant | Look                                                                                       |
| Viewer      | Look                                                                                       |

## Agents

The MCP server and the REST API take `sequence` with `sequenceParticipants`, `sequenceMessages` and `sequenceNumbered`.
An agent that already has Mermaid text can keep drawing loose elements (`style: "sequence"`); this element is the
editable form.
