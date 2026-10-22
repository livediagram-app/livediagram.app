import { describe, expect, it } from 'vitest';
import { templateCreateHref } from '@liveplanner/templates';
import {
  choosePlacementAgainUrl,
  newProjectKind,
  newProjectQuery,
  placementParamsFromSearch,
  SEARCH_PRESET_MAX,
} from './new-project-params';

describe('newProjectKind (docs/specs/007-editor/new-project-route.md)', () => {
  it('reads ?template= as that template', () => {
    expect(newProjectKind('?template=kanban')).toBe('kanban');
    expect(newProjectKind('?team=t1&template=budget-planner')).toBe('budget-planner');
  });

  it('is a blank project for anything else, a retired ?blank= or ?mode= included', () => {
    expect(newProjectKind('?template=not-a-template')).toBeNull();
    expect(newProjectKind('?template=')).toBeNull();
    expect(newProjectKind('?folder=f1')).toBeNull();
    expect(newProjectKind('?blank=1')).toBeNull();
    expect(newProjectKind('?mode=draw')).toBeNull();
    expect(newProjectKind('')).toBeNull();
  });

  it('reads back the link the templates package builds for the gallery', () => {
    expect(newProjectKind(templateCreateHref('kanban').slice('/new'.length))).toBe('kanban');
  });
});

describe('choosePlacementAgainUrl (docs/specs/007-editor/new-project-route.md)', () => {
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

describe('newProjectQuery', () => {
  it('reads the search words, trimmed and capped, or none', () => {
    expect(newProjectQuery('?q=mind%20map')).toBe('mind map');
    expect(newProjectQuery('?q=%20%20budget%20')).toBe('budget');
    expect(newProjectQuery(`?q=${'x'.repeat(80)}`)).toHaveLength(SEARCH_PRESET_MAX);
    expect(newProjectQuery('?q=%20')).toBeNull();
    expect(newProjectQuery('')).toBeNull();
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
