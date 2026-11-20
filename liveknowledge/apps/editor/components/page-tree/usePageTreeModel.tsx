'use client';

// The page tree's props from the editor (docs/specs/030-knowledgebase/blueprints/page-tree.md "The sidebar"): the
// tabs as the tree reads them, who may change them, what is closed in this browser, and the actions, each read from
// the editor's chrome store one slice at a time. A typing commit changes none of them (`sameTabsForBar` compares the
// tabs without their writing), so it renders nothing here.
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { truncateName } from '@liveknowledge/document';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { sameTabsForBar } from '@/app/document/[id]/editor-view-bars';
import { TabPresenceStack } from '@/components/chrome/TabPresenceStack';
import { useToast } from '@/hooks/ui/useToast';
import { readClosedPages, writeClosedPages } from '@/lib/page-tree-open';
import { track } from '@/lib/telemetry';
import { appHrefOfPlace } from '@/lib/workbench/workspace-place';
import { useKnowledgeActions } from '@/components/knowledge/usePageKnowledge';
import { pageKnowledgeStore } from '@/lib/knowledge/page-knowledge-store';
import { pageTrust, trustMarks } from '@/lib/knowledge/page-trust';
import { useRelativeNow } from '@/lib/relative-time';
import type { PageTreeActions, PageTreeKnowledge, PageTreeProps } from './PageTree';
import { selectPage } from './select-page';

/** The link to one page of a knowledgebase: the knowledgebase's address with the page pinned in its fragment, which
 *  is where the editor reads the page to open (seed-fetched-document.ts). */
export function pageLinkOf(
  origin: string,
  documentId: string,
  pageId: string,
  shareCode: string | null,
): string {
  const path = appHrefOfPlace({ kind: 'document', documentId, tabId: null, shareCode });
  return `${origin}${path}#t=${encodeURIComponent(pageId)}`;
}

export type PageTreeModel = PageTreeProps & {
  name: string;
  onRenameKnowledgebase: ((name: string) => void) | undefined;
};

export function usePageTreeModel(): PageTreeModel {
  const chrome = useEditorChromeStore();
  const toast = useToast();
  const tabs = useEditorChrome((s) => s.tabs, sameTabsForBar);
  const activeId = useEditorChrome((s) => s.activeId);
  const name = useEditorChrome((s) => s.documentName);
  const documentId = useEditorChrome((s) => s.documentId);
  // An Editor on the whole knowledgebase: never a Participant, a Viewer or a tab-scoped link
  // (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Share roles").
  const canEdit = useEditorChrome((s) => s.can.editPages && !s.isStructureReadOnly);
  const isOutOfScope = useEditorChrome((s) => s.isOutOfScope);
  const renameNonce = useEditorChrome((s) => s.renameTabNonce);
  const participantsByTab = useEditorChrome((s) => s.participantsByTab);
  const selfId = useEditorChrome((s) => s.selfParticipant.id);
  const sessionRole = useEditorChrome((s) => s.sessionRole);
  const followingId = useEditorChrome((s) => s.followMe.followingId);
  const followerCount = useEditorChrome((s) => s.followMe.followerCount);

  // What is closed, per knowledgebase, in this browser. Read again when another knowledgebase opens.
  const [closedFor, setClosedFor] = useState(() => ({
    documentId,
    closed: readClosedPages(documentId),
  }));
  if (closedFor.documentId !== documentId) {
    setClosedFor({ documentId, closed: readClosedPages(documentId) });
  }
  const onSetOpen = useCallback(
    (id: string, open: boolean) =>
      setClosedFor((state) => {
        if (state.closed.has(id) !== open) return state;
        const closed = new Set(state.closed);
        if (open) closed.delete(id);
        else closed.add(id);
        writeClosedPages(state.documentId, closed);
        return { ...state, closed };
      }),
    [],
  );

  // The handlers read the newest view-model when they run, so the object keeps its identity and the rows stay put.
  const actions = useMemo<PageTreeActions>(
    () => ({
      onSelect: (id) => selectPage(chrome.get(), id),
      onRename: (id, next) => chrome.get().renameTab(id, next),
      onAdd: (parent) => chrome.get().addTab(parent),
      onDuplicate: (id) => chrome.get().duplicateTab(id),
      onDelete: (id) => void chrome.get().deleteTab(id),
      onMove: (id, to) => chrome.get().movePage(id, to),
      onStep: (id, by) => chrome.get().stepPage(id, by),
      onIndent: (id) => chrome.get().indentPage(id),
      onOutdent: (id) => chrome.get().outdentPage(id),
      onCopyLink: (id) => {
        const editor = chrome.get();
        if (!editor.documentId) return;
        const link = pageLinkOf(
          window.location.origin,
          editor.documentId,
          id,
          editor.sessionShareCode,
        );
        track('UI', 'Used', 'CopyPageLink');
        navigator.clipboard.writeText(link).then(
          () => toast.success('Link copied'),
          () => toast.error('Could not copy the link.'),
        );
      },
    }),
    [chrome, toast],
  );

  const people = useCallback(
    (id: string): ReactNode => {
      const here = participantsByTab.get(id);
      if (!here || here.length === 0) return null;
      return (
        <TabPresenceStack
          participants={here}
          selfId={selfId}
          selfRole={sessionRole}
          followingId={followingId}
          followerCount={followerCount}
          onOpenCollaborators={(...a) => chrome.get().openCollaborators(...a)}
        />
      );
    },
    [chrome, participantsByTab, selfId, sessionRole, followingId, followerCount],
  );

  // Each page's verified state, from the tab list alone (the summaries carry every page's fields, and the room
  // patches them): one pass a change of the list, of a field just set here, or of the clock's 30 s tick, never a
  // request a row. A typing commit changes none of the three.
  const knowledgeActions = useKnowledgeActions();
  const knowledgeVersion = useSyncExternalStore(
    pageKnowledgeStore.subscribe,
    pageKnowledgeStore.version,
    pageKnowledgeStore.version,
  );
  const now = useRelativeNow();
  const knowledge = useMemo<PageTreeKnowledge>(() => {
    // Read for the memo's sake: a field set here moves the version, not the tab list.
    void knowledgeVersion;
    const inContext = new Set<string>();
    for (const tab of tabs) {
      if (pageTrust(pageKnowledgeStore.fieldsOf(tab), now).fields.context) inContext.add(tab.id);
    }
    return {
      marks: trustMarks(tabs, now, pageKnowledgeStore.fieldsOf),
      inContext,
      canVerify: knowledgeActions.rights.verify,
      canEditFields: knowledgeActions.rights.editFields,
      onVerify: knowledgeActions.verify,
      onSetContext: (id, on) => knowledgeActions.setFields(id, { context: on }, 'context'),
    };
  }, [tabs, now, knowledgeVersion, knowledgeActions]);

  const onRenameKnowledgebase = useCallback(
    (next: string) => {
      const trimmed = truncateName(next);
      if (trimmed && trimmed !== chrome.get().documentName) chrome.get().nameDocument(trimmed);
    },
    [chrome],
  );

  return {
    tabs,
    activeId,
    closed: closedFor.closed,
    onSetOpen,
    canEdit,
    isOutOfScope,
    people: participantsByTab.size > 0 ? people : undefined,
    renameNonce,
    actions,
    knowledge,
    name,
    onRenameKnowledgebase: canEdit ? onRenameKnowledgebase : undefined,
  };
}
