'use client';

// A page's approval for the editor's chrome (docs/specs/030-knowledgebase/approval.md): the approval the fields carry
// (what was just done here first), the actions the person here may take, and `act`, optimistic with a toast in words
// on a refusal. Reads the chrome store one slice at a time and the knowledge store by its version, so typing renders
// nothing here.
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { ApprovalAction, ApprovalCaller, PageApproval } from '@liveknowledge/knowledge';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { useIsOfflineDocument } from '@/hooks/persistence/useIsOfflineDocument';
import { useToast } from '@/hooks/ui/useToast';
import {
  approvalActionsOf,
  approvalCallerOf,
  approvalOfFields,
} from '@/lib/knowledge/approval-view';
import { approvalFailureText } from '@/lib/knowledge/page-feedback-words';
import { pageKnowledgeStore } from '@/lib/knowledge/page-knowledge-store';
import { track } from '@/lib/telemetry';

const TELEMETRY_TYPE: Record<ApprovalAction, string> = {
  request: 'ApprovalRequested',
  withdraw: 'ApprovalWithdrawn',
  approve: 'Approved',
  reject: 'Rejected',
};

export type ApprovalDoor = {
  caller: ApprovalCaller;
  /** The account here, to say "you". */
  self: string | null;
  act: (pageId: string, action: ApprovalAction, note?: string) => Promise<boolean>;
};

/** Who the person here is to the rule, and the one way to act on any page's approval. */
export function useApprovalDoor(): ApprovalDoor {
  const chrome = useEditorChromeStore();
  const toast = useToast();
  const documentId = useEditorChrome((s) => s.documentId);
  const offline = useIsOfflineDocument(documentId);
  const level = useEditorChrome((s) => s.can.level);
  const account = useEditorChrome((s) => s.accountUserId ?? null);
  const isStructureReadOnly = useEditorChrome((s) => s.isStructureReadOnly);
  const caller = useMemo(
    () => approvalCallerOf({ level, account, isStructureReadOnly, offline }),
    [level, account, isStructureReadOnly, offline],
  );
  const act = useCallback(
    async (pageId: string, action: ApprovalAction, note?: string): Promise<boolean> => {
      const editor = chrome.get();
      const page = editor.tabs.find((t) => t.id === pageId);
      if (!editor.documentId || !page || !caller.account || caller.role === 'view') return false;
      track('Tab', 'Changed', note ? `${TELEMETRY_TYPE[action]}WithNote` : TELEMETRY_TYPE[action]);
      try {
        await pageKnowledgeStore.approval(
          { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode },
          editor.documentId,
          page,
          action,
          { account: caller.account, role: caller.role },
          Date.now(),
          note,
        );
        return true;
      } catch (err) {
        toast.error(approvalFailureText(err, action));
        return false;
      }
    },
    [chrome, caller, toast],
  );
  return useMemo(() => ({ caller, self: account, act }), [caller, account, act]);
}

/** One page's approval and what the person here may do with it. */
export function usePageApproval(
  pageId: string,
  stored: unknown,
): ApprovalDoor & { approval: PageApproval | undefined; actions: ApprovalAction[] } {
  const door = useApprovalDoor();
  // The store's version is read into the lookup (see usePageKnowledge): a compiler-memoised call keyed on it.
  const at = useSyncExternalStore(
    pageKnowledgeStore.subscribe,
    pageKnowledgeStore.version,
    pageKnowledgeStore.version,
  );
  const fields = pageKnowledgeStore.fieldsOf({ id: pageId, knowledge: stored }, at);
  // Parsed once per change of the fields, so the actions below keep their identity between renders.
  const approval = useMemo(
    () => approvalOfFields(fields as { approval?: unknown } | undefined),
    [fields],
  );
  const actions = useMemo(() => approvalActionsOf(approval, door.caller), [approval, door.caller]);
  return { ...door, approval, actions };
}
