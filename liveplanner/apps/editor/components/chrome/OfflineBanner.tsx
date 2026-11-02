'use client';

import { useSyncExternalStore } from 'react';
import { useOnline } from '@liveworkspace/workbench/hooks/ui/useOnline';
import { useSaveFailing } from '@liveworkspace/workbench/lib/save-health';
import { subscribeWaitingChanges, waitingChangeCount } from '@/lib/offline-queue/plan-queue';
import { TopCenterBanner, TopCenterRow } from './TopCenter';

const noneWaiting = () => 0;

// "1 change waits" / "3 changes wait": the queue's length (docs/specs/007-editor/offline-changes.md).
export function waitingCopy(online: boolean, count: number): string {
  if (online)
    return `Saving ${count === 1 ? '1 change' : `${count} changes`} made without a connection.`;
  return count === 1
    ? 'You’re offline. 1 change waits in this browser and saves when you reconnect.'
    : `You’re offline. ${count} changes wait in this browser and save when you reconnect.`;
}

// The editor's offline banner (docs/specs/007-editor/load-recovery.md "Offline"), first in the top-centre stack while
// the browser says it is offline. Card and sheet changes that wait for the connection are kept in this browser and
// counted (offline-changes.md "What the person sees"), shown also while they are being sent; anything else is held
// in memory, so the plain copy says "in this tab". Online, it says so while the last save failed and waits on its
// retry ("A failing save stays on screen"), so the gaps between the failure toasts are not silent.
export function OfflineBanner({ readOnly }: { readOnly: boolean }) {
  const online = useOnline();
  const saveFailing = useSaveFailing();
  const waiting = useSyncExternalStore(subscribeWaitingChanges, waitingChangeCount, noneWaiting);
  if (online && waiting === 0 && (readOnly || !saveFailing)) return null;
  const copy =
    online && saveFailing && !readOnly
      ? 'Couldn’t save your changes. Retrying, so keep this tab open.'
      : waiting > 0
        ? waitingCopy(online, waiting)
        : readOnly
          ? 'You’re offline. You’ll see changes when you reconnect.'
          : 'You’re offline. Changes stay in this tab and save when you reconnect.';
  return (
    <TopCenterRow>
      <TopCenterBanner tone="neutral" className="gap-2 px-3 py-1 text-[11px] font-medium">
        <span role="status" className="flex items-center gap-2">
          {copy}
        </span>
      </TopCenterBanner>
    </TopCenterRow>
  );
}
