import { describe, expect, it } from 'vitest';
import { createShape, layOutPages, type Element, type Page } from '@livedesign/design';
import {
  relinkToScreen,
  screenLinkChoices,
  screenOfElement,
  showsScreenLinkHandle,
  wireframeTabPages,
} from './screen-link-choices';
import { resolveEditorCapabilities } from './editor-capabilities';

// docs/specs/007-editor/wireframe-pages.md "Setting a link": the Screen mode's rows, the handle's drop and when the
// handle shows, for each share role.
const ME = 'a'.repeat(32);
const wire = (id: string, name?: string): Page => ({
  id,
  orientation: 'portrait',
  kind: 'wireframe',
  device: 'iphone',
  ...(name ? { name } : {}),
});
const pages = [wire('page-1'), wire('page-2', 'Checkout'), wire('page-3', '  ')];
const laid = layOutPages(pages);
const onPage = (index: number, extra: Partial<Element> = {}): Element => {
  const r = laid[index]!.rect;
  return {
    ...createShape('square', r.x + 20, r.y + 20),
    id: `el-${index}`,
    ...extra,
  } as Element;
};

describe('screenLinkChoices', () => {
  it('lists every screen by name or place, marking the one the element sits on', () => {
    const el = onPage(1);
    expect(screenLinkChoices(pages, el, [el])).toEqual([
      { id: 'page-1', name: 'Screen 1', here: false },
      { id: 'page-2', name: 'Checkout', here: true },
      { id: 'page-3', name: 'Screen 3', here: false },
    ]);
  });

  it('marks no screen for an element off every page', () => {
    const el = { ...createShape('square', -5000, -5000), id: 'off' } as Element;
    expect(screenLinkChoices(pages, el, [el]).some((c) => c.here)).toBe(false);
    expect(screenOfElement(laid, el, [el])).toBeUndefined();
  });
});

describe('wireframeTabPages', () => {
  it('is true for a wireframe tab only', () => {
    expect(wireframeTabPages(pages)).toBe(true);
    expect(wireframeTabPages([{ kind: 'logo' }])).toBe(false);
    expect(wireframeTabPages([])).toBe(false);
  });
});

describe('relinkToScreen', () => {
  it('keeps a screen link transition and drops any other link', () => {
    expect(relinkToScreen({ kind: 'page', pageId: 'a', transition: 'slide' }, 'b')).toEqual({
      kind: 'page',
      pageId: 'b',
      transition: 'slide',
    });
    expect(relinkToScreen({ kind: 'back', transition: 'dissolve' }, 'b')).toEqual({
      kind: 'page',
      pageId: 'b',
      transition: 'dissolve',
    });
    expect(relinkToScreen({ kind: 'page', pageId: 'a' }, 'b')).toEqual({
      kind: 'page',
      pageId: 'b',
    });
    expect(relinkToScreen({ kind: 'url', url: 'https://x.test' }, 'b')).toEqual({
      kind: 'page',
      pageId: 'b',
    });
    expect(relinkToScreen(undefined, 'b')).toEqual({ kind: 'page', pageId: 'b' });
  });
});

describe('showsScreenLinkHandle', () => {
  const base = (element: Element | undefined, canLink: (el: Element) => boolean) => ({
    element,
    multiSelected: false,
    editing: false,
    menuOpen: false,
    paintMode: false,
    tabLocked: false,
    canLink,
    pages: laid,
    elements: element ? [element] : [],
  });
  const editor = resolveEditorCapabilities({ level: 'edit', adderKey: null });
  const participant = resolveEditorCapabilities({ level: 'participate', adderKey: ME });
  const viewer = resolveEditorCapabilities({ level: 'view', adderKey: ME });

  it('shows for an Editor on any element, locked included', () => {
    expect(showsScreenLinkHandle(base(onPage(0), editor.linkScreens))).toBe(true);
    expect(showsScreenLinkHandle(base(onPage(0, { locked: true }), editor.linkScreens))).toBe(true);
  });

  it('shows for a Participant on its own unlocked element only', () => {
    const own = onPage(0, { addedBy: ME });
    expect(showsScreenLinkHandle(base(own, participant.linkScreens))).toBe(true);
    expect(showsScreenLinkHandle(base(onPage(0), participant.linkScreens))).toBe(false);
    const ownLocked = onPage(0, { addedBy: ME, locked: true });
    expect(showsScreenLinkHandle(base(ownLocked, participant.linkScreens))).toBe(false);
  });

  it('never shows for a Viewer', () => {
    const own = onPage(0, { addedBy: ME });
    expect(showsScreenLinkHandle(base(own, viewer.linkScreens))).toBe(false);
  });

  it('hides while editing, a menu, paint, a lock, a multi-selection or no permission check', () => {
    const el = onPage(0);
    const can = editor.linkScreens;
    for (const flag of ['multiSelected', 'editing', 'menuOpen', 'paintMode', 'tabLocked'] as const)
      expect(showsScreenLinkHandle({ ...base(el, can), [flag]: true }), flag).toBe(false);
    expect(showsScreenLinkHandle({ ...base(el, can), canLink: undefined })).toBe(false);
    expect(showsScreenLinkHandle(base(undefined, can))).toBe(false);
  });

  it('needs two screens, a wireframe page under the element, and a boxed element', () => {
    const el = onPage(0);
    const can = editor.linkScreens;
    expect(showsScreenLinkHandle({ ...base(el, can), pages: laid.slice(0, 1) })).toBe(false);
    expect(showsScreenLinkHandle({ ...base(el, can), pages: null })).toBe(false);
    const logo = layOutPages([
      { id: 'l1', orientation: 'portrait', kind: 'logo' },
      { id: 'l2', orientation: 'portrait', kind: 'logo' },
    ]);
    const onLogo = {
      ...createShape('square', logo[0]!.rect.x + 5, logo[0]!.rect.y + 5),
      id: 'x',
    } as Element;
    expect(showsScreenLinkHandle({ ...base(onLogo, can), pages: logo })).toBe(false);
    const off = { ...createShape('square', -5000, -5000), id: 'off' } as Element;
    expect(showsScreenLinkHandle(base(off, can))).toBe(false);
    const arrow = {
      id: 'arrow',
      type: 'arrow',
      from: { x: 0, y: 0 },
      to: { x: 10, y: 10 },
    } as unknown as Element;
    expect(showsScreenLinkHandle(base(arrow, can))).toBe(false);
  });
});
