'use client';

import { truncateName } from '@livediagram/document';
import dynamic from 'next/dynamic';
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { EditorHeader } from '@/components/chrome/EditorHeader';
import { ApiErrorPage } from '@/components/chrome/ApiErrorPage';
import { TemplatePicker, type NewDocumentSettings } from '@/components/palette/TemplatePicker';
import { DocumentLoading } from '@/components/chrome/DocumentLoading';
import { RecentDocumentsCard } from './RecentDocumentsCard';
import { CustomThemeProvider } from '@/components/primitives/CustomThemeProvider';
import { AnimatedLinesBackdrop } from '@/components/canvas/AnimatedLinesBackdrop';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import { useCtaAttribution } from './useCtaAttribution';
import { usePlacementOptions } from './usePlacementOptions';
import {
  apiCreateDocument,
  apiLoadSelf,
  apiSaveSelf,
  apiSetDocumentFolder,
} from '@/lib/api-client';
import { offlineCreateDocument } from '@/lib/offline/offline-store';
import { DEFAULT_SAVE_LOCATION, isOfflineLocation } from '@/lib/save-locations';
import { markTourPending } from '@/lib/tour-pending';
import { randomColor, randomName, type Participant } from '@/lib/identity';
import { titleCaseType, track } from '@/lib/telemetry';
import { trackDailyReturn } from '@/lib/daily-return';
import { accepted } from '@/lib/accepted';
import {
  ensureGuestSelfId,
  getGuestSelfId,
  subscribeGuestSelfId,
  markNameConfirmed,
} from '@/lib/local-identity';
import { buildTemplatedTab } from '@/lib/template-builders';
import { untitledNameForTemplate, type TemplateKind } from '@livediagram/templates';
import { WIZARD_BYPASS_PARAMS, wizardBypassKind } from '@/lib/new-document-params';
import { getTheme } from '@/lib/themes';
import { themeTelemetryLabel } from '@/lib/custom-theme-registry';
import { useLatest } from '@/hooks/ui/useLatest';

// In-place handoff (docs/specs/007-editor/new-document-route.md): once a diagram is created, this page
// renders the editor itself under the rewritten /diagram/<id> URL instead of paying for a second page
// load. `loadEditor` is also called on mount to fetch the chunk ahead; if it still isn't in at
// handoff, the opening screen holds at its "opening" stage.
const loadEditor = () => import('@/app/document/[id]/editor-page');
const EditorPage = dynamic(loadEditor, {
  ssr: false,
  loading: () => <DocumentLoading stage="opening" />,
});

// The wizard bypass a /new URL asks for, if any (docs/specs/007-editor/new-document-route.md). The URL does
// not change under the page, so nothing needs to subscribe.
const subscribeNever = () => () => {};
const bypassKindFromUrl = () => wizardBypassKind(window.location.search);
const noBypass = () => null;

// Folder shape the Settings step's placement browser consumes.
// Dedicated welcome / create-new flow, see docs/specs/007-editor/new-diagram-route.md.
// Owns identity bootstrap, template + theme choice (a two-step wizard),
// and the actual "commit a new diagram" handoff. Once the user picks (or
// skips), we POST the seeded diagram and navigate to /diagram/<id> where
// the editor route picks it up cleanly. The Explorer is NOT rendered here:
// the wizard's "Open Existing Diagram" button sends users to /explorer
// instead, keeping this screen focused on creating.
const PENDING_SELF: Participant = {
  id: 'pending',
  name: 'Guest',
  color: '#0ea5e9',
  status: 'online',
};
const noGuestId = () => null;

export default function NewDocumentPage() {
  // Stable placeholder so the first paint matches the SSG render; the
  // real participant lands once `useLayoutEffect` runs.
  // Clerk wiring (token provider + guest to authed migration), the same
  // hook as the editor route; see hooks/useClerkApiBootstrap.ts.
  const { authLoaded, clerkUserId } = useClerkApiBootstrap();

  // Who is creating (docs/specs/003-system-architecture/react-state-and-effects.md): derived during render.
  // The base is the Clerk id once auth has settled, else the guest id read from its store, with a name and
  // colour seeded once per visit. `selfOverride` holds what replaces it: the stored profile, the name
  // chosen in the wizard, or the commit's fallback. Until auth settles it is the 'pending' placeholder.
  const guestId = useSyncExternalStore(subscribeGuestSelfId, getGuestSelfId, noGuestId);
  const [seed] = useState(() => ({ name: randomName(), color: randomColor() }));
  const [selfOverride, setSelf] = useState<Participant | null>(null);
  const baseId = authLoaded ? (clerkUserId ?? guestId) : null;
  const self: Participant =
    selfOverride && (baseId === null || selfOverride.id === baseId)
      ? selfOverride
      : baseId
        ? { id: baseId, name: seed.name, color: seed.color, status: 'online' }
        : PENDING_SELF;
  const [submitting, setSubmitting] = useState(false);
  // Set once the created diagram has been handed to the in-place editor. The ref mirrors it for the
  // bfcache listener, which must stand down once this document IS the editor.
  const [openedId, setOpenedId] = useState<string | null>(null);
  const handedOff = useRef(false);
  // How many diagrams the user owns (null until known). Reported by
  // RecentDiagramsCard's fetch; gates the interactive tour's welcome offer
  // (docs/specs/007-editor/editor-tour.md), which is for brand-new (zero-diagram) users only.
  const [documentCount, setDocumentCount] = useState<number | null>(null);
  // Set when the create POST fails (network / 5xx). Shows a retryable
  // error instead of navigating to the editor for a diagram that was
  // never persisted (which would 404). The ref keeps the last attempt's
  // args so Retry can re-run the exact same create.
  const [createError, setCreateError] = useState(false);
  const lastCreateArgs = useRef<{
    kind: TemplateKind | null;
    name: string;
    // string, not ThemeId: the picker can hand back a custom `custom:<uuid>`
    // theme id (docs/specs/011-theme/custom-themes.md) as well as a built-in one.
    themeId: string;
    // The Settings step's choices (docs/specs/006-document/offline-mode.md): diagram name, placement, offline.
    settings: NewDocumentSettings;
  } | null>(null);

  // Landing funnel (docs/specs/019-marketing/landing-funnel.md): the public-page CTA that brought this visit
  // here, if any. Counts the arrival now and the diagram once it's committed.
  const cta = useCtaAttribution();

  // Where this diagram can be filed, and the inline New Folder the Settings
  // step offers — see usePlacementOptions.
  const { folders, teams, teamFolders, createPickerFolder, createPickerTeam } = usePlacementOptions(
    {
      selfId: self.id,
      clerkUserId,
    },
  );

  // Placement context from the URL: /new?folder=<id> (Explorer's "new diagram
  // in this folder") and /new?team=<id>(&folder=<id>) (team library, docs/specs/013-workspace/team-shared-documents.md)
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

  // Wizard bypass (docs/specs/007-editor/new-document-route.md): /new?blank=1 ("Just Draw") and
  // /new?template=<kind> (the marketing template gallery) skip the wizard
  // entirely — the page commits that template (Default theme, the template's
  // default name) the moment it mounts and lands on the editor. The ?folder /
  // ?team placement context above still applies.
  //
  // Read from the URL as an external store whose server snapshot is "no
  // bypass", NOT a window-reading state initializer: the static export
  // prerenders this page without a query string, so the hydration render has
  // to match the server HTML. The kind lands on the render after hydration;
  // until then the inline script + style guard rendered below keeps the
  // wizard hidden. That guard can't validate a template kind, so when the
  // query names one we don't know, the layout effect lifts it before the
  // first post-hydration paint and the wizard shows as normal.
  const bypassKind = useSyncExternalStore(subscribeNever, bypassKindFromUrl, noBypass);
  useLayoutEffect(() => {
    if (!bypassKindFromUrl()) document.documentElement.removeAttribute('data-just-draw');
  }, []);

  useEffect(() => {
    document.title = 'New diagram | livediagram';
    // Fetch the editor's chunk while identity + the create run. Fire-and-forget: a failure here
    // just leaves `dynamic` to retry the import at handoff.
    loadEditor().catch(() => {});
  }, []);

  // Back/forward-cache restore: creating navigates away with
  // `submitting === true` still set, and the browser Back button
  // restores this page from bfcache exactly as frozen — leaving the
  // Create button stuck on "Creating…" forever. `pageshow` with
  // `persisted` is the restore signal; reset the transient submit
  // state so the page is usable again.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted || handedOff.current) return;
      // A bypass auto-creates on mount, so a bfcache restore would
      // either strand the user on a frozen "Creating…" card or (if we
      // re-fired the create) trap Back behind a page that always navigates
      // forward again. Send them to the wizard instead, keeping the
      // ?folder / ?team placement context and dropping only the blank flag.
      if (bypassKind) {
        const params = new URLSearchParams(window.location.search);
        for (const key of WIZARD_BYPASS_PARAMS) params.delete(key);
        const qs = params.toString();
        window.location.replace(qs ? `/new?${qs}` : '/new');
        return;
      }
      setSubmitting(false);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [bypassKind]);

  useLayoutEffect(() => {
    // Wait for Clerk to settle so a signed-in user gets the Clerk
    // userId, not a freshly-minted guest UUID.
    if (!authLoaded) return;
    // Daily-active-returns signal (docs/specs/017-telemetry/telemetry.md): once-per-browser-per-UTC-day,
    // gated inside the helper. Auth has settled, so guest vs signed-in is known.
    trackDailyReturn(!!clerkUserId);
    // A guest's id is minted here if this browser has none; the store re-renders the page with it before
    // paint.
    const selfId = clerkUserId ?? ensureGuestSelfId();
    const local: Participant = { id: selfId, name: seed.name, color: seed.color, status: 'online' };
    let cancelled = false;
    void (async () => {
      const stored = await apiLoadSelf(selfId).catch(() => null);
      if (cancelled) return;
      if (stored) {
        setSelf({ ...stored, status: 'online' });
      } else {
        await apiSaveSelf(local).catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoaded, clerkUserId, seed]);
  // Identity for the commit path. Clerk's chunk loads deferred, so a fast
  // click-through (or an e2e robot) can reach Create while `self` is still
  // the 'pending' placeholder — the identity bootstrap above hasn't run.
  // Creating then would file the diagram under the literal owner "pending":
  // a shared id every raced visitor collides on, and one the editor route
  // (fetching with the real id) 404s. So the commit resolves identity
  // itself: wait out the bootstrap (bounded — authLoaded flips by the
  // 5 s Clerk timeout at the latest), then fall back to the guest id.
  const selfRef = useLatest(self);
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
  const commitNewDocument = async (
    templateKind: TemplateKind | null,
    name: string,
    themeId: string,
    settings: NewDocumentSettings,
  ) => {
    if (submitting) return;
    setSubmitting(true);
    // Save location (docs/specs/006-document/save-locations.md): only Local Browser takes the offline branch.
    const offline = isOfflineLocation(settings.saveLocation);
    lastCreateArgs.current = { kind: templateKind, name, themeId, settings };
    // The Settings step's name field wins; fall back to the per-template
    // default when it's left blank (docs/specs/006-document/offline-mode.md).
    // docs/specs/006-document/name-length.md: the wizard's name field goes through the same cap.
    const documentName =
      truncateName(settings.documentName ?? '') || untitledNameForTemplate(templateKind);
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

    const documentId = crypto.randomUUID();
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
        // Offline Mode (docs/specs/006-document/offline-mode.md): create the diagram in IndexedDB only. This
        // also registers its id so every later load / save routes local.
        await offlineCreateDocument(
          { id: documentId, name: documentName, tabs: [tab] },
          Date.now(),
        );
      } else {
        await apiCreateDocument(who.id, {
          id: documentId,
          name: documentName,
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
    // Anonymous telemetry (docs/specs/017-telemetry/telemetry.md): a diagram was created. No id or name is
    // sent — the `type` records only whether it's an Offline or Cloud diagram
    // (docs/specs/006-document/offline-mode.md). The chosen theme is recorded separately below.
    track('Document', 'Created', offline ? 'Offline' : 'Cloud');
    track('Theme', 'Changed', themeTelemetryLabel(themeId));
    if (templateKind) track('Template', 'Used', titleCaseType(templateKind));
    cta.trackCreated();
    // Placement. The Settings step's picker (docs/specs/006-document/offline-mode.md) is authoritative: the
    // URL context (/new?folder=<id>, /new?team=<id>&folder=<id>) pre-seeds it
    // on mount, so what the picker highlighted is exactly what gets filed.
    // Done as a follow-up PUT so the create endpoint signature stays stable
    // and placement can fail independently (a glitch just leaves it in the
    // personal Unsorted, movable later). Offline diagrams have no server
    // folder / team placement — skip it.
    if (!offline) {
      if (settings.teamId) {
        // Created straight into a team library: the same Team·Added·Diagram
        // an Explorer move into a team sends (docs/specs/017-telemetry/telemetry.md), and only once the
        // placement landed (a failed PUT leaves it personal).
        const placed = await accepted(
          apiSetDocumentFolder(who.id, documentId, settings.folderId ?? null, settings.teamId),
        );
        if (placed) track('Team', 'Added', 'Document');
      } else if (settings.folderId) {
        await apiSetDocumentFolder(who.id, documentId, settings.folderId).catch(() => {});
      }
    }
    // "Show me around" (docs/specs/007-editor/editor-tour.md): a brand-new user's (zero owned diagrams)
    // first diagram gets the tour's welcome offer once the editor opens —
    // handed across the hard navigation via a sessionStorage flag. The
    // editor gates the offer on the synced `tourSeen` preference.
    if (documentCount === 0) {
      markTourPending();
    }
    // Hand off in place: the editor URL takes /new's history entry, and the editor mounts here,
    // reading the id from the rewritten path exactly as a direct visit would.
    handedOff.current = true;
    document.documentElement.removeAttribute('data-just-draw');
    window.history.replaceState(null, '', `/diagram/${documentId}`);
    setOpenedId(documentId);
  };

  // Just-Draw fast path (docs/specs/007-editor/new-document-route.md): fire the Skip-defaults create on mount.
  // commitNewDiagram waits out the identity bootstrap itself (resolveSelf),
  // so firing immediately is safe. The ref makes it once-only under Strict
  // Mode's double-invoked effects. Note the tour offer (docs/specs/007-editor/editor-tour.md) can't queue
  // here: the create fires before RecentDiagramsCard reports a count — which
  // is the behaviour we want for someone who asked to just draw.
  const bypassFired = useRef(false);
  const fireBypass = useEffectEvent((kind: TemplateKind) => {
    // Wizard-bypass adoption signal (docs/specs/017-telemetry/telemetry.md): a fixed preset per entry
    // point, never user content. (The template itself is reported by the
    // usual Diagram / Created event the commit fires.)
    track('UI', 'Used', kind === 'blank' ? 'JustDraw' : 'TemplateLink');
    const params = new URLSearchParams(window.location.search);
    void commitNewDocument(kind, '', 'brand', {
      saveLocation: DEFAULT_SAVE_LOCATION,
      folderId: params.get('folder'),
      teamId: params.get('team'),
    });
  });
  useEffect(() => {
    if (!bypassKind || bypassFired.current) return;
    bypassFired.current = true;
    fireBypass(bypassKind);
  }, [bypassKind]);

  // Keyed on the id so a second handoff (not reachable today) would remount a fresh editor.
  if (openedId) return <EditorPage key={openedId} />;

  if (createError) {
    return (
      <div className="flex h-dvh flex-col">
        <EditorHeader
          documentName="New diagram"
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
              if (a) void commitNewDocument(a.kind, a.name, a.themeId, a.settings);
            }}
          />
        </main>
      </div>
    );
  }

  // A bypass never shows the wizard: the opening screen, at its "creating" stage, holds the screen
  // from mount to the handoff (docs/specs/007-editor/new-document-route.md). The editor's own load
  // renders the same screen, so create → open reads as one moment. Create failures fall through to
  // the retryable error card branch before this one.
  if (bypassKind) return <DocumentLoading stage="creating" />;

  return (
    <div className="flex h-dvh flex-col">
      {/* Bypass pre-hydration guard (docs/specs/007-editor/new-document-route.md): this static page's
          prerendered HTML is the wizard, and React only learns about
          ?blank=1 / ?template= at hydration — without this, the wizard paints for the
          beat until then. The script runs as the HTML parses, BEFORE the
          wizard markup below paints, and flags the root element; the style
          rule hides the wizard-only content under that flag until React
          swaps in the opening screen. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{var p=new URLSearchParams(location.search);if(p.has('blank')||p.has('template'))document.documentElement.setAttribute('data-just-draw','')}catch(e){}",
        }}
      />
      <style>{`html[data-just-draw] [data-wizard-only]{visibility:hidden}`}</style>
      <EditorHeader
        documentName="New diagram"
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
            (docs/specs/011-theme/custom-themes.md). */}
        {/* display:contents so the guard wrapper adds no box of its own;
            visibility inherits to the wizard card. */}
        <div data-wizard-only className="contents">
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
              // Teams are Clerk-only (docs/specs/013-workspace/teams.md): a guest gets no New Team tile.
              onCreateTeam={clerkUserId ? createPickerTeam : undefined}
              onOpenExisting={() => window.location.assign('/explorer/recent')}
              onPick={(kind, name, themeId, settings) =>
                void commitNewDocument(kind, name, themeId, settings)
              }
              // Empty name = "keep the resolved participant name" (commit falls
              // back to it); passing self.name here could freeze the
              // pre-bootstrap 'Guest' placeholder into the account.
              onSkip={() =>
                void commitNewDocument('blank', '', 'brand', {
                  saveLocation: DEFAULT_SAVE_LOCATION,
                })
              }
            />
          </CustomThemeProvider>
        </div>
        {/* The right rail beside the centred wizard (desktop-only, xl+):
            returning users get "Jump back in" (docs/specs/007-editor/new-document-route.md, hidden with no
            diagrams yet). Its fetch also reports the diagram count that
            gates the interactive tour's welcome offer (docs/specs/007-editor/editor-tour.md). The
            guided-tour sample card that used to sit under it was removed
            when the interactive tour superseded it. */}
        <div
          data-wizard-only
          className="pointer-events-none absolute inset-y-0 right-4 z-10 hidden items-center xl:flex 2xl:right-10"
        >
          <RecentDocumentsCard
            ownerId={self.id === 'pending' ? null : self.id}
            onCount={setDocumentCount}
          />
        </div>
      </main>
    </div>
  );
}
