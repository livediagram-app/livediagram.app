import { describe, expect, it } from 'vitest';
import { TEMPLATES, stepPopularKinds } from '@livedocuments/templates';
import { TEMPLATE_START } from './start-template-items';

// docs/specs/007-editor/start-diagramming.md
describe('the Pages template start', () => {
  const start = TEMPLATE_START;
  const listed = TEMPLATES.filter(
    (t) => !t.hidden && t.kind !== 'blank-illustration' && t.kind !== 'blank',
  ).map((t) => t.kind);

  it('leads with Recommended, the Popular shelf with two picks swapped for blanks of a page kind', () => {
    const recommended = start.groups[0]!;
    expect(recommended.id).toBe('recommended');
    const swap: Partial<Record<string, string>> = {
      'blank-illustration': 'blank-infographic',
      article: 'blank-article',
    };
    expect(recommended.kinds).toEqual(stepPopularKinds().map((k) => swap[k] ?? k));
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
    const kinds = start.search('slide').flatMap((g) => g.kinds);
    expect(kinds).toContain('slide-deck');
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

describe('Start Making Pages', () => {
  it('groups by what is made: Slides, Infographics, Articles, Posters and Social, Logos, Wireframes, Design', () => {
    expect(TEMPLATE_START.groups.map((g) => g.name)).toEqual([
      'Recommended',
      'Slides',
      'Infographics',
      'Articles',
      'Posters and Social',
      'Logos',
      'Wireframes',
      'Design',
    ]);
    // A carousel is posted, not presented.
    const group = (id: string) => TEMPLATE_START.groups.find((g) => g.id === id)!.kinds;
    expect(group('slides')).not.toContain('social-carousel');
    expect(group('posters')).toContain('social-carousel');
    expect(group('design')).toEqual(['storyboard', 'floor-plan']);
  });

  it('leads Slides, Infographics, Articles and Logos with their blank of a page kind', () => {
    // docs/specs/007-editor/start-diagramming.md "Recommended and groups".
    const first = Object.fromEntries(TEMPLATE_START.groups.map((g) => [g.id, g.kinds[0]]));
    expect(first).toMatchObject({
      slides: 'blank-slide-deck',
      infographics: 'blank-infographic',
      articles: 'blank-article',
      logos: 'blank-logo',
    });
    // Recommended leads with Blank Infographic and Blank Article, then Blank Slide Deck in the Slide Deck's place;
    // Blank Illustration and the Project Brief template are left out of it, and Blank Logo stays in its group alone.
    const recommended = TEMPLATE_START.groups[0]!.kinds;
    expect(recommended.slice(0, 3)).toEqual([
      'blank-infographic',
      'blank-article',
      'blank-slide-deck',
    ]);
    for (const k of ['blank-illustration', 'article', 'slide-deck', 'blank-logo'] as const)
      expect(recommended).not.toContain(k);
    expect(TEMPLATE_START.groups.filter((g) => g.kinds.includes('blank-logo'))).toHaveLength(1);
  });
});
