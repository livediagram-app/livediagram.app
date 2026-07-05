'use client';

// The canvas's visually-hidden polite live region (spec/71). Renders
// whatever lib/announcer last broadcast; screen readers speak it,
// sighted users never see it. `aria-atomic` so a changed message is
// read whole; the alternating no-break-space suffix forces DOM change
// (and therefore re-announcement) when the same message repeats.

import { useSyncExternalStore } from 'react';
import {
  getAnnouncementSnapshot,
  getServerAnnouncementSnapshot,
  subscribeAnnouncements,
} from '@/lib/announcer';

export function CanvasLiveRegion() {
  const { message, nonce } = useSyncExternalStore(
    subscribeAnnouncements,
    getAnnouncementSnapshot,
    getServerAnnouncementSnapshot,
  );
  return (
    <div aria-live="polite" aria-atomic="true" role="status" className="sr-only">
      {message}
      {nonce % 2 === 1 ? ' ' : ''}
    </div>
  );
}
