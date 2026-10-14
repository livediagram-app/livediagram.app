import { describe, expect, it } from 'vitest';
import {
  createShape,
  isValidElement,
  nextMessageAfter,
  renderElementsToSvg,
  sequenceDiagramOf,
  sequenceDrawing,
  withSequenceAnim,
  withSequenceRows,
  type ShapeElement,
} from './index';

// docs/specs/009-elements/sequence-diagram.md, blueprint sequence-diagram.md.

const seq = () => ({ ...(createShape('sequence', 0, 0) as ShapeElement), id: 'q' });

describe('sequence diagram element', () => {
  it('a new one is Browser, API and Database with five valid messages', () => {
    const el = seq();
    expect(el.sequenceParticipants!.map((p) => p.label)).toEqual(['Browser', 'API', 'Database']);
    expect(el.sequenceMessages).toHaveLength(5);
    expect(isValidElement(el)).toBe(true);
  });

  it('rejects fewer than two participants and an unknown message kind', () => {
    expect(isValidElement({ ...seq(), sequenceParticipants: [{ id: 'a', label: 'A' }] })).toBe(
      false,
    );
    expect(
      isValidElement({
        ...seq(),
        sequenceMessages: [{ from: 'api', to: 'db', label: 'x', kind: 'shout' as never }],
      }),
    ).toBe(false);
  });

  it('removing a participant removes its messages', () => {
    const el = withSequenceRows(seq(), {
      participants: seq().sequenceParticipants!.filter((p) => p.id !== 'db'),
    });
    expect(el.sequenceMessages!.every((m) => m.from !== 'db' && m.to !== 'db')).toBe(true);
    expect(el.sequenceMessages).toHaveLength(3);
  });

  it('keeps at least two participants and at most twelve, ids unique', () => {
    const one = withSequenceRows(seq(), { participants: [{ id: 'x', label: 'X' }] });
    expect(one.sequenceParticipants).toHaveLength(3);
    const many = withSequenceRows(seq(), {
      participants: Array.from({ length: 20 }, () => ({ id: 'same', label: 'S' })),
    });
    expect(many.sequenceParticipants).toHaveLength(12);
    expect(new Set(many.sequenceParticipants!.map((p) => p.id)).size).toBe(12);
  });

  it('bounds messages to 60 and labels to 80 characters', () => {
    const el = withSequenceRows(seq(), {
      messages: Array.from({ length: 70 }, () => ({
        from: 'api',
        to: 'db',
        label: 'x'.repeat(100),
        kind: 'call' as const,
      })),
    });
    expect(el.sequenceMessages).toHaveLength(60);
    expect(el.sequenceMessages![0]!.label).toHaveLength(80);
  });

  it('Enter adds a message from the receiver to the participant after it, wrapping', () => {
    const el = seq();
    expect(nextMessageAfter(el, 0)).toEqual({ from: 'api', to: 'db', label: '', kind: 'call' });
    expect(nextMessageAfter(el, 2)).toEqual({ from: 'db', to: 'browser', label: '', kind: 'call' });
    expect(nextMessageAfter({ ...el, sequenceMessages: [] }, -1).from).toBe('browser');
  });

  it('describes the shared layout, numbering when on', () => {
    const d = sequenceDiagramOf({ ...seq(), sequenceNumbered: true });
    expect(d.autonumber).toBe(true);
    expect(d.items.filter((i) => i.kind === 'message')).toHaveLength(5);
  });

  it('draws the same picture for the same rows, and exports it fitted', () => {
    const el = seq();
    expect(sequenceDrawing(el)).toBe(sequenceDrawing({ ...el }));
    const svg = renderElementsToSvg({ id: 't', name: 't', elements: [el] } as never);
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).toContain('Place order');
    expect(svg).toContain('Database');
  });

  it('Play is stored only when on', () => {
    const on = withSequenceAnim(seq(), { anim: 'play', repeat: true });
    expect(on.sequenceAnim).toBe('play');
    const off = withSequenceAnim(on, { anim: null, repeat: false });
    expect('sequenceAnim' in off).toBe(false);
    expect('sequenceAnimRepeat' in off).toBe(false);
  });
});
