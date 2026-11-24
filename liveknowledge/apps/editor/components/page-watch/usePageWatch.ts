'use client';

// One page's watch for the editor (docs/specs/030-knowledgebase/watching.md "Where it shows"): read after the page has
// drawn (once a session, again when a section's change made it stale), whether the person here may watch (any
// signed-in reader, a Viewer too; never a guest or a knowledgebase kept Offline), and `set`, shown at once with a
// toast. Reads the chrome store one slice at a time and the watch store by its version: typing renders nothing here.
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { PageWatchScope } from '@liveknowledge/api-schema';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { toastName } from '@liveworkspace/workbench/lib/toast-name';
import { useToast } from '@/hooks/ui/useToast';
import { watchFailureText } from '@/lib/knowledge/page-feedback-words';
import { pageWatchStore, type PageWatchEntry } from '@/lib/page-watch/page-watch-store';
import { track } from '@/lib/telemetry';

export type PageWatchView = {
  entry: PageWatchEntry;
  /** Watch or unwatch: any signed-in reader's (the api's rule, watching.md "Share roles"). */
  canWatch: boolean;
  /** Watch the page, its section, or neither. */
  set: (scope: PageWatchScope | null) => void;
  /** Hidden: a knowledgebase kept Offline has no room. */
  hidden: boolean;
};

const EVENT: Record<PageWatchScope, [on: string, off: string]> = {
  page: ['WatchPageOn', 'WatchPageOff'],
  section: ['WatchSectionOn', 'WatchSectionOff'],
};

/** `tab` is the page: the open one when left out. */
export function usePageWatch(tab?: string): PageWatchView {
  const chrome = useEditorChromeStore();
  const toast = useToast();
  const documentId = useEditorChrome((s) => s.documentId);
  const activeId = useEditorChrome((s) => s.activeId);
  const pageId = tab ?? activeId;
  const signedIn = useEditorChrome((s) => !!s.accountUserId || !!s.workbench);
  const offline = useIsOfflineDocument(documentId);
  const at = useSyncExternalStore(
    pageWatchStore.subscribe,
    pageWatchStore.version,
    pageWatchStore.version,
  );
  const entry = pageWatchStore.entryOf(documentId ?? '', pageId, at);
  const shown = signedIn && !offline && !!documentId;
  const stale = entry.stale;
  useEffect(() => {
    if (!shown || !documentId) return;
    const editor = chrome.get();
    const who = { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode };
    // After the page has drawn: a read on its own, never on the writing's render path.
    const handle = window.setTimeout(() => void pageWatchStore.load(who, documentId, pageId), 0);
    return () => window.clearTimeout(handle);
  }, [chrome, documentId, pageId, shown, stale]);
  const canWatch = shown && entry.status === 'ready';
  const set = useCallback(
    (scope: PageWatchScope | null) => {
      const editor = chrome.get();
      if (!editor.documentId || !canWatch) return;
      const was = pageWatchStore.entryOf(editor.documentId, pageId).watch.watching;
      if (was === scope) return;
      const name = editor.tabs.find((t) => t.id === pageId)?.name.trim() || 'Untitled Page';
      const kind = scope ?? was ?? 'page';
      track('UI', 'Toggled', EVENT[kind][scope ? 0 : 1]);
      pageWatchStore
        .set(
          { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode },
          editor.documentId,
          pageId,
          scope,
        )
        .then(
          () =>
            toast.success(
              scope
                ? `Watching ${name}. You'll hear when it changes.`
                : `Stopped watching ${name}.`,
            ),
          (err: unknown) => toast.error(watchFailureText(err, scope !== null, toastName(name))),
        );
    },
    [chrome, canWatch, pageId, toast],
  );
  return useMemo(() => ({ entry, canWatch, set, hidden: !shown }), [entry, canWatch, set, shown]);
}
