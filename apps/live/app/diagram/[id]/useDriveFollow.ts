'use client';

// The open editor follows a change made in Google Drive
// (docs/specs/022-drive-mirror/drive-mirror.md, "Other views follow"): its
// Explorer panel and folder chips re-read, its title takes a rename, and a
// move to the Trash shows the deleted card.

import { useAfterDriveChange } from '@/hooks/persistence/useAfterDriveChange';
import { ApiError, apiLoadDiagram } from '@/lib/api-client';

export function useDriveFollow(opts: {
  ownerId: string | null;
  diagramId: string | null;
  enabled: boolean;
  refreshDiagramList: (ownerId: string) => void;
  setDiagramName: (name: string) => void;
  setDiagramTrashed: (trashed: boolean) => void;
  loadMeta?: (ownerId: string, diagramId: string) => Promise<{ name: string } | null>;
}): void {
  const { ownerId, diagramId, enabled } = opts;
  useAfterDriveChange(
    () => {
      if (!ownerId || !diagramId) return;
      opts.refreshDiagramList(ownerId);
      const load = opts.loadMeta ?? apiLoadDiagram;
      void load(ownerId, diagramId)
        .then((meta) => {
          if (meta?.name) opts.setDiagramName(meta.name);
        })
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 410) opts.setDiagramTrashed(true);
        });
    },
    enabled && !!ownerId && !!diagramId,
  );
}
