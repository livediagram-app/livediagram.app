'use client';

// Share Form (docs/specs/030-forms/forms.md "Publishing and the form link"), separate from the project's Share
// dialog: a form link grants nothing on the project. Unpublished, it explains and offers Publish Form (held back,
// with the reason, while responses have nowhere to go or the form is not ready: each problem listed with Show). Published, it shows the link to copy or open, Accepting
// Responses, and Delete Link, which asks first. On a project in This Browser it offers Sync Project first (the project
// Share dialog's prompt), then carries straight on to publishing as the project stops being offline.
import { useId, useState } from 'react';
import { Button, DialogCloseButton, DialogHeader, SwitchRow } from '@liveplanner/ui';
import type { DestinationProblem, PublishProblem } from '@liveplanner/forms';
import { SyncProjectPrompt } from '@/components/dialogs/SyncProjectPrompt';
// The editor's Dialog, so the modal guard counts it (shortcuts behind it go quiet, and the tours wait for it).
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { ConfirmPopover } from '@liveworkspace/workbench/components/primitives/ConfirmPopover';
import type { FormLinkState } from '@/hooks/forms/useFormLink';
import { formUrlFor } from '@/lib/form-path';
import { track } from '@/lib/telemetry';
import { FormProblems, formProblemCount } from './FormProblems';

export function ShareFormDialog({
  open,
  onClose,
  link,
  problem,
  onFixDestination,
  notReady = [],
  onShow,
  toSheet = false,
  onSyncToCloud,
  syncReady = true,
}: {
  open: boolean;
  onClose: () => void;
  link: FormLinkState;
  problem: DestinationProblem | null;
  onFixDestination: () => void;
  // What else stops publishing (publishProblems), and Show for a question's or section's.
  notReady?: readonly PublishProblem[];
  onShow?: (problem: PublishProblem) => void;
  // Responses go to a sheet (a row each) rather than a board.
  toSheet?: boolean;
  // A project in This Browser: syncs it in place (useSyncInPlace), once the reader is known (`syncReady`).
  onSyncToCloud?: () => Promise<void>;
  syncReady?: boolean;
}) {
  const titleId = useId();
  const [copied, setCopied] = useState(false);
  const [confirmAt, setConfirmAt] = useState<HTMLElement | null>(null);
  const live = link.link?.link ?? null;
  const url = live?.code ? formUrlFor(window.location.origin, live.code) : null;
  const suspended = !live && link.link?.suspendedAt;
  const canPublish = link.link?.canPublish !== false;
  // A project in This Browser syncs first; the publish view follows once it is on liveplanner.
  const syncFirst = link.status === 'offline' && !!onSyncToCloud;
  return (
    <Dialog open={open} onClose={onClose} titleId={titleId} size="md" phoneSheet>
      <div id={titleId} className="sr-only">
        Share Form
      </div>
      <DialogHeader
        title="Share Form"
        subtitle="Anyone with the link can fill in this form. They won’t see your plan."
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      {syncFirst && onSyncToCloud ? (
        <SyncProjectPrompt
          onSyncToCloud={() => {
            track('Form', 'Moved', 'SyncedToShare');
            return onSyncToCloud();
          }}
          ready={syncReady}
          message="It is saved only in this browser, so this form can’t be published yet. Sync it to liveplanner to publish it: the form link and its responses need it on our servers. You can take it offline again any time."
        />
      ) : (
        <div className="flex flex-col gap-4 px-6 pb-6 pt-4">
          {link.status === 'offline' ? (
            <p className="text-[14px] text-slate-600 dark:text-slate-300">
              Forms are published from plans saved to liveplanner. This one is kept on this device
              only.
            </p>
          ) : live && url ? (
            <>
              <div className="flex items-stretch gap-2 max-sm:flex-col">
                <input
                  readOnly
                  aria-label="Form link"
                  value={url}
                  onFocus={(e) => e.target.select()}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[13px] text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <Button
                  onClick={() => {
                    void navigator.clipboard?.writeText(url).then(() => {
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1800);
                    });
                  }}
                >
                  {copied ? 'Copied' : 'Copy Link'}
                </Button>
                <Button variant="secondary" onClick={() => window.open(url, '_blank', 'noopener')}>
                  Open
                </Button>
              </div>
              <span role="status" className="sr-only">
                {copied ? 'Link copied' : ''}
              </span>
              <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <SwitchRow
                  checked={live.open}
                  onChange={(on) => void link.setOpen(on)}
                  // Reopening waits on the problems listed below (forms.md "A live form is locked").
                  disabled={!live.open && formProblemCount(problem, notReady) > 0}
                  className="py-1 text-[14px] font-medium"
                >
                  Accepting Responses
                </SwitchRow>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">
                  {live.open
                    ? `${link.link?.responses ?? 0} ${link.link?.responses === 1 ? 'response' : 'responses'} so far.`
                    : formProblemCount(problem, notReady)
                      ? 'Closed until the problems below are fixed.'
                      : 'Closed: people who open the link see your closed message. Taking responses locks the form.'}
                </p>
              </div>
              {/* Still listed once published: a problem since then is the Editor's to fix. */}
              <FormProblems
                title="Problems with this Form"
                problem={problem}
                notReady={notReady}
                onFixDestination={onFixDestination}
                onShow={onShow}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={(e) => setConfirmAt(e.currentTarget)}
                  className="cursor-pointer text-[13px] font-medium text-red-700 hover:underline dark:text-red-400"
                >
                  Delete Link
                </button>
              </div>
            </>
          ) : (
            <>
              {suspended ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-900 dark:bg-red-500/10 dark:text-red-100">
                  This form’s link was suspended after reports from respondents. Publishing again
                  makes a new link.
                </p>
              ) : null}
              {!canPublish ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-900 dark:bg-red-500/10 dark:text-red-100">
                  This plan can’t publish more forms: its form links were suspended after reports.
                </p>
              ) : formProblemCount(problem, notReady) ? (
                <FormProblems
                  title="Before publishing:"
                  problem={problem}
                  notReady={notReady}
                  onFixDestination={onFixDestination}
                  onShow={onShow}
                />
              ) : (
                <p className="text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
                  Publishing makes a link you can send to anyone. Each response becomes{' '}
                  {toSheet ? 'a row in your sheet' : 'a card on your board'}, and you can close the
                  form at any time.
                </p>
              )}
              <div className="flex justify-end">
                <Button
                  disabled={
                    !!problem ||
                    notReady.length > 0 ||
                    !canPublish ||
                    link.busy ||
                    link.status !== 'ready'
                  }
                  onClick={() => void link.publish()}
                >
                  {link.busy ? 'Publishing…' : 'Publish Form'}
                </Button>
              </div>
            </>
          )}
          {link.error ? (
            <p role="alert" className="text-[13px] text-red-700 dark:text-red-400">
              {link.error}
            </p>
          ) : null}
        </div>
      )}
      {confirmAt ? (
        <ConfirmPopover
          anchor={confirmAt}
          message="Delete this link? People with it will see this form isn’t available. Publishing again makes a new link."
          confirmLabel="Delete Link"
          onConfirm={() => {
            setConfirmAt(null);
            void link.remove();
          }}
          onCancel={() => setConfirmAt(null)}
        />
      ) : null}
    </Dialog>
  );
}
