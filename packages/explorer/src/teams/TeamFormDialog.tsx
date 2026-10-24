'use client';

// New Team and Edit Team (livediagram's TeamFormModal): a name and an optional organisation. Made, the team opens;
// edited, the card reads it again. A refusal is said under the fields and the dialog stays.

import { useId, useState, type FormEvent } from 'react';
import { teamErrorMessage, type TeamResult } from '../data/teams';
import { Button } from '../ui/Button';
import { Dialog, DialogCloseButton, DialogFooter, DialogHeader } from '../ui/Dialog';
import { ORGANISATION_MAX, TEAM_NAME_MAX } from './rules';

export const TEAM_FIELD =
  'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export function TeamFormDialog({
  mode,
  initial,
  onSubmit,
  onClose,
}: {
  mode: 'create' | 'edit';
  initial?: { name: string; organisation: string | null };
  onSubmit: (input: { name: string; organisation: string | null }) => Promise<TeamResult<unknown>>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [organisation, setOrganisation] = useState(initial?.organisation ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();
  const orgId = useId();
  const title = mode === 'create' ? 'New Team' : 'Edit Team';
  const unchanged =
    mode === 'edit' &&
    name.trim() === (initial?.name ?? '') &&
    organisation.trim() === (initial?.organisation ?? '');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await onSubmit({
      name: name.trim(),
      organisation: organisation.trim() || null,
    });
    if (!result.ok) {
      setError(teamErrorMessage(result.error));
      setBusy(false);
    }
  }

  return (
    <Dialog onClose={onClose} ariaLabel={title} size="sm">
      <form onSubmit={(e) => void submit(e)} data-team-form={mode}>
        <DialogHeader
          title={title}
          subtitle={
            mode === 'create'
              ? 'A shared home for your work, the same team in every app.'
              : 'Saved in every app, for everyone in the team.'
          }
        >
          <DialogCloseButton onClick={onClose} />
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 py-4">
          <div>
            <label
              htmlFor={nameId}
              className="text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Team name
            </label>
            <input
              id={nameId}
              autoFocus
              required
              maxLength={TEAM_NAME_MAX}
              placeholder="Design"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${TEAM_FIELD} mt-1.5`}
            />
          </div>
          <div>
            <label
              htmlFor={orgId}
              className="text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Organisation <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id={orgId}
              maxLength={ORGANISATION_MAX}
              placeholder="Northwind Ltd"
              value={organisation}
              onChange={(e) => setOrganisation(e.target.value)}
              className={`${TEAM_FIELD} mt-1.5`}
            />
          </div>
          {error ? (
            <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={busy || !name.trim() || unchanged}>
            {mode === 'create' ? (busy ? 'Creating…' : 'Create Team') : busy ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
