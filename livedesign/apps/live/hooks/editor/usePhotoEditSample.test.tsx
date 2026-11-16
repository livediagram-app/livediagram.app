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

afterEach(() => {
  cleanup();
  apply.mockClear();
  asked.clear();
});

const tab = { id: 'tab-1', name: 'Photo Edit', elements: [] } as Tab;

describe('usePhotoEditSample', () => {
  it('sets the sample on the asked-for tab, through the queue and a tab edit', async () => {
    asked.add('tab-1');
    let tabs: Tab[] = [tab, { ...tab, id: 'other' }];
    const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
      tabs = map(tabs);
    });
    renderHook(() =>
      usePhotoEditSample({ activeTab: tab, commitTabs, ready: true, canEdit: true }),
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
  });

  it('does nothing before the store is reachable, for someone who may not edit, or for a tab not asked for', () => {
    asked.add('tab-1');
    const commitTabs = vi.fn();
    renderHook(() =>
      usePhotoEditSample({ activeTab: tab, commitTabs, ready: false, canEdit: true }),
    );
    renderHook(() =>
      usePhotoEditSample({ activeTab: tab, commitTabs, ready: true, canEdit: false }),
    );
    asked.clear();
    renderHook(() =>
      usePhotoEditSample({ activeTab: tab, commitTabs, ready: true, canEdit: true }),
    );
    expect(apply).not.toHaveBeenCalled();
  });
});
