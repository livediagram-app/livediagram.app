// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, newPhotoPage, photoOfPage, type Tab } from '@livedesign/design';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { track } from '@/lib/telemetry';
import type { PagesModeView } from './usePagesMode';
import { usePhotoEditor } from './usePhotoEditor';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/031-photo/photo-pages.md "Making sizes" and "Share roles": Make Sizes is an Editor's who may add
// pages; Participants and Viewers get no way to it. One edit adds every size after its source page.
afterEach(cleanup);

function setup({ canEdit = true, addPhotoPage = true } = {}) {
  // A photo tab with one photo page.
  let tabs: Tab[] = [
    {
      id: 't',
      elements: [],
      pages: [newPhotoPage('src')],
      photos: { src: { width: 4, height: 2, layers: [] } },
    } as unknown as Tab,
  ];
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const focusPage = vi.fn();
  const view = {
    focusPage,
    edit: addPhotoPage ? { addPhotoPage: vi.fn() } : {},
  } as unknown as PagesModeView;
  const hook = renderHook(
    ({ tab }: { tab: Tab }) =>
      usePhotoEditor({
        pagesModeView: view,
        // Laid out without a photo kind, so the engine is not fetched.
        pages: layOutPages(tab.pages as never).map((p) => ({ ...p, kind: undefined })),
        activeTab: tab,
        commitTabs,
        tickTabs: vi.fn(),
        markCheckpoint: vi.fn(),
        cancelToCheckpoint: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        depth: 0,
        visibleRect: () => null,
        viewport: createViewportStore(1),
        scope: null,
        canEdit,
        canInspect: canEdit,
        presence: { publish: vi.fn(), on: () => [] },
        toast: { warning: vi.fn(), action: vi.fn() } as never,
      }),
    { initialProps: { tab: tabs[0]! } },
  );
  return { hook, tabs: () => tabs, commitTabs, focusPage };
}

describe('Make Sizes in the editor', () => {
  it('is offered only to an Editor who may add pages', () => {
    expect(setup().hook.result.current.photo.addSizes).toBeTypeOf('function');
    // A Participant or a Viewer: no edit rights.
    expect(setup({ canEdit: false }).hook.result.current.photo.addSizes).toBeUndefined();
    // No adding pages (a locked tab, the page limit).
    expect(setup({ addPhotoPage: false }).hook.result.current.photo.addSizes).toBeUndefined();
    // Without a scope there is no export from the toast.
    expect(setup().hook.result.current.photo.exportAllSizes).toBeUndefined();
  });

  it('adds every size after its source in one edit and goes to the first', () => {
    const { hook, tabs, commitTabs, focusPage } = setup();
    expect(hook.result.current.photo.photoRoom).toBe(10);
    const made = [
      { id: 'n1', name: 'Instagram Post', photo: { width: 1080, height: 1350, layers: [] } },
      { id: 'n2', name: 'X Post', photo: { width: 1600, height: 900, layers: [] } },
    ];
    let ok = false;
    act(() => {
      ok = hook.result.current.photo.addSizes!('src', made);
    });
    expect(ok).toBe(true);
    expect(commitTabs).toHaveBeenCalledOnce();
    expect(tabs()[0]!.pages!.map((p) => [p.id, p.name])).toEqual([
      ['src', undefined],
      ['n1', 'Instagram Post'],
      ['n2', 'X Post'],
    ]);
    expect(photoOfPage(tabs()[0]!, 'n2')).toMatchObject({ width: 1600, height: 900 });
    expect(track).toHaveBeenCalledWith('Tab', 'Changed', 'PhotoMakeSizes');
    hook.rerender({ tab: tabs()[0]! });
    expect(focusPage).toHaveBeenCalledWith('n1');
    // Refused (an unknown source, or nothing to add): nothing written.
    act(() => {
      ok = hook.result.current.photo.addSizes!('gone', made);
    });
    expect(ok).toBe(false);
    act(() => {
      ok = hook.result.current.photo.addSizes!('src', []);
    });
    expect(ok).toBe(false);
    expect(commitTabs).toHaveBeenCalledOnce();
  });
});
