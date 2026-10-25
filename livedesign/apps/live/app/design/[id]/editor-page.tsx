'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, type ReactNode } from 'react';
import { setSessionSharePassword } from '@/lib/api-client';
import { ensureIconCatalogs } from '@/lib/icon-registry';
import { DESIGN_CONTENT_CODE, EDITOR_SURFACE_CODE } from '@/lib/editor-deferred-code';
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
import { surfaceFlags, type EditorSurface } from './editor-surface';
import { MentionContext } from '@/components/canvas/collab/comment/MentionContext';
import { isEditorPath } from '@/lib/legacy-editor-path';

const NotFound = dynamic(() => import('@/components/chrome/NotFound').then((m) => m.NotFound), {
  ssr: false,
});

const DesignTrashedCard = dynamic(
  () => import('@/components/chrome/DesignTrashedCard').then((m) => m.DesignTrashedCard),
  { ssr: false },
);
const SharePasswordGate = dynamic(
  () => import('@/components/dialogs/SharePasswordGate').then((m) => m.SharePasswordGate),
  { ssr: false },
);

// `surface` says where the editor runs (editor-surface.ts): the app (/design), the read-only embed
// view (/embed, docs/specs/013-workspace/embeds.md), or a workbench's frame (/embed/workbench,
// docs/specs/013-workspace/workbench-embeds.md). Same state, same EditorView, with the chrome /
// identity / edit gates flipped by it.
export default function LivePage({ surface = 'app' }: { surface?: EditorSurface } = {}) {
  const state = useEditorState({ surface });
  const { embedMode, workbenchMode, appChrome } = surfaceFlags(surface);
  // Anonymous telemetry (docs/specs/017-telemetry/telemetry.md): one emit per rendered embed iframe
  // design, and one per design-scope workbench frame that mounts the editor (a workspace frame counts its own
  // mount, WorkspaceFrame). Fires once on mount.
  // A workspace frame's hooks (Back), or null.
  const workspaceFrame = useWorkbenchSession()?.frame ?? null;
  const inWorkspaceFrame = workspaceFrame !== null;
  useEffect(() => {
    if (surface === 'embed') track('Session', 'Opened', 'Embed');
    if (surface === 'workbench' && !inWorkspaceFrame) track('Session', 'Opened', 'Workbench');
  }, [surface, inWorkspaceFrame]);
  // Prefetch the async icon-catalogue chunk (~60 kB of glyph data kept out of
  // the first-load JS, see lib/icon-registry.ts) as soon as the editor
  // mounts, so it downloads in parallel with the design fetch / hydration.
  // By the time a design's icons render — or the user opens the Icons /
  // Technology palette tab — the data is almost always already in, keeping
  // the placeholder window to a first-paint blink at worst. Fire-and-forget:
  // ensureIconCatalogs never rejects (a failure logs and retries on the next
  // consumer mount), and every icon surface still self-loads via
  // useIconCatalogs, so this is purely a head start.
  useEffect(() => {
    void ensureIconCatalogs();
  }, []);
  // The code the editor loads on demand (lib/editor-deferred-code.ts): what a board may draw on open
  // alongside the design request, and the surfaces someone opens once the design has rendered.
  useEffect(() => prefetchWhenIdle(DESIGN_CONTENT_CODE), []);
  useEffect(
    () => (state.loadingDesign ? undefined : prefetchWhenIdle(EDITOR_SURFACE_CODE)),
    [state.loadingDesign],
  );
  // An access change just reloaded us (lib/access-notice.ts): taken once, on mount, so a refusal can say why. The
  // first page after the eject always takes it, whatever it shows (the editor, a password prompt, a refusal).
  const [accessEnded] = useState(() => takeAccessEnded());
  // Tab title reflects the design: "<name> | livedesign" (falls back to
  // Untitled when the design has no name yet). Updates as the user renames.
  useEffect(() => {
    const name = state.designName?.trim();
    document.title = `${name || 'Untitled design'} | livedesign`;
  }, [state.designName]);
  const {
    designNotFound,
    loadError,
    sharePasswordGate,
    loadingDesign,
    designOwnerName,
    setSharePasswordGate,
    setLoadingDesign,
    setPasswordRetry,
  } = state;
  // Whose data the owner-scoped providers read: nobody's while the reader is the 'self' placeholder,
  // which a design in This Browser opens under (docs/specs/006-design/offline-mode.md "Instant open").
  const ownerId = state.selfParticipant?.id === 'self' ? null : (state.selfParticipant?.id ?? null);
  // The design is in the Trash (docs/specs/013-workspace/trash.md): from the
  // load, the room, or a refused save. Ahead of every other status because it
  // can arrive mid-session, over an editor that loaded fine.
  if (state.designTrashed.trashed) {
    // A workbench cannot restore: Restore is an ownership power outside its session.
    const card = (
      <DesignTrashedCard
        restorable={workbenchMode ? null : state.designTrashed.restorable}
        onRestore={state.designTrashed.restore}
      />
    );
    return !appChrome ? (
      <EmbedShell frame={workspaceFrame}>{card}</EmbedShell>
    ) : (
      <StatusShell title="Design deleted">{card}</StatusShell>
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
      <EmbedShell frame={workspaceFrame}>{card}</EmbedShell>
    ) : (
      <StatusShell title="Couldn’t load design">{card}</StatusShell>
    );
  }

  if (designNotFound) {
    // An address that names no design is a missing page, not a missing design. A workbench's session always
    // names a design, whatever its frame's address.
    const page = !workbenchMode && !isEditorPath(window.location.pathname);
    // The create-new escape opens the full app in a new tab from a frame
    // (rather than navigating the host page's iframe), in place otherwise.
    return !appChrome ? (
      <EmbedShell frame={workspaceFrame}>
        <NotFound
          page={page}
          onCreateNew={() => window.open(`${window.location.origin}/new`, '_blank', 'noopener')}
          // In a workspace frame the Explorer is a step back, inside the frame.
          onOpenExplorer={workspaceFrame?.back}
        />
      </EmbedShell>
    ) : (
      // No Explorer panel beside it: the card stands alone and offers the Explorer as a button
      // (docs/specs/007-editor/new-design-route.md "Unknown addresses").
      <StatusShell
        title={
          page
            ? 'Page not found'
            : accessEnded !== null
              ? 'No Longer Shared With You'
              : 'Design not found'
        }
      >
        <NotFound
          page={page}
          accessEnded={accessEnded !== null}
          onCreateNew={() => window.location.assign(`${window.location.origin}/new`)}
          onOpenExplorer={() => window.location.assign(`${window.location.origin}/explorer`)}
        />
      </StatusShell>
    );
  }

  // Password gate (docs/specs/013-workspace/share-password.md): a visitor opened a protected design's
  // share link and hasn't supplied a valid password yet. Submitting
  // sets the session password and bumps passwordRetry to re-run the
  // bootstrap, which now carries the password on every request. In an
  // embed the gate renders headerless inside the iframe (docs/specs/013-workspace/embeds.md).
  if (sharePasswordGate) {
    return (
      <StatusShell title="Password required" showHeader={!embedMode}>
        <SharePasswordGate
          invalid={sharePasswordGate.invalid}
          ownerName={designOwnerName}
          onSubmit={(pw) => {
            setSharePasswordGate(null);
            setSessionSharePassword(pw);
            setLoadingDesign(true);
            setPasswordRetry((n) => n + 1);
          }}
        />
      </StatusShell>
    );
  }

  if (loadingDesign) {
    // Arriving from the hero's launch window, the load holds the quiet blank canvas /new showed.
    return <OpeningScreen />;
  }

  return (
    <EditorContext.Provider value={state}>
      {/* Who the comment composers can @-mention (docs/specs/012-collaboration/comment-mentions.md). */}
      <MentionContext.Provider value={state.commentMentions}>
        <EditorView />
      </MentionContext.Provider>
      {/* Moving this browser's designs in This Browser after signing in
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
  return (
    <div className="flex h-dvh flex-col">
      {showHeader ? (
        <EditorHeader
          designName={title}
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
}: {
  children: ReactNode;
  frame?: WorkspaceFrameHooks | null;
}) {
  return (
    <main className="relative h-dvh bg-slate-50 dark:bg-slate-950">
      {frame ? <WorkbenchBackButton onBack={frame.back} backTitle={frame.backTitle} /> : null}
      {children}
    </main>
  );
}
