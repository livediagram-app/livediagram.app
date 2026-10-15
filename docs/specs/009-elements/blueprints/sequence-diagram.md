# Sequence diagram: blueprint

Derived from [The sequence diagram](../sequence-diagram.md). Defaults in [DEFAULTS.md](DEFAULTS.md) as `Dn`.

| File                                                        | Role                                                      |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| `packages/document/src/sequence-element.ts`                 | Fields, bounds, writes, the diagram it describes          |
| `packages/document/src/svg-render-sequence.ts`              | The picture: `layoutSequence` drawn and fitted to the box |
| `apps/live/components/canvas/SequenceFace.tsx`              | Canvas face (the same picture), the Play wipe             |
| `apps/live/components/palette/SequenceMenuSection.tsx`      | Summary, Edit Sequence, Numbered                          |
| `packages/document/src/sequence-text.ts`                    | The Text tab: rows as lines and back                      |
| `apps/live/components/dialogs/SequenceDialog.tsx`           | The dialog: tabs, draft, preview, footer                  |
| `apps/live/components/dialogs/SequenceParticipantStrip.tsx` | Participant chips and the open chip's editor              |
| `apps/live/components/dialogs/SequenceMessageList.tsx`      | Numbered message rows, Add Message                        |
| `apps/live/components/dialogs/DialogTabs.tsx`               | The tab bar, shared with the Sankey Flows dialog          |
| `apps/live/hooks/canvas/useSequenceSetters.ts`              | The dialog's writes, one commit each                      |
| `apps/live/lib/sequence-edit.ts`                            | `canEditSequence`: an Editor, on an unlocked diagram      |

## Domain and naming

| Term        | Identifier                                           | Meaning                        |
| ----------- | ---------------------------------------------------- | ------------------------------ |
| Sequence    | `shape: 'sequence'`, `isSequenceElement`             | The element                    |
| Participant | `SequenceElementParticipant = { id, label, actor? }` | A lifeline                     |
| Message     | `SequenceElementMessage = { from, to, label, kind }` | A row; `kind` call/async/reply |

Banned: "lifeline" for the element (it is one participant's line), "Mermaid" in UI copy.

## Behaviour and state

- `sequenceDiagramOf(el)`: `{ autonumber: sequenceNumbered, participants, items }` with one message item per message
  whose `from` and `to` name participants (others dropped), `style` = `kind`.
- `sequenceDrawing(el, look)`: `layoutSequence(sequenceDiagramOf(el), { makeId })` with ids `seq-<n>` (deterministic,
  so the picture is stable). Each laid-out part takes the look's colours on the slots `themeColourFields` gives it,
  only where the layout left them unset (fill = `look.paper`, stroke = `look.stroke`, text = `look.ink`), as a new
  element on a themed tab does; with neither stroke nor ink given the parts are left as laid out. Drawn with
  `renderElementsToSvg` on `look.paper` (default `#ffffff`) in a tab carrying `look.finish`, then stripped of the paper
  rect, since the element's own box is the paper; with `look.fontFamily` every `font-family` in the markup is
  replaced by it. Cached by the rows, Numbered and the whole look, at most 64 entries (the oldest dropped first).
- The look (spec "Look"): on the canvas `SequenceFace` passes the element's resolved fill (`cardFill`), stroke
  (`strokeColor ?? defaultStrokeColor`), label colour and font stack, and reads the finish with `useElementFinish`; in
  an export `svgElementBody` passes `fill`, `stroke`, `el.textColor ?? labelColor`, `fontFamily` and the element's
  resolved finish. The Sequence dialog's preview passes only its white paper.
- `svgSequencePicture(el, look)`: that drawing nested as an `<svg>` at the element's box with
  `preserveAspectRatio="xMidYMid meet"`, for exports; the canvas face shows the same markup at 100% of the box.
- `withSequenceRows(el, { participants?, messages? })`: participants bounded to 12 (labels 40), ids kept unique
  (`p<n>`); messages bounded to 60 (labels 80) and filtered to known participants; a participant list under 2 is
  ignored.
- `nextMessageAfter(el, index)`: from the message's `to`, to the participant after it (wrapping), kind Call, label "".
- `withSequenceNumbered(el, on)`: `true` stored, off absent.
- `withSequenceAnim(el, { anim?, speed?, repeat? })`: `'play'` or absent; the default speed (`DEFAULT_ANIMATION_SPEED`)
  stored as absent; Repeat `true` or absent.
- Play: the face sets `--lvd-seq-dur` = `messages * 0.4 s * ANIMATION_SPEED_FACTOR[speed]` and the class
  `.lvd-seq-play` (once: `clip-path: inset(0 0 100% 0)` to `inset(0 0 0 0)`, linear, `both`) or `.lvd-seq-play-loop`
  (Repeat: `infinite` over `dur / 0.7`, revealed by 70%, held to 92%, faded out by 100%); reduced motion
  `animation: none`.

- The dialog (`SequenceDialog`): opened by `sequenceOpenForId` (editor-ui-state), set by the double-click
  (`useBoxedElementGestures` → `openEditDialog`) and the menu's Edit Sequence, both gated on `canEditSequence`; the
  host renders nothing when the element is gone, is not a sequence, or the session may not edit it. It holds a draft
  (`participants`, `messages`), seeded once. `store(p, m, type)` drops messages naming an unknown participant, sets
  the draft and calls `onCommit` unless the JSON of the rows equals the last stored. Words store on blur; picks,
  kind, moves, adds and removes at once; the text on blur; closing stores the draft first.
- `addAfter(i)`: inserts `nextMessageAfter(draft, i)` at `i + 1` and focuses its words; Backspace in empty words
  removes the row and focuses the one above.
- Text tab: entering it writes `sequenceToText(draft)`; typing reads `parseSequenceText(text, draft participants)`
  into the draft unless it names fewer than two participants (then the draft is kept and the note says so); leaving
  it stores the draft.
- `sequenceToText(participants, messages)`: a `participant` / `actor` line each, a blank line, then `From <arrow> To:
words` per message (`->`, `~>`, `-->`). A participant's name is its label (its id when blank); a name already written
  (case-insensitively) takes the first free ` <n>` suffix from 2, so every written name reads back as its own participant.
- `parseSequenceText(text, known)`: per line (trimmed; empty and `//` skipped; past `SEQ_TEXT_LINE_MAX` unread):
  `participant|actor <name>` declares; otherwise the first arrow found scanning left to right (longest token at a
  position: `-->>`, `-->`, `->>`, `->`, `~>`, `-)`, read a character at a time, at most four per position) splits From
  (less any spaces and dashes before the arrow, so `A ---> B` reads From `A`) and the rest; To is the longest participant named so
  far whose name the rest starts with, followed by `:` or the line's end, else the rest up to its first `:`; the words
  follow the `:`.
  Names match case-insensitively; a known name keeps its id, a new one takes the next free `p<n>`. Past 12
  participants or 60 messages the line is unread.

### Invariants

- I1: every stored message names two participants of the element.
- I2: canvas and export draw the same picture.

## Interfaces and contracts

```ts
export type SequenceElementParticipant = { id: string; label: string; actor?: boolean };
export type SequenceElementMessage = {
  from: string;
  to: string;
  label: string;
  kind: 'call' | 'async' | 'reply';
};
export function isSequenceElement(el: Element): boolean;
export function sequenceDiagramOf(el: ShapeElement): SequenceDiagram;
export function withSequenceRows<T extends Element>(
  el: T,
  rows: { participants?: SequenceElementParticipant[]; messages?: SequenceElementMessage[] },
): T;
export function nextMessageAfter(el: ShapeElement, index: number): SequenceElementMessage;
export function sequenceToText(
  participants: readonly SequenceElementParticipant[],
  messages: readonly SequenceElementMessage[],
): string;
export function parseSequenceText(
  text: string,
  known?: readonly SequenceElementParticipant[],
): {
  participants: SequenceElementParticipant[];
  messages: SequenceElementMessage[];
  unread: number[];
};
export function canEditSequence(can: Pick<EditorCapabilities, 'level'>, el: Element): boolean;
export function withSequenceNumbered<T extends Element>(el: T, on: boolean): T;
export function withSequenceAnim<T extends Element>(
  el: T,
  patch: { anim?: 'play' | null; speed?: AnimationSpeed; repeat?: boolean },
): T;
export type SequenceLook = {
  paper?: string;
  stroke?: string;
  ink?: string;
  fontFamily?: string;
  finish?: Finish;
};
export function sequenceDrawing(el: ShapeElement, look?: SequenceLook): string; // natural size, no paper
export function svgSequencePicture(
  el: BoxedElement & { type: 'shape' },
  look?: SequenceLook,
): string; // fitted
```

Validation: participants 2 to 12 (`id` ≤ 24, label ≤ 40, `actor` boolean); messages ≤ 60 (`from`/`to` ≤ 24, label ≤ 80,
kind one of three); `sequenceNumbered` boolean; `sequenceAnim` `'play'`.

## Data and persistence

| Field                  | Class               |
| ---------------------- | ------------------- |
| `sequenceParticipants` | persisted           |
| `sequenceMessages`     | persisted           |
| `sequenceNumbered`     | persisted           |
| `sequenceAnim*`        | persisted, cosmetic |

## Errors and edge cases

| #   | Case                                                                   | Handling                                                                                                                     |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| E1  | No messages                                                            | Heads and lifelines only                                                                                                     |
| E2  | A message to a removed participant                                     | Dropped by the write; ignored by the reader                                                                                  |
| E3  | Very long labels                                                       | The layout widens its pitch (capped at 520) and the picture scales down                                                      |
| E4  | Diagram deleted, locked or no longer editable while its dialog is open | The dialog closes (`useCloseVanishedDialogs`, with its own `canEditSequence` check); an undo or an unlock does not reopen it |

## Security and trust

Labels pass through the headless renderer's escaping; the picture is our own SVG, inserted as markup.

## Performance and limits

Layout is O(messages) ≤ 60; the picture is built once per change of the rows (memo on the canvas), not per frame.

The Text tab parses on every keystroke. A hostile paste (1,000 lines of 390 dashes, 1,000 lines of 190 ` -` pairs before
an arrow, a 100,000-character line) parses in 10 ms of CPU on an M-series Mac, 29 ms under coverage, against a 200 ms
budget (`sequence-text.test.ts`). The arrow scan reads at most four characters per position and the trailing-dash trim
is a walk back, never a backtracking pattern; trying the six arrows with `startsWith` at every dash cost 40 ms (73 ms
under coverage, 281 ms on CI).

## Presentation and UX

- D194: 560 × 340; participants Browser, API, Database; messages `Place order` (call, Browser → API), `Validate`
  (call, API → API), `Insert order` (call, API → Database), `Order id` (reply, Database → API), `201 Created` (reply,
  API → Browser).
- The Sequence section: `N participants · M messages`, Edit Sequence (secondary, full width; only with
  `onEditSequence`), Numbered. Play is the Animation row's Sequence section (`ElementAnimationTiles.tsx` `SequenceAnimTiles`: None, Play,
  then Speed / Repeat); a sequence diagram takes no Shape set (`animation-membership.ts` `hasOwnBodySet`).
- The dialog: size `3xl`, `phoneSheet`, `max-h-[90vh]`; header title "Sequence Diagram" and its line, labelled Help
  (`sequenceDiagram` → `palette/sequence-diagrams`), close. Tabs Messages / Text (`DialogTabs`). Body: rows column and
  a 280 px preview (white paper, `max-h-[360px]`, 160 px on a phone, above the rows there). Footer: Numbered switch,
  Done.
- Chips: 32 px pills with the look glyph; the open chip ringed in brand; the editor row holds the name box, a
  Box / Actor radio pair, Move Left, Move Right and Remove (rose on hover; disabled at two, tooltip says why, or how
  many messages go with it). Add Participant is a dashed pill; it adds `{ id: first free p<n>, label: Participant <k> }`,
  `k` the first number from the count plus one that no label uses (case-insensitively).
- Message rows: grid `[1.25rem 6.5rem 2.5rem 6.5rem 1fr auto]` on a wide screen; on a phone `[1.25rem 1fr 2.5rem 1fr]`,
  From, kind and To on the first line (From and To equal), the words (columns 2 to 3) and the actions (column 4) on
  the second. The kind button draws `KindArrow` (brand tint for Call and
  Async, plain for Reply). Move Up / Down show on hover or focus, always on a touch screen. Add Message is a dashed
  row ending in `n of 60`. No messages: `CompactEmptyState` "No messages yet".
- A sequence opens no inline label editor (`opensInlineLabelEditor` is false), so a click never starts one and a
  double-click reaches the dialog; it is not self-drawing, so its box keeps its border controls.
- On the palette strip Build now holds exactly twelve tiles, so its divider gives way (the strip's rule).

## Accessibility

The picture has `role="img"` and an `aria-label` listing the participants and the message count; the menu rows are
labelled inputs.

## Observability

`Element·Added·Sequence`; `Element·Changed·SequenceParticipants`, `SequenceMessages`, `SequenceText` (the
dialog, `useSequenceSetters`), `SequenceNumbered`, `SequenceAnim`.

## Testing

| Rule                        | Test file                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Writes, bounds (I1), next   | `packages/document/src/sequence-element.test.ts`                                                      |
| Picture and export (I2)     | same                                                                                                  |
| Look: colours, face, finish | `packages/document/src/sequence-element.test.ts`, `apps/live/components/canvas/SequenceFace.test.tsx` |
| Menu: summary, Edit         | `apps/live/components/palette/SequenceMenuSection.test.tsx`                                           |
| Dialog: rows, text, close   | `apps/live/components/dialogs/SequenceDialog.test.tsx`                                                |
| Text read and written       | `packages/document/src/sequence-text.test.ts`                                                         |
| Dialog writes               | `apps/live/hooks/canvas/useSequenceSetters.test.ts`                                                   |
| Who may edit                | `apps/live/lib/sequence-edit.test.ts`                                                                 |
| Face label, Play class      | `apps/live/components/canvas/SequenceFace.test.tsx`                                                   |
| Dialog closes (E4)          | `apps/live/components/dialogs/useCloseVanishedDialogs.test.ts`                                        |

## Constants and configuration

| Name             | Value | Provenance |
| ---------------- | ----- | ---------- |
| Participants max | 12    | Spec       |
| Messages max     | 60    | Spec       |
| Play beat        | 0.4 s | D194       |
| Drawing cache    | 64    | Blueprint  |
| Text line max    | 400   | Blueprint  |
