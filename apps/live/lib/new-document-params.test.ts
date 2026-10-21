import { describe, expect, it } from 'vitest';
import { templateCreateHref } from '@liveplanner/templates';
import {
  choosePlacementAgainUrl,
  newDocumentKind,
  newDocumentQuery,
  placementParamsFromSearch,
  SEARCH_PRESET_MAX,
} from './new-document-params';

describe('newDocumentKind (docs/specs/007-editor/new-document-route.md)', () => {
  it('reads ?template= as that template', () => {
    expect(newDocumentKind('?template=kanban')).toBe('kanban');
    expect(newDocumentKind('?team=t1&template=budget-planner')).toBe('budget-planner');
  });

  it('opens a retired kind as its replacement', () => {
    expect(newDocumentKind('?template=browser-wireframe')).toBe('wireframe-website');
  });

  it('is a blank document for anything else, a retired ?blank= or ?mode= included', () => {
    expect(newDocumentKind('?template=not-a-template')).toBeNull();
    expect(newDocumentKind('?template=')).toBeNull();
    expect(newDocumentKind('?folder=f1')).toBeNull();
    expect(newDocumentKind('?blank=1')).toBeNull();
    expect(newDocumentKind('?mode=draw')).toBeNull();
    expect(newDocumentKind('')).toBeNull();
  });

  it('reads back the link the templates package builds for the gallery', () => {
    expect(newDocumentKind(templateCreateHref('kanban').slice('/new'.length))).toBe('kanban');
  });
});

describe('choosePlacementAgainUrl (docs/specs/007-editor/new-document-route.md)', () => {
  it('drops the refused placement and keeps every other param', () => {
    expect(choosePlacementAgainUrl('?team=t1&folder=f1')).toBe('/new');
    expect(choosePlacementAgainUrl('?template=kanban&folder=f1&cta=hero')).toBe(
      '/new?template=kanban&cta=hero',
    );
  });

  it('is plain /new for a plain visit', () => {
    expect(choosePlacementAgainUrl('')).toBe('/new');
  });
});

describe('newDocumentQuery', () => {
  it('reads the search words, trimmed and capped, or none', () => {
    expect(newDocumentQuery('?q=mind%20map')).toBe('mind map');
    expect(newDocumentQuery('?q=%20%20budget%20')).toBe('budget');
    expect(newDocumentQuery(`?q=${'x'.repeat(80)}`)).toHaveLength(SEARCH_PRESET_MAX);
    expect(newDocumentQuery('?q=%20')).toBeNull();
    expect(newDocumentQuery('')).toBeNull();
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
    expect(placementParamsFromSearch('?template=kanban')).toEqual({});
    expect(placementParamsFromSearch('?folder=&team=')).toEqual({});
  });
});
