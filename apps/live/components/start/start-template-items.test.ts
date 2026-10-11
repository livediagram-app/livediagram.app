import { describe, expect, it } from 'vitest';
import { TEMPLATES, popularKindsFor, templateEditorMode } from '@livediagram/templates';
import { TEMPLATE_STARTS, type TemplateStartMode } from './start-template-items';

// docs/specs/007-editor/start-diagramming.md
const MODES: readonly TemplateStartMode[] = ['diagram', 'draw', 'facilitate', 'illustrate'];

describe.each(MODES)('the %s template start', (mode) => {
  const start = TEMPLATE_STARTS[mode];
  const listed = TEMPLATES.filter(
    (t) => !t.hidden && t.kind !== start.blank && templateEditorMode(t.kind) === mode,
  ).map((t) => t.kind);

  it("leads with Recommended, the mode's Popular shelf, its blank first, Timeline left out", () => {
    const recommended = start.groups[0]!;
    expect(recommended.id).toBe('recommended');
    expect(recommended.kinds).toEqual(popularKindsFor(mode).filter((k) => k !== 'timeline'));
    expect(recommended.kinds[0]).toBe(start.blank);
  });

  it('shows only groups holding a template, and only the mode’s templates', () => {
    for (const g of start.groups) {
      expect(g.kinds.length, g.id).toBeGreaterThan(0);
      for (const k of g.kinds) expect(templateEditorMode(k), k).toBe(mode);
    }
  });

  it('lists every template of the mode in a group after Recommended', () => {
    const grouped = new Set(start.groups.slice(1).flatMap((g) => g.kinds));
    for (const k of listed) expect(grouped.has(k), k).toBe(true);
    expect(grouped.has(start.blank)).toBe(false);
  });

  it('searches the catalogue, each match once, and nothing for a blank query', () => {
    expect(start.search('  ')).toEqual([]);
    expect(start.search('zzzqqq')).toEqual([]);
    const probe = {
      diagram: ['flow', 'flowchart'],
      draw: ['sketch', 'sketchnote'],
      facilitate: ['retro', 'retrospective'],
      illustrate: ['slide', 'slide-deck'],
    }[mode];
    const kinds = start.search(probe[0]!).flatMap((g) => g.kinds);
    expect(kinds).toContain(probe[1]);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

describe('Start Facilitating', () => {
  it('groups by the session run: Retrospectives, Meetings, Workshops, Decisions', () => {
    expect(TEMPLATE_STARTS.facilitate.groups.map((g) => g.id)).toEqual([
      'recommended',
      'retrospectives',
      'meetings',
      'workshops',
      'decisions',
    ]);
  });
});

describe('Start Illustrating', () => {
  it('groups by what is made: Slides, Infographics, Documents, Posters, Logos', () => {
    expect(TEMPLATE_STARTS.illustrate.groups.map((g) => g.id)).toEqual([
      'recommended',
      'slides',
      'infographics',
      'documents',
      'posters',
      'logos',
    ]);
    expect(TEMPLATE_STARTS.illustrate.blank).toBe('blank-illustration');
  });
});
