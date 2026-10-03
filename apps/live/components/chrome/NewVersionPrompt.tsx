'use client';

// "A new version of livediagram is ready." (docs/specs/016-platform/new-version-prompt.md): shown when
// the server serves a newer document format than this editor was built for. Calm and non-blocking:
// a polite status that never takes focus, never reloads by itself, and reloads only once everything
// edited has been saved.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { DOCUMENT_FORMAT } from '@livediagram/api-schema';
import { Button } from '@livediagram/ui';
import {
  newVersionAvailable,
  serverDocumentFormat,
  subscribeServerRelease,
} from '@/lib/server-release';
import { reloadWhenSaved } from '@/lib/reload-when-saved';
import { track } from '@/lib/telemetry';
import { debugLog } from '@/lib/debug-log';

type Phase = 'offered' | 'saving' | 'unsaved';

const COPY: Record<Phase, string> = {
  offered: 'A new version of livediagram is ready.',
  saving: 'Saving your changes…',
  unsaved: "Your latest changes aren't saved yet. Reload once they are.",
};

const getServerFormat = () => serverDocumentFormat();

export function NewVersionPrompt({
  hasUnsavedChanges,
  reload = () => window.location.reload(),
}: {
  hasUnsavedChanges: () => boolean;
  reload?: () => void;
}) {
  const server = useSyncExternalStore(subscribeServerRelease, getServerFormat, () => null);
  const [phase, setPhase] = useState<Phase>('offered');
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const announced = useRef(false);
  const visible =
    server !== null && newVersionAvailable() && (dismissedAt === null || server > dismissedAt);

  useEffect(() => {
    if (!visible || announced.current) return;
    announced.current = true;
    debugLog('[document-format] newer on the server', { editor: DOCUMENT_FORMAT, server });
    track('UI', 'Opened', 'NewVersionPrompt');
  }, [visible, server]);

  if (!visible) return null;

  const onReload = async () => {
    track('UI', 'Used', 'NewVersionPrompt');
    setPhase('saving');
    const outcome = await reloadWhenSaved({ hasUnsavedChanges, reload });
    if (outcome === 'unsaved') setPhase('unsaved');
  };

  return (
    <div
      role="status"
      data-new-version-prompt=""
      className="fixed bottom-20 left-1/2 z-[var(--z-chrome)] flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <p className="min-w-0 flex-1">{COPY[phase]}</p>
      <Button size="sm" disabled={phase === 'saving'} onClick={() => void onReload()}>
        Reload
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={phase === 'saving'}
        onClick={() => {
          setDismissedAt(server);
          setPhase('offered');
        }}
      >
        Not now
      </Button>
    </div>
  );
}
