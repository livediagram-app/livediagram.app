import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import type { Element, Page } from './index';
import {
  describeScreenLink,
  isPageLinkTransition,
  isScreenLink,
  isWellFormedLinkField,
  PAGE_LINK_ID_MAX,
  pageLinkTransitionOf,
  resolveScreenLink,
  screenName,
} from './page-link';
import { elementValidationIssue, isValidTab } from './validate';

// docs/specs/007-editor/wireframe-pages.md "Clickable prototypes".
const pages: Page[] = [
  { id: 'page-1', orientation: 'portrait', kind: 'wireframe' },
  { id: 'page-2', orientation: 'portrait', kind: 'wireframe', name: '  Checkout  ' },
];

describe('screen links', () => {
  it('tells the screen kinds from the other link kinds', () => {
    expect(isScreenLink({ kind: 'page' })).toBe(true);
    expect(isScreenLink({ kind: 'back' })).toBe(true);
    expect(isScreenLink({ kind: 'tab' })).toBe(false);
    expect(isScreenLink(undefined)).toBe(false);
    expect(isScreenLink(null)).toBe(false);
  });

  it('reads an absent transition as instant', () => {
    expect(pageLinkTransitionOf({ kind: 'back' })).toBe('instant');
    expect(pageLinkTransitionOf({ kind: 'page', pageId: 'p', transition: 'dissolve' })).toBe(
      'dissolve',
    );
    expect(['instant', 'slide', 'dissolve'].every(isPageLinkTransition)).toBe(true);
    expect(isPageLinkTransition('wipe')).toBe(false);
  });

  it('resolves to its page and place, back, or broken when the page is gone', () => {
    expect(resolveScreenLink({ kind: 'page', pageId: 'page-2' }, pages)).toEqual({
      state: 'page',
      page: pages[1],
      index: 1,
    });
    expect(resolveScreenLink({ kind: 'back' }, pages)).toEqual({ state: 'back' });
    expect(resolveScreenLink({ kind: 'page', pageId: 'deleted' }, pages)).toEqual({
      state: 'broken',
    });
    expect(resolveScreenLink({ kind: 'page', pageId: 'page-1' }, [])).toEqual({
      state: 'broken',
    });
  });

  it('names a screen by its name, else its place', () => {
    expect(screenName(pages[1]!, 1)).toBe('Checkout');
    expect(screenName(pages[0]!, 0)).toBe('Screen 1');
    expect(screenName({ name: '   ' }, 4)).toBe('Screen 5');
  });

  it('describes each link, a broken one included', () => {
    expect(describeScreenLink({ kind: 'page', pageId: 'page-2' }, pages)).toBe('Goes to Checkout');
    expect(describeScreenLink({ kind: 'page', pageId: 'x' }, pages)).toBe(
      'Broken link: its screen was deleted',
    );
    expect(describeScreenLink({ kind: 'back' }, pages)).toBe('Goes back to the screen before');
  });
});

describe('the stored link field', () => {
  it('checks only the screen kinds, leaving the others as lenient as they were', () => {
    expect(isWellFormedLinkField({ kind: 'url', url: 42 })).toBe(true);
    expect(isWellFormedLinkField({ kind: 'diagram', diagramId: 'd' })).toBe(true);
    expect(isWellFormedLinkField('not a link')).toBe(true);
    expect(isWellFormedLinkField({ kind: 'page', pageId: 'page-1' })).toBe(true);
    expect(isWellFormedLinkField({ kind: 'page', pageId: 'page-1', transition: 'slide' })).toBe(
      true,
    );
    expect(isWellFormedLinkField({ kind: 'back' })).toBe(true);
    expect(isWellFormedLinkField({ kind: 'back', transition: 'dissolve' })).toBe(true);
    expect(isWellFormedLinkField({ kind: 'page' })).toBe(false);
    expect(isWellFormedLinkField({ kind: 'page', pageId: '' })).toBe(false);
    expect(isWellFormedLinkField({ kind: 'page', pageId: 7 })).toBe(false);
    expect(isWellFormedLinkField({ kind: 'page', pageId: 'p'.repeat(PAGE_LINK_ID_MAX) })).toBe(
      true,
    );
    expect(isWellFormedLinkField({ kind: 'page', pageId: 'p'.repeat(PAGE_LINK_ID_MAX + 1) })).toBe(
      false,
    );
    expect(isWellFormedLinkField({ kind: 'back', transition: 'wipe' })).toBe(false);
    expect(isWellFormedLinkField({ kind: 'page', pageId: 'p', transition: null })).toBe(false);
  });

  it('refuses a malformed screen link naming the field, on a box and on an arrow', () => {
    const box = { ...createShape('square', 0, 0), id: 'b' } as Element;
    expect(elementValidationIssue({ ...box, link: { kind: 'page', pageId: 'page-1' } })).toBe(null);
    expect(elementValidationIssue({ ...box, link: { kind: 'back', transition: 'x' } })).toEqual(
      expect.objectContaining({ field: 'link' }),
    );
    const arrow = {
      id: 'a',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 10, y: 0 },
      link: { kind: 'page' },
    };
    expect(elementValidationIssue(arrow)?.field).toBe('link');
  });

  it('keeps a tab whose link points at a deleted page valid: it reads as broken', () => {
    const box = { ...createShape('square', 0, 0), id: 'b' } as Element;
    const tab = {
      id: 't',
      name: 'Screens',
      pages,
      elements: [{ ...box, link: { kind: 'page', pageId: 'deleted' } }],
    };
    expect(isValidTab(tab)).toBe(true);
  });
});
