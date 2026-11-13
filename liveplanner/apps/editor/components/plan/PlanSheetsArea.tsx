'use client';

// The card panel, type editor and required fields, behind their own error boundary (docs/specs/026-plan/plan-board.md
// "A panel that fails to draw closes"). A failure there once left the boundary drawing nothing while the card stayed
// open, so every card clicked after it changed the address and opened nothing until a reload. Its usual cause was a
// release made while the plan was open: the panel's code, loaded on first open, was a chunk the release had removed.
// Now that code is fetched at idle (EDITOR_SURFACE_CODE), and a failure closes what was open, says why, and lets the
// next click mount the panel afresh.
import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { isChunkLoadError } from '@liveworkspace/workbench/lib/stale-chunks';
import { AreaErrorBoundary } from '@/components/primitives/AreaErrorBoundary';
import type { PlanSlice } from '@/hooks/plan/usePlanSlice';
import { loadPlanSheetsHost } from '@/lib/editor-deferred-code';

// Plan's UI loads only when it is drawn (docs/specs/026-plan/plan-mode.md "Cost"), its code fetched at idle.
const PlanSheetsHost = dynamic(loadPlanSheetsHost, { ssr: false });

export const PANEL_FAILED_TEXT = 'Couldn’t open that card. Try again.';
// A chunk the page could not load: a newer release is out (or the connection went), and only a reload helps.
export const PANEL_STALE_TEXT = 'Couldn’t open that card. Reload the page to open cards again.';

export function PlanSheetsArea({ plan }: { plan: PlanSlice }) {
  const { closeItem, closeTypeEditor, settleRequiredFields, requiredFields } = plan;
  const notify = plan.context.notify;
  const onError = useCallback(
    (error: unknown) => {
      closeItem();
      closeTypeEditor();
      if (requiredFields) settleRequiredFields(null);
      notify?.(isChunkLoadError(error) ? PANEL_STALE_TEXT : PANEL_FAILED_TEXT);
    },
    [closeItem, closeTypeEditor, settleRequiredFields, requiredFields, notify],
  );
  return (
    <AreaErrorBoundary area="Modals" onError={onError}>
      <PlanSheetsHost plan={plan} />
    </AreaErrorBoundary>
  );
}
