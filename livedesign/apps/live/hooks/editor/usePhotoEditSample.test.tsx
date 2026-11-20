// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedesign/design';

// docs/specs/031-photo/photo-pages.md "The Photo Edit template": the editor sets the sample on the tab it was asked
// for, once the photo store can be reached and the person may edit; its code loads only then.
const apply = vi.fn(async (..._a: unknown[]) => true);
const asked = new Set<string>();
vi.mock('@/lib/photo-template/photo-edit-sample-apply', () => ({
  applyAskedPhotoEditSample: (...a: unknown[]) => apply(...a),
  photoEditSampleAsked: (id: string) => asked.has(id),
}));
const loadSample = vi.fn(async () => null);
vi.mock('@/lib/photo-template/photo-edit-sample-load', () => ({ loadPhotoEditSample: loadSample }));
const enqueue = vi.fn();
const whenSettled = vi.fn(async () => {});
vi.mock('@/lib/photo-editor/upload-queue', () => ({ photoUploads: { enqueue, whenSettled } }));

const { usePhotoEditSample } = await import('./usePhotoEditSample');

const land = vi.fn();

afterEach(() => {
  cleanup();
  apply.mockClear();
  land.mockClear();
  asked.clear();
});

const tab = { id: 'tab-1', name: 'Photo Edit', elements: [] } as Tab;

describe('usePhotoEditSample', () => {
  it('sets the sample on the asked-for tab, through the queue and a tab edit', async () => {
    asked.add('tab-1');
    let tabs: Tab[] = [tab, { ...tab, id: 'other' }];
    const tickTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
      tabs = map(tabs);
    });
    renderHook(() =>
      usePhotoEditSample({ activeTab: tab, tickTabs, ready: true, canEdit: true, land }),
    );
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    const [given, deps] = apply.mock.calls[0] as [Tab, Record<string, (...a: never[]) => unknown>];
    expect(given).toBe(tab);
    await deps.load!();
    expect(loadSample).toHaveBeenCalled();
    deps.enqueue!('tab-1' as never, [] as never);
    expect(enqueue).toHaveBeenCalledWith('tab-1', []);
    await deps.settled!('tab-1' as never);
    expect(whenSettled).toHaveBeenCalledWith('tab-1');
    deps.commit!('tab-1' as never, ((t: Tab) => ({ ...t, name: 'Set' })) as never);
    expect(tabs.map((t) => t.name)).toEqual(['Set', 'Photo Edit']);
    // The sample's pages are another size than the page the template framed, so the tab is framed again.
    await waitFor(() => expect(land).toHaveBeenCalledTimes(1));
  });

  it('frames nothing when the sample was not set', async () => {
    asked.add('tab-1');
    apply.mockImplementationOnce(async () => false);
    renderHook(() =>
      usePhotoEditSample({ activeTab: tab, tickTabs: vi.fn(), ready: true, canEdit: true, land }),
    );
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(land).not.toHaveBeenCalled();
  });

  it('does nothing before the store is reachable, for someone who may not edit, or for a tab not asked for', () => {
    asked.add('tab-1');
    const tickTabs = vi.fn();
    renderHook(() =>
      usePhotoEditSample({ activeTab: tab, tickTabs, ready: false, canEdit: true, land }),
    );
    renderHook(() =>
      usePhotoEditSample({ activeTab: tab, tickTabs, ready: true, canEdit: false, land }),
    );
    asked.clear();
    renderHook(() =>
      usePhotoEditSample({ activeTab: tab, tickTabs, ready: true, canEdit: true, land }),
    );
    expect(apply).not.toHaveBeenCalled();
    expect(land).not.toHaveBeenCalled();
  });
});
