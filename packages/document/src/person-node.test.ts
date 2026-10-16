import { describe, expect, it } from 'vitest';
import {
  applyShapeVariant,
  createShape,
  isPersonNode,
  isValidElement,
  personInitials,
  personNodeLayout,
  renderElementsToSvg,
} from './index';

// docs/specs/009-elements/org-chart.md, blueprint org-chart.md.

describe('person nodes', () => {
  it("takes initials from the first two words, or a one-word name's first two letters", () => {
    expect(personInitials('Ana Kim')).toBe('AK');
    expect(personInitials('  mo  li  rae ')).toBe('ML');
    expect(personInitials('Platform')).toBe('PL');
    expect(personInitials('')).toBe('?');
  });

  it('places the disc at the left and splits the text column when there is a role', () => {
    const l = personNodeLayout(200, 64, true);
    expect(l.disc).toEqual({ x: 12, y: 10, width: 44, height: 44 });
    expect(l.name.x).toBe(68);
    expect(l.role!.y).toBe(32);
    expect(personNodeLayout(200, 64, false).role).toBeNull();
  });

  it('places an org chart as a person root in the downward flow', () => {
    const root = applyShapeVariant(createShape('mind-node', 0, 0), 'org-chart');
    expect(root).toMatchObject({ mindLook: 'person', mindFlow: 'downward', label: 'Ana Kim' });
    expect(isPersonNode(root)).toBe(true);
    expect(isValidElement(root)).toBe(true);
    expect(isValidElement({ ...root, mindLook: 'robot' as never })).toBe(false);
  });

  it('exports the initials, the name and the role, the name once', () => {
    const root = {
      ...applyShapeVariant(createShape('mind-node', 0, 0), 'org-chart'),
      x: 0,
      y: 0,
    };
    const svg = renderElementsToSvg({ id: 't', name: 't', elements: [root] });
    expect(svg).toContain('>AK<');
    expect(svg).toContain('Head of Engineering');
    expect(svg.match(/>Ana Kim</g)).toHaveLength(1);
  });
});
