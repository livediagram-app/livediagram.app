'use client';

// The rail of versions (docs/specs/006-document/version-history.md "In the editor"): Now first, then the versions
// newest first under day headings, each with its time, its name or kind, and who it names. An Editor names the
// current content at the rail's head and names, renames or unnames the selected row in place.
import { useState, type FormEvent } from 'react';
import type { VersionSummary } from '@liveknowledge/api-schema';
import { NAME_MAX_LENGTH } from '@liveknowledge/document';
import { Button, CompactEmptyState, SwitchRow, TextInput } from '@liveknowledge/ui';
import { HistoryIcon } from './history-tools-item';
import type { VersionList } from './useVersionHistory';
import { timeOfDay, versionsByDay, versionTitle } from './version-words';

export const NOW = 'now';

type RailProps = {
  list: VersionList;
  selected: string;
  onSelect: (id: string) => void;
  canEdit: boolean;
  onNameCurrent: (name: string) => Promise<void>;
  onRename: (versionId: string, name: string | null) => Promise<void>;
  onRetry: () => void;
  now: number;
};

const ROW =
  'group flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition duration-micro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';
const ROW_IDLE = 'hover:bg-slate-100 dark:hover:bg-slate-800/70';
const ROW_ON = 'bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:ring-brand-500/30';

export function VersionRail(props: RailProps) {
  const { list, selected, onSelect, canEdit, now } = props;
  const [onlyNamed, setOnlyNamed] = useState(false);
  const [naming, setNaming] = useState(false);
  const versions = list.state === 'ready' ? list.versions : [];
  const shown = onlyNamed ? versions.filter((v) => v.name !== null) : versions;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {canEdit ? (
        <div className="border-b border-slate-200 p-3 dark:border-slate-800">
          {naming ? (
            <NameField
              label="Version name"
              initial=""
              onCancel={() => setNaming(false)}
              onSave={async (name) => {
                await props.onNameCurrent(name);
                setNaming(false);
              }}
            />
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-center"
              onClick={() => setNaming(true)}
            >
              Name This Version
            </Button>
          )}
        </div>
      ) : null}
      <nav
        aria-label="Versions"
        aria-busy={list.state === 'loading'}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
      >
        <button
          type="button"
          aria-current={selected === NOW ? 'true' : undefined}
          className={`${ROW} ${selected === NOW ? ROW_ON : ROW_IDLE}`}
          onClick={() => onSelect(NOW)}
        >
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Now</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">The page as it is</span>
        </button>
        {list.state === 'loading' ? <RailSkeleton /> : null}
        {list.state === 'failed' ? (
          <div
            className="px-3 py-6 text-center text-sm text-slate-600 dark:text-slate-300"
            role="alert"
          >
            <p>{list.gone ? 'This page is gone.' : 'The versions could not be read.'}</p>
            {list.gone ? null : (
              <Button variant="ghost" size="xs" className="mt-2" onClick={props.onRetry}>
                Try Again
              </Button>
            )}
          </div>
        ) : null}
        {list.state === 'ready' && versions.length === 0 ? (
          <CompactEmptyState
            className="mt-4"
            icon={<HistoryIcon size={18} />}
            title="No earlier versions yet"
            description="A version is kept each time the page is saved, before an AI edit, and whenever you name one."
          />
        ) : null}
        {list.state === 'ready' && versions.length > 0 && shown.length === 0 ? (
          <CompactEmptyState
            className="mt-4"
            size="small"
            icon={<HistoryIcon size={16} />}
            title="No named versions yet"
            description="Name a version to keep it until you remove the name."
          />
        ) : null}
        {versionsByDay(shown, now).map((day) => (
          <section key={day.heading} className="mt-3">
            <h3 className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {day.heading}
            </h3>
            <ul className="flex flex-col gap-0.5">
              {day.versions.map((version) => (
                <li key={version.id}>
                  <VersionRow
                    version={version}
                    on={selected === version.id}
                    canEdit={canEdit}
                    onSelect={() => onSelect(version.id)}
                    onRename={(name) => props.onRename(version.id, name)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
      {versions.some((v) => v.name !== null) ? (
        <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
          <SwitchRow checked={onlyNamed} onChange={setOnlyNamed} className="w-full text-xs">
            Only Named Versions
          </SwitchRow>
        </div>
      ) : null}
    </div>
  );
}

function VersionRow({
  version,
  on,
  canEdit,
  onSelect,
  onRename,
}: {
  version: VersionSummary;
  on: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onRename: (name: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const named = version.name !== null;
  if (editing) {
    return (
      <div className={`${ROW} ${ROW_ON} cursor-default`}>
        <NameField
          label="Version name"
          initial={version.name ?? ''}
          onCancel={() => setEditing(false)}
          onSave={async (name) => {
            await onRename(name);
            setEditing(false);
          }}
        />
      </div>
    );
  }
  return (
    <div className={`${ROW} ${on ? ROW_ON : ROW_IDLE} relative`}>
      <button
        type="button"
        aria-current={on ? 'true' : undefined}
        onClick={onSelect}
        className="flex w-full cursor-pointer flex-col items-start gap-0.5 text-left after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
      >
        <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {timeOfDay(version.savedAt)}
        </span>
        <span
          className={`text-sm ${named ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200'}`}
        >
          {versionTitle(version)}
        </span>
        {version.author ? (
          <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: version.author.color }}
            />
            {version.author.name}
          </span>
        ) : null}
      </button>
      {on && canEdit ? (
        <div className="relative z-10 mt-1 flex gap-1">
          <Button variant="ghost" size="xs" onClick={() => setEditing(true)}>
            {named ? 'Rename' : 'Name'}
          </Button>
          {named ? (
            <Button variant="ghost" size="xs" onClick={() => void onRename(null)}>
              Remove Name
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// A name typed in place: Enter or Save keeps it, Escape or Cancel leaves it. A refusal (too many names) shows under
// the field.
function NameField({
  label,
  initial,
  onSave,
  onCancel,
}: {
  label: string;
  initial: string;
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = value.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(name);
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? err.code : null;
      setError(
        code === 'too_many_names'
          ? 'This page has as many named versions as it can keep. Remove a name first.'
          : 'The name could not be saved. Try again.',
      );
      setBusy(false);
    }
  };
  return (
    <form className="flex w-full flex-col gap-2" onSubmit={(e) => void submit(e)}>
      <TextInput
        compact
        autoFocus
        aria-label={label}
        placeholder="Version name"
        maxLength={NAME_MAX_LENGTH}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onCancel();
          }
        }}
      />
      {error ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="xs" busy={busy} disabled={!value.trim()}>
          Save
        </Button>
      </div>
    </form>
  );
}

function RailSkeleton() {
  return (
    <div aria-hidden className="mt-3 flex flex-col gap-2 px-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-1.5 py-1.5">
          <div className="h-2.5 w-12 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      ))}
    </div>
  );
}
