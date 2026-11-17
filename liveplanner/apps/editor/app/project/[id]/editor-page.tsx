'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, type ReactNode } from 'react';
import { setSessionSharePassword } from '@/lib/api-client';
import { ensureIconCatalogs } from '@liveworkspace/workbench/lib/icon-registry';
import { PROJECT_CONTENT_CODE, EDITOR_SURFACE_CODE } from '@/lib/editor-deferred-code';
import { prefetchWhenIdle } from '@liveworkspace/workbench/lib/idle-prefetch';
import {
  useWorkbenchSession,
  type WorkspaceFrameHooks,
} from '@/components/providers/workbench-session-context';
import { WorkbenchBackButton } from '@/components/chrome/WorkbenchChrome';
import { track } from '@/lib/telemetry';
import { EditorHeader } from '@/components/chrome/EditorHeader';
import { OpeningScreen } from '@/components/chrome/OpeningScreen';
// Static, unlike the other status cards: it must render offline (docs/specs/007-editor/load-recovery.md
// "Offline"); its recovery tools are the lazy part.
import { LoadErrorCard } from '@/components/chrome/LoadErrorCard';
import { ConversionHandoff } from '@/components/dialogs/ConversionHandoff';
import { LocalMovePrompt } from '@/components/dialogs/LocalMovePrompt';
import { EditorContext } from './EditorContext';
import { EditorView } from './EditorView';
import { useEditorState } from './useEditorState';
import { takeAccessEnded } from '@/lib/access-notice';
import { useAuthHrefs } from '@liveworkspace/workbench/components/chrome/auth-routes';
import {
  addressHasShareCode,
  notFoundReason,
  notFoundTitle,
} from '@liveworkspace/workbench/lib/not-found-reason';
import { surfaceFlags, type EditorSurface } from '@liveworkspace/workbench/lib/editor-surface';
import { MentionContext } from '@/components/canvas/collab/comment/MentionContext';
import { CommentReactionsProvider } from '@liveworkspace/workbench/components/comments/CommentReactionsContext';
import { projectIdFromPath, isEditorPath } from '@/lib/editor-path';
import { planGrantRefusal } from '@/lib/api/plan-grants';
import { archivedByIndex, archivedChangeFolderHref } from '@liveworkspace/workbench/lib/archived';
import { useArchivedAddress } from '@liveworkspace/workbench/lib/useArchivedAddress';
import { useBrowserTabTitle } from '@liveworkspace/workbench/hooks/editor/useBrowserTabTitle';

const NotFound = dynamic(() => import('@/components/chrome/NotFound').then((m) => m.NotFound), {
  ssr: false,
});

const ProjectTrashedCard = dynamic(
  () => import('@/components/chrome/ProjectTrashedCard').then((m) => m.ProjectTrashedCard),
  { ssr: false },
);
const SharePasswordGate = dynamic(
  () => import('@/components/dialogs/SharePasswordGate').then((m) => m.SharePasswordGate),
  { ssr: false },
);

// `surface` says where the editor runs (editor-surface.ts): the app (/project), the read-only embed
// view (/embed, docs/specs/013-workspace/embeds.md), or a workbench's frame (/embed/workbench,
// docs/specs/013-workspace/workbench-embeds.md). Same state, same EditorView, with the chrome /
// identity / edit gates flipped by it.
export default function LivePage({ surface = 'app' }: { surface?: EditorSurface } = {}) {
  const state = useEditorState({ surface });
  const { embedMode, workbenchMode, appChrome } = surfaceFlags(surface);
  // Anonymous telemetry (docs/specs/017-telemetry/telemetry.md): one emit per rendered embed iframe
  // project, and one per project-scope workbench frame that mounts the editor (a workspace frame counts its own
  // mount, WorkspaceFrame). Fires once on mount.
  // A workspace frame's hooks (Back), or null.
  const workspaceFrame = useWorkbenchSession()?.frame ?? null;
  const inWorkspaceFrame = workspaceFrame !== null;
  useEffect(() => {
    if (surface === 'embed') track('Session', 'Opened', 'Embed');
    if (surface === 'workbench' && !inWorkspaceFrame) track('Session', 'Opened', 'Workbench');
  }, [surface, inWorkspaceFrame]);
  // Prefetch the async icon-catalogue chunk (~60 kB of glyph data kept out of
  // the first-load JS, see @liveworkspace/workbench/lib/icon-registry.ts) as soon as the editor
  // mounts, so it downloads in parallel with the project fetch / hydration.
  // By the time a project's icons render — or the user opens the Icons /
  // Technology palette tab — the data is almost always already in, keeping
  // the placeholder window to a first-paint blink at worst. Fire-and-forget:
  // ensureIconCatalogs never rejects (a failure logs and retries on the next
  // consumer mount), and every icon surface still self-loads via
  // useIconCatalogs, so this is purely a head start.
  useEffect(() => {
    void ensureIconCatalogs();
  }, []);
  // The code the editor loads on demand (lib/editor-deferred-code.ts): what a board may draw on open
  // alongside the project request, and the surfaces someone opens once the project has rendered.
  useEffect(() => prefetchWhenIdle(PROJECT_CONTENT_CODE), []);
  useEffect(
    () => (state.loadingProject ? undefined : prefetchWhenIdle(EDITOR_SURFACE_CODE)),
    [state.loadingProject],
  );
  // An access change just reloaded us (lib/access-notice.ts): taken once, on mount, so a refusal can say why. The
  // first page after the eject always takes it, whatever it shows (the editor, a password prompt, a refusal).
  const [accessEnded] = useState(() => takeAccessEnded());
  // Where a signed-out visitor's Sign In goes: the sign-in page, back to this address (the not-found card's
  // `sign-in` case).
  const { signInHref } = useAuthHrefs();
  // The plan the address names, and whether this browser holds it archived (@liveworkspace/workbench/lib/archived):
  // read once, on mount, so an archived one never opens.
  const { id: archivedId, here: archivedHere } = useArchivedAddress(
    'liveplanner',
    projectIdFromPath,
  );
  // Tab title reflects the project: "<name> | liveplanner" (falls back to
  // Untitled when the project has no name yet). Updates as the user renames. Held there (useBrowserTabTitle): Next.js
  // commits the route's static "liveplanner" title after hydration and wrote it over the plan's name.
  useBrowserTabTitle(`${state.projectName?.trim() || 'Untitled plan'} | liveplanner`);
  const {
    projectNotFound,
    loadError,
    sharePasswordGate,
    loadingProject,
    projectOwnerName,
    setSharePasswordGate,
    setLoadingProject,
    setPasswordRetry,
  } = state;
  // Whose data the owner-scoped providers read: nobody's while the reader is the 'self' placeholder,
  // which a project in This Browser opens under (docs/specs/006-project/offline-mode.md "Instant open").
  const ownerId = state.selfParticipant?.id === 'self' ? null : (state.selfParticipant?.id ?? null);
  // Archived by its owner (liveworkspace/docs/specs/004-index/one-explorer.md "Archived"): the index refused the
  // grant as `archived`, or this browser holds it archived. It doesn't open; Change Folder moves it out, from the
  // Explorer's Archived. A frame can't take the person there, so it offers only the way back.
  if (archivedHere || (projectNotFound && archivedByIndex(archivedId, planGrantRefusal))) {
    const card = (
      <NotFound
        archived={
          appChrome && archivedId
            ? {
                onChangeFolder: () =>
                  window.location.assign(
                    archivedChangeFolderHref(archivedId, window.location.origin),
                  ),
              }
            : {}
        }
        onCreateNew={() => window.location.assign(`${window.location.origin}/new`)}
        onOpenExplorer={
          appChrome
            ? () => window.location.assign(`${window.location.origin}/explorer`)
            : workspaceFrame?.back
        }
      />
    );
    return !appChrome ? (
      <EmbedShell frame={workspaceFrame} title="Plan Archived">
        {card}
      </EmbedShell>
    ) : (
      <StatusShell title="Plan Archived">{card}</StatusShell>
    );
  }

  // The project is in the Trash (docs/specs/013-workspace/trash.md): from the
  // load, the room, or a refused save. Ahead of every other status because it
  // can arrive mid-session, over an editor that loaded fine.
  if (state.projectTrashed.trashed) {
    // A workbench cannot restore: Restore is an ownership power outside its session.
    const card = (
      <ProjectTrashedCard
        restorable={workbenchMode ? null : state.projectTrashed.restorable}
        onRestore={state.projectTrashed.restore}
      />
    );
    return !appChrome ? (
      <EmbedShell frame={workspaceFrame} title="Plan Deleted">
        {card}
      </EmbedShell>
    ) : (
      <StatusShell title="Plan Deleted">{card}</StatusShell>
    );
  }

  // The load FAILED (network / 5xx) rather than 404'd. Retryable, so
  // show the error card
  // instead of NotFound. Retry re-runs hydration via a full reload.
  if (loadError) {
    const card = <LoadErrorCard embed={!appChrome} ownerId={ownerId} />;
    // Embed and workbench frames get the bare retry card: an app header + Explorer
    // panel inside someone else's page is noise (docs/specs/013-workspace/embeds.md).
    return !appChrome ? (
      <EmbedShell frame={workspaceFrame} title="Couldn’t Load Plan">
        {card}
      </EmbedShell>
    ) : (
      <StatusShell title="Couldn’t Load Plan">{card}</StatusShell>
    );
  }

  if (projectNotFound) {
    // An address that names no project is a missing page, not a missing project. An embed or a
    // workbench frame is never a missing page: its address is the frame route itself, not the editor path.
    const page = appChrome && !isEditorPath(window.location.pathname);
    // Which card (new-project-route.md "Which not-found card"), never by whether the plan exists: a
    // share code the api refused is a dead link, unknown, revoked or expired alike, and a signed-out
    // visitor is offered Sign In (never in a frame).
    const reason = notFoundReason({
      page,
      accessEnded: accessEnded !== null,
      shareLink: addressHasShareCode(window.location.search),
      signedOut: appChrome && !state.accountUserId,
    });
    // The create-new escape opens the full app in a new tab from a frame
    // (rather than navigating the host page's iframe), in place otherwise.
    return !appChrome ? (
      <EmbedShell frame={workspaceFrame} title={notFoundTitle(reason, 'plan', true)}>
        <NotFound
          reason={reason}
          embed
          onCreateNew={() => window.open(`${window.location.origin}/new`, '_blank', 'noopener')}
          // In a workspace frame the Explorer is a step back, inside the frame.
          onOpenExplorer={workspaceFrame?.back}
        />
      </EmbedShell>
    ) : (
      // No Explorer panel beside it: the card stands alone and offers the Explorer as a button
      // (docs/specs/007-editor/new-project-route.md "Unknown addresses").
      <StatusShell title={notFoundTitle(reason, 'plan')}>
        <NotFound
          reason={reason}
          signInHref={signInHref}
          onCreateNew={() => window.location.assign(`${window.location.origin}/new`)}
          onOpenExplorer={() => window.location.assign(`${window.location.origin}/explorer`)}
        />
      </StatusShell>
    );
  }

  // Password gate (docs/specs/013-workspace/share-password.md): a visitor opened a protected project's
  // share link and hasn't supplied a valid password yet. Submitting
  // sets the session password and bumps passwordRetry to re-run the
  // bootstrap, which now carries the password on every request. In an
  // embed the gate renders headerless inside the iframe (docs/specs/013-workspace/embeds.md).
  if (sharePasswordGate) {
    return (
      <StatusShell title="Password Required" showHeader={!embedMode}>
        <SharePasswordGate
          invalid={sharePasswordGate.invalid}
          changed={sharePasswordGate.changed}
          ownerName={projectOwnerName}
          onSubmit={(pw) => {
            setSharePasswordGate(null);
            setSessionSharePassword(pw);
            setLoadingProject(true);
            setPasswordRetry((n) => n + 1);
          }}
        />
      </StatusShell>
    );
  }

  if (loadingProject) {
    // Arriving from the hero's launch window, the load holds the quiet blank canvas /new showed.
    return <OpeningScreen />;
  }

  return (
    <EditorContext.Provider value={state}>
      {/* Who the comment composers can @-mention (docs/specs/012-collaboration/comment-mentions.md). */}
      <MentionContext.Provider value={state.commentMentions}>
        {/* Who reacts to comments, and how (docs/specs/012-collaboration/comment-reactions.md); a card's threads
            provide their own. */}
        <CommentReactionsProvider value={state.commentReactions}>
          <EditorView />
        </CommentReactionsProvider>
      </MentionContext.Provider>
      {/* Moving this browser's projects in This Browser after signing in
          (docs/specs/014-identity/auth-and-guest-access.md); never inside someone else's page. */}
      {appChrome ? <LocalMovePrompt /> : null}
      {/* A Take Offline or Sync the Explorer page handed over in the address. */}
      <ConversionHandoff />
    </EditorContext.Provider>
  );
}

// Full-height status chrome (deleted / error / not-found / password gate): the
// editor header (title-only, every action disabled) over a slate surface
// that holds the status card alone. No Explorer panel and no menu button: the
// Explorer opens only from the canvas's menu button
// (docs/specs/007-editor/toolbar-layout.md). Shared by the status branches so
// the header + main wrapper isn't repeated per branch.
function StatusShell({
  title,
  showHeader = true,
  children,
}: {
  title: string;
  showHeader?: boolean;
  children: ReactNode;
}) {
  // The tab names the screen, not the item it stands in for (useBrowserTabTitle's `status`): a missing
  // plan's tab never reads as an empty one.
  useBrowserTabTitle(`${title} | liveplanner`, { status: true });
  return (
    <div className="flex h-dvh flex-col">
      {showHeader ? (
        <EditorHeader
          projectName={title}
          hideTitle
          showShare={false}
          shareable={false}
          onOpenShare={() => {}}
          onRename={() => {}}
        />
      ) : null}
      <main className="relative flex-1 bg-slate-50 dark:bg-slate-950">{children}</main>
    </div>
  );
}

// The bare embed status surface (docs/specs/013-workspace/embeds.md): no header, no Explorer — an
// app header + Explorer inside someone else's iframe would be noise.
// A frame's bare status screen; a workspace frame's carries its Back (WB59), top left.
function EmbedShell({
  children,
  frame = null,
  title = null,
}: {
  children: ReactNode;
  frame?: WorkspaceFrameHooks | null;
  // The status the card stands for, naming the browser tab as the app's status shell does (never "Untitled").
  title?: string | null;
}) {
  useBrowserTabTitle(title ? `${title} | liveplanner` : null, { status: true });
  return (
    <main className="relative h-dvh bg-slate-50 dark:bg-slate-950">
      {frame ? (
        <div className="absolute top-3 left-3 z-[var(--z-chrome)]">
          <WorkbenchBackButton onBack={frame.back} backTitle={frame.backTitle} labelled />
        </div>
      ) : null}
      {children}
    </main>
  );
}
