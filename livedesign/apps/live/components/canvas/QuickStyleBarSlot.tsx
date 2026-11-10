'use client';

// A page's place for the Quick Style bar (docs/specs/008-canvas/quick-style-panel.md "Where it sits"): in its
// title-bar row, just left of the title bar. Empty and boxless (`contents`) until the bar portals in, so it takes no
// room and no gap while the bar is elsewhere.
import { useLayoutEffect, useState } from 'react';
import { clearQuickStyleBarSlot, setQuickStyleBarSlot } from '@/lib/quick-style-bar-slots';

export function QuickStyleBarSlot({ pageId, named }: { pageId: string; named: boolean }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!el) return;
    setQuickStyleBarSlot(pageId, { el, named });
  }, [el, pageId, named]);
  useLayoutEffect(() => {
    if (!el) return;
    return () => clearQuickStyleBarSlot(pageId, el);
  }, [el, pageId]);
  return <div ref={setEl} data-quick-style-bar-slot="" className="contents" />;
}
