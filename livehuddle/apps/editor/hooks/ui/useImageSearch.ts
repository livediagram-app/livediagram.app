'use client';

// The image picker's Search tab state (docs/specs/009-elements/blueprints/image-search.md): the workbench's hook,
// bound once to this editor's telemetry and import session.
import { createImageSearch } from '@liveworkspace/workbench/hooks/ui/useImageSearch';
import { track } from '@/lib/telemetry';

export const useImageSearch = createImageSearch({
  track,
  // The pipeline's browser half is DOM-heavy; load it on first pick.
  openImportSession: async (ids) =>
    (await import('@/lib/import-images/browser')).createBrowserImportImageSession(ids),
});
