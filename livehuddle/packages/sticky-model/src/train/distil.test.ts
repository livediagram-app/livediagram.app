import { describe, expect, it } from 'vitest';
import { teacherTargets } from './distil';

describe('teacherTargets', () => {
  it('replaces each learnt pixel target with the teacher probabilities', () => {
    const y = new Float32Array([0, 3, 0, 1, 0, 0]);
    const taught = new Float32Array([0.1, 0.7, 0.2, 0.6, 0.3, 0.1]);
    teacherTargets(y, taught);
    expect([...y]).toEqual([...taught]);
  });

  it('leaves an ignored pixel (all zeros) ignored', () => {
    const y = new Float32Array([0, 0, 0, 0, 0, 3]);
    teacherTargets(y, new Float32Array([0.2, 0.3, 0.5, 0.4, 0.4, 0.2]));
    expect([...y.subarray(0, 3)]).toEqual([0, 0, 0]);
    expect(y[3]).toBeCloseTo(0.4);
  });
});
