// The sequence diagram element (docs/specs/009-elements/sequence-diagram.md, blueprint sequence-diagram.md): one
// element holding participants and messages, laid out by the shared `layoutSequence` (the Mermaid import's and the
// agents' layout), so inserting a message is typing one row.

import { DEFAULT_ANIMATION_SPEED, type AnimationSpeed } from './animation';
import type { Element, ShapeElement } from './index';
import type { SequenceDiagram, SequenceItem } from './mermaid-sequence';

export type SequenceElementParticipant = { id: string; label: string; actor?: boolean };
export type SequenceMessageKindName = 'call' | 'async' | 'reply';
export type SequenceElementMessage = {
  from: string;
  to: string;
  label: string;
  kind: SequenceMessageKindName;
};

export const SEQ_PARTICIPANTS_MIN = 2;
export const SEQ_PARTICIPANTS_MAX = 12;
export const SEQ_MESSAGES_MAX = 60;
export const SEQ_PARTICIPANT_LABEL_MAX = 40;
export const SEQ_MESSAGE_LABEL_MAX = 80;
const SEQ_ID_MAX = 24;
export const SEQUENCE_KINDS: readonly SequenceMessageKindName[] = ['call', 'async', 'reply'];

export function isSequenceElement(el: Element): boolean {
  return el.type === 'shape' && el.shape === 'sequence';
}

const clip = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);
const isKind = (v: unknown): v is SequenceMessageKindName =>
  v === 'call' || v === 'async' || v === 'reply';

/** The diagram the element describes, for `layoutSequence`: messages naming an unknown participant are left out. */
export function sequenceDiagramOf(el: ShapeElement): SequenceDiagram {
  const participants = (el.sequenceParticipants ?? []).map((p) => ({
    id: p.id,
    label: p.label,
    ...(p.actor ? { actor: true } : {}),
  }));
  const known = new Set(participants.map((p) => p.id));
  const items: SequenceItem[] = (el.sequenceMessages ?? [])
    .filter((m) => known.has(m.from) && known.has(m.to))
    .map((m) => ({ kind: 'message', from: m.from, to: m.to, label: m.label, style: m.kind }));
  return { autonumber: el.sequenceNumbered === true, participants, items };
}

/** The element with its rows written, bounded: participants 2 to 12 (ids kept unique), messages to 60 and only between
 *  known participants. A participant list under two is ignored. */
export function withSequenceRows<T extends Element>(
  el: T,
  rows: { participants?: SequenceElementParticipant[]; messages?: SequenceElementMessage[] },
): T {
  if (el.type !== 'shape' || el.shape !== 'sequence') return el;
  let participants = el.sequenceParticipants ?? [];
  if (rows.participants) {
    const used = new Set<string>();
    const next = rows.participants.slice(0, SEQ_PARTICIPANTS_MAX).map((p, i) => {
      let id = clip(p.id || `p${i + 1}`, SEQ_ID_MAX) || `p${i + 1}`;
      let n = i + 1;
      while (used.has(id)) id = `p${++n}`;
      used.add(id);
      return {
        id,
        label: clip(p.label, SEQ_PARTICIPANT_LABEL_MAX),
        ...(p.actor ? { actor: true } : {}),
      };
    });
    if (next.length >= SEQ_PARTICIPANTS_MIN) participants = next;
  }
  const known = new Set(participants.map((p) => p.id));
  const messages = (rows.messages ?? el.sequenceMessages ?? [])
    .filter((m) => known.has(m.from) && known.has(m.to))
    .slice(0, SEQ_MESSAGES_MAX)
    .map((m) => ({
      from: m.from,
      to: m.to,
      label: clip(m.label, SEQ_MESSAGE_LABEL_MAX),
      kind: isKind(m.kind) ? m.kind : 'call',
    }));
  return { ...el, sequenceParticipants: participants, sequenceMessages: messages };
}

/** The message Enter adds after `index`: from that message's receiver to the participant after it (wrapping), a call
 *  with no words yet. Past the end (or with no messages), from the first participant to the second. */
export function nextMessageAfter(el: ShapeElement, index: number): SequenceElementMessage {
  const ps = el.sequenceParticipants ?? [];
  const prev = el.sequenceMessages?.[index];
  const fromId = prev?.to ?? ps[0]?.id ?? 'p1';
  const at = ps.findIndex((p) => p.id === fromId);
  const to = ps[(at + 1) % Math.max(1, ps.length)]?.id ?? fromId;
  return { from: fromId, to, label: '', kind: 'call' };
}

/** The element with a Play setting (`'play'`) or none, its speed (Normal stored as absent) and its repeat. */
export function withSequenceAnim<T extends Element>(
  el: T,
  patch: { anim?: 'play' | null; speed?: AnimationSpeed; repeat?: boolean },
): T {
  if (el.type !== 'shape' || el.shape !== 'sequence') return el;
  const next = { ...el } as T & {
    sequenceAnim?: 'play';
    sequenceAnimSpeed?: AnimationSpeed;
    sequenceAnimRepeat?: boolean;
  };
  if (patch.speed !== undefined) {
    if (patch.speed === DEFAULT_ANIMATION_SPEED) delete next.sequenceAnimSpeed;
    else next.sequenceAnimSpeed = patch.speed;
  }
  if (patch.anim !== undefined) {
    if (patch.anim) next.sequenceAnim = 'play';
    else delete next.sequenceAnim;
  }
  if (patch.repeat !== undefined) {
    if (patch.repeat) next.sequenceAnimRepeat = true;
    else delete next.sequenceAnimRepeat;
  }
  return next;
}

/** The element with Numbered on (stored as `true`) or off (absent). */
export function withSequenceNumbered<T extends Element>(el: T, on: boolean): T {
  if (el.type !== 'shape' || el.shape !== 'sequence') return el;
  const next = { ...el } as T & { sequenceNumbered?: boolean };
  if (on) next.sequenceNumbered = true;
  else delete next.sequenceNumbered;
  return next;
}
