import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { migrateIncomingElements } from './stored-tab';
import type { Element } from './index';

// docs/specs/009-elements/pointer-note.md: a pointer note never turns, so a turn written on one (an agent's, an old
// copy's) is dropped where elements enter, and every reader sees it upright.
describe('a turn on an element that does not turn', () => {
  it("is dropped from a pointer note and an annotation marker, and kept on a shape's", () => {
    const note = { ...createShape('pointer-note', 0, 0), id: 'n', rotation: 90 } as Element;
    const marker = {
      id: 'm',
      type: 'annotation',
      x: 0,
      y: 0,
      width: 24,
      height: 24,
      rotation: 30,
    } as unknown as Element;
    const square = { ...createShape('square', 0, 0), id: 's', rotation: 45 } as Element;
    const [n, m, s] = migrateIncomingElements([note, marker, square]);
    expect(n).not.toHaveProperty('rotation');
    expect(m).not.toHaveProperty('rotation');
    expect(s).toMatchObject({ rotation: 45 });
  });

  it('leaves a list with nothing to drop as it is', () => {
    const els = [{ ...createShape('square', 0, 0), id: 's' } as Element];
    expect(migrateIncomingElements(els)[0]).toEqual(els[0]);
  });
});
