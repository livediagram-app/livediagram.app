import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { migrateIncomingElements } from './stored-tab';
import type { Element } from './index';

// An annotation marker never turns, so a turn written on one (an agent's, an old copy's) is dropped where elements
// enter, and every reader sees it upright. A stored pointer note is a retired element now
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3): it keeps its stored turn.
describe('a turn on an element that does not turn', () => {
  it("is dropped from an annotation marker, and kept on a shape's and a stored pointer note's", () => {
    const note = {
      ...createShape('square', 0, 0),
      shape: 'pointer-note',
      id: 'n',
      rotation: 90,
    } as unknown as Element;
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
    expect(n).toMatchObject({ rotation: 90 });
    expect(m).not.toHaveProperty('rotation');
    expect(s).toMatchObject({ rotation: 45 });
  });

  it('leaves a list with nothing to drop as it is', () => {
    const els = [{ ...createShape('square', 0, 0), id: 's' } as Element];
    expect(migrateIncomingElements(els)[0]).toEqual(els[0]);
  });
});
