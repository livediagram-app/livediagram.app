import { describe, expect, it } from 'vitest';
import { TEMPLATES, popularKindsFor, templateEditorMode } from '@livedesign/templates';
import { TEMPLATE_STARTS, type TemplateStartMode } from './start-template-items';

// docs/specs/007-editor/start-diagramming.md
const MODES: readonly TemplateStartMode[] = ['diagram', 'draw', 'workshop', 'pages'];

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
      pages: ['logo', 'logo-design'],
    }[mode];
    const kinds = start.search(probe[0]!).flatMap((g) => g.kinds);
    expect(kinds).toContain(probe[1]);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

describe('Start a Workshop', () => {
  it('groups by the session run: Retrospectives, Meetings, Quizzes & Games, Ideation, Planning, Strategy, Decisions', () => {
    expect(TEMPLATE_STARTS.workshop.groups.map((g) => g.id)).toEqual([
      'recommended',
      'retrospectives',
      'meetings',
      'spaces',
      'games',
      'ideation',
      'planning',
      'strategy',
      'decisions',
    ]);
    // The boards a team fills in together, moved from Diagram.
    const group = (id: string) => TEMPLATE_STARTS.workshop.groups.find((g) => g.id === id)!.kinds;
    expect(group('retrospectives')).toContain('incident-postmortem');
    expect(group('ideation')).toContain('user-persona');
    expect(group('games')).toEqual([
      'pub-quiz',
      'icebreaker-questions',
      'two-truths-and-a-lie',
      'would-you-rather',
      'people-bingo',
    ]);
    expect(group('planning')).toEqual([
      'objectives-planner',
      'roadmap',
      'raci-matrix',
      'user-story-map',
    ]);
    expect(group('strategy')).toEqual([
      'swot',
      'business-model-canvas',
      'value-proposition-canvas',
      'stakeholder-map',
      'opportunity-solution-tree',
    ]);
  });
});

describe('Start Making Pages', () => {
  it('groups by what is made: Logos, Wireframes', () => {
    expect(TEMPLATE_STARTS.pages.groups.map((g) => g.name)).toEqual([
      'Recommended',
      'Logos',
      'Wireframes',
    ]);
    expect(TEMPLATE_STARTS.pages.blank).toBe('blank-illustration');
  });

  it('leads Logos and Wireframes with their blank of a page kind', () => {
    // docs/specs/007-editor/templates-by-mode.md "Blanks of a page kind".
    const first = Object.fromEntries(TEMPLATE_STARTS.pages.groups.map((g) => [g.id, g.kinds[0]]));
    expect(first).toMatchObject({ logos: 'blank-logo', wireframes: 'blank-wireframe-phone' });
    // Blank Logo stays in its group alone.
    expect(TEMPLATE_STARTS.pages.groups[0]!.kinds).not.toContain('blank-logo');
    expect(TEMPLATE_STARTS.pages.groups.filter((g) => g.kinds.includes('blank-logo'))).toHaveLength(
      1,
    );
  });
});

// docs/specs/007-editor/start-diagramming.md "There is no way out to a bigger picker": with the Quick Start gone, a
// start is the whole catalogue of its mode, so every listed template must sit in one of its groups.
describe('every listed template on its own start', () => {
  it.each(MODES)('the %s start reaches every template of its mode', (mode) => {
    const start = TEMPLATE_STARTS[mode];
    const shown = new Set(start.groups.flatMap((g) => g.kinds));
    const missing = TEMPLATES.filter(
      (t) =>
        !t.hidden &&
        templateEditorMode(t.kind) === mode &&
        !shown.has(t.kind) &&
        // Pages mode's own blank leaves the same empty tab the × does, so it is offered nowhere.
        !(mode === 'pages' && t.kind === 'blank-illustration'),
    ).map((t) => t.kind);
    expect(missing).toEqual([]);
  });
});
