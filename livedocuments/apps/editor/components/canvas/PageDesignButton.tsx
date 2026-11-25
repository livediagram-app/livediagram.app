'use client';

// A page's Design opener (docs/specs/007-editor/pages-mode.md "Beside the cog"): nothing drawn in the title bar since
// Style moved by the zoom (owner, 2026-11-25), it opens Tab Style when the page's Appearance sheet asks for Design on
// a phone.
import { useEffect, useRef } from 'react';
import { openTabStyleFrom, useTabStyleOpen } from '@/lib/tab-style-opener';
import { track } from '@/lib/telemetry';

export function PageDesignButton({ openRequest = 0 }: { openRequest?: number }) {
  const open = useTabStyleOpen();
  const seen = useRef(openRequest);
  useEffect(() => {
    if (openRequest === seen.current) return;
    seen.current = openRequest;
    if (!open) return;
    track('UI', 'Opened', 'PageDesignButton');
    openTabStyleFrom(null, 'design');
  }, [openRequest, open]);
  return null;
}
