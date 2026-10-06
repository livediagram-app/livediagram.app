'use client';

// Leaving Plan on a tab with content (docs/specs/026-plan/plan-mode.md "Plan keeps its own tabs"): the tab stays
// in Plan mode; the way on is a new tab in the mode asked for.
import { useEffect, useRef } from 'react';
import { editorModeLabel } from '@livediagram/document';
import { Button } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogFooter } from '@/components/dialogs/DialogFooter';
import type { LeavePlan } from '@/hooks/editor/useLeavePlan';

export function LeavePlanDialog({ leave }: { leave: LeavePlan }) {
  const newTabRef = useRef<HTMLButtonElement>(null);
  const open = leave.blocked !== null;
  useEffect(() => {
    if (open) newTabRef.current?.focus();
  }, [open]);
  const mode = leave.blocked ? editorModeLabel(leave.blocked) : '';
  // Going into Plan from another mode, or out of Plan (docs/specs/026-plan/plan-mode.md).
  const into = leave.blocked === 'plan';
  return (
    <Dialog open={open} onClose={leave.cancel} titleId="leave-plan-title">
      <div className="border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-800">
        <h2
          id="leave-plan-title"
          className="text-lg font-semibold text-slate-900 dark:text-slate-50"
        >
          {into ? 'Plan Mode Needs Its Own Tab' : 'This Tab Stays in Plan Mode'}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {into
            ? 'Boards and cards are worked on a tab of their own, so this tab keeps its mode and everything on it. Start a new tab to plan in.'
            : `A tab with something on it stays in Plan mode, so its boards and cards keep working. Start a new tab to work in ${mode} mode.`}
        </p>
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={leave.cancel}>
          Cancel
        </Button>
        <Button ref={newTabRef} variant="primary" onClick={leave.newTab}>
          Create a New Tab
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
