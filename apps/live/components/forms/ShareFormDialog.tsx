'use client';

// Share Form (docs/specs/030-forms/forms.md "Publishing and the form link"), separate from the document's Share
// dialog: a form link grants nothing on the document. Unpublished, it explains and offers Publish Form (held back,
// with the reason, while responses have nowhere to go). Published, it shows the link to copy or open, Accepting
// Responses, and Delete Link, which asks first.
import { useId, useState } from 'react';
import { Button, Dialog, DialogCloseButton, DialogHeader } from '@livediagram/ui';
import { DESTINATION_PROBLEM_TEXT, type DestinationProblem } from '@livediagram/forms';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { SwitchRow } from '@/components/primitives/SwitchRow';
import type { FormLinkState } from '@/hooks/forms/useFormLink';
import { formUrlFor } from '@/lib/form-path';

export function ShareFormDialog({
  open,
  onClose,
  link,
  problem,
  onFixDestination,
}: {
  open: boolean;
  onClose: () => void;
  link: FormLinkState;
  problem: DestinationProblem | null;
  onFixDestination: () => void;
}) {
  const titleId = useId();
  const [copied, setCopied] = useState(false);
  const [confirmAt, setConfirmAt] = useState<HTMLElement | null>(null);
  const live = link.link?.link ?? null;
  const url = live?.code ? formUrlFor(window.location.origin, live.code) : null;
  const suspended = !live && link.link?.suspendedAt;
  const canPublish = link.link?.canPublish !== false;
  return (
    <Dialog open={open} onClose={onClose} titleId={titleId} size="md" phoneSheet>
      <div id={titleId} className="sr-only">
        Share Form
      </div>
      <DialogHeader
        title="Share Form"
        subtitle="Anyone with the link can fill in this form. They won’t see your document."
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="flex flex-col gap-4 px-6 pb-6 pt-4">
        {link.status === 'offline' ? (
          <p className="text-[14px] text-slate-600 dark:text-slate-300">
            Forms are published from documents saved to livediagram. This one is kept on this device
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
                className="py-1 text-[14px] font-medium"
              >
                Accepting Responses
              </SwitchRow>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">
                {live.open
                  ? `${link.link?.responses ?? 0} ${link.link?.responses === 1 ? 'response' : 'responses'} so far.`
                  : 'Closed: people who open the link see your closed message.'}
              </p>
            </div>
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
                This document can’t publish more forms: its form links were suspended after reports.
              </p>
            ) : problem ? (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
                <p>Responses have nowhere to go yet. {DESTINATION_PROBLEM_TEXT[problem]}</p>
                <button
                  type="button"
                  onClick={onFixDestination}
                  className="mt-1 cursor-pointer font-semibold underline underline-offset-2"
                >
                  Choose Where Responses Go
                </button>
              </div>
            ) : (
              <p className="text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
                Publishing makes a link you can send to anyone. Each response becomes a card on your
                board, and you can close the form at any time.
              </p>
            )}
            <div className="flex justify-end">
              <Button
                disabled={!!problem || !canPublish || link.busy || link.status !== 'ready'}
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
