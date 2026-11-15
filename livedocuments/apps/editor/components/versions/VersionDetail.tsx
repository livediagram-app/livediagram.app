'use client';

// The selected version's line (docs/specs/006-document/version-history.md "In the editor"): when it was kept, its
// kind and who it names, what changed since, Show Changes, and for an Editor Restore This Version (asked first, in
// place) and Make a Copy. A Viewer or Participant reads why the buttons are not there.
import { useState } from 'react';
import type { VersionSummary } from '@livedocuments/api-schema';
import type { VersionChanges } from '@livedocuments/document';
import { versionChangesLine } from '@livedocuments/document';
import { Button, SwitchRow } from '@livedocuments/ui';
import { kindWords, whenWords } from './version-words';

export function VersionDetail({
  version,
  changes,
  showChanges,
  onShowChanges,
  canEdit,
  canCopy,
  onRestore,
  onCopy,
  now,
}: {
  version: VersionSummary;
  // Null while the version's body is read.
  changes: VersionChanges | null;
  showChanges: boolean;
  onShowChanges: (on: boolean) => void;
  canEdit: boolean;
  canCopy: boolean;
  onRestore: () => Promise<void>;
  onCopy: () => Promise<void>;
  now: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<'restore' | 'copy' | null>(null);
  const line = changes ? versionChangesLine(changes) : null;
  const run = async (what: 'restore' | 'copy', act: () => Promise<void>) => {
    setBusy(what);
    try {
      await act();
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  };
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {version.name ?? `Version kept ${whenWords(version.savedAt, now)}`}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {[
            version.name ? `Kept ${whenWords(version.savedAt, now)}` : null,
            kindWords(version.kind),
            version.author ? `by ${version.author.name}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300" aria-live="polite">
          {changes === null
            ? 'Comparing with now…'
            : line
              ? `Compared with now: ${line}`
              : 'The same as now.'}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {changes && (changes.removed.length > 0 || changes.changed.length > 0) ? (
          <SwitchRow
            checked={showChanges}
            onChange={onShowChanges}
            layout="inline-flex items-center gap-2 rounded-md text-left"
            className="text-xs"
          >
            Show Changes
          </SwitchRow>
        ) : null}
        {!canEdit ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Only an Editor can restore a version.
          </p>
        ) : confirming ? (
          <div
            role="group"
            aria-label="Restore this version?"
            className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-900 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-500/30"
          >
            <span>Restore this version? The tab changes for everyone; you can undo it.</span>
            <Button variant="ghost" size="xs" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              size="xs"
              autoFocus
              busy={busy === 'restore'}
              onClick={() => void run('restore', onRestore)}
            >
              Restore
            </Button>
          </div>
        ) : (
          <>
            {canCopy ? (
              <Button
                variant="secondary"
                size="xs"
                busy={busy === 'copy'}
                onClick={() => void run('copy', onCopy)}
              >
                Make a Copy
              </Button>
            ) : null}
            <Button size="xs" onClick={() => setConfirming(true)}>
              Restore This Version
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
