# Sequence diagram: blueprint

Derived from [The sequence diagram](../sequence-diagram.md). Defaults in [DEFAULTS.md](DEFAULTS.md) as `Dn`.

| File                                                   | Role                                                      |
| ------------------------------------------------------ | --------------------------------------------------------- |
| `packages/document/src/sequence-element.ts`            | Fields, bounds, writes, the diagram it describes          |
| `packages/document/src/svg-render-sequence.ts`         | The picture: `layoutSequence` drawn and fitted to the box |
| `apps/live/components/canvas/SequenceFace.tsx`         | Canvas face (the same picture), the Play wipe             |
| `apps/live/components/palette/SequenceMenuSection.tsx` | Participants, messages, Numbered, Play                    |

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
- `sequencePicture(el)`: `layoutSequence(sequenceDiagramOf(el), { makeId })` with ids `seq-<n>` (deterministic, so the
  picture is stable), drawn with `renderElementsToSvg` on no background; cached by the element's rows. Fitted into the
  element's box by `preserveAspectRatio="xMidYMid meet"`.
- `withSequenceRows(el, { participants?, messages? })`: participants bounded to 12 (labels 40), ids kept unique
  (`p<n>`); messages bounded to 60 (labels 80) and filtered to known participants; a participant list under 2 is
  ignored.
- `nextMessageAfter(el, index)`: from the message's `to`, to the participant after it (wrapping), kind Call, label "".
- Play: the face wraps the picture in `.lvd-seq-play` with `--lvd-seq-n` (messages) and `--lvd-seq-speed`; CSS
  `clip-path: inset(0 0 100% 0)` to `inset(0)` over `n * 0.4 s * speed`, linear, `both`, once (or `infinite` with
  Repeat and a 1.5 s hold); reduced motion `animation: none`.

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
export function svgSequencePicture(el: ShapeElement): string; // an <svg> sized to the element's box
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

| #   | Case                               | Handling                                                                |
| --- | ---------------------------------- | ----------------------------------------------------------------------- |
| E1  | No messages                        | Heads and lifelines only                                                |
| E2  | A message to a removed participant | Dropped by the write; ignored by the reader                             |
| E3  | Very long labels                   | The layout widens its pitch (capped at 520) and the picture scales down |

## Security and trust

Labels pass through the headless renderer's escaping; the picture is our own SVG, inserted as markup.

## Performance and limits

Layout is O(messages) ≤ 60; the picture is built once per change of the rows (memo on the canvas), not per frame.

## Presentation and UX

- D194: 560 × 340; participants Browser, API, Database; messages `GET /orders` (call, Browser → API), `validate`
  (call, API → API), `SELECT orders` (call, API → Database), `rows` (reply), `200 OK` (reply).

## Accessibility

The picture has `role="img"` and an `aria-label` listing the participants and the message count; the menu rows are
labelled inputs.

## Observability

`Element·Added·Sequence`; `Element·Changed·SequenceRows`, `SequenceNumbered`, `SequenceAnim`.

## Testing

| Rule                      | Test file                                                   |
| ------------------------- | ----------------------------------------------------------- |
| Writes, bounds (I1), next | `packages/document/src/sequence-element.test.ts`            |
| Picture and export (I2)   | same                                                        |
| Menu rows, Enter adds     | `apps/live/components/palette/SequenceMenuSection.test.tsx` |

## Constants and configuration

| Name             | Value | Provenance |
| ---------------- | ----- | ---------- |
| Participants max | 12    | Spec       |
| Messages max     | 60    | Spec       |
| Play beat        | 0.4 s | D194       |
