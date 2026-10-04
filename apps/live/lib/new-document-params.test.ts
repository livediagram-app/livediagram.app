import { describe, expect, it } from 'vitest';
import { templateCreateHref } from '@livediagram/templates';
import {
  choosePlacementAgainUrl,
  wizardBypassKind,
  SEARCH_PRESET_MAX,
  wizardPresetMode,
  wizardPresetQuery,
} from './new-document-params';

describe('wizardBypassKind (docs/specs/007-editor/new-document-route.md)', () => {
  it('reads ?blank as the blank template, whatever its value', () => {
    expect(wizardBypassKind('?blank=1')).toBe('blank');
    expect(wizardBypassKind('?blank')).toBe('blank');
    expect(wizardBypassKind('?folder=f1&blank=true')).toBe('blank');
  });

  it('reads ?template=<kind> for a catalogue kind', () => {
    expect(wizardBypassKind('?template=kanban')).toBe('kanban');
    expect(wizardBypassKind('?team=t1&template=er-diagram')).toBe('er-diagram');
  });

  it('falls back to the wizard for an unknown kind or no bypass', () => {
    expect(wizardBypassKind('?template=not-a-template')).toBeNull();
    expect(wizardBypassKind('?template=')).toBeNull();
    expect(wizardBypassKind('?folder=f1')).toBeNull();
    expect(wizardBypassKind('')).toBeNull();
  });

  it('lets blank win when both are present', () => {
    expect(wizardBypassKind('?template=kanban&blank=1')).toBe('blank');
  });

  it('reads back the link the templates package builds for the gallery', () => {
    expect(wizardBypassKind(templateCreateHref('swot').slice('/new'.length))).toBe('swot');
  });
});

describe('choosePlacementAgainUrl (docs/specs/007-editor/new-document-route.md)', () => {
  it('drops the refused placement and the bypass, so the wizard starts from the root of My documents', () => {
    expect(choosePlacementAgainUrl('?blank=1&team=t1&folder=f1')).toBe('/new');
  });

  it('keeps every other param', () => {
    expect(choosePlacementAgainUrl('?template=flowchart&folder=f1&mode=draw&cta=hero')).toBe(
      '/new?mode=draw&cta=hero',
    );
  });

  it('is plain /new for a plain visit', () => {
    expect(choosePlacementAgainUrl('')).toBe('/new');
  });
});

// docs/specs/007-editor/new-document-route.md "?mode= and ?q=": the template step's presets.
describe('wizardPresetMode / wizardPresetQuery', () => {
  it('reads a known mode, and ignores an unknown one', () => {
    expect(wizardPresetMode('?mode=draw')).toBe('draw');
    expect(wizardPresetMode('?folder=f1&mode=illustrate&via=Home.HeroBuild')).toBe('illustrate');
    expect(wizardPresetMode('?mode=sideways')).toBeNull();
    expect(wizardPresetMode('')).toBeNull();
  });

  it('reads the words, trimmed and capped, and ignores none', () => {
    expect(wizardPresetQuery('?q=mind%20map')).toBe('mind map');
    expect(wizardPresetQuery('?q=%20%20article%20')).toBe('article');
    expect(wizardPresetQuery(`?q=${'x'.repeat(80)}`)).toHaveLength(SEARCH_PRESET_MAX);
    expect(wizardPresetQuery('?q=%20')).toBeNull();
    expect(wizardPresetQuery('?mode=draw')).toBeNull();
  });
});
