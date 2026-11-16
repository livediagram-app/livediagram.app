'use client';

// The Photo Edit template's sample set on the tab it made (docs/specs/031-photo/photo-pages.md "The Photo Edit
// template"; lib/photo-template/photo-edit-sample-apply.ts): tried whenever the open tab changes, once the
// photo store can be reached and the person may edit. The sample's code and files load only when it was asked for.
import { useEffect } from 'react';
import type { Tab } from '@livedesign/design';
import {
  applyAskedPhotoEditSample,
  photoEditSampleAsked,
} from '@/lib/photo-template/photo-edit-sample-apply';
import { photoUploads } from '@/lib/photo-editor/upload-queue';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

export function usePhotoEditSample({
  activeTab,
  commitTabs,
  ready,
  canEdit,
}: {
  activeTab: Tab;
  commitTabs: (map: (tabs: Tab[]) => Tab[]) => void;
  // The photo store's transport is set.
  ready: boolean;
  canEdit: boolean;
}): void {
  const commitRef = useLatest(commitTabs);
  useEffect(() => {
    // A Set lookup and a session read on each change of the open tab; the rest only for the tab asked for.
    if (!ready || !canEdit || !photoEditSampleAsked(activeTab.id)) return;
    void applyAskedPhotoEditSample(activeTab, {
      load: () =>
        import('@/lib/photo-template/photo-edit-sample-load').then((m) => m.loadPhotoEditSample()),
      enqueue: (tabId, entries) => photoUploads.enqueue(tabId, entries),
      settled: (tabId) => photoUploads.whenSettled(tabId),
      commit: (tabId, map) =>
        commitRef.current((ts) => ts.map((t) => (t.id === tabId ? map(t) : t))),
    });
  }, [ready, canEdit, activeTab, commitRef]);
}
