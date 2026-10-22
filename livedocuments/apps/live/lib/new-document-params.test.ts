import { describe, expect, it } from 'vitest';
import { templateCreateHref } from '@livedocuments/templates';
import {
  choosePlacementAgainUrl,
  newDocumentKind,
  newDocumentQuery,
  newDocumentStartsBlank,
  placementParamsFromSearch,
  SEARCH_PRESET_MAX,
} from './new-document-params';

describe('newDocumentKind (docs/specs/007-editor/new-document-route.md)', () => {
  it('reads ?blank as the blank template, whatever its value', () => {
    expect(newDocumentKind('?blank=1')).toBe('blank');
    expect(newDocumentKind('?blank')).toBe('blank');
    expect(newDocumentKind('?folder=f1&blank=true')).toBe('blank');
  });

  it('reads ?template=<kind> for a catalogue kind', () => {
    expect(newDocumentKind('?template=slide-deck')).toBe('slide-deck');
    expect(newDocumentKind('?team=t1&template=article')).toBe('article');
  });

  it('opens a retired template’s replacement (a stale link)', () => {
    expect(newDocumentKind('?template=browser-wireframe')).toBe('wireframe-website');
  });

  it('is no template for an unknown kind or none', () => {
    expect(newDocumentKind('?template=not-a-template')).toBeNull();
    expect(newDocumentKind('?template=')).toBeNull();
    expect(newDocumentKind('?folder=f1')).toBeNull();
    expect(newDocumentKind('')).toBeNull();
  });

  it('lets blank win when both are present', () => {
    expect(newDocumentKind('?template=slide-deck&blank=1')).toBe('blank');
  });

  it('reads back the link the templates package builds for the gallery', () => {
    expect(newDocumentKind(templateCreateHref('article').slice('/new'.length))).toBe('article');
  });
});

describe('newDocumentStartsBlank (docs/specs/007-editor/new-document-route.md "Start Blank")', () => {
  it('reads ?blank and ?start=blank, beside any other param', () => {
    expect(newDocumentStartsBlank('?blank=1')).toBe(true);
    expect(newDocumentStartsBlank('?start=blank')).toBe(true);
    expect(newDocumentStartsBlank('?start=blank&via=Home.HeaderBlank')).toBe(true);
  });

  it('is off without either, or for any other start', () => {
    expect(newDocumentStartsBlank('')).toBe(false);
    expect(newDocumentStartsBlank('?start')).toBe(false);
    expect(newDocumentStartsBlank('?start=templates')).toBe(false);
    expect(newDocumentStartsBlank('?template=article')).toBe(false);
  });
});

describe('newDocumentQuery', () => {
  it('reads the words, trimmed and capped, and ignores none', () => {
    expect(newDocumentQuery('?q=slide%20deck')).toBe('slide deck');
    expect(newDocumentQuery('?q=%20%20article%20')).toBe('article');
    expect(newDocumentQuery(`?q=${'x'.repeat(80)}`)).toHaveLength(SEARCH_PRESET_MAX);
    expect(newDocumentQuery('?q=%20')).toBeNull();
    expect(newDocumentQuery('?folder=f1')).toBeNull();
  });
});

describe('choosePlacementAgainUrl (docs/specs/007-editor/new-document-route.md)', () => {
  it('drops the refused placement', () => {
    expect(choosePlacementAgainUrl('?team=t1&folder=f1')).toBe('/new');
  });

  it('keeps every other param', () => {
    expect(choosePlacementAgainUrl('?template=article&folder=f1&cta=hero')).toBe(
      '/new?template=article&cta=hero',
    );
  });

  it('is plain /new for a plain visit', () => {
    expect(choosePlacementAgainUrl('')).toBe('/new');
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
