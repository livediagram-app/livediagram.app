'use client';

// The mounted workspace frame (docs/specs/013-workspace/workbench-embeds.md "What renders", blueprint "The workspace
// frame"): the Explorer (@liveworkspace/explorer) as it is at /explorer, without the app's surroundings, or the editor of the document opened
// in it, with Back. The place is the frame's own address; every move is the frame's own (useWorkspaceNavigation),
// told to the workbench as `livediagram:place`, and the workbench may move it with `livediagram:open`. The
// Explorer unmounts while a document is open, so the editor's shortcuts and panels are the only ones listening.
import dynamic from 'next/dynamic';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { WorkbenchOpenTarget, WorkbenchRole } from '@livediagram/api-schema';
import { setAppearanceOverride } from '@livediagram/ui';
import { WorkbenchReconnectLine } from '@/components/chrome/WorkbenchChrome';
import {
  useWorkbenchSession,
  WorkbenchSessionContext,
  type DocumentPlace,
  type WorkbenchSession,
} from '@/components/providers/workbench-session-context';
import { useToast } from '@/hooks/ui/useToast';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';
import { workspacePlaceOf, type WorkspacePlace } from '@/lib/workbench/workspace-place';
import { VIEW_TITLES, type ExplorerView } from '@liveworkspace/explorer';
import { ExplorerHost } from './ExplorerHost';
import { useWorkspaceNavigation } from './useWorkspaceNavigation';
import {
  explorerPlaceFields,
  useWorkspacePlaceMessages,
  type PlaceFields,
} from './useWorkspacePlaceMessages';
import { WorkbenchStatus } from './WorkbenchStatus';

const EditorPage = dynamic(() => import('../../document/[id]/editor-page'), {
  ssr: false,
  loading: () => <WorkbenchStatus phase={{ phase: 'reading' }} scope="workspace" />,
});

const CREATE_FAILED = 'Couldn’t create the document. Try again.';
const DOCUMENT_TRASHED = 'That document is in the Trash.';

// The place `livediagram:open` asks for.
function placeOfOpen(to: WorkbenchOpenTarget): WorkspacePlace {
  if ('view' in to) return { kind: 'explorer', node: { kind: 'home' } };
  if ('folderId' in to) return { kind: 'explorer', node: { kind: 'folder', id: to.folderId } };
  return { kind: 'document', documentId: to.documentId, tabId: to.tabId ?? null, shareCode: null };
}

const openKindOf = (to: WorkbenchOpenTarget) =>
  'view' in to ? 'home' : 'folderId' in to ? 'folder' : 'document';

// What Back says it returns to: the view the document was opened from.
function backTitleOf(win: Window): string {
  const from = (win.history.state as { workbenchFrom?: string } | null)?.workbenchFrom;
  if (!from) return VIEW_TITLES.home;
  const url = new URL(from, win.location.origin);
  const place = workspacePlaceOf(url.pathname, url.searchParams);
  if (place.kind !== 'explorer') return VIEW_TITLES.home;
  return titleOfNode(place.node);
}

function titleOfNode(node: ExplorerView): string {
  if (node.kind === 'folder') return 'the folder';
  if (node.kind === 'team') return 'the team';
  return VIEW_TITLES[node.kind];
}

export function WorkspaceFrame() {
  const session = useWorkbenchSession();
  // A workspace frame is mounted only under its session (WorkbenchPage).
  return session ? <MountedFrame session={session} /> : null;
}

function MountedFrame({ session }: { session: WorkbenchSession }) {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? '';
  const place = useMemo(
    () => workspacePlaceOf(pathname, new URLSearchParams(search)),
    [pathname, search],
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const onCreateFailed = useCallback(() => toast.error(CREATE_FAILED), [toast]);
  const nav = useWorkspaceNavigation({
    rootRef,
    ownerId: session.person.id,
    place,
    onCreateFailed,
  });
  const { port, level } = session;
  const report = useWorkspacePlaceMessages(port);

  // Once, before any child reports its place: the workbench hears the frame is ready, the scheme starts as the
  // system's until the workbench sets it, and the mount is counted.
  const announced = useRef(false);
  useLayoutEffect(() => {
    if (announced.current) return;
    announced.current = true;
    setAppearanceOverride('system');
    port.send({ type: 'livediagram:ready', v: 1, scope: 'workspace', role: level });
    track('Session', 'Opened', 'WorkbenchWorkspace');
  }, [port, level]);

  // The workbench sets the scheme and moves the frame.
  const { go } = nav;
  useEffect(
    () =>
      port.subscribe((message) => {
        if (message.type === 'livediagram:theme') setAppearanceOverride(message.colourScheme);
        if (message.type !== 'livediagram:open') return;
        debugLog('[workbench] open', { kind: openKindOf(message.to) });
        go(placeOfOpen(message.to));
      }),
    [port, go],
  );

  const { back } = nav;
  const documentSession = useMemo<WorkbenchSession | null>(() => {
    if (place.kind !== 'document') return null;
    const reportDocumentPlace = (at: DocumentPlace) =>
      report({
        view: 'document',
        folderId: null,
        folderName: null,
        documentCount: null,
        ...at,
      });
    return {
      ...session,
      documentId: place.documentId,
      tabId: place.tabId,
      shareCode: place.shareCode,
      // A trashed document ends nothing here: the frame returns to the Explorer (WB60).
      end: (reason) => {
        if (reason !== 'trashed') return session.end(reason);
        toast.info(DOCUMENT_TRASHED);
        back();
      },
      frame: { back, backTitle: backTitleOf(window), reportDocumentPlace },
    };
  }, [place, session, report, back, toast]);

  return (
    <div ref={rootRef}>
      {documentSession && place.kind === 'document' ? (
        <WorkbenchSessionContext.Provider value={documentSession}>
          <EditorPage key={`${place.documentId}:${place.shareCode ?? ''}`} surface="workbench" />
        </WorkbenchSessionContext.Provider>
      ) : (
        <>
          <div className="flex min-h-dvh bg-slate-50 px-4 pb-16 pt-6 dark:bg-slate-900">
            {place.kind === 'explorer' ? <ExplorerHost view={place.node} /> : null}
          </div>
          {place.kind === 'explorer' ? (
            <ExplorerPlaceReporter view={place.node} report={report} role={level} />
          ) : null}
          <WorkbenchReconnectLine workbenchName={session.workbenchName} ended={session.ended} />
        </>
      )}
    </div>
  );
}

// Tells the workbench which Explorer view the frame shows, and the folder when it is one. The Explorer's lists are the
// index's, read inside the Explorer, so the frame names the folder by id only.
function ExplorerPlaceReporter({
  view,
  report,
  role,
}: {
  view: ExplorerView;
  report: (fields: PlaceFields) => void;
  role: WorkbenchRole;
}) {
  const folderId =
    view.kind === 'folder' ? view.id : view.kind === 'team' ? (view.folderId ?? null) : null;
  useEffect(() => {
    report(
      explorerPlaceFields({
        view: view.kind,
        folderId,
        folderName: null,
        documentCount: null,
        role,
      }),
    );
  }, [report, view.kind, folderId, role]);
  return null;
}
