'use client';

// Save to Library (liveworkspace/docs/specs/006-media/libraries.md): a name, where it goes (Personal or one of the
// person's teams) and an optional folder, then Save. A quick question, so the plain header. A refusal stays in the
// dialog, in words, with what was typed kept.

import { useId, useState } from 'react';
import { Button, DialogFooter, DialogHeader, TextInput } from '@liveworkspace/ui';
import {
  LIBRARY_FOLDER_MAX,
  LIBRARY_TITLE_MAX,
  type LibraryItemSummary,
  type LibraryTeam,
} from '@liveworkspace/media';
import { Dialog } from '../dialogs/Dialog';
import { folderNames, PERSONAL_LABEL } from '../../lib/library/library-groups';
import { libraryErrorMessage } from '../../lib/library/library-api';
import { PersonalScopeIcon, TeamScopeIcon } from './library-icons';

export type SaveToLibraryChoice = {
  scope: 'personal' | 'team';
  teamId: string | null;
  title: string;
  folder: string;
};

type Destination = {
  key: string;
  scope: 'personal' | 'team';
  teamId: string | null;
  label: string;
  line: string;
};

function destinationsOf(teams: readonly LibraryTeam[]): Destination[] {
  return [
    { key: 'personal', scope: 'personal', teamId: null, label: PERSONAL_LABEL, line: 'Only you' },
    ...teams.map((t) => ({
      key: t.id,
      scope: 'team' as const,
      teamId: t.id,
      label: t.name,
      line:
        t.role === 'admin'
          ? 'Everyone in the team can place it. You can tidy it.'
          : 'Everyone in the team can place it. Admins tidy it.',
    })),
  ];
}

type SaveToLibraryProps = {
  open: boolean;
  // How many elements are being saved, for the line under the title.
  count: number;
  suggestedTitle: string;
  teams: readonly LibraryTeam[];
  // What the Library holds now, for each destination's folder suggestions.
  items: readonly LibraryItemSummary[];
  onClose: () => void;
  // Resolves once saved; a throw is shown in the dialog.
  onSave: (choice: SaveToLibraryChoice) => Promise<void>;
};

export function SaveToLibraryDialog(props: SaveToLibraryProps) {
  const titleId = useId();
  return (
    <Dialog open={props.open} onClose={props.onClose} titleId={titleId} size="sm">
      {/* Mounted per opening, so each starts afresh from its own selection. */}
      {props.open ? <SaveToLibraryForm {...props} titleId={titleId} /> : null}
    </Dialog>
  );
}

function SaveToLibraryForm({
  count,
  suggestedTitle,
  teams,
  items,
  onClose,
  onSave,
  titleId,
}: SaveToLibraryProps & { titleId: string }) {
  const foldersId = useId();
  const [title, setTitle] = useState(suggestedTitle);
  const [destination, setDestination] = useState('personal');
  const [folder, setFolder] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destinations = destinationsOf(teams);
  const picked = destinations.find((d) => d.key === destination) ?? destinations[0]!;
  const suggestions = folderNames(items, picked.scope, picked.teamId);
  const trimmed = title.trim();

  const submit = async () => {
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        scope: picked.scope,
        teamId: picked.teamId,
        title: trimmed,
        folder: folder.trim(),
      });
    } catch (e) {
      setError(libraryErrorMessage(e));
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="px-6 pt-5">
        <DialogHeader
          title={<span id={titleId}>Save to Library</span>}
          subtitle={
            count === 1
              ? 'Keep a copy of this element to place in any document, in every app.'
              : `Keep a copy of these ${count} elements to place in any document, in every app.`
          }
        />
      </div>
      <div className="flex flex-col gap-4 px-6 py-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Name</span>
          <TextInput
            value={title}
            autoFocus
            maxLength={LIBRARY_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name this item"
          />
        </label>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
            Save to
          </legend>
          <div role="radiogroup" className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
            {destinations.map((d) => {
              const checked = d.key === picked.key;
              return (
                <label
                  key={d.key}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
                    checked
                      ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="library-destination"
                    value={d.key}
                    checked={checked}
                    onChange={() => setDestination(d.key)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                      checked
                        ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {d.scope === 'personal' ? <PersonalScopeIcon /> : <TeamScopeIcon />}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {d.label}
                    </span>
                    <span className="truncate text-xs text-slate-600 dark:text-slate-400">
                      {d.line}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Folder{' '}
            <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
          </span>
          <TextInput
            value={folder}
            list={suggestions.length > 0 ? foldersId : undefined}
            maxLength={LIBRARY_FOLDER_MAX}
            onChange={(e) => setFolder(e.target.value)}
            placeholder={suggestions[0] ?? 'Logos, Icons, Components…'}
          />
          {suggestions.length > 0 ? (
            <datalist id={foldersId}>
              {suggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          ) : null}
        </label>
        {error ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!trimmed || saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogFooter>
    </form>
  );
}
