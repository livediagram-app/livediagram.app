'use client';

// The mounted workspace frame (docs/specs/013-workspace/workbench-embeds.md "What renders", blueprint "The workspace
// frame"): the Explorer as it is at /explorer, without the app's surroundings, or the editor of the document opened
// in it, with Back. The place is the frame's own address; every move is the frame's own (useWorkspaceNavigation),
// told to the workbench as `livedesign:place`, and the workbench may move it with `livedesign:open`. The
// Explorer unmounts while a document is open, so the editor's shortcuts and panels are the only ones listening.
import dynamic from 'next/dynamic';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { WorkbenchOpenTarget, WorkbenchRole } from '@livedesign/api-schema';
import { setAppearanceOverride } from '@livedesign/ui';
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
import { useExplorer } from '../../explorer/ExplorerContext';
import { ExplorerPane } from '../../explorer/ExplorerPane';
import { ExplorerShell } from '../../explorer/ExplorerShell';
import type { SelectedNode } from '../../explorer/views';
import { VIEW_TITLES } from '../../explorer/view-titles';
import { teamFolderPath } from '../../explorer/routes';
import { replaceAppLocation } from '@/lib/app-location';
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

// The place `livedesign:open` asks for.
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

function titleOfNode(node: SelectedNode): string {
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
    port.send({ type: 'livedesign:ready', v: 1, scope: 'workspace', role: level });
    track('Session', 'Opened', 'WorkbenchWorkspace');
  }, [port, level]);

  // The workbench sets the scheme and moves the frame.
  const { go } = nav;
  useEffect(
    () =>
      port.subscribe((message) => {
        if (message.type === 'livedesign:theme') setAppearanceOverride(message.colourScheme);
        if (message.type !== 'livedesign:open') return;
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

  // A team page reads its folder when it mounts, as each /explorer page does: a move remounts the pane.
  const paneKey =
    place.kind === 'explorer'
      ? `${pathname}?${new URLSearchParams(search).get('id') ?? ''}&${new URLSearchParams(search).get('folder') ?? ''}`
      : '';

  return (
    <div ref={rootRef}>
      {documentSession && place.kind === 'document' ? (
        <WorkbenchSessionContext.Provider value={documentSession}>
          <EditorPage key={`${place.documentId}:${place.shareCode ?? ''}`} surface="workbench" />
        </WorkbenchSessionContext.Provider>
      ) : (
        <>
          <ExplorerShell>
            <ExplorerPane key={paneKey} />
            <ExplorerPlaceReporter report={report} role={level} />
          </ExplorerShell>
          <WorkbenchReconnectLine workbenchName={session.workbenchName} ended={session.ended} />
        </>
      )}
    </div>
  );
}

// Tells the workbench which Explorer view the frame shows, once its lists are in: the folder shown and how many
// documents sit directly in it, so a workbench can offer something of its own beside an empty folder.
function ExplorerPlaceReporter({
  report,
  role,
}: {
  report: (fields: PlaceFields) => void;
  role: WorkbenchRole;
}) {
  const { selected, loading, folderById, documentsByFolder, teamFolders } = useExplorer();
  const folderId = selected.kind === 'folder' ? selected.id : null;
  // A team's folder lives on its team's page (WB52): a frame started on one moves there, in place.
  const teamFolder =
    folderId && !loading && !folderById.has(folderId)
      ? (teamFolders.find((f) => f.id === folderId) ?? null)
      : null;
  useEffect(() => {
    if (teamFolder) replaceAppLocation(teamFolderPath(teamFolder.teamId, teamFolder.id));
  }, [teamFolder]);
  const folderName = folderId ? (folderById.get(folderId)?.name ?? null) : null;
  const documentCount = folderId ? (documentsByFolder.get(folderId)?.length ?? 0) : null;
  useEffect(() => {
    if (loading || teamFolder) return;
    report(explorerPlaceFields({ view: selected.kind, folderId, folderName, documentCount, role }));
  }, [report, loading, teamFolder, selected.kind, folderId, folderName, documentCount, role]);
  return null;
}
