import { describe, expect, it } from 'vitest';
import { isValidTab, parseStrokePoints } from '@livedocuments/document';
import {
  buildTemplateTab,
  buildTemplateTabs,
  resolveTemplate,
  closestTemplateKinds,
  closestTemplatesHint,
  CLOSEST_TEMPLATES_MAX,
  templateTabName,
  validTemplateKinds,
} from './template-tab';
import { TEMPLATES } from './templates';
import { templateCatalogue } from './template-catalogue';

// What the MCP writes from a template must be a tab the api accepts, any strokes packed
// (docs/specs/006-document/stroke-points.md).
describe('buildTemplateTab', () => {
  it('builds every template as a valid tab, with packed strokes', () => {
    for (const { kind } of TEMPLATES) {
      const tab = buildTemplateTab(`tab-${kind}`, kind, kind);
      expect(isValidTab(tab), kind).toBe(true);
      expect(tab.templateChosen, kind).toBe(true);
      for (const el of tab.elements) {
        if (el.type !== 'freehand') continue;
        expect(parseStrokePoints(el.packedPoints).ok, kind).toBe(true);
      }
    }
  });

  // Blank Tab and Blank Illustration open on the one unchosen page every new Pages tab starts on.
  it('opens every other template on pages of its own', () => {
    for (const { kind } of TEMPLATES) {
      if (kind === 'blank' || kind === 'blank-illustration') continue;
      expect(buildTemplateTab('t', kind, kind).pages?.length, kind).toBeGreaterThan(0);
    }
  });
});

describe('resolveTemplate', () => {
  it('resolves a catalogue kind and refuses an unknown one', () => {
    expect(resolveTemplate('slide-deck')).toBe('slide-deck');
    // A retired kind resolves to its replacement.
    expect(resolveTemplate('mobile-wireframe')).toBe('wireframe-mobile-app');
    expect(resolveTemplate('nope')).toBeNull();
  });

  it('lists every kind an agent may build for the refusal, as the catalogue does', () => {
    expect(validTemplateKinds().split(', ')).toEqual(
      templateCatalogue().templates.map((t) => t.kind),
    );
  });
});

describe('buildTemplateTabs', () => {
  it('makes exactly buildTemplateTab’s one tab for every template', () => {
    const newId = () => 'never';
    // Element ids are fresh each build: compare everything else.
    const shape = (tab: ReturnType<typeof buildTemplateTab>) => ({
      ...tab,
      elements: tab.elements.map(({ id: _id, ...rest }) => rest.type),
    });
    // Not an article's: its writing's block ids are fresh each build too.
    for (const kind of [
      'blank',
      'slide-deck',
      'event-poster',
      'floor-plan',
      'wireframe-website',
    ] as const) {
      const tabs = buildTemplateTabs({ id: 's', name: 'Mine' }, kind, newId);
      expect(tabs.map(shape), kind).toEqual([shape(buildTemplateTab('s', 'Mine', kind))]);
    }
  });
});

describe('templateTabName', () => {
  it('takes the name given, else Tab 1', () => {
    expect(templateTabName('Pitch', 'slide-deck')).toBe('Pitch');
    expect(templateTabName(undefined, 'slide-deck')).toBe('Tab 1');
    expect(templateTabName('  ', 'event-poster')).toBe('Tab 1');
  });
});

// docs/specs/015-api/mcp-server.md §4.5: an unknown kind is refused with the ones it most likely meant.
describe('closestTemplateKinds', () => {
  it('offers the kinds with a word starting with a word of it', () => {
    expect(closestTemplateKinds('wireframe')).toEqual([
      'blank-wireframe-phone',
      'blank-wireframe-tablet',
      'blank-wireframe-browser',
      'blank-wireframe-laptop',
      'blank-wireframe-watch',
    ]);
    expect(closestTemplateKinds('Recipe Card')).toContain('recipe-card');
    expect(closestTemplatesHint('poster')).toBe('Closest: event-poster. ');
  });

  it('offers nothing for a word under 3 letters or one no template has', () => {
    expect(closestTemplateKinds('ab')).toEqual([]);
    expect(closestTemplateKinds('zzzq')).toEqual([]);
    expect(closestTemplatesHint('zzzq')).toBe('');
  });

  it('offers at most CLOSEST_TEMPLATES_MAX', () => {
    expect(closestTemplateKinds('blank')).toHaveLength(CLOSEST_TEMPLATES_MAX);
  });
});
