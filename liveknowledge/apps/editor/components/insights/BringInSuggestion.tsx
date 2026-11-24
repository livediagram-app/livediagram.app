'use client';

// Bring In Your Diagrams and Docs (docs/specs/013-workspace/suggestions.md; liveworkspace/docs/specs/016-notifications/
// suggestions.md): a new knowledgebase (no connected items, at most NEW_KB_PAGES_MAX pages) offers to connect the
// person's most recent diagrams and documents, so Ask answers from them too (Ask Across Every App). Each is connected
// as Connect File connects one, at View, one way. The check reads the tree from the chrome store when the page is
// idle; the person's recent items are asked once, after the tree matched. An Editor's, in a session that may change
// the whole tree.
import { useCallback } from 'react';
import type { Item } from '@liveworkspace/index-client';
import { connectFile } from '@liveworkspace/workbench/components/connect/connect-file';
import { NextAppSuggestion } from '@liveworkspace/workbench/components/suggest/NextAppSuggestion';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { pageCount } from '@liveknowledge/document';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useToast } from '@/hooks/ui/useToast';

/** A knowledgebase with no more pages than this, and nothing connected, is new. */
export const NEW_KB_PAGES_MAX = 3;
/** Recent items of each app it connects. */
export const BRING_IN_PER_APP = 3;
const APPS = ['livediagram', 'livedocuments'] as const;

// The person's recent diagrams and documents, asked once a page load.
let recent: Promise<Item[]> | null = null;

function recentItems(): Promise<Item[]> {
  recent ??= Promise.all(
    APPS.map((app) =>
      indexClient
        .listItems({ app, view: 'recent', limit: BRING_IN_PER_APP })
        .then((page) => page.items.slice(0, BRING_IN_PER_APP))
        .catch(() => [] as Item[]),
    ),
  ).then((lists) => lists.flat());
  return recent;
}

export function BringInSuggestion({
  itemId,
  allowed,
}: {
  itemId: string | null;
  allowed: boolean;
}) {
  const chrome = useEditorChromeStore();
  const toast = useToast();
  const mayChangeTree = useEditorChrome(
    (s) => !!s.documentId && !s.isStructureReadOnly && !s.embedMode && !s.workbench,
  );

  const check = useCallback(() => {
    const state = chrome.get();
    if (state.connectedTabs.connected.size > 0 || pageCount(state.tabs) > NEW_KB_PAGES_MAX) {
      return null;
    }
    return recentItems().then((items) => {
      const fresh = items.filter((i) => i.id !== itemId);
      if (fresh.length === 0) return null;
      const n = fresh.length;
      return {
        line: `Connect your ${n === 1 ? 'most recent diagram or document' : `${n} most recent diagrams and documents`}, so Ask answers from them too.`,
        run: async () => {
          const now = chrome.get();
          const hostId = now.documentId;
          const grant = hostId ? await now.connectedTabs.grant() : null;
          if (!hostId || !grant) {
            toast.error('They couldn’t be connected just now. Try Connect File instead.');
            return;
          }
          let made = 0;
          for (const item of fresh) {
            if (chrome.get().connectedTabs.connected.has(item.id)) continue;
            const tabId = crypto.randomUUID();
            try {
              await connectFile({
                client: indexClient,
                hostId,
                grant,
                tabId,
                targetId: item.id,
                level: 'view',
                both: false,
                addTab: (row) => chrome.get().addConnectedRow(row, tabId),
              });
              made += 1;
            } catch {
              // One that can't be connected is left out; the rest still are.
            }
          }
          if (made === 0)
            toast.error('They couldn’t be connected just now. Try Connect File instead.');
          else
            toast.success(
              `Connected ${made === 1 ? 'one item' : `${made} items`}. Ask answers from them once they have been read.`,
            );
        },
      };
    });
  }, [chrome, itemId, toast]);

  return (
    <NextAppSuggestion
      id="bring-in"
      itemId={itemId}
      allowed={allowed && mayChangeTree}
      check={check}
    />
  );
}

/** Forgets the recent items read, for tests. */
export function resetBringInForTests(): void {
  recent = null;
}
