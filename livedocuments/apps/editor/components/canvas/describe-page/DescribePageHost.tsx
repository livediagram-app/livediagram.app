'use client';

// Describe a Page bound to the editor (docs/specs/007-editor/describe-a-page.md "The dialog"; blueprint "The editor"):
// the open document, tab, team and account read from the editor's chrome store when the words are sent, the api's
// draft made into the page through the page edits of the view as it is then (its newest render, so a peer's edit
// meanwhile is built on), Contents told a page is coming so it marks it here, and a toast saying what was made. The
// agents' engine the page is made through loads with the dialog, never with the editor.
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { PageKind } from '@livedocuments/document';
import { useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import type { PageContents } from '@/hooks/ui/usePageContents';
import { useToast } from '@/hooks/ui/useToast';
import { draftPage } from '@/lib/api/page-drafts';
import { DescribePageDialog, type MakePage } from './DescribePageDialog';
import { DESCRIBE_PAGE_WORDS } from './describe-page-words';

const loadEngine = () => import('@livedocuments/edit-operations/pages');

export function DescribePageHost({
  kind,
  view,
  contents,
  onClose,
}: {
  kind: PageKind;
  view: PagesModeView;
  contents: PageContents;
  onClose: () => void;
}) {
  const chrome = useEditorChromeStore();
  const toast = useToast();
  // The newest view and Contents, for the edit made once the words come back.
  const latest = useRef({ view, contents });
  useLayoutEffect(() => {
    latest.current = { view, contents };
  });
  // Loaded as the dialog opens, so it is in hand by the time the words come back.
  const engine = useRef<ReturnType<typeof loadEngine> | null>(null);
  useEffect(() => {
    engine.current ??= loadEngine();
  }, []);

  const make: MakePage = async (prompt, signal) => {
    const editor = chrome.get();
    const accountId = editor.accountUserId;
    const documentId = editor.documentId;
    if (!accountId || !documentId) return false;
    const teamId = editor.documentTeamId;
    const { draft } = await draftPage(
      accountId,
      {
        prompt,
        documentId,
        tabId: editor.activeTab.id,
        kind,
        ...(teamId ? { teamId } : {}),
      },
      signal,
    );
    const ops = await (engine.current ??= loadEngine());
    if (signal.aborted) return false;
    const { view: now, contents: list } = latest.current;
    const add = now.edit?.addDraftedPage;
    if (!add) return false;
    list.expectAdded();
    if (!add(draft, ops, list.current ?? undefined)) return false;
    toast.success(DESCRIBE_PAGE_WORDS[kind].made(draft.kind === 'layout' ? draft.label : null));
    return true;
  };

  return <DescribePageDialog kind={kind} make={make} onClose={onClose} />;
}
