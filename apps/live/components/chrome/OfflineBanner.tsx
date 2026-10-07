'use client';

import { useOnline } from '@/hooks/ui/useOnline';
import { TopCenterBanner, TopCenterRow } from './TopCenter';

// The editor's offline banner (docs/specs/007-editor/load-recovery.md "Offline"), first in the
// top-centre stack while the browser says it is offline. Changes are held in memory, not stored, so
// the copy says "in this tab": closing it while offline loses them.
export function OfflineBanner({ readOnly }: { readOnly: boolean }) {
  const online = useOnline();
  if (online) return null;
  return (
    <TopCenterRow>
      <TopCenterBanner tone="neutral" className="gap-2 px-3 py-1 text-[11px] font-medium">
        <span role="status" className="flex items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
          {readOnly
            ? 'You’re offline. You’ll see changes when you reconnect.'
            : 'You’re offline. Changes stay in this tab and save when you reconnect.'}
        </span>
      </TopCenterBanner>
    </TopCenterRow>
  );
}
