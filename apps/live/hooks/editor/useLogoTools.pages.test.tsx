// @vitest-environment jsdom

// Show Guides and Mirror While Drawing are per page (docs/specs/007-editor/logo-pages.md).
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MirrorSettings, Tab } from '@livediagram/document';
import { readLogoPageGuides } from '@/lib/logo-page-guides';
import { useLogoTools } from './useLogoTools';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/combine/combine', () => ({ preloadCombineEngine: vi.fn() }));

afterEach(() => localStorage.clear());

function setup(prefs = {}, readOnly = false) {
  const mirrorRef = { current: new Map() as ReadonlyMap<string, MirrorSettings> };
  const hook = renderHook(() =>
    useLogoTools({
      mirrorRef,
      prefs,
      applyPrefs: vi.fn(),
      activeTab: { id: 't', elements: [] } as unknown as Tab,
      pages: null,
      currentSelectionIds: () => new Set(),
      commit: vi.fn(),
      setSelectedId: vi.fn(),
      setMultiSelectedIds: vi.fn(),
      readOnly,
    }),
  );
  return { hook, mirrorRef };
}

describe('useLogoTools per page', () => {
  it('turns one page’s guides off, the others following the setting, and remembers it', () => {
    const { hook } = setup();
    expect(hook.result.current.guidesOn('a')).toBe(true);
    act(() => hook.result.current.setGuides('a', false));
    expect(hook.result.current.guidesOn('a')).toBe(false);
    expect(hook.result.current.guidesOn('b')).toBe(true);
    expect(readLogoPageGuides()).toEqual({ 't:a': false });
    // The setting off: a page with no choice of its own follows it.
    const off = setup({ logoGuides: false });
    expect(off.hook.result.current.guidesOn('b')).toBe(false);
    expect(off.hook.result.current.guidesOn('a')).toBe(false);
  });

  it('mirrors one page, and hands the draw commits only the mirrored pages', () => {
    const { hook, mirrorRef } = setup();
    act(() => hook.result.current.setMirror('a', true));
    expect(hook.result.current.mirrorOn('a')).toBe(true);
    expect(hook.result.current.mirrorOn('b')).toBe(false);
    expect([...mirrorRef.current.keys()]).toEqual(['a']);
    act(() => hook.result.current.setMirror('a', false));
    expect(mirrorRef.current.size).toBe(0);
  });

  it('keeps each page its own mirror settings, a new page starting from the last chosen', () => {
    const { hook, mirrorRef } = setup();
    // Choosing an axis turns the page's mirror on with it.
    act(() => hook.result.current.setMirrorSettings('a', { axis: 'radial' }));
    expect(hook.result.current.mirrorOn('a')).toBe(true);
    act(() => hook.result.current.setMirrorSettings('a', { copies: 4, merge: false }));
    expect(mirrorRef.current.get('a')).toEqual({ axis: 'radial', copies: 4, merge: false });
    // Another page starts from them; changing it leaves page a as it was.
    expect(hook.result.current.mirrorSettings('b')).toEqual({
      axis: 'radial',
      copies: 4,
      merge: false,
    });
    act(() => hook.result.current.setMirror('b', true));
    act(() => hook.result.current.setMirrorSettings('b', { axis: 'horizontal' }));
    expect(mirrorRef.current.get('a')!.axis).toBe('radial');
    expect(mirrorRef.current.get('b')!.axis).toBe('horizontal');
    // Off and on again, a page keeps what it had.
    act(() => hook.result.current.setMirror('a', false));
    act(() => hook.result.current.setMirror('a', true));
    expect(mirrorRef.current.get('a')!.axis).toBe('radial');
  });

  it('mirrors nothing for a viewer', () => {
    const { hook, mirrorRef } = setup({}, true);
    act(() => hook.result.current.setMirror('a', true));
    expect(mirrorRef.current.size).toBe(0);
  });
});

const tab = (id: string) => ({ id, name: id, elements: [] }) as unknown as Tab;

function render(activeTab: Tab) {
  const mirrorRef = { current: new Map<string, MirrorSettings>() };
  return renderHook(
    ({ activeTab }: { activeTab: Tab }) =>
      useLogoTools({
        mirrorRef,
        prefs: {},
        applyPrefs: vi.fn(),
        activeTab,
        pages: null,
        currentSelectionIds: () => new Set(),
        commit: () => {},
        setSelectedId: () => {},
        setMultiSelectedIds: () => {},
        readOnly: false,
      }),
    { initialProps: { activeTab } },
  );
}

// docs/specs/007-editor/logo-pages.md: page ids repeat across tabs ('page-1'), so a page's
// Show Guides and Mirror stay with the tab they were chosen on.
describe('useLogoTools across tabs', () => {
  it("keeps a page's Show Guides to its own tab", () => {
    const { result, rerender } = render(tab('a'));
    act(() => result.current.setGuides('page-1', false));
    expect(result.current.guidesOn('page-1')).toBe(false);
    rerender({ activeTab: tab('b') });
    expect(result.current.guidesOn('page-1')).toBe(true);
    rerender({ activeTab: tab('a') });
    expect(result.current.guidesOn('page-1')).toBe(false);
  });

  it('lets go of Mirror when another tab opens', () => {
    const { result, rerender } = render(tab('a'));
    act(() => result.current.setMirror('page-1', true));
    expect(result.current.mirrorOn('page-1')).toBe(true);
    rerender({ activeTab: tab('b') });
    expect(result.current.mirrorOn('page-1')).toBe(false);
    expect(result.current.mirrorPages.size).toBe(0);
  });
});
