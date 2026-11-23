'use client';

// The open page's suggested edits for its chrome (docs/specs/030-knowledgebase/insights.md "On the page"; blueprint
// suggested-edits-ui.md): read from the page's health (one read a page open, no read of their own), what the writing
// found of them, who may decide them, and Accept and Dismiss. Each piece of chrome (the pill, the rail, the popover,
// the review bar) reads this; the host (PageSuggestionsHost) alone hands the marks to the writing.
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { KnowledgeSuggestion } from '@liveknowledge/api-schema';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { useToast } from '@/hooks/ui/useToast';
import {
  apiAcceptKnowledgeSuggestion,
  apiDismissKnowledgeSuggestion,
  overviewFailureText,
} from '@/lib/knowledge-ask/suggestions-api';
import { pageKnowledgeStore } from '@/lib/knowledge/page-knowledge-store';
import { suggestionsView, type SuggestionsViewState } from '@/lib/knowledge/page-suggestions-view';
import { suggestionRights, type SuggestionRights } from '@/lib/knowledge/suggestion-rights';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { toastName } from '@liveworkspace/workbench/lib/toast-name';
import { track } from '@/lib/telemetry';

const NONE: readonly KnowledgeSuggestion[] = [];

export type PageSuggestions = {
  pageId: string;
  suggestions: readonly KnowledgeSuggestion[];
  rights: SuggestionRights;
  view: SuggestionsViewState;
  /** A suggestion's passage was looked for and is not in the page: it shows in the rail and the popover only. */
  missing: (id: string) => boolean;
  accept: (s: KnowledgeSuggestion) => void;
  dismiss: (s: KnowledgeSuggestion) => void;
};

/** The view store, for React. */
export function useSuggestionsView(): SuggestionsViewState {
  return useSyncExternalStore(suggestionsView.subscribe, suggestionsView.get, suggestionsView.get);
}

export function useSuggestionRights(): SuggestionRights {
  const documentId = useEditorChrome((s) => s.documentId);
  const offline = useIsOfflineDocument(documentId);
  const manage = useEditorChrome((s) => s.can.manageKnowledgebase);
  const isStructureReadOnly = useEditorChrome((s) => s.isStructureReadOnly);
  return useMemo(
    () => suggestionRights({ can: { manageKnowledgebase: manage }, isStructureReadOnly, offline }),
    [manage, isStructureReadOnly, offline],
  );
}

export function usePageSuggestions(): PageSuggestions {
  const chrome = useEditorChromeStore();
  const toast = useToast();
  const documentId = useEditorChrome((s) => s.documentId);
  const pageId = useEditorChrome((s) => s.activeId);
  const rights = useSuggestionRights();
  const view = useSuggestionsView();
  // The store's version is read into the lookup (as usePageKnowledge's), so a new read is seen.
  const at = useSyncExternalStore(
    pageKnowledgeStore.subscribe,
    pageKnowledgeStore.version,
    pageKnowledgeStore.version,
  );
  const health = documentId ? pageKnowledgeStore.healthOf(documentId, pageId, at) : undefined;
  const suggestions = rights.see ? (health?.suggestions ?? NONE) : NONE;

  const decide = useCallback(
    (verb: 'accept' | 'dismiss', s: KnowledgeSuggestion) => {
      const editor = chrome.get();
      const key = `${verb}:${s.id}`;
      if (!rights.decide || !editor.documentId || suggestionsView.get().busy.has(key)) return;
      const docId = editor.documentId;
      const who = { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode };
      track('UI', 'Used', verb === 'accept' ? 'SuggestionAccepted' : 'SuggestionDismissed');
      suggestionsView.setBusy(key, true);
      const call =
        verb === 'accept'
          ? apiAcceptKnowledgeSuggestion(who, docId, s.id)
          : apiDismissKnowledgeSuggestion(who, docId, s.id);
      void call
        .then(
          () => {
            pageKnowledgeStore.dropSuggestion(docId, s.tab, s.id);
            if (suggestionsView.get().showing === s.id) suggestionsView.show(null);
            const page =
              toastName(chrome.get().tabs.find((t) => t.id === s.tab)?.name) ?? 'the page';
            toast.success(`Edit to ${page} ${verb === 'accept' ? 'accepted' : 'dismissed'}.`);
          },
          (err: unknown) => {
            // Already decided elsewhere: it is gone, which is what was asked.
            if (err instanceof ApiError && err.status === 404) {
              pageKnowledgeStore.dropSuggestion(docId, s.tab, s.id);
              return;
            }
            toast.error(
              overviewFailureText(
                err,
                `${verb}-suggestion`,
                toastName(chrome.get().tabs.find((t) => t.id === s.tab)?.name),
              ),
            );
          },
        )
        .finally(() => {
          suggestionsView.setBusy(key, false);
          // The page's health again, once: its counts and what still waits.
          void pageKnowledgeStore.load(who, docId, s.tab, true);
        });
    },
    [chrome, rights.decide, toast],
  );
  const accept = useCallback((s: KnowledgeSuggestion) => decide('accept', s), [decide]);
  const dismiss = useCallback((s: KnowledgeSuggestion) => decide('dismiss', s), [decide]);
  const missing = useCallback((id: string) => view.found.get(id) === false, [view.found]);
  return { pageId, suggestions, rights, view, missing, accept, dismiss };
}
