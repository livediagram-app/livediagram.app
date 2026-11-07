import { describe, expect, it } from 'vitest';
import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  isBlankTemplate,
  popularKindsFor,
  templateEditorMode,
} from '@livehuddle/templates';
import { TEMPLATE_STARTS, type TemplateStartMode } from './start-template-items';

// docs/specs/007-editor/start-diagramming.md
const MODES: readonly TemplateStartMode[] = ['workshop'];

describe.each(MODES)('the %s template start', (mode) => {
  const start = TEMPLATE_STARTS[mode];
  const listed = TEMPLATES.filter(
    (t) => !t.hidden && !isBlankTemplate(t.kind) && templateEditorMode(t.kind) === mode,
  ).map((t) => t.kind);

  // docs/specs/007-editor/start-diagramming.md "Recommended leads": first in the rail, and the start opens on it.
  it("leads with Recommended, the mode's Popular shelf, its blank first, and opens on it", () => {
    const recommended = start.groups[0]!;
    expect(start.initial).toBe('recommended');
    expect(recommended.id).toBe('recommended');
    expect(recommended.kinds).toEqual(popularKindsFor(mode));
    expect(recommended.kinds[0]).toBe(start.blank);
  });

  it('shows only groups holding a template, and only the mode’s templates', () => {
    for (const g of start.groups) {
      expect(g.kinds.length, g.id).toBeGreaterThan(0);
      for (const k of g.kinds) expect(templateEditorMode(k), k).toBe(mode);
    }
  });

  it('lists every template of the mode in a group other than Recommended', () => {
    const grouped = new Set(
      start.groups.filter((g) => g.id !== 'recommended').flatMap((g) => g.kinds),
    );
    for (const k of listed) expect(grouped.has(k), k).toBe(true);
    expect(grouped.has(start.blank)).toBe(false);
  });

  it('searches the catalogue, each match once, and nothing for a blank query', () => {
    expect(start.search('  ')).toEqual([]);
    expect(start.search('zzzqqq')).toEqual([]);
    const probe = {
      workshop: ['standup', 'team-pod'],
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

  it('are the catalogue’s categories after Recommended, in order, each with its label and line', () => {
    const others = start.groups.slice(1);
    const ids = others.map((g) => g.id);
    const order = TEMPLATE_CATEGORIES.map((c) => c.id) as string[];
    expect(ids).toEqual(order.filter((id) => ids.includes(id)));
    for (const g of others) {
      const c = TEMPLATE_CATEGORIES.find((x) => x.id === g.id)!;
      expect([g.name, g.line]).toEqual([c.label, c.description]);
    }
  });
});

describe('Start a Space', () => {
  // docs/specs/007-editor/templates-by-mode.md "The catalogue": the Spaces and Recommended, nothing else.
  it('offers Recommended, then Campus, Events, Games Rooms, Homes, Office, Outdoor, Recreation and Venues', () => {
    expect(TEMPLATE_STARTS.workshop.groups.map((g) => g.id)).toEqual([
      'recommended',
      'campus',
      'events',
      'games',
      'homes',
      'office',
      'outdoor',
      'recreation',
      'venues',
    ]);
    const group = (id: string) => TEMPLATE_STARTS.workshop.groups.find((g) => g.id === id)!.kinds;
    expect(group('office')).toEqual([
      'virtual-office',
      'coworking-space',
      'team-pod',
      'focus-library',
    ]);
    expect(group('events')).toEqual(['all-hands-hall', 'training-room', 'expo-hall']);
    expect(group('outdoor')).toEqual(['garden-retreat', 'city-park', 'beach-offsite']);
    // A cross-listed Space is in catalogue order among the category's own: the Sports Bar in Recreation, the Beach
    // Offsite in Campus and the Expo Hall in Venues.
    expect(group('recreation')).toEqual(['rooftop-bar', 'cafe', 'sports-bar']);
    expect(group('campus')).toEqual([
      'company-campus',
      'startup-hq',
      'school-quad',
      'coworking-tower',
      'beach-offsite',
    ]);
    expect(group('games')).toEqual(['arcade-lounge', 'games-night-den', 'sports-bar']);
    expect(group('homes')).toEqual(['family-house', 'city-townhouse', 'country-cottage']);
    expect(group('venues')).toEqual([
      'conference-venue',
      'hotel-and-suites',
      'expo-hall',
      'music-hall',
    ]);
    expect(group('recommended')[0]).toBe('blank-session');
  });

  it('lists a search match once, under its primary category', () => {
    expect(TEMPLATE_STARTS.workshop.search('standup')).toEqual([
      { group: 'office', kinds: ['team-pod'] },
    ]);
    // The Sports Bar, cross-listed in Recreation, is found by its words but listed once, under Games Rooms.
    expect(TEMPLATE_STARTS.workshop.search('drinks')).toEqual([
      { group: 'games', kinds: ['sports-bar'] },
      { group: 'recreation', kinds: ['rooftop-bar', 'cafe'] },
    ]);
    // A template that left (Work Tracker #423) is found nowhere.
    expect(TEMPLATE_STARTS.workshop.search('postmortem')).toEqual([]);
  });

  it('lists search matches in rail order', () => {
    const order = TEMPLATE_STARTS.workshop.groups.map((g) => g.id);
    const groups = TEMPLATE_STARTS.workshop.search('room').map((g) => g.group);
    expect(groups.length).toBeGreaterThan(1);
    expect([...groups].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(groups);
  });
});

// docs/specs/007-editor/start-diagramming.md "There is no way out to a bigger picker": with the Quick Start gone, a
// start is the whole catalogue of its mode, so every listed template but the blanks must sit in one of its groups.
describe('every listed template on its own start', () => {
  it.each(MODES)('the %s start reaches every template of its mode', (mode) => {
    const start = TEMPLATE_STARTS[mode];
    const shown = new Set(start.groups.flatMap((g) => g.kinds));
    const missing = TEMPLATES.filter(
      (t) =>
        !t.hidden &&
        !isBlankTemplate(t.kind) &&
        templateEditorMode(t.kind) === mode &&
        !shown.has(t.kind),
    ).map((t) => t.kind);
    expect(missing).toEqual([]);
  });
});
