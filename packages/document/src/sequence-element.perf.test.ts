import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import { createShape, sequenceDrawing, type ShapeElement } from './index';

// docs/specs/009-elements/blueprints/sequence-diagram.md "Performance and limits": the picture is rebuilt on every
// change of the rows (typing a message label commits on blur), so the worst case, 12 participants with 60 long
// messages, must stay cheap. Each pass varies one label so the cache never answers; warm-up passes then the fastest
// of five, as the other budget tests do.
const WARM_UP_PASSES = 3;
const PASSES = 5;

function worst(n: number): ShapeElement {
  const participants = Array.from({ length: 12 }, (_, i) => ({
    id: `p${i}`,
    label: `Participant number ${i}`,
  }));
  const messages = Array.from({ length: 60 }, (_, i) => ({
    from: `p${i % 12}`,
    to: `p${(i * 5 + 3) % 12}`,
    label: `${n} ${'a fairly long message label '.repeat(2)}`.slice(0, 80),
    kind: (['call', 'async', 'reply'] as const)[i % 3],
  }));
  return {
    ...(createShape('sequence', 0, 0) as ShapeElement),
    sequenceParticipants: participants,
    sequenceMessages: messages,
    sequenceNumbered: true,
  };
}

describe('sequenceDrawing budget', () => {
  it('draws 12 participants and 60 messages within 40 ms of CPU', () => {
    let n = 0;
    for (let p = 0; p < WARM_UP_PASSES; p++) sequenceDrawing(worst(n++));
    let best = Infinity;
    for (let p = 0; p < PASSES; p++) {
      const el = worst(n++);
      best = Math.min(
        best,
        cpuMsOf(() => sequenceDrawing(el)),
      );
    }
    expect(best).toBeLessThan(40);
  });

  it('answers the same rows from its cache', () => {
    const el = worst(-1);
    const first = sequenceDrawing(el);
    expect(cpuMsOf(() => sequenceDrawing({ ...el }))).toBeLessThan(5);
    expect(sequenceDrawing({ ...el })).toBe(first);
  });
});
