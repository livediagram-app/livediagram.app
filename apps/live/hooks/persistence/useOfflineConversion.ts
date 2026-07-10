'use client';

import { useState } from 'react';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { saveOfflineToCloud, takeCloudOffline } from '@/lib/offline/offline-convert';

// Shared Offline Mode conversion handlers (spec/76) for the Explorer's row and
// card menus, which otherwise duplicated this logic. `syncToCloud` uploads an
// offline diagram to the account; `takeOffline` pulls a cloud diagram down and
// deletes the server copy (gated by a confirm). Both reload afterwards so the
// list reflects the move, and `converting` guards against a double-trigger.
// `close` runs first to dismiss the caller's menu.
export function useOfflineConversion(
  diagram: { id: string; name: string; shareCode?: string | null },
  ownerId: string | null,
  close: () => void,
) {
  const confirm = useConfirm();
  const [converting, setConverting] = useState(false);

  const syncToCloud = async () => {
    if (!ownerId || converting) return;
    close();
    setConverting(true);
    try {
      await saveOfflineToCloud(diagram.id, ownerId);
      window.location.reload();
    } catch {
      setConverting(false); // stays offline
    }
  };

  const takeOffline = async () => {
    if (!ownerId || converting) return;
    close();
    const ok = await confirm({
      title: `Take “${diagram.name}” offline?`,
      message:
        'This removes it from your account and every other device. It will exist only in this browser, with no backup.',
      confirmLabel: 'Take Offline',
      variant: 'danger',
    });
    if (!ok) return;
    setConverting(true);
    try {
      await takeCloudOffline(diagram.id, ownerId, diagram.shareCode ?? null);
      window.location.reload();
    } catch {
      setConverting(false); // stays on server
    }
  };

  return { syncToCloud, takeOffline, converting };
}
