'use client';

// One page's Required Reading for the editor (docs/specs/030-knowledgebase/required-reading.md "Where it shows"): read
// after the page has drawn (once a session), whether it shows here at all (a knowledgebase with a room, not kept
// Offline), and its presses, each with its toast and its telemetry. The api decides who may do what (`sees`,
// `manages`, `mine.asked`); this only draws what it answered. Reads the chrome store one slice at a time and the
// reading store by its version: typing renders nothing here.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { PageReadingChange } from '@liveknowledge/api-schema';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { useToast } from '@/hooks/ui/useToast';
import {
  confirmedToast,
  readingFailureText,
  remindSent,
  remindText,
} from '@/lib/required-reading/reading-words';
import { readingStore, type PageReadingEntry } from '@/lib/required-reading/reading-store';
import { track } from '@/lib/telemetry';

export type RequiredReadingView = {
  entry: PageReadingEntry;
  /** Whether any of it shows: a knowledgebase with a room, its state read. */
  shown: boolean;
  /** The press waiting on the api, if any. */
  busy: 'confirm' | 'set' | 'remind' | null;
  confirm: () => void;
  /** Require, change or stop; answers whether it was saved. */
  set: (change: PageReadingChange) => Promise<boolean>;
  remind: () => void;
};

/** `tab` is the page: the open one when left out. */
export function useRequiredReading(tab?: string): RequiredReadingView {
  const chrome = useEditorChromeStore();
  const toast = useToast();
  const documentId = useEditorChrome((s) => s.documentId);
  const activeId = useEditorChrome((s) => s.activeId);
  const pageId = tab ?? activeId;
  const offline = useIsOfflineDocument(documentId);
  // An embed shows the page alone, with no room of its own to ask (required-reading.md "Where it shows").
  const embedded = useEditorChrome((s) => !!s.embedMode);
  const [busy, setBusy] = useState<RequiredReadingView['busy']>(null);
  const at = useSyncExternalStore(
    readingStore.subscribe,
    readingStore.version,
    readingStore.version,
  );
  const entry = readingStore.entryOf(documentId ?? '', pageId, at);
  const reachable = !offline && !embedded && !!documentId;
  useEffect(() => {
    if (!reachable || !documentId) return;
    const editor = chrome.get();
    const who = { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode };
    // After the page has drawn: a read on its own, never on the writing's render path.
    const handle = window.setTimeout(() => void readingStore.load(who, documentId, pageId), 0);
    return () => window.clearTimeout(handle);
  }, [chrome, documentId, pageId, reachable]);
  const shown = reachable && entry.status === 'ready';

  const context = useCallback(() => {
    const editor = chrome.get();
    return {
      who: { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode },
      documentId: editor.documentId,
      selfId: editor.accountUserId ?? null,
      name: editor.tabs.find((t) => t.id === pageId)?.name.trim() || 'Untitled Page',
    };
  }, [chrome, pageId]);

  const confirm = useCallback(() => {
    const { who, documentId: id, selfId, name } = context();
    if (!id || busy) return;
    track('UI', 'Used', 'ReadConfirmed');
    setBusy('confirm');
    readingStore
      .confirm(who, id, pageId, selfId)
      .then(
        () => toast.success(confirmedToast(name)),
        (err: unknown) => toast.error(readingFailureText(err, 'confirm')),
      )
      .finally(() => setBusy(null));
  }, [busy, context, pageId, toast]);

  const set = useCallback(
    async (change: PageReadingChange) => {
      const { who, documentId: id, name } = context();
      if (!id || busy) return false;
      const stop = change.audience === null;
      track('UI', 'Used', stop ? 'RequiredReadingStopped' : 'RequiredReadingSet');
      setBusy('set');
      try {
        await readingStore.set(who, id, pageId, change);
        toast.success(
          stop ? `${name} is no longer Required Reading.` : `${name} is Required Reading.`,
        );
        return true;
      } catch (err) {
        toast.error(readingFailureText(err, stop ? 'stop' : 'set'));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [busy, context, pageId, toast],
  );

  const remind = useCallback(() => {
    const { who, documentId: id } = context();
    if (!id || busy) return;
    track('UI', 'Used', 'ReadingReminded');
    setBusy('remind');
    readingStore
      .remind(who, id, pageId)
      .then(
        (result) =>
          remindSent(result) ? toast.success(remindText(result)) : toast.info(remindText(result)),
        (err: unknown) => toast.error(readingFailureText(err, 'remind')),
      )
      .finally(() => setBusy(null));
  }, [busy, context, pageId, toast]);

  return useMemo(
    () => ({ entry, shown, busy, confirm, set, remind }),
    [entry, shown, busy, confirm, set, remind],
  );
}
