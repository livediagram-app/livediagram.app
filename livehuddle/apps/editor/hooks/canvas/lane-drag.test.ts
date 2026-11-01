import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { laneAnchorOf, lanesHoldDrag } from './lane-drag';

const box = (id: string, over: Record<string, unknown>) =>
  ({ id, x: 0, y: 0, width: 200, height: 200, ...over }) as unknown as Element;
const note = (id: string) => box(id, { type: 'sticky', esKind: 'domain-event', fixedSize: true });
const plain = (id: string) => box(id, { type: 'sticky' });
const label = (id: string) => box(id, { type: 'text', label: 'Checkout' });
const frame = (id: string) => box(id, { type: 'shape', shape: 'frame' });

const board = [note('n1'), note('n2'), plain('p'), label('t'), frame('f')];
const ids = (...list: string[]) => new Set(list);

// docs/specs/021-event-storming/event-storming.md "Always on a lane": a workshop note stays on a lane however
// it is moved, with whatever else is in the selection.
describe('lane drags', () => {
  it('holds a workshop note moved with a label or inside a frame', () => {
    expect(lanesHoldDrag(board, ids('n1', 't'))).toBe(true);
    expect(lanesHoldDrag(board, ids('f', 'n1', 'n2'))).toBe(true);
    expect(laneAnchorOf(board, 't', ids('t', 'n1'))).toBe('n1');
    expect(laneAnchorOf(board, 'f', ids('f', 'n2', 'n1'))).toBe('n2');
  });

  it('keeps the aid for plain stickies, and nothing for a selection without a note', () => {
    expect(lanesHoldDrag(board, ids('p'))).toBe(true);
    expect(laneAnchorOf(board, 'p', ids('p'))).toBeNull();
    expect(lanesHoldDrag(board, ids('t', 'f'))).toBe(false);
    expect(lanesHoldDrag(board, ids('p', 't'))).toBe(false);
    expect(lanesHoldDrag(board, ids())).toBe(false);
  });

  it('snaps by the note in hand when it is a workshop note', () => {
    expect(laneAnchorOf(board, 'n2', ids('n1', 'n2'))).toBe('n2');
  });
});
