import { describe, expect, it } from 'vitest';
import { templateCreateHref } from '@livedesign/templates';
import {
  choosePlacementAgainUrl,
  newDesignKind,
  newDesignQuery,
  newDesignStartsBlank,
  placementParamsFromSearch,
  SEARCH_PRESET_MAX,
} from './new-design-params';

describe('newDesignKind (docs/specs/007-editor/new-design-route.md)', () => {
  it('reads ?blank as the blank template, whatever its value', () => {
    expect(newDesignKind('?blank=1')).toBe('blank');
    expect(newDesignKind('?blank')).toBe('blank');
    expect(newDesignKind('?folder=f1&blank=true')).toBe('blank');
  });

  it('reads ?template=<kind> for a catalogue kind', () => {
    expect(newDesignKind('?template=wireframe-mobile-app')).toBe('wireframe-mobile-app');
    expect(newDesignKind('?team=t1&template=logo-design')).toBe('logo-design');
  });

  it('opens a retired template’s replacement (a stale link)', () => {
    expect(newDesignKind('?template=browser-wireframe')).toBe('wireframe-website');
  });

  it('is no template for an unknown kind or none', () => {
    expect(newDesignKind('?template=not-a-template')).toBeNull();
    expect(newDesignKind('?template=')).toBeNull();
    expect(newDesignKind('?folder=f1')).toBeNull();
    expect(newDesignKind('')).toBeNull();
  });

  it('lets blank win when both are present', () => {
    expect(newDesignKind('?template=wireframe-mobile-app&blank=1')).toBe('blank');
  });

  it('reads back the link the templates package builds for the gallery', () => {
    expect(newDesignKind(templateCreateHref('logo-design').slice('/new'.length))).toBe(
      'logo-design',
    );
  });
});

describe('newDesignStartsBlank (docs/specs/007-editor/new-design-route.md "Start Blank")', () => {
  it('reads ?blank and ?start=blank, beside any other param', () => {
    expect(newDesignStartsBlank('?blank=1')).toBe(true);
    expect(newDesignStartsBlank('?start=blank')).toBe(true);
    expect(newDesignStartsBlank('?start=blank&via=Home.HeaderBlank')).toBe(true);
  });

  it('is off without either, or for any other start', () => {
    expect(newDesignStartsBlank('')).toBe(false);
    expect(newDesignStartsBlank('?start')).toBe(false);
    expect(newDesignStartsBlank('?start=templates')).toBe(false);
    expect(newDesignStartsBlank('?template=logo-design')).toBe(false);
  });
});

describe('newDesignQuery', () => {
  it('reads the words, trimmed and capped, and ignores none', () => {
    expect(newDesignQuery('?q=slide%20deck')).toBe('slide deck');
    expect(newDesignQuery('?q=%20%20logo-design%20')).toBe('logo-design');
    expect(newDesignQuery(`?q=${'x'.repeat(80)}`)).toHaveLength(SEARCH_PRESET_MAX);
    expect(newDesignQuery('?q=%20')).toBeNull();
    expect(newDesignQuery('?folder=f1')).toBeNull();
  });
});

describe('choosePlacementAgainUrl (docs/specs/007-editor/new-design-route.md)', () => {
  it('drops the refused placement', () => {
    expect(choosePlacementAgainUrl('?team=t1&folder=f1')).toBe('/new');
  });

  it('keeps every other param', () => {
    expect(choosePlacementAgainUrl('?template=logo-design&folder=f1&cta=hero')).toBe(
      '/new?template=logo-design&cta=hero',
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
