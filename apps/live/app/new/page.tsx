'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EditorHeader } from '@/components/EditorHeader';
import { Explorer } from '@/components/Explorer';
import { ApiErrorPage } from '@/components/ApiErrorPage';
import { TemplatePicker } from '@/components/TemplatePicker';
import { useClerkApiBootstrap } from '@/hooks/useClerkApiBootstrap';
import {
  apiCreateDiagram,
  apiListDiagrams,
  apiListSharedWith,
  apiLoadSelf,
  apiSaveSelf,
  apiSetDiagramFolder,
  DIAGRAM_LIST_LOAD_SAFETY_MS,
  type DiagramListItem,
  type SharedWithItem,
} from '@/lib/api-client';
import { useConfirm } from '@/hooks/useConfirm';
import { useDiagramListActions } from '@/hooks/useDiagramListActions';
import { useToast } from '@/hooks/useToast';
import { useFolders } from '@/hooks/useFolders';
import { randomColor, randomName, type Participant } from '@/lib/identity';
import { titleCaseType, track } from '@/lib/telemetry';
import { ensureGuestSelfId, markNameConfirmed } from '@/lib/local-identity';
import { buildTemplatedTab } from '@/lib/template-builders';
import type { TemplateKind } from '@/lib/templates';
import { getTheme, THEMES, type ThemeId } from '@/lib/themes';

// Dedicated welcome / create-new flow — see specs/14-new-diagram-route.md.
// Owns identity bootstrap, template + theme choice, and the actual
// "commit a new diagram" handoff. Once the user picks (or skips), we
// POST the seeded diagram and navigate to /live/diagram/<id> where
// the editor route picks it up cleanly.
export default function NewDiagramPage() {
  // Stable placeholder so the first paint matches the SSG render — the
  // real participant lands once `useLayoutEffect` runs.
  const [self, setSelf] = useState<Participant>({
    id: 'pending',
    name: 'Guest',
    color: '#0ea5e9',
    status: 'online',
  });
  // Two-phase ready:
  //   - `ready` flips as soon as we have a stable local id + name. This
  //     unblocks render so the picker shows even when the API is slow
  //     or offline (a stalled `apiLoadSelf` used to leave this
  //     route stuck on the spinner forever).
  //   - The API roundtrip then runs in the background and replaces the
  //     local stub with the server-side participant if one exists.
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Set when the create POST fails (network / 5xx). Shows a retryable
  // error instead of navigating to the editor for a diagram that was
  // never persisted (which would 404). The ref keeps the last attempt's
  // args so Retry can re-run the exact same create.
  const [createError, setCreateError] = useState(false);
  const lastCreateArgs = useRef<{
    kind: TemplateKind | null;
    name: string;
    themeId: ThemeId;
  } | null>(null);

  // Clerk wiring (token provider + guest→authed migration) — same
  // hook as the editor route; see hooks/useClerkApiBootstrap.ts.
  const { authLoaded, clerkUserId } = useClerkApiBootstrap();

  useEffect(() => {
    document.title = 'New diagram | livediagram';
  }, []);

  // Explorer panel state. Lives on this page so the user can hop back
  // into an existing diagram without first having to commit a new one
  // — the welcome flow shouldn't be a dead end. List + loading are
  // sourced from the same API the editor uses, keyed by the local
  // self id once it's available.
  const [diagramList, setDiagramList] = useState<DiagramListItem[]>([]);
  // Folder state + mutations via the shared useFolders hook. The
  // ownerId is `'pending'` until the post-mount effect resolves
  // self.id, so we gate the hook on a real id — passing `null`
  // tells the hook to no-op until the real owner arrives, at
  // which point autoLoad fires the list fetch.
  const {
    folders,
    createFolder,
    renameFolder,
    deleteFolder: hookDeleteFolder,
  } = useFolders(self.id === 'pending' ? null : self.id);
  const [sharedDiagrams, setSharedDiagrams] = useState<SharedWithItem[]>([]);
  const [diagramListLoading, setDiagramListLoading] = useState(true);
  const [explorerPosition, setExplorerPosition] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    // Wait for Clerk to settle so a signed-in user gets the Clerk
    // userId, not a freshly-minted guest UUID.
    if (!authLoaded) return;
    const selfId = clerkUserId ?? ensureGuestSelfId();
    const local: Participant = {
      id: selfId,
      name: randomName(),
      color: randomColor(),
      status: 'online',
    };
    setSelf(local);
    setReady(true);

    // Safety net mirrors the editor route: hung API leaves the
    // Explorer skeleton up otherwise. 10s feels right — long enough
    // for a real fetch to complete, short enough that a dead network
    // surfaces an empty list rather than an indefinite spinner.
    const safety = window.setTimeout(
      () => setDiagramListLoading(false),
      DIAGRAM_LIST_LOAD_SAFETY_MS,
    );
    void (async () => {
      const stored = await apiLoadSelf(selfId).catch(() => null);
      if (stored) {
        setSelf({ ...stored, status: 'online' });
      } else {
        await apiSaveSelf(local).catch(() => {});
      }
      // Folders are loaded by useFolders' autoLoad effect once
      // self.id resolves to a real value — don't double-fetch
      // here.
      const [list, sharedList] = await Promise.all([
        apiListDiagrams(selfId).catch(() => null),
        apiListSharedWith(selfId).catch(() => null),
      ]);
      window.clearTimeout(safety);
      setDiagramList(list ?? []);
      setSharedDiagrams(sharedList ?? []);
      setDiagramListLoading(false);
    })();

    return () => window.clearTimeout(safety);
  }, [authLoaded, clerkUserId]);

  // Single commit point — shared by the Submit (Create Diagram) and
  // Skip / X paths. Submit passes a template + theme; Skip passes
  // null + 'brand' for a fresh empty starter tab. Either way we
  // persist the diagram so the editor route lands on a real row.
  const commitNewDiagram = async (
    templateKind: TemplateKind | null,
    name: string,
    themeId: ThemeId,
  ) => {
    if (submitting) return;
    setSubmitting(true);
    lastCreateArgs.current = { kind: templateKind, name, themeId };
    // Identity persistence first so any subsequent room broadcasts
    // carry the chosen name + colour.
    const trimmed = name.trim() || self.name;
    if (trimmed !== self.name) {
      const updated: Participant = { ...self, name: trimmed };
      setSelf(updated);
      await apiSaveSelf(updated).catch(() => {});
    }
    markNameConfirmed();

    const diagramId = crypto.randomUUID();
    const tabId = crypto.randomUUID();
    const tab = templateKind
      ? buildTemplatedTab(templateKind, themeId, tabId, 'Tab 1')
      : {
          // Skipped — fall through to a blank canvas with the chosen
          // theme's backdrop so the editor loads in the user's style
          // without any seeded elements.
          id: tabId,
          name: 'Tab 1',
          elements: [],
          theme: themeId,
          backgroundColor: getTheme(themeId).backgroundColor,
          backgroundPattern: getTheme(themeId).backgroundPattern,
          patternColor: getTheme(themeId).patternColor,
          templateChosen: true,
        };
    try {
      await apiCreateDiagram(self.id, {
        id: diagramId,
        name: 'Untitled diagram',
        tabs: [tab],
      });
    } catch {
      // Create FAILED (network down / 5xx). Don't navigate to the editor
      // for a diagram that was never persisted — that lands on a 404.
      // Surface a retryable error card instead (Retry re-runs this exact
      // create from lastCreateArgs).
      setSubmitting(false);
      setCreateError(true);
      return;
    }
    // Anonymous telemetry (spec/22): a diagram was created. No id or
    // name is sent — just the event. The chosen theme is recorded
    // alongside since the picker on this screen is the first place a
    // theme gets set; later switches in the editor emit the same way
    // (Theme / Changed / <label>).
    track('Diagram', 'Created');
    const themeLabel =
      THEMES.find((t) => t.id === themeId)?.label ??
      themeId.charAt(0).toUpperCase() + themeId.slice(1);
    track('Theme', 'Changed', themeLabel);
    if (templateKind) track('Template', 'Used', titleCaseType(templateKind));
    // Placement context from the URL. /live/new?folder=<id> lets the
    // explorer drop a fresh diagram straight into the folder the user
    // was browsing; /live/new?team=<id>(&folder=<id>) sends it into
    // that team's shared library (spec/35), scoped to the open team
    // folder when one is set. Done as a follow-up PUT rather than
    // baking placement into POST /diagrams so the create endpoint
    // signature stays stable and the assignment can fail
    // independently (network glitch → diagram lives in the personal
    // Unsorted, user can move it later).
    const params = new URLSearchParams(window.location.search);
    const targetFolderId = params.get('folder');
    const targetTeamId = params.get('team');
    if (targetTeamId) {
      await apiSetDiagramFolder(self.id, diagramId, targetFolderId, targetTeamId).catch(() => {});
    } else if (targetFolderId) {
      await apiSetDiagramFolder(self.id, diagramId, targetFolderId).catch(() => {});
    }
    window.location.assign(`/diagram/${diagramId}`);
  };

  // Explorer-row mutations come from the shared useDiagramListActions
  // hook (the same behaviours behind the editor's Explorer panel and
  // /explorer), so the optimistic updates, API calls, telemetry, and
  // confirm copy stay single-sourced.
  const confirm = useConfirm();
  const toast = useToast();
  const {
    openDiagram,
    deleteDiagram,
    deleteFolder,
    moveDiagramToFolder,
    duplicateDiagram,
    dismissSharedDiagram,
  } = useDiagramListActions({
    ownerId: self.id === 'pending' ? null : self.id,
    diagramList,
    setDiagramList,
    confirm,
    toast,
    deleteFolderFromHook: hookDeleteFolder,
    // Stay on the welcome flow after a duplicate; just refresh the
    // list so the copy's row appears.
    afterDuplicate: async () => {
      const list = await apiListDiagrams(self.id).catch(() => null);
      setDiagramList(list ?? []);
    },
    sharedDiagrams,
    setSharedDiagrams,
  });

  if (createError) {
    return (
      <div className="flex h-dvh flex-col">
        <EditorHeader
          diagramName="New diagram"
          hideTitle
          showShare={false}
          shareable={false}
          onOpenShare={() => {}}
          onRename={() => {}}
        />
        <main className="relative flex-1 bg-slate-50 dark:bg-slate-950">
          <ApiErrorPage
            title="Couldn’t create the diagram"
            message="We couldn’t reach the server to create your diagram. Check your connection and try again."
            onRetry={() => {
              setCreateError(false);
              const a = lastCreateArgs.current;
              if (a) void commitNewDiagram(a.kind, a.name, a.themeId);
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <EditorHeader
        diagramName="New diagram"
        hideTitle
        showShare={false}
        shareable={false}
        onOpenShare={() => {}}
        onRename={() => {}}
      />
      {/* TemplatePicker positions itself absolute over its parent;
          the relative wrapper gives it a stage. Below it the
          backdrop reads as an empty canvas — same idle look as the
          editor route under the welcome modal it used to render
          inline. */}
      <main className="relative flex-1 bg-slate-50">
        {ready ? (
          <TemplatePicker
            mode="welcome"
            participant={self}
            currentThemeId="brand"
            onPick={(kind, name, themeId) => void commitNewDiagram(kind, name, themeId)}
            onSkip={() => void commitNewDiagram(null, self.name, 'brand')}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="animate-spin text-brand-500"
              aria-hidden
            >
              <circle cx="16" cy="16" r="12" strokeOpacity="0.18" />
              <path d="M28 16a12 12 0 0 0-12-12" />
            </svg>
          </div>
        )}
        {/* Explorer is the one piece of chrome that stays visible on
            the welcome route — clicking an existing diagram is the
            primary escape hatch from "I came here by accident". The
            New Diagram CTA is suppressed here because the user is
            already in the new-diagram flow. */}
        <Explorer
          position={explorerPosition}
          diagrams={diagramList}
          folders={folders}
          loading={diagramListLoading}
          // Returning users land here with diagrams already saved;
          // expanding the Recent accordion on mount means they see
          // their library straight away rather than having to click
          // the header to reveal it.
          defaultRecentOpen={diagramList.length > 0}
          shared={sharedDiagrams}
          onDismissShared={(diagramId) => void dismissSharedDiagram(diagramId)}
          // Open to guests too: the standalone page is not gated (it
          // keys off the per-browser id for signed-out visitors, see
          // app/explorer/page.tsx), so the button surfaces for everyone.
          onOpenFullExplorer={() => window.location.assign('/explorer/recent')}
          currentDiagramId={null}
          onMoveTo={(x, y) => setExplorerPosition({ x, y })}
          onReset={() => setExplorerPosition(null)}
          onOpenDiagram={openDiagram}
          onDeleteDiagram={deleteDiagram}
          onDuplicateDiagram={(id) => void duplicateDiagram(id)}
          onCreateFolder={createFolder}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolder}
          onMoveDiagramToFolder={moveDiagramToFolder}
        />
      </main>
    </div>
  );
}
