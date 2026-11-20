'use client';

// The search dialog's host (docs/specs/030-knowledgebase/search-and-ask.md "Search"): opens it on Cmd or Ctrl K and
// from the Search field, searches the room's index (or the pages this editor holds, for a knowledgebase kept
// Offline), and opens the chosen page at its passage. Mounted once with the canvas chrome.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { KnowledgeSearchResult } from '@liveknowledge/api-schema';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { sameTabsForBar } from '@/app/document/[id]/editor-view-bars';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { apiSearchKnowledge } from '@/lib/api/knowledge';
import { goToBlock } from '@/lib/knowledge/go-to-block';
import { searchLoadedPages } from '@/lib/knowledge/knowledge-search';
import { isSearchChord, knowledgeSearch } from '@/lib/knowledge/search-open';
import { track } from '@/lib/telemetry';
import { SearchDialog } from './SearchDialog';

function OpenSearch() {
  const chrome = useEditorChromeStore();
  const documentId = useEditorChrome((s) => s.documentId);
  const offline = useIsOfflineDocument(documentId);
  const pages = useEditorChrome((s) => s.tabs, sameTabsForBar);
  const search = useCallback(
    (query: string, signal: AbortSignal): Promise<KnowledgeSearchResult[]> => {
      const editor = chrome.get();
      if (!editor.documentId || offline)
        return Promise.resolve(searchLoadedPages(editor.tabs, query, Date.now()));
      return apiSearchKnowledge(
        { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode },
        editor.documentId,
        query,
        signal,
      );
    },
    [chrome, offline],
  );
  return (
    <SearchDialog
      onClose={knowledgeSearch.close}
      search={search}
      pages={pages}
      onOpen={(result) => {
        track('UI', 'Used', result.isTitle ? 'SearchResultPage' : 'SearchResultPassage');
        goToBlock(chrome.get, result.tab, result.isTitle ? '' : result.firstBlock);
      }}
    />
  );
}

export function KnowledgeSearchHost() {
  const open = useSyncExternalStore(knowledgeSearch.subscribe, knowledgeSearch.isOpen, () => false);
  useEffect(() => {
    // Before the editor's own keys. In the writing, with words selected, Cmd or Ctrl K is still the link field's.
    const onKey = (e: KeyboardEvent) => {
      if (!isSearchChord(e)) return;
      const inWriting = e.target instanceof Element && e.target.closest('.article-flow') !== null;
      if (inWriting && window.getSelection()?.isCollapsed === false) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!knowledgeSearch.isOpen()) track('UI', 'Opened', 'KnowledgeSearch');
      knowledgeSearch.open();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      knowledgeSearch.close();
    };
  }, []);
  return open ? <OpenSearch /> : null;
}
