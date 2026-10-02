import { describe, expect, it } from 'vitest';
import type { ArrowElement } from '@livediagram/document';
import { repinnedArrow } from './arrow-repin';

const imported: ArrowElement = {
  id: 'a',
  type: 'arrow',
  from: { kind: 'pinned', elementId: 'x', anchor: 'e' },
  to: { kind: 'pinned', elementId: 'y', anchor: 'w' },
  exactStart: true,
  exactEnd: true,
};

describe('repinnedArrow', () => {
  it('lets a hand-moved end join the fan again', () => {
    const moved = repinnedArrow(imported, 'to', { kind: 'free', x: 1, y: 2 });
    expect(moved.to).toEqual({ kind: 'free', x: 1, y: 2 });
    expect(moved).not.toHaveProperty('exactEnd');
  });

  it("keeps the start's switch, which is the user's", () => {
    const moved = repinnedArrow(imported, 'from', { kind: 'free', x: 1, y: 2 });
    expect(moved).toMatchObject({ exactStart: true, exactEnd: true });
  });
});
