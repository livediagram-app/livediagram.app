'use client';

// Sync Knowledgebase inside the hover card of an Offline knowledgebase's Ask and AI Knowledge tabs
// (docs/specs/030-knowledgebase/search-and-ask.md "Offline"): the same sync in place the Share dialog's gate runs
// (docs/specs/006-document/offline-mode.md "Syncing in place"), so the views open once it lands. Waits for the
// reader to be known, as that gate does.
import { useState } from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { Spinner } from '@/components/palette/template-picker-icons';
import { useToast } from '@/hooks/ui/useToast';
import { syncFailureMessage } from '@/lib/offline/offline-convert';

export function SyncKnowledgebaseButton() {
  const { syncToCloud, selfParticipant } = useEditorContext();
  const ready = selfParticipant.id !== 'self';
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const sync = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await syncToCloud();
      toast.success('Synced. Ask and AI Knowledge are on now.');
    } catch (e) {
      toast.error(syncFailureMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      data-sync-knowledgebase=""
      disabled={!ready || busy}
      aria-busy={busy || undefined}
      onClick={() => void sync()}
      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-white hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-default disabled:opacity-70 dark:bg-brand-600 dark:hover:bg-brand-500"
    >
      {busy ? <Spinner /> : null}
      {busy ? 'Syncing…' : 'Sync Knowledgebase'}
    </button>
  );
}
