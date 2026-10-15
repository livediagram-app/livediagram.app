import { describe, expect, it } from 'vitest';
import {
  TAG_COLOURS_MAX,
  cardTagColour,
  createShape,
  renderElementsToSvg,
  tagColourOf,
  tagColoursOf,
  withTagAccent,
  withTagColour,
  type ShapeElement,
  type TagColour,
} from './index';

// docs/specs/009-elements/tag-colours.md, blueprint tag-colours.md.

const card = (over: Partial<ShapeElement> = {}) =>
  ({ ...(createShape('card', 0, 0) as ShapeElement), id: 'c', ...over }) as ShapeElement;

describe('the tag colour map', () => {
  it('maps, replaces (keeping the first casing) and clears a tag, matching case-insensitively', () => {
    let tab: { tagColours?: TagColour[] } = {};
    tab = withTagColour(tab, 'Platform', '#0d9488');
    tab = withTagColour(tab, ' platform ', '#7c3aed');
    expect(tab.tagColours).toEqual([{ tag: 'Platform', color: '#7c3aed' }]);
    expect(tagColourOf(tab.tagColours, 'PLATFORM')).toBe('#7c3aed');
    tab = withTagColour(tab, 'platform', null);
    expect('tagColours' in tab).toBe(false);
  });

  it('ignores a blank tag, a colour that is not hex, and an add to a full map', () => {
    const tab = { tagColours: [] as TagColour[] };
    expect(withTagColour(tab, '  ', '#000000')).toBe(tab);
    expect(withTagColour(tab, 'x', 'red')).toBe(tab);
    const full = {
      tagColours: Array.from({ length: TAG_COLOURS_MAX }, (_, i) => ({
        tag: `t${i}`,
        color: '#111111',
      })),
    };
    expect(withTagColour(full, 'one more', '#222222')).toBe(full);
  });

  it('reads a stored map tolerantly: bad rows and repeated keys are left out', () => {
    expect(
      tagColoursOf({
        tagColours: [
          { tag: 'a', color: '#ffffff' },
          { tag: 'A', color: '#000000' },
          { tag: 'b', color: 'blue' },
          'junk',
        ],
      }),
    ).toEqual([{ tag: 'a', color: '#ffffff' }]);
  });
});

describe('a card under the map', () => {
  const map: TagColour[] = [
    { tag: 'payments', color: '#d97706' },
    { tag: 'platform', color: '#0d9488' },
  ];

  it('takes its first mapped tag colour as a left accent edge (I1: nothing stored)', () => {
    const c = card({ tags: ['v2', 'Platform', 'payments'] });
    expect(cardTagColour(c, map)).toBe('#0d9488');
    const shown = withTagAccent(c, map);
    expect(shown.accentEdge).toBe('left');
    expect(shown.accentEdgeColor).toBe('#0d9488');
    expect(c.accentEdge).toBeUndefined();
  });

  it('keeps its own side, and its own edge colour wins (I2)', () => {
    const c = card({ tags: ['payments'], accentEdge: 'top', accentEdgeColor: '#000000' });
    expect(withTagAccent(c, map)).toMatchObject({ accentEdge: 'top', accentEdgeColor: '#000000' });
  });

  it('leaves a card with no mapped tag, and any other kind, as the same object', () => {
    const c = card({ tags: ['v2'] });
    expect(withTagAccent(c, map)).toBe(c);
    const sq = createShape('square', 0, 0);
    expect(withTagAccent(sq, map)).toBe(sq);
  });

  it('exports the edge and a tinted chip from the tab map (I3)', () => {
    const c = card({ tags: ['payments'], x: 0, y: 0 });
    const svg = renderElementsToSvg({
      id: 't',
      name: 't',
      elements: [c],
      tagColours: map,
    } as never);
    expect(svg.toLowerCase()).toContain('#d97706');
    const plain = renderElementsToSvg({ id: 't', name: 't', elements: [c] } as never);
    expect(plain.toLowerCase()).not.toContain('#d97706');
  });
});
