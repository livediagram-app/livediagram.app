'use client';

// The knowledgebase's doors into the universal search (docs/specs/030-knowledgebase/search-and-ask.md "Search"): Cmd
// or Ctrl K and the Search field at the head of the page tree open the editor's search panel, whose first group is
// This Knowledgebase. liveknowledge has no search dialog of its own. Also notes each page as it is opened, for the
// group's list of recent pages. Mounted once with the canvas chrome; draws nothing.
import { useEffect, useSyncExternalStore } from 'react';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { noteRecentPage } from '@/lib/knowledge/recent-pages';
import { isSearchChord, knowledgeSearch } from '@/lib/knowledge/search-open';
import { track } from '@/lib/telemetry';

export function KnowledgeSearchHost() {
  const chrome = useEditorChromeStore();
  // A door was pressed: the panel opens, and the door's ask is spent.
  const asked = useSyncExternalStore(
    knowledgeSearch.subscribe,
    knowledgeSearch.isOpen,
    () => false,
  );
  useEffect(() => {
    if (!asked) return;
    knowledgeSearch.close();
    const editor = chrome.get();
    if (!editor.searchOpen) track('UI', 'Opened', 'KnowledgeSearch');
    editor.setSearchOpen(true);
  }, [asked, chrome]);
  useEffect(() => {
    // Before the editor's own keys. In the writing, with words selected, Cmd or Ctrl K is still the link field's.
    const onKey = (e: KeyboardEvent) => {
      if (!isSearchChord(e)) return;
      const inWriting = e.target instanceof Element && e.target.closest('.article-flow') !== null;
      if (inWriting && window.getSelection()?.isCollapsed === false) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      knowledgeSearch.open();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      knowledgeSearch.close();
    };
  }, []);
  // The page someone is on, noted once per page opened: never per keystroke (the id alone is read).
  const documentId = useEditorChrome((s) => s.documentId);
  const activeId = useEditorChrome((s) => s.activeId);
  useEffect(() => {
    noteRecentPage(documentId, activeId);
  }, [documentId, activeId]);
  return null;
}
