import { describe, expect, it } from 'vitest';
import type { ShapeElement } from './element';
import {
  isSequenceElement,
  nextMessageAfter,
  SEQ_MESSAGES_MAX,
  SEQ_PARTICIPANTS_MAX,
  sequenceDiagramOf,
  withSequenceAnim,
  withSequenceNumbered,
  withSequenceRows,
} from './sequence-element';
import { createShape } from './testing/elements';

// docs/specs/009-elements/sequence-diagram.md. Each product's own test also draws and validates one through its
// binding; these read the shared rows alone.
const seq = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('sequence', 0, 0),
  id: 'q',
  sequenceParticipants: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B', actor: true },
  ],
  sequenceMessages: [{ from: 'a', to: 'b', label: 'Hi', kind: 'call' }],
  ...over,
});

describe('sequenceDiagramOf', () => {
  it('reads the rows as a diagram, leaving out a message to an unknown participant', () => {
    const el = seq({
      sequenceNumbered: true,
      sequenceMessages: [
        { from: 'a', to: 'b', label: 'Hi', kind: 'call' },
        { from: 'a', to: 'gone', label: 'Lost', kind: 'async' },
      ],
    });
    expect(sequenceDiagramOf(el)).toEqual({
      autonumber: true,
      participants: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B', actor: true },
      ],
      items: [{ kind: 'message', from: 'a', to: 'b', label: 'Hi', style: 'call' }],
    });
    expect(sequenceDiagramOf({ ...createShape('sequence', 0, 0) })).toEqual({
      autonumber: false,
      participants: [],
      items: [],
    });
  });

  it('knows a sequence', () => {
    expect(isSequenceElement(seq())).toBe(true);
    expect(isSequenceElement(createShape('square', 0, 0))).toBe(false);
  });
});

describe('withSequenceRows', () => {
  it('keeps ids unique, clips the words and bounds the rows', () => {
    const many = Array.from({ length: SEQ_PARTICIPANTS_MAX + 4 }, (_, i) => ({
      id: 'x',
      label: `P ${i}`,
    }));
    const out = withSequenceRows(seq(), { participants: many });
    const ids = out.sequenceParticipants!.map((p) => p.id);
    expect(ids).toHaveLength(SEQ_PARTICIPANTS_MAX);
    expect(new Set(ids).size).toBe(ids.length);
    const blank = withSequenceRows(seq(), {
      participants: [
        { id: '', label: '  Spaced   out  ' },
        { id: 'b', label: 'B', actor: true },
      ],
    });
    expect(blank.sequenceParticipants![0]).toEqual({ id: 'p1', label: 'Spaced out' });
    expect(blank.sequenceParticipants![1]!.actor).toBe(true);
  });

  it('ignores a participant list under two, and keeps messages between known participants', () => {
    const out = withSequenceRows(seq(), {
      participants: [{ id: 'solo', label: 'Solo' }],
      messages: [
        { from: 'a', to: 'b', label: 'ok', kind: 'nonsense' as 'call' },
        { from: 'a', to: 'z', label: 'no', kind: 'call' },
        ...Array.from({ length: SEQ_MESSAGES_MAX }, () => ({
          from: 'b',
          to: 'a',
          label: 'r',
          kind: 'reply' as const,
        })),
      ],
    });
    expect(out.sequenceParticipants!.map((p) => p.id)).toEqual(['a', 'b']);
    expect(out.sequenceMessages).toHaveLength(SEQ_MESSAGES_MAX);
    expect(out.sequenceMessages![0]!.kind).toBe('call');
  });

  it('leaves any other element as it was', () => {
    const sq = createShape('square', 0, 0);
    expect(withSequenceRows(sq, { participants: [] })).toBe(sq);
    expect(withSequenceAnim(sq, { anim: 'play' })).toBe(sq);
    expect(withSequenceNumbered(sq, true)).toBe(sq);
  });
});

describe('nextMessageAfter', () => {
  it("runs from that message's receiver to the participant after it", () => {
    expect(nextMessageAfter(seq(), 0)).toEqual({ from: 'b', to: 'a', label: '', kind: 'call' });
    expect(nextMessageAfter(seq(), 9)).toEqual({ from: 'a', to: 'b', label: '', kind: 'call' });
    const empty = { ...createShape('sequence', 0, 0) };
    expect(nextMessageAfter(empty, 0)).toEqual({ from: 'p1', to: 'p1', label: '', kind: 'call' });
  });
});

describe('withSequenceAnim and withSequenceNumbered', () => {
  it('stores Play, a speed other than the default, and repeat, and clears each', () => {
    const on = withSequenceAnim(seq(), {
      anim: 'play',
      speed: 'fast',
      repeat: true,
    }) as ShapeElement & Record<string, unknown>;
    expect(on).toMatchObject({
      sequenceAnim: 'play',
      sequenceAnimSpeed: 'fast',
      sequenceAnimRepeat: true,
    });
    const off = withSequenceAnim(on, { anim: null, speed: 'slow', repeat: false });
    expect(off).not.toHaveProperty('sequenceAnim');
    expect(off).not.toHaveProperty('sequenceAnimSpeed');
    expect(off).not.toHaveProperty('sequenceAnimRepeat');
    expect(withSequenceAnim(seq(), {})).toEqual(seq());
  });

  it('stores Numbered as true, and off as absent', () => {
    const on = withSequenceNumbered(seq(), true);
    expect(on.sequenceNumbered).toBe(true);
    expect(withSequenceNumbered(on, false)).not.toHaveProperty('sequenceNumbered');
  });
});
