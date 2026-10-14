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

The **Sequence** section (Tools flyout), closed until opened:

- **Participants**: a row per participant (name, an Actor toggle, ↑ ↓ ×), **Add Participant** (disabled at 12).
- **Messages**: a row per message (From, To, label, kind, ↑ ↓ ×), **Add Message** (disabled at 60). **Enter** in a
  message's label adds the next message under it, from that message's receiver to the participant after it (wrapping
  to the first), and puts the cursor in its label, so a conversation is typed straight down.
- **Numbered**: on / off.

## Animation

**Play** (`sequenceAnim: 'play'`, the Concept-style option in the Sequence section) reveals the diagram top to bottom,
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

| Role        | May              |
| ----------- | ---------------- |
| Editor      | Everything above |
| Participant | Look             |
| Viewer      | Look             |

## Agents

The MCP server and the REST API take `sequence` with `sequenceParticipants`, `sequenceMessages` and `sequenceNumbered`.
An agent that already has Mermaid text can keep drawing loose elements (`style: "sequence"`); this element is the
editable form.
