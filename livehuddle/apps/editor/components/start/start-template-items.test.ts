import { describe, expect, it } from 'vitest';
import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  popularKindsFor,
  templateEditorMode,
} from '@livediagram/templates';
import { TEMPLATE_STARTS, type TemplateStartMode } from './start-template-items';

// docs/specs/007-editor/start-diagramming.md
const MODES: readonly TemplateStartMode[] = ['diagram', 'draw', 'workshop'];

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
      workshop: ['retro', 'retrospective'],
    }[mode];
    const kinds = start.search(probe[0]!).flatMap((g) => g.kinds);
    expect(kinds).toContain(probe[1]);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

// The groups are the catalogue's categories in every mode, in the catalogue's order, each skipped where the mode has
// none of its templates (docs/specs/007-editor/start-diagramming.md "Recommended and groups").
describe.each(MODES)('the %s start’s groups', (mode) => {
  const start = TEMPLATE_STARTS[mode];

  it('are the catalogue’s categories, in order, each with its label and line', () => {
    const ids = start.groups.slice(1).map((g) => g.id);
    const order = TEMPLATE_CATEGORIES.map((c) => c.id) as string[];
    expect(ids).toEqual(order.filter((id) => ids.includes(id)));
    for (const g of start.groups.slice(1)) {
      const c = TEMPLATE_CATEGORIES.find((x) => x.id === g.id)!;
      expect([g.name, g.line]).toEqual([c.label, c.description]);
    }
  });
});

describe('Start a Workshop', () => {
  it('reaches every session the room runs, by its category', () => {
    expect(TEMPLATE_STARTS.workshop.groups.map((g) => g.id)).toEqual([
      'recommended',
      'ideas',
      'decisions',
      'goals',
      'meetings',
      'people',
      'planning',
      'product',
      'games',
      'retros',
      'software',
      'strategy',
      'learning',
      'spaces',
    ]);
    const group = (id: string) => TEMPLATE_STARTS.workshop.groups.find((g) => g.id === id)!.kinds;
    // A cross-listed template shows in each of its categories.
    expect(group('retros')).toContain('incident-postmortem');
    expect(group('software')).toEqual(['incident-postmortem']);
    expect(group('games')).toEqual([
      'pub-quiz',
      'icebreaker-questions',
      'two-truths-and-a-lie',
      'would-you-rather',
      'people-bingo',
    ]);
    expect(group('spaces')).toEqual([
      'virtual-office',
      'coworking-space',
      'team-pod',
      'all-hands-hall',
    ]);
    expect(group('strategy')).toEqual(
      expect.arrayContaining(['swot', 'pestle-analysis', 'business-model-canvas']),
    );
    expect(group('learning')).toEqual(['pub-quiz', 'kwl-chart']);
  });

  it('lists a search match once, under its primary category', () => {
    expect(TEMPLATE_STARTS.workshop.search('postmortem')).toEqual([
      { group: 'software', kinds: ['incident-postmortem'] },
    ]);
  });
});

describe('Start Drawing', () => {
  it('groups its drawn templates by what each is for', () => {
    expect(TEMPLATE_STARTS.draw.groups.map((g) => g.id)).toEqual([
      'recommended',
      'ideas',
      'decisions',
      'meetings',
      'product',
      'games',
      'retros',
      'strategy',
      'learning',
    ]);
  });
});

// docs/specs/007-editor/start-diagramming.md "There is no way out to a bigger picker": with the Quick Start gone, a
// start is the whole catalogue of its mode, so every listed template must sit in one of its groups.
describe('every listed template on its own start', () => {
  it.each(MODES)('the %s start reaches every template of its mode', (mode) => {
    const start = TEMPLATE_STARTS[mode];
    const shown = new Set(start.groups.flatMap((g) => g.kinds));
    const missing = TEMPLATES.filter(
      (t) => !t.hidden && templateEditorMode(t.kind) === mode && !shown.has(t.kind),
    ).map((t) => t.kind);
    expect(missing).toEqual([]);
  });
});
