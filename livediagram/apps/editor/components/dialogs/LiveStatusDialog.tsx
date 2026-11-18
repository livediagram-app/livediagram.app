'use client';

import { useId, useState } from 'react';
import { Button, DialogCloseButton, DialogHeader, TextInput } from '@livediagram/ui';
import type { ServiceStatus } from '@livediagram/api-schema';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { ServiceStatusPill } from '@/components/canvas/ServiceStatusBadge';
import { readStatusUrlInput } from '@/lib/live-status-input';
import { serviceStatusCopy } from '@/lib/service-status-copy';

// The Editor's Live Status dialog (docs/specs/009-elements/live-status.md "The Live Status dialog"): binds a shape to
// a public https status URL, checked as it is typed against the same rules the document's validation holds it to.
// Save writes it, Remove takes it off, each one undo step; Cancel and Escape change nothing.

export function LiveStatusDialog({
  url,
  status,
  now,
  onSave,
  onRemove,
  onClose,
}: {
  // The shape's binding, absent when unbound.
  url: string | undefined;
  // The room's latest check of it, when there is one.
  status: ServiceStatus | undefined;
  now: number;
  onSave: (url: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(url ?? '');
  const read = readStatusUrlInput(draft);
  const refusal = !read.ok && read.error !== 'empty' ? read.message : null;
  const messageId = useId();
  const fieldId = useId();
  const current = url !== undefined && status ? serviceStatusCopy(status, url, now) : null;

  const save = () => {
    if (!read.ok) return;
    if (read.url !== url) onSave(read.url);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} ariaLabel="Live Status" size="md">
      <DialogHeader
        title="Live Status"
        subtitle="Show whether the service this shape stands for is up. While the canvas is open, it's checked about once a minute."
      >
        <HelpArticleLink size="md" article="liveStatus" />
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="flex flex-col gap-2 px-6 py-4">
        <label htmlFor={fieldId} className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Status URL
        </label>
        <TextInput
          id={fieldId}
          type="url"
          inputMode="url"
          autoFocus
          spellCheck={false}
          value={draft}
          placeholder="https://status.example.com/api/v2/status.json"
          aria-invalid={refusal !== null}
          aria-describedby={messageId}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            }
          }}
        />
        <p
          id={messageId}
          className={
            refusal
              ? 'text-[11px] font-medium text-rose-600 dark:text-rose-400'
              : 'text-[11px] text-slate-600 dark:text-slate-400'
          }
        >
          {refusal ??
            'A Statuspage status.json, a health check, or any https page that answers when the service is up. Anyone who can open this canvas can read the address, so never put a key or token in it.'}
        </p>
        {current ? (
          <div
            data-live-status-current=""
            className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
          >
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Now</span>
            <ServiceStatusPill copy={current} />
            <span className="min-w-0 truncate text-xs text-slate-600 dark:text-slate-400">
              {current.detail}
            </span>
          </div>
        ) : null}
      </div>
      <DialogFooter>
        {url !== undefined ? (
          <Button
            variant="ghost"
            className="mr-auto"
            onClick={() => {
              onRemove();
              onClose();
            }}
          >
            Remove
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!read.ok}>
          Save
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
