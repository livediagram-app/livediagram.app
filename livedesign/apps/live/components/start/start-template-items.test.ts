import { describe, expect, it } from 'vitest';
import { TEMPLATES, popularKindsFor } from '@livedesign/templates';
import { TEMPLATE_STARTS } from './start-template-items';

// docs/specs/007-editor/start-diagramming.md
describe('the Pages template start', () => {
  const start = TEMPLATE_STARTS.pages;
  const listed = TEMPLATES.filter(
    (t) => !t.hidden && t.kind !== 'blank-illustration' && t.kind !== 'blank',
  ).map((t) => t.kind);

  it('leads with Recommended, the Popular shelf, its blank first', () => {
    const recommended = start.groups[0]!;
    expect(recommended.id).toBe('recommended');
    expect(recommended.kinds).toEqual(popularKindsFor('pages'));
    expect(recommended.kinds[0]).toBe('blank-illustration');
  });

  it('shows only groups holding a template', () => {
    for (const g of start.groups) expect(g.kinds.length, g.id).toBeGreaterThan(0);
  });

  // "There is no way out to a bigger picker": the start is the whole catalogue, so every listed template sits in a
  // group.
  it('lists every template in a group after Recommended', () => {
    const grouped = new Set(start.groups.slice(1).flatMap((g) => g.kinds));
    for (const k of listed) expect(grouped.has(k), k).toBe(true);
    expect(grouped.has('blank-illustration')).toBe(false);
  });

  it('searches the catalogue, each match once, and nothing for a blank query', () => {
    expect(start.search('  ')).toEqual([]);
    expect(start.search('zzzqqq')).toEqual([]);
    const kinds = start.search('logo').flatMap((g) => g.kinds);
    expect(kinds).toContain('logo-design');
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

describe('Start Making Pages', () => {
  it('groups by what is made: Logos, Photos, Wireframes', () => {
    expect(TEMPLATE_STARTS.pages.groups.map((g) => g.name)).toEqual([
      'Recommended',
      'Logos',
      'Photos',
      'Wireframes',
    ]);
  });

  it('leads each group with its page kind: Blank Logo, Photo Edit, a blank wireframe', () => {
    const first = Object.fromEntries(TEMPLATE_STARTS.pages.groups.map((g) => [g.id, g.kinds[0]]));
    expect(first).toMatchObject({
      logos: 'blank-logo',
      photos: 'photo-edit',
      wireframes: 'blank-wireframe-phone',
    });
    // Blank Logo stays in its group alone.
    expect(TEMPLATE_STARTS.pages.groups[0]!.kinds).not.toContain('blank-logo');
    expect(TEMPLATE_STARTS.pages.groups.filter((g) => g.kinds.includes('blank-logo'))).toHaveLength(
      1,
    );
  });
});
