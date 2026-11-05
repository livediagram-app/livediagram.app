import { describe, expect, it } from 'vitest';
import { templateCreateHref } from '@livehuddle/templates';
import {
  choosePlacementAgainUrl,
  linkedTemplateKind,
  newSpaceKind,
  placementParamsFromSearch,
  SEARCH_PRESET_MAX,
  startPresetQuery,
  startsBlank,
} from './new-document-params';

describe('linkedTemplateKind (docs/specs/007-editor/new-document-route.md "What a /new link can ask for")', () => {
  it('reads ?blank as the Blank Space template, whatever its value', () => {
    expect(linkedTemplateKind('?blank=1')).toBe('blank-session');
    expect(linkedTemplateKind('?blank')).toBe('blank-session');
    expect(linkedTemplateKind('?folder=f1&blank=true')).toBe('blank-session');
  });

  it('reads ?template=<kind> for a catalogue kind', () => {
    expect(linkedTemplateKind('?template=virtual-office')).toBe('virtual-office');
    // A template that left (Work Tracker #423) reads as no kind: /new opens Blank Space.
    expect(linkedTemplateKind('?template=sailboat')).toBeNull();
    expect(linkedTemplateKind('?team=t1&template=team-pod')).toBe('team-pod');
  });

  it('names none for an unknown kind or no template', () => {
    expect(linkedTemplateKind('?template=not-a-template')).toBeNull();
    expect(linkedTemplateKind('?template=')).toBeNull();
    expect(linkedTemplateKind('?folder=f1')).toBeNull();
    expect(linkedTemplateKind('')).toBeNull();
  });

  it('lets blank win when both are present', () => {
    expect(linkedTemplateKind('?template=kanban&blank=1')).toBe('blank-session');
  });

  it('reads back the link the templates package builds for the gallery', () => {
    expect(linkedTemplateKind(templateCreateHref('all-hands-hall').slice('/new'.length))).toBe(
      'all-hands-hall',
    );
  });
});

describe('newSpaceKind', () => {
  it('makes the named template, else the Blank Space, so every /new makes a Space', () => {
    expect(newSpaceKind('?template=team-pod')).toBe('team-pod');
    expect(newSpaceKind('')).toBe('blank-session');
    expect(newSpaceKind('?template=kanban')).toBe('blank-session');
    expect(newSpaceKind('?q=bar&folder=f1')).toBe('blank-session');
  });
});

describe('choosePlacementAgainUrl (docs/specs/007-editor/new-document-route.md)', () => {
  it('drops the refused placement and the template, so the next create goes where new Spaces go', () => {
    expect(choosePlacementAgainUrl('?template=team-pod&team=t1&folder=f1')).toBe('/new');
    expect(choosePlacementAgainUrl('?blank=1&team=t1')).toBe('/new?blank=1');
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

// docs/specs/007-editor/new-document-route.md "What a /new link can ask for": `?q=` searches the new Space's start.
describe('startPresetQuery', () => {
  it('reads the words, trimmed and capped, and ignores none', () => {
    expect(startPresetQuery('?q=mind%20map')).toBe('mind map');
    expect(startPresetQuery('?q=%20%20article%20')).toBe('article');
    expect(startPresetQuery(`?q=${'x'.repeat(80)}`)).toHaveLength(SEARCH_PRESET_MAX);
    expect(startPresetQuery('?q=%20')).toBeNull();
    expect(startPresetQuery('?mode=draw')).toBeNull();
  });
});

describe('placementParamsFromSearch', () => {
  it('reads a folder, a team, or a team folder', () => {
    expect(placementParamsFromSearch('?folder=f1')).toEqual({ folderId: 'f1' });
    expect(placementParamsFromSearch('?team=t1')).toEqual({ teamId: 't1' });
    expect(placementParamsFromSearch('?team=t1&folder=f1')).toEqual({
      folderId: 'f1',
      teamId: 't1',
    });
  });

  it('is no placement without either, an empty param included', () => {
    expect(placementParamsFromSearch('')).toEqual({});
    expect(placementParamsFromSearch('?blank=1')).toEqual({});
    expect(placementParamsFromSearch('?folder=&team=')).toEqual({});
  });
});

describe('startsBlank (docs/specs/007-editor/new-document-route.md "What a /new link can ask for")', () => {
  it('reads ?blank and ?start=blank, beside any other param', () => {
    expect(startsBlank('?blank=1')).toBe(true);
    expect(startsBlank('?start=blank')).toBe(true);
    expect(startsBlank('?start=blank&via=Home.HeaderBlank')).toBe(true);
  });

  it('is off without them or for any other start value', () => {
    expect(startsBlank('')).toBe(false);
    expect(startsBlank('?start')).toBe(false);
    expect(startsBlank('?start=templates')).toBe(false);
    expect(startsBlank('?template=team-pod')).toBe(false);
  });
});
