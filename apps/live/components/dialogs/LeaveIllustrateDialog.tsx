'use client';

// Leaving Illustrate on a tab with articles (docs/specs/007-editor/article-pages.md "Leaving
// Illustrate"): turn the articles into Page elements, keep them as articles, or stay.
import { useEffect, useRef } from 'react';
import { editorModeLabel } from '@livediagram/document';
import { Button } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogFooter } from '@/components/dialogs/DialogFooter';
import type { LeaveIllustrate } from '@/hooks/editor/useLeaveIllustrate';

export function LeaveIllustrateDialog({ leave }: { leave: LeaveIllustrate }) {
  const convertRef = useRef<HTMLButtonElement>(null);
  const open = leave.pending !== null;
  useEffect(() => {
    if (open) convertRef.current?.focus();
  }, [open]);
  const mode = leave.pending ? editorModeLabel(leave.pending) : '';
  return (
    <Dialog open={open} onClose={leave.cancel} titleId="leave-illustrate-title">
      <div className="border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-800">
        <h2
          id="leave-illustrate-title"
          className="text-lg font-semibold text-slate-900 dark:text-slate-50"
        >
          Turn Articles Into Pages?
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {mode} mode does not show the writing on article pages. Turn each article page into a Page
          you can keep writing in on the canvas, or keep them as articles to come back to in
          Illustrate.
        </p>
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={leave.cancel}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={leave.keep}>
          Keep as Articles
        </Button>
        <Button ref={convertRef} variant="primary" onClick={leave.convert}>
          Turn Into Pages
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
