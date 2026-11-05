import { describe, expect, it } from 'vitest';
import { buildTemplatedTab } from './template-builders';
import {
  BLANK_TEMPLATE_FOR_MODE,
  isBlankTemplate,
  templateEditorMode,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  templateCanvasOverrides,
  templateCategory,
  untitledNameForTemplate,
  type TemplateKind,
} from '@livehuddle/templates';
import { isFloorPattern } from '@livehuddle/document';
import { getTheme } from './themes';

// `buildTemplatedTab` is the seam between /live/new (the welcome flow) and the editor: a freshly chosen template and
// theme have to land in the editor as a fully styled tab, or the person opens an "Untitled" document that doesn't
// match the option they picked.

// The catalogue (docs/specs/007-editor/templates-by-mode.md "The catalogue"): Blank Space and the eighteen Spaces. The
// retrospectives, workshops, planning and strategy boards and the quizzes and games left with Work Tracker #423.
describe('TEMPLATES catalogue', () => {
  const ALL_KINDS: TemplateKind[] = [
    'blank-session',
    'virtual-office',
    'coworking-space',
    'team-pod',
    'all-hands-hall',
    'focus-library',
    'training-room',
    'rooftop-bar',
    'cafe',
    'garden-retreat',
    'city-park',
    'company-campus',
    'conference-venue',
    'startup-hq',
    'school-quad',
    'hotel-and-suites',
    'coworking-tower',
    'expo-hall',
    'beach-offsite',
  ];

  // Hidden templates are buildable but never listed; nothing ships hidden today.
  const listed = TEMPLATES.filter((t) => !t.hidden);

  it('lists Blank Space and the eighteen Spaces, in that order', () => {
    expect(listed.map((t) => t.kind)).toEqual(ALL_KINDS);
    expect(listed.map((t) => t.title)).toEqual([
      'Blank Space',
      'Virtual Office',
      'Coworking Space',
      'Team Pod',
      'All-Hands Hall',
      'Focus Library',
      'Training Room',
      'Rooftop Bar',
      'Cafe',
      'Garden Retreat',
      'City Park',
      'Company Campus',
      'Conference Venue',
      'Startup HQ',
      'School Quad',
      'Hotel and Suites',
      'Co-working Tower',
      'Expo Hall',
      'Beach Offsite',
    ]);
  });

  it('ships no hidden templates (the flag is generic; docs/specs/007-editor/editor-tour.md has no sample)', () => {
    expect(TEMPLATES.filter((t) => t.hidden)).toEqual([]);
  });

  it('assigns every template but the blank to a known category (the picker groups templates by category)', () => {
    const known = new Set(TEMPLATE_CATEGORIES.map((c) => c.id));
    for (const t of TEMPLATES) {
      const category = templateCategory(t.kind);
      if (isBlankTemplate(t.kind)) expect(category, t.kind).toBeNull();
      else expect(category !== null && known.has(category), t.kind).toBe(true);
    }
  });

  it('builds every kind, the blank empty and every Space furnished', () => {
    for (const kind of ALL_KINDS) {
      const tab = buildTemplatedTab(kind, 'brand', `tab-${kind}`, 'name');
      if (kind === 'blank-session') expect(tab.elements, kind).toEqual([]);
      else expect(tab.elements.length, kind).toBeGreaterThan(0);
    }
  });
});

describe('templateCanvasOverrides', () => {
  it('lays every Space on a floor at full strength (docs/specs/011-theme/floors.md)', () => {
    for (const kind of TEMPLATES.map((t) => t.kind).filter((k) => k !== 'blank-session')) {
      const overrides = templateCanvasOverrides(kind);
      expect(isFloorPattern(overrides.backgroundPattern), kind).toBe(true);
      expect(overrides, kind).toEqual({
        backgroundPattern: overrides.backgroundPattern,
        opensIn: 'workshop',
      });
    }
    expect(templateCanvasOverrides('garden-retreat').backgroundPattern).toBe('grass');
    expect(templateCanvasOverrides('virtual-office').backgroundPattern).toBe('carpet-tiles');
  });

  it('leaves the blank template to inherit the theme backdrop', () => {
    // docs/specs/007-editor/editor-modes.md: the meeting board is the one mode, and it lands on every creation path
    // through here (the template, a new tab, Quick Start, the MCP worker).
    expect(templateCanvasOverrides('blank-session')).toEqual({ opensIn: 'workshop' });
  });
});

describe('buildTemplatedTab', () => {
  it('returns a Tab carrying the supplied id, name, and theme metadata', () => {
    const tab = buildTemplatedTab('blank-session', 'slate', 'tab-1', 'My tab');
    const slate = getTheme('slate');
    expect(tab.id).toBe('tab-1');
    expect(tab.name).toBe('My tab');
    expect(tab.theme).toBe('slate');
    expect(tab.backgroundColor).toBe(slate.backgroundColor);
    expect(tab.backgroundPattern).toBe(slate.backgroundPattern);
    expect(tab.patternColor).toBe(slate.patternColor);
    expect(tab.templateChosen).toBe(true);
  });

  it('keeps a Space’s floor over the theme’s own pattern', () => {
    const tab = buildTemplatedTab('team-pod', 'slate', 'tab-2', 'Team Pod');
    expect(tab.backgroundPattern).toBe('carpet');
    expect(tab.opensIn).toBe('workshop');
  });
});

describe('untitledNameForTemplate', () => {
  it('names no template and the blank alike, "Untitled Space"', () => {
    expect(untitledNameForTemplate(null)).toBe('Untitled Space');
    expect(untitledNameForTemplate('blank-session')).toBe('Untitled Space');
  });
});

// Templates by mode (docs/specs/007-editor/templates-by-mode.md): the mode a card shows is the mode its tab opens in,
// and each mode's blank is of that mode.
describe('templateEditorMode', () => {
  it('is the mode every template opens in', () => {
    for (const t of TEMPLATES) {
      expect(templateEditorMode(t.kind), t.kind).toBe(templateCanvasOverrides(t.kind).opensIn);
    }
  });

  it('gives every mode a blank of its own mode', () => {
    for (const [mode, kind] of Object.entries(BLANK_TEMPLATE_FOR_MODE)) {
      expect(templateEditorMode(kind)).toBe(mode);
    }
  });
});
