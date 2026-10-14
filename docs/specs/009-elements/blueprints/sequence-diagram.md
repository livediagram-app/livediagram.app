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
- `sequenceDrawing(el, paper)`: `layoutSequence(sequenceDiagramOf(el), { makeId })` with ids `seq-<n>` (deterministic,
  so the picture is stable), drawn with `renderElementsToSvg` on `paper` (the element's resolved fill, so its ink reads
  on it in either theme) and then stripped of the paper rect, since the element's own box is the paper. Cached by the
  rows, Numbered and the paper, at most 64 entries (the oldest dropped first).
- `svgSequencePicture(el, paper)`: that drawing nested as an `<svg>` at the element's box with
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
export function withSequenceNumbered<T extends Element>(el: T, on: boolean): T;
export function withSequenceAnim<T extends Element>(
  el: T,
  patch: { anim?: 'play' | null; speed?: AnimationSpeed; repeat?: boolean },
): T;
export function sequenceDrawing(el: ShapeElement, paper?: string): string; // natural size, no paper
export function svgSequencePicture(el: BoxedElement & { type: 'shape' }, paper?: string): string; // fitted
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

- D194: 560 × 340; participants Browser, API, Database; messages `Place order` (call, Browser → API), `Validate`
  (call, API → API), `Insert order` (call, API → Database), `Order id` (reply, Database → API), `201 Created` (reply,
  API → Browser).
- The Sequence section lists Participants (name, Actor, ↑ ↓ ×, Add Participant) and Messages (From, To, kind; label,
  ↑ ↓ ×; Add Message). Words commit on blur; Enter commits and adds the next message, focused.
- On the palette strip Build now holds exactly twelve tiles, so its divider gives way (the strip's rule).

## Accessibility

The picture has `role="img"` and an `aria-label` listing the participants and the message count; the menu rows are
labelled inputs.

## Observability

`Element·Added·Sequence`; `Element·Changed·SequenceParticipants`, `SequenceMessages`, `SequenceNumbered`,
`SequenceAnim`.

## Testing

| Rule                      | Test file                                                   |
| ------------------------- | ----------------------------------------------------------- |
| Writes, bounds (I1), next | `packages/document/src/sequence-element.test.ts`            |
| Picture and export (I2)   | same                                                        |
| Menu rows, Enter adds     | `apps/live/components/palette/SequenceMenuSection.test.tsx` |
| Face label, Play class    | `apps/live/components/canvas/SequenceFace.test.tsx`         |

## Constants and configuration

| Name             | Value | Provenance |
| ---------------- | ----- | ---------- |
| Participants max | 12    | Spec       |
| Messages max     | 60    | Spec       |
| Play beat        | 0.4 s | D194       |
| Drawing cache    | 64    | Blueprint  |
