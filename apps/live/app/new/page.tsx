'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EditorHeader } from '@/components/chrome/EditorHeader';
import { ApiErrorPage } from '@/components/chrome/ApiErrorPage';
import { TemplatePicker, type NewDiagramSettings } from '@/components/palette/TemplatePicker';
import { NewHereCard } from './NewHereCard';
import { RecentDiagramsCard } from './RecentDiagramsCard';
import { CustomThemeProvider } from '@/components/primitives/CustomThemeProvider';
import { AnimatedLinesBackdrop } from '@/components/canvas/AnimatedLinesBackdrop';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import {
  apiCreateDiagram,
  apiCreateFolder,
  apiGetTeamLibrary,
  apiListFolders,
  apiListTeams,
  apiLoadSelf,
  apiSaveSelf,
  apiSetDiagramFolder,
} from '@/lib/api-client';
import { offlineCreateDiagram } from '@/lib/offline/offline-store';
import { markTourPending } from '@/lib/tour-pending';
import { randomColor, randomName, type Participant } from '@/lib/identity';
import { titleCaseType, track } from '@/lib/telemetry';
import { trackDailyReturn } from '@/lib/daily-return';
import { ensureGuestSelfId, markNameConfirmed } from '@/lib/local-identity';
import { buildTemplatedTab } from '@/lib/template-builders';
import { untitledNameForTemplate, type TemplateKind } from '@livediagram/templates';
import { getTheme, THEMES } from '@/lib/themes';
import { isCustomThemeId } from '@/lib/custom-theme-registry';

// Folder shape the Settings step's placement browser consumes.
type PickerFolder = { id: string; name: string; parentId: string | null };

// Dedicated welcome / create-new flow, see specs/14-new-diagram-route.md.
// Owns identity bootstrap, template + theme choice (a two-step wizard),
// and the actual "commit a new diagram" handoff. Once the user picks (or
// skips), we POST the seeded diagram and navigate to /diagram/<id> where
// the editor route picks it up cleanly. The Explorer is NOT rendered here:
// the wizard's "Open Existing Diagram" button sends users to /explorer
// instead, keeping this screen focused on creating.
export default function NewDiagramPage() {
  // Stable placeholder so the first paint matches the SSG render; the
  // real participant lands once `useLayoutEffect` runs.
  const [self, setSelf] = useState<Participant>({
    id: 'pending',
    name: 'Guest',
    color: '#0ea5e9',
    status: 'online',
  });
  const [submitting, setSubmitting] = useState(false);
  // How many diagrams the user owns (null until known). Reported by
  // RecentDiagramsCard's fetch; gates the guided-tour card, which is for
  // first-timers and disappears once the account holds 3+ diagrams.
  const [diagramCount, setDiagramCount] = useState<number | null>(null);
  // Set when the create POST fails (network / 5xx). Shows a retryable
  // error instead of navigating to the editor for a diagram that was
  // never persisted (which would 404). The ref keeps the last attempt's
  // args so Retry can re-run the exact same create.
  const [createError, setCreateError] = useState(false);
  const lastCreateArgs = useRef<{
    kind: TemplateKind | null;
    name: string;
    // string, not ThemeId: the picker can hand back a custom `custom:<uuid>`
    // theme id (spec/44) as well as a built-in one.
    themeId: string;
    // The Settings step's choices (spec/76): diagram name, placement, offline.
    settings: NewDiagramSettings;
  } | null>(null);

  // Personal folders + teams offered by the Settings step's placement picker
  // (spec/76). Folders work for guests; teams are Clerk-only, so we only fetch
  // them once signed in. Empty until the fetch settles / for signed-out users.
  const [folders, setFolders] = useState<PickerFolder[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  // Per-team folder lists for the placement browser's second level, fetched
  // alongside the team list (teams are few, so eager Promise.all is fine).
  const [teamFolders, setTeamFolders] = useState<Record<string, PickerFolder[]>>({});

  // Clerk wiring (token provider + guest to authed migration), the same
  // hook as the editor route; see hooks/useClerkApiBootstrap.ts.
  const { authLoaded, clerkUserId } = useClerkApiBootstrap();

  // Placement context from the URL: /new?folder=<id> (Explorer's "new diagram
  // in this folder") and /new?team=<id>(&folder=<id>) (team library, spec/35)
  // pre-select the Save In picker, so what the Settings step highlights IS
  // what Create files into. The picker is the single source of truth from
  // here on; there is no separate commit-time fallback (it used to override
  // an explicit "Unsorted" choice silently).
  const [initialPlacement] = useState(() => {
    if (typeof window === 'undefined') return 'unsorted';
    const params = new URLSearchParams(window.location.search);
    const folderId = params.get('folder');
    const teamId = params.get('team');
    if (teamId) return folderId ? `team:${teamId}:folder:${folderId}` : `team:${teamId}`;
    if (folderId) return `folder:${folderId}`;
    return 'unsorted';
  });

  useEffect(() => {
    document.title = 'New diagram | livediagram';
  }, []);

  // Back/forward-cache restore: creating navigates away with
  // `submitting === true` still set, and the browser Back button
  // restores this page from bfcache exactly as frozen — leaving the
  // Create button stuck on "Creating…" forever. `pageshow` with
  // `persisted` is the restore signal; reset the transient submit
  // state so the page is usable again.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setSubmitting(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  useLayoutEffect(() => {
    // Wait for Clerk to settle so a signed-in user gets the Clerk
    // userId, not a freshly-minted guest UUID.
    if (!authLoaded) return;
    // Daily-active-returns signal (spec/22): once-per-browser-per-UTC-day,
    // gated inside the helper. Auth has settled, so guest vs signed-in is known.
    trackDailyReturn(!!clerkUserId);
    const selfId = clerkUserId ?? ensureGuestSelfId();
    const local: Participant = {
      id: selfId,
      name: randomName(),
      color: randomColor(),
      status: 'online',
    };
    setSelf(local);

    void (async () => {
      const stored = await apiLoadSelf(selfId).catch(() => null);
      if (stored) {
        setSelf({ ...stored, status: 'online' });
      } else {
        await apiSaveSelf(local).catch(() => {});
      }
    })();
  }, [authLoaded, clerkUserId]);

  // Load the placement options for the Settings step once identity resolves.
  // Personal folders only (a team's folders live under their own optgroup);
  // teams are Clerk-only so they're skipped for guests.
  useEffect(() => {
    if (self.id === 'pending') return;
    let cancelled = false;
    void (async () => {
      const list = await apiListFolders(self.id).catch(() => []);
      if (!cancelled) {
        setFolders(
          list
            .filter((f) => f.teamId == null)
            .map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })),
        );
      }
    })();
    if (clerkUserId) {
      void (async () => {
        const list = await apiListTeams(self.id).catch(() => []);
        if (cancelled) return;
        setTeams(list.map((t) => ({ id: t.id, name: t.name })));
        // Second level of the placement browser: each team's folders.
        const libs = await Promise.all(
          list.map((t) =>
            apiGetTeamLibrary(self.id, t.id)
              .then(
                (lib) =>
                  [
                    t.id,
                    lib.folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })),
                  ] as const,
              )
              .catch(() => [t.id, []] as const),
          ),
        );
        if (!cancelled) setTeamFolders(Object.fromEntries(libs));
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [self.id, clerkUserId]);

  // Inline folder creation from the Settings step's placement browser
  // (spec/76 follow-up): create in the right scope (personal, or a team's
  // library) under the open parent, merge into the picker lists, and hand
  // the new folder back so the browser can select it.
  const createPickerFolder = async (
    name: string,
    parentId: string | null,
    teamId: string | null,
  ): Promise<PickerFolder | null> => {
    try {
      const folder = await apiCreateFolder(self.id, {
        id: crypto.randomUUID(),
        name,
        parentId,
        teamId,
      });
      const pf: PickerFolder = { id: folder.id, name: folder.name, parentId: folder.parentId };
      if (teamId) {
        setTeamFolders((m) => ({ ...m, [teamId]: [...(m[teamId] ?? []), pf] }));
      } else {
        setFolders((list) => [...list, pf]);
      }
      return pf;
    } catch {
      return null;
    }
  };

  // Identity for the commit path. Clerk's chunk loads deferred, so a fast
  // click-through (or an e2e robot) can reach Create while `self` is still
  // the 'pending' placeholder — the identity bootstrap above hasn't run.
  // Creating then would file the diagram under the literal owner "pending":
  // a shared id every raced visitor collides on, and one the editor route
  // (fetching with the real id) 404s. So the commit resolves identity
  // itself: wait out the bootstrap (bounded — authLoaded flips by the
  // 5 s Clerk timeout at the latest), then fall back to the guest id.
  const selfRef = useRef(self);
  selfRef.current = self;
  const resolveSelf = async (): Promise<Participant> => {
    const deadline = Date.now() + 8000;
    while (selfRef.current.id === 'pending' && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (selfRef.current.id !== 'pending') return selfRef.current;
    const fallback = { ...selfRef.current, id: ensureGuestSelfId() };
    setSelf(fallback);
    return fallback;
  };

  // Single commit point, shared by the Create Diagram and Skip paths.
  // Submit passes a template + theme; Skip passes 'blank' + 'brand'. Either
  // way we persist the diagram so the editor route lands on a real row.
  const commitNewDiagram = async (
    templateKind: TemplateKind | null,
    name: string,
    themeId: string,
    settings: NewDiagramSettings,
  ) => {
    if (submitting) return;
    setSubmitting(true);
    // "Show me around" (the guided tour, spec/69) is a throwaway sample — always
    // create it offline (spec/76) so we don't pile guided-tour diagrams into D1.
    const offline = settings.offline || templateKind === 'guided-tour';
    lastCreateArgs.current = { kind: templateKind, name, themeId, settings };
    // The Settings step's name field wins; fall back to the per-template
    // default when it's left blank (spec/76).
    const diagramName = settings.diagramName?.trim() || untitledNameForTemplate(templateKind);
    // Never create as the 'pending' placeholder — see resolveSelf above.
    const who = await resolveSelf();
    // Identity persistence first so any subsequent room broadcasts
    // carry the chosen name + colour.
    const trimmed = name.trim() || who.name;
    if (trimmed !== who.name) {
      const updated: Participant = { ...who, name: trimmed };
      setSelf(updated);
      await apiSaveSelf(updated).catch(() => {});
    }
    markNameConfirmed();

    const diagramId = crypto.randomUUID();
    const tabId = crypto.randomUUID();
    const tab = templateKind
      ? buildTemplatedTab(templateKind, themeId, tabId, 'Tab 1')
      : {
          // Skipped: fall through to a blank canvas with the chosen
          // theme's backdrop so the editor loads in the user's style
          // without any seeded elements.
          id: tabId,
          name: 'Tab 1',
          elements: [],
          theme: themeId,
          backgroundColor: getTheme(themeId).backgroundColor,
          backgroundPattern: getTheme(themeId).backgroundPattern,
          patternColor: getTheme(themeId).patternColor,
          ...(getTheme(themeId).backgroundOpacity != null
            ? { backgroundOpacity: getTheme(themeId).backgroundOpacity }
            : {}),
          templateChosen: true,
        };
    try {
      if (offline) {
        // Offline Mode (spec/76): create the diagram in IndexedDB only. This
        // also registers its id so every later load / save routes local.
        await offlineCreateDiagram({ id: diagramId, name: diagramName, tabs: [tab] }, Date.now());
      } else {
        await apiCreateDiagram(who.id, {
          id: diagramId,
          name: diagramName,
          tabs: [tab],
        });
      }
    } catch {
      // Create FAILED (network / 5xx for cloud, or no IndexedDB for offline).
      // Don't navigate to an editor for a diagram that was never persisted
      // (that lands on a 404). Surface a retryable error card instead (Retry
      // re-runs this exact create from lastCreateArgs).
      setSubmitting(false);
      setCreateError(true);
      return;
    }
    // Anonymous telemetry (spec/22): a diagram was created. No id or name is
    // sent — the `type` records only whether it's an Offline or Cloud diagram
    // (spec/76). The chosen theme is recorded separately below.
    track('Diagram', 'Created', offline ? 'Offline' : 'Cloud');
    // Telemetry `type` must stay a preset, never user content, so a custom
    // theme reports the fixed 'Custom' rather than its name (spec/22, /44).
    const themeLabel = isCustomThemeId(themeId)
      ? 'Custom'
      : (THEMES.find((t) => t.id === themeId)?.label ??
        themeId.charAt(0).toUpperCase() + themeId.slice(1));
    track('Theme', 'Changed', themeLabel);
    if (templateKind) track('Template', 'Used', titleCaseType(templateKind));
    // Placement. The Settings step's picker (spec/76) is authoritative: the
    // URL context (/new?folder=<id>, /new?team=<id>&folder=<id>) pre-seeds it
    // on mount, so what the picker highlighted is exactly what gets filed.
    // Done as a follow-up PUT so the create endpoint signature stays stable
    // and placement can fail independently (a glitch just leaves it in the
    // personal Unsorted, movable later). Offline diagrams have no server
    // folder / team placement — skip it.
    if (!offline) {
      if (settings.teamId) {
        await apiSetDiagramFolder(
          who.id,
          diagramId,
          settings.folderId ?? null,
          settings.teamId,
        ).catch(() => {});
      } else if (settings.folderId) {
        await apiSetDiagramFolder(who.id, diagramId, settings.folderId).catch(() => {});
      }
    }
    // "Show me around" (spec/79): hand the tour intent across the hard
    // navigation via a one-shot sessionStorage flag the editor consumes.
    if (settings.tour) markTourPending();
    window.location.assign(`/diagram/${diagramId}`);
  };

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
              if (a) void commitNewDiagram(a.kind, a.name, a.themeId, a.settings);
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
      <main className="relative flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Soft animated lines give the otherwise-empty backdrop life
            behind the wizard card. Decorative + reduced-motion aware. */}
        <AnimatedLinesBackdrop />
        {/* No identity spinner: the wizard's first step is static template
            data, so it renders immediately. Identity resolves in the
            background; the picker follows the resolved participant name on
            its own (it no longer remounts on id change, which used to flash
            the card once the real id landed). Mounting CustomThemeProvider
            with a null owner until then just defers the Custom theme list
            (spec/44). */}
        <CustomThemeProvider ownerId={self.id === 'pending' ? null : self.id}>
          <TemplatePicker
            mode="welcome"
            participant={self}
            currentThemeId="brand"
            busy={submitting}
            folders={folders}
            teams={teams}
            teamFolders={teamFolders}
            initialPlacement={initialPlacement}
            onCreateFolder={createPickerFolder}
            // "Show me around" (spec/79): the Settings step offers the
            // interactive tour only to brand-new users (zero owned diagrams;
            // stricter than the < 3 gate on the sample-tour card below).
            offerTour={diagramCount === 0}
            onOpenExisting={() => window.location.assign('/explorer/recent')}
            onPick={(kind, name, themeId, settings) =>
              void commitNewDiagram(kind, name, themeId, settings)
            }
            // Empty name = "keep the resolved participant name" (commit falls
            // back to it); passing self.name here could freeze the
            // pre-bootstrap 'Guest' placeholder into the account.
            onSkip={() => void commitNewDiagram('blank', '', 'brand', { offline: false })}
          />
        </CustomThemeProvider>
        {/* The right rail beside the centred wizard (desktop-only, xl+):
            returning users get "Jump back in" (spec/14, hidden with no
            diagrams yet), and first-timers the guided tour underneath
            (spec/69), which lives here rather than posing as a template in
            the Quick Start grid. The tour card is for first-timers only:
            it waits for the diagram count (RecentDiagramsCard's fetch,
            shared via onCount) and stays hidden once the user has three or
            more diagrams. */}
        <div className="pointer-events-none absolute inset-y-0 right-4 z-10 hidden items-center xl:flex 2xl:right-10">
          <div className="flex flex-col gap-4">
            <RecentDiagramsCard
              ownerId={self.id === 'pending' ? null : self.id}
              onCount={setDiagramCount}
            />
            {diagramCount !== null && diagramCount < 3 ? (
              <NewHereCard
                busy={submitting}
                onStart={() =>
                  // '' = keep the resolved participant name, same as onSkip.
                  void commitNewDiagram('guided-tour', '', 'brand', { offline: true })
                }
              />
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
