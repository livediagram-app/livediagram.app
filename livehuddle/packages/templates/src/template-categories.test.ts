import { describe, expect, it } from 'vitest';
import { EDITOR_MODES } from '@livehuddle/document';
import {
  TEMPLATE_ALSO_IN,
  TEMPLATE_CATEGORIES,
  isInTemplateCategory,
  templateCategories,
  templateCategory,
  templateCategoryLabel,
  templateCategorySearchWords,
} from './template-categories';
import { isBlankTemplate, templateEditorMode } from './template-modes';
import { templateKeywords } from './template-keywords';
import { templateMatchesQuery } from './template-search';
import { TEMPLATES } from './templates';

// docs/specs/008-canvas/canvas-and-palette.md "Template categories", docs/specs/007-editor/templates-by-mode.md "The
// catalogue": the twenty-six Spaces in eight categories by the kind of place they are, the blank in none.
describe('template categories', () => {
  const ids = TEMPLATE_CATEGORIES.map((c) => c.id);

  it('is Campus, Events, Games Rooms, Homes, Office, Outdoor, Recreation and Venues, alphabetical, Title Case, with even descriptions', () => {
    expect(TEMPLATE_CATEGORIES.map((c) => c.label)).toEqual([
      'Campus',
      'Events',
      'Games Rooms',
      'Homes',
      'Office',
      'Outdoor',
      'Recreation',
      'Venues',
    ]);
    expect(ids).toEqual([
      'campus',
      'events',
      'games',
      'homes',
      'office',
      'outdoor',
      'recreation',
      'venues',
    ]);
    for (const c of TEMPLATE_CATEGORIES) {
      expect(c.description.length, c.id).toBeGreaterThanOrEqual(40);
      expect(c.description.length, c.id).toBeLessThanOrEqual(50);
      expect(c.description, c.id).not.toMatch(/—/);
    }
    expect(templateCategoryLabel('office')).toBe('Office');
    for (const id of ids) expect(templateCategorySearchWords(id), id).toMatch(/avatar walk/);
  });

  it('gives every template but the blank exactly one primary category, and the blank none', () => {
    for (const t of TEMPLATES) {
      const primary = templateCategory(t.kind);
      if (isBlankTemplate(t.kind)) {
        expect(primary, t.kind).toBeNull();
        expect(templateCategories(t.kind), t.kind).toEqual([]);
      } else {
        expect(ids, t.kind).toContain(primary);
        expect(templateCategories(t.kind)[0], t.kind).toBe(primary);
      }
    }
  });

  it('files two to seven Spaces in each category, four of them cross-listed', () => {
    const inCategory = (id: (typeof ids)[number]) =>
      TEMPLATES.filter((t) => templateCategory(t.kind) === id).map((t) => t.kind);
    expect(inCategory('office')).toEqual([
      'virtual-office',
      'coworking-space',
      'team-pod',
      'focus-library',
    ]);
    expect(inCategory('events')).toEqual(['all-hands-hall', 'training-room', 'expo-hall']);
    expect(inCategory('recreation')).toEqual(['rooftop-bar', 'cafe']);
    expect(inCategory('outdoor')).toEqual(['garden-retreat', 'city-park', 'beach-offsite']);
    expect(inCategory('campus')).toEqual([
      'company-campus',
      'startup-hq',
      'school-quad',
      'coworking-tower',
    ]);
    expect(inCategory('games')).toEqual(['arcade-lounge', 'games-night-den', 'sports-bar']);
    expect(inCategory('homes')).toEqual(['family-house', 'city-townhouse', 'country-cottage']);
    expect(inCategory('venues')).toEqual([
      'conference-venue',
      'hotel-and-suites',
      'music-hall',
      'festival-field',
    ]);
    for (const id of ids) {
      expect(inCategory(id).length, id).toBeGreaterThanOrEqual(2);
      expect(inCategory(id).length, id).toBeLessThanOrEqual(7);
    }
    expect(TEMPLATE_ALSO_IN).toEqual({
      'beach-offsite': ['campus'],
      'sports-bar': ['recreation'],
      'expo-hall': ['venues'],
      'festival-field': ['outdoor'],
    });
    expect(isInTemplateCategory('festival-field', 'outdoor')).toBe(true);
    expect(isInTemplateCategory('team-pod', 'office')).toBe(true);
    expect(isInTemplateCategory('blank-session', 'office')).toBe(false);
  });

  it('leaves no category empty in every mode', () => {
    for (const id of ids) {
      const modes = EDITOR_MODES.filter((m) =>
        TEMPLATES.some((t) => isInTemplateCategory(t.kind, id) && templateEditorMode(t.kind) === m),
      );
      expect(modes.length, id).toBeGreaterThan(0);
    }
  });
});

describe('template search words', () => {
  it('gives every template words of its own, lower case, each once', () => {
    for (const t of TEMPLATES) {
      const words = templateKeywords(t.kind);
      expect(words.length, t.kind).toBeGreaterThan(0);
      expect(new Set(words).size, t.kind).toBe(words.length);
      for (const w of words) expect(w, t.kind).toBe(w.toLowerCase());
    }
  });

  it('finds templates by the words people use', () => {
    const find = (q: string) =>
      TEMPLATES.filter((t) => templateMatchesQuery(t, q)).map((t) => t.kind);
    expect(find('standup')).toContain('team-pod');
    expect(find('town hall')).toContain('all-hands-hall');
    expect(find('blank')).toContain('blank-session');
    expect(find('drinks')).toEqual(expect.arrayContaining(['rooftop-bar', 'cafe']));
    expect(find('garden')).toEqual(expect.arrayContaining(['garden-retreat', 'city-park']));
    expect(find('pub')).toContain('rooftop-bar');
    // The Games Rooms, the Homes and the Venues by the words people use for them.
    expect(find('moon mail')).toEqual(['arcade-lounge']);
    expect(find('ping pong')).toContain('sports-bar');
    expect(find('play')).toEqual(
      expect.arrayContaining(['arcade-lounge', 'games-night-den', 'sports-bar']),
    );
    expect(find('house')).toEqual(
      expect.arrayContaining(['family-house', 'city-townhouse', 'country-cottage']),
    );
    expect(find('upstairs')).toEqual(
      expect.arrayContaining(['family-house', 'city-townhouse', 'country-cottage']),
    );
    expect(find('live music')).toEqual(['music-hall', 'festival-field']);
    expect(find('festival')).toEqual(['festival-field']);
    expect(find('food stalls')).toEqual(['festival-field']);
    // Cross-listed in Outdoor, the Festival Field is found by that category's words too.
    expect(find('outdoors')).toEqual(expect.arrayContaining(['beach-offsite', 'festival-field']));
    expect(find('venue')).toEqual(
      expect.arrayContaining([
        'conference-venue',
        'hotel-and-suites',
        'music-hall',
        'festival-field',
        'expo-hall',
      ]),
    );
    // A category's search words find its templates: every Space by "avatar", and the Blank Space by its own Avatar
    // Pad.
    expect(find('avatar')).toEqual(TEMPLATES.map((t) => t.kind));
    // Every word must match.
    expect(find('office zebra')).toEqual([]);
    expect(find('')).toHaveLength(TEMPLATES.length);
    // The workshop words left with the workshop templates.
    expect(find('retro')).toEqual([]);
    expect(find('workshop')).toEqual([]);
  });

  it('reads punctuation and hyphens as no part of a word, in the query and the templates alike', () => {
    const find = (q: string) =>
      TEMPLATES.filter((t) => templateMatchesQuery(t, q)).map((t) => t.kind);
    expect(find('all-hands')).toContain('all-hands-hall');
    // Run together, a hyphenated name is found too ("team pod" from the kind team-pod).
    expect(find('teampod')).toContain('team-pod');
    // A query of punctuation alone is no query.
    expect(find(' - ')).toHaveLength(TEMPLATES.length);
  });
});
