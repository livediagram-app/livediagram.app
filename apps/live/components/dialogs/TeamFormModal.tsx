'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, TextInput } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { CloseIcon } from '@/components/primitives/CloseIcon';
import { DialogFooter } from '@/components/dialogs/DialogFooter';

// Create / edit form for a team (spec/32): name + organisation.
// Visual sibling of ConfirmDialog (same backdrop, fly-up animation,
// border/shadow stack, button rhythm) but with form fields, so it's
// its own component rather than a ConfirmDialog contortion. The
// caller owns open/close and the submit side-effects; `initial`
// switches it between "New team" and "Edit team" duty.

export function TeamFormModal({
  open,
  title,
  submitLabel,
  initial,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  title: string;
  submitLabel: string;
  initial?: { name: string; organisation: string | null };
  onSubmit: (values: { name: string; organisation: string | null }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [organisation, setOrganisation] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  // Re-seed the fields each time the modal opens: a reopened "New
  // team" must not show the previous attempt, and "Edit team" must
  // show the current values even after a prior edit.
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setOrganisation(initial?.organisation ?? '');
    nameRef.current?.focus();
  }, [open, initial]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      nameRef.current?.focus();
      return;
    }
    onSubmit({ name: trimmed, organisation: organisation.trim() || null });
  };

  return (
    <Dialog open={open} onClose={onCancel} titleId="team-form-title">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="border-b border-slate-100 px-6 pt-5 pb-5 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <h2
              id="team-form-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-50"
            >
              {title}
            </h2>
            {/* Help (the old inline "learn more" link, now an icon button) +
                an explicit close, sat together top-right. */}
            <div className="-mr-1.5 -mt-0.5 flex items-center gap-0.5">
              <HelpArticleLink
                article="teamRolesAndInvites"
                variant="icon"
                title="Teams"
                description="Admin and Member roles, and how invites work."
              />
              <button
                type="button"
                onClick={onCancel}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <CloseIcon size={16} />
              </button>
            </div>
          </div>
          {/* Concise "what teams do" primer so first-time creators know what
              they're setting up before naming it. */}
          <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
            Teams let you invite people by email and share a library of diagrams everyone can open.
            Members edit shared work; admins also manage who&rsquo;s in the team.
          </p>
          <label className="mt-4 block">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Team name
            </span>
            <TextInput
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Platform squad"
              maxLength={80}
              className="mt-1"
            />
          </label>
          <label className="mt-3 block">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Organisation <span className="normal-case text-slate-400">(optional)</span>
            </span>
            <TextInput
              value={organisation}
              onChange={(e) => setOrganisation(e.target.value)}
              placeholder="e.g. ACME Corp"
              maxLength={120}
              className="mt-1"
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim()}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
