// docs/specs/031-photo/photo-pages.md "Working on a photo page": a slow command names itself while it runs.
import { describe, expect, it } from 'vitest';
import { photoBusy } from './photo-busy';

describe('the slow commands at work', () => {
  it('names the latest while each runs, and clears as each lands, failed or not', async () => {
    let finishA!: (v: string) => void;
    let failB!: (e: Error) => void;
    const a = photoBusy.run('A', new Promise<string>((r) => (finishA = r)));
    const b = photoBusy.run('B', new Promise<string>((_, j) => (failB = j)));
    expect(photoBusy.get().map((r) => r.label)).toEqual(['A', 'B']);
    finishA('done');
    expect(await a).toBe('done');
    expect(photoBusy.get().map((r) => r.label)).toEqual(['B']);
    failB(new Error('no'));
    await expect(b).rejects.toThrow('no');
    expect(photoBusy.get()).toEqual([]);
  });
});
