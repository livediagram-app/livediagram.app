# Sequence text

liveplanner takes no Mermaid: its MCP server, CLI and public API accept no Mermaid text and no node/edge `graph`, and
nothing exports one. What `packages/project` keeps is the sequence model a sequence diagram element draws from:

- `mermaid-sequence.ts`: the sequence types (`SequenceDiagram`, `SequenceItem`) that `sequence-element.ts` and
  `sequence-layout.ts` use, and `parseSequenceDiagram`, which reads Mermaid `sequenceDiagram` text into them. No
  product surface calls the parser; the sequence layout tests write their cases in that text and read them through it.
- `graph-header.ts` (`withHeaderAndKey`): the title, caption and key a sequence diagram element draws above itself.
- `glyph-width.ts` (`glyphWidth`): the DOM-free text width estimate the header, the sequence layout and chart
  values measure with.

## The syntax

What `parseSequenceDiagram` reads, and how `layoutSequence` draws it (the
[sequence diagram element](../009-elements/sequence-diagram.md) draws through the same layout).

- **Syntax**: `participant A` / `participant A as Label`, `actor A` (a UML stick figure with its name beneath);
  participants appear in the order declared, then first mentioned. Messages `A->>B: text` (a call: solid, filled
  head), `A-)B: text` (async: solid, open head), `A-->>B: text` and `A-->B: text` (a reply: dashed, open head),
  `A->B` and `A-xB` (calls); `A->>A` is a self-call. `+` and `-` after the arrow (`A->>+B`, `B-->>-A`) and
  `activate B` / `deactivate B` start and end activations at the message the line follows; a message into B that
  `activate B` follows ends on the bar it starts, not on B's lifeline inside it. An activation the author opened (`+`,
  `activate`) stays open until its `-` or `deactivate`; a reply on the way does not close it. `Note over A,B: text`, `Note right of A: text`,
  `Note left of A: text`; a note over one participant whose bar is open sits beside the bar, as a right-of note
  does (left of it on the last participant, the side with room), since centred it hid the bar, and a beside note keeps clear of the bars. Fragments `loop`, `alt` (with `else`), `opt`, `par` (with `and`), `critical`, `break`,
  each closed by `end`. `autonumber` numbers the messages; `title Text` (or front matter `title:`) heads the
  diagram. `rect` blocks, `box` groupings, links and styling are read and skipped, never an error.
- **Activations without markers**: a call to another participant activates it from that message until it replies
  to its caller; one never closed ends after the participant's last message. A self-call nests an activation,
  stepped right. Nested activations step right by half a bar. A diagram that activates anything itself (`activate`, `deactivate`, `+`, `-`) draws
  only those bars: answered calls add none, so an author's bars are never doubled.
- **The look**: participants in a row of headed boxes (bold, the node text size) each over a dashed lifeline, the
  pitch wide enough for the longest message label in one gap (up to 520 px), as a message keeps its label in its
  first gap; messages a row each, edge to edge of the activation bars, labels above their line, wrapped to the gap
  and lifted by however many lines they take so no plate cuts its own line; a self-call loops out of the bar and back
  into its nested one; a note is a sticky over or beside its participants, as tall as its text needs (one line, 48
  px) with the text centred; a fragment is a frame across the lifelines its messages and notes involve (every
  lifeline when they involve none), wide enough to hold its notes whole and every fragment nested in it a step
  inside, with its operator as its label and
  each guard in muted text, operands split by a dashed divider.
- **Limits**: at most 30 participants and 300 messages, notes and fragment lines; past them the parser refuses
  naming the limit.
