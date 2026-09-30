import { useEffect, useEffectEvent } from 'react';
import { consumeQuickStartPending } from '@/lib/quick-start-pending';

// /new?blank=1&quickstart=1 (docs/specs/007-editor/new-document-route.md): the marketing hero's launch
// window grows into a blank document with Quick Start open. /new leaves a
// one-shot flag across the in-place handoff; this opens the picker the first
// time the document is loaded, editable and its active tab empty (the same
// gate the empty-canvas banner's Quick Start button sits behind), and the
// flag is consumed so a reload lands on the plain canvas.
export function useQuickStartHandoff(opts: {
  ready: boolean;
  activeTabEmpty: boolean;
  openTemplatePicker: () => void;
}) {
  const { ready, activeTabEmpty } = opts;
  const open = useEffectEvent(opts.openTemplatePicker);
  useEffect(() => {
    if (!ready || !activeTabEmpty) return;
    if (consumeQuickStartPending()) open();
  }, [ready, activeTabEmpty]);
}
