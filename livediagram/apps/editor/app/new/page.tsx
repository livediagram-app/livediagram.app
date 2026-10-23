'use client';

import { trustedHtml } from '@livediagram/ui';

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
import { NewDocumentWizard } from '@/components/palette/NewDocumentWizard';
import type { NewDocumentSettings } from './new-document-settings';
import { DocumentLoading } from '@/components/chrome/DocumentLoading';
import { OpeningScreen } from '@/components/chrome/OpeningScreen';
import { RecentDocumentsCard } from './RecentDocumentsCard';
import { EARLY_MODE_SCRIPT, EARLY_MODE_STYLE } from './early-mode-choice';
import { AnimatedLinesBackdrop } from '@/components/canvas/AnimatedLinesBackdrop';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useCtaAttribution } from './useCtaAttribution';
import { apiCreateDocument, apiLoadSelf, apiSaveSelf } from '@/lib/api-client';
import {
  createFailureCopy,
  createIdsFor,
  type CreateFailure,
  type CreateIds,
} from './create-failure';
import { offlineCreateDocument } from '@/lib/offline/offline-store';
import { isOfflineLocation } from '@/lib/save-locations';
import { useDocumentCount } from './useDocumentCount';
import { useNewDocumentLocation } from './useNewDocumentLocation';
import { markTourPending } from '@/lib/tour-pending';
import { randomColor, randomName, type Participant } from '@/lib/identity';
import { titleCaseType, track } from '@/lib/telemetry';
import { trackDailyReturn } from '@/lib/daily-return';
import { markNameConfirmed } from '@/lib/local-identity';
import { ensureGuestIdentity } from '@/lib/guest-identity';
import { useGuestId } from '@/hooks/persistence/useGuestId';
import {
  templateFamilyOf,
  untitledNameForTemplate,
  type TemplateKind,
} from '@livediagram/templates';
import { creationIntentOf } from '@livediagram/api-schema';
import {
  WIZARD_BYPASS_PARAMS,
  choosePlacementAgainUrl,
  placementParamsFromSearch,
  wizardBypassKind,
  wizardPresetMode,
  wizardPresetQuery,
  wizardStartsBlank,
} from '@/lib/new-document-params';
import { backOutTarget } from '@/lib/back-out';
import { themeTelemetryLabel } from '@/lib/theme-telemetry-label';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';
import { handStartQuery } from '@/components/start/start-query';
import { closeStartForBlank } from '@/components/start/close-start-for-blank';
import { handTemplatePick } from '@/lib/placement-defaults/template-pick-handoff';
import { isBlankTemplate } from '@livediagram/templates';
import { NEW_DOCUMENT_THEME_ID, newDocumentTab } from '@/lib/new-document-content';

// In-place handoff (docs/specs/007-editor/new-document-route.md): once a document is created, this page
// renders the editor itself under the rewritten /document/<id> URL instead of paying for a second page
// load. `loadEditor` is also called on mount to fetch the chunk ahead; if it still isn't in at
// handoff, the opening screen holds at its "opening" stage.
const loadEditor = () => import('@/app/document/[id]/editor-page');
const EditorPage = dynamic(loadEditor, {
  ssr: false,
  loading: () => <OpeningScreen />,
});

// The wizard bypass a /new URL asks for, if any (docs/specs/007-editor/new-document-route.md). The URL does
// not change under the page, so nothing needs to subscribe.
const subscribeNever = () => () => {};
const bypassKindFromUrl = () => wizardBypassKind(window.location.search);
// The template step's presets (`?mode=`, `?q=`), read the same way.
const presetModeFromUrl = () => wizardPresetMode(window.location.search);
const presetQueryFromUrl = () => wizardPresetQuery(window.location.search);
const noPreset = () => null;
const noBypass = () => null;
// Dedicated welcome / create-new flow, see docs/specs/007-editor/new-document-route.md.
// Owns identity bootstrap, the mode choice (a one-step wizard),
// and the actual "commit a new document" handoff. Once the user picks (or
// skips), we POST the seeded document and navigate to /document/<id> where
// the editor route picks it up cleanly. The Explorer is NOT rendered here:
// the wizard's "Open Existing Document" button sends users to /explorer
// instead, keeping this screen focused on creating.
const PENDING_SELF: Participant = {
  id: 'pending',
  name: 'Guest',
  color: '#0ea5e9',
  status: 'online',
};

export default function NewDocumentPage() {
  // Stable placeholder so the first paint matches the SSG render; the
  // real participant lands once the identity has resolved.
  // Sign-in wiring (the token provider), the same
  // hook as the editor route; see hooks/useAccountBootstrap.ts.
  const { authLoaded, accountUserId } = useAccountBootstrap();

  // Who is creating (docs/specs/003-system-architecture/react-state-and-effects.md): derived during render.
  // The base is the account id once auth has settled, else the guest id read from its store, with a name and
  // colour seeded once per visit. `selfOverride` holds what replaces it: the stored profile, the name
  // chosen in the wizard, or the commit's fallback. Until auth settles it is the 'pending' placeholder.
  // A guest's id is their guest token's, resolved before any owner-scoped call
  // (docs/specs/014-identity/auth-and-guest-access.md): until then `self` stays
  // 'pending', which gates every owner-scoped read below.
  const guestId = useGuestId(authLoaded, accountUserId);
  const [seed] = useState(() => ({ name: randomName(), color: randomColor() }));
  const [selfOverride, setSelf] = useState<Participant | null>(null);
  const baseId = authLoaded ? (accountUserId ?? guestId) : null;
  const self: Participant =
    selfOverride && (baseId === null || selfOverride.id === baseId)
      ? selfOverride
      : baseId
        ? { id: baseId, name: seed.name, color: seed.color, status: 'online' }
        : PENDING_SELF;
  const [submitting, setSubmitting] = useState(false);
  // Set once the created document has been handed to the in-place editor. The ref mirrors it for the
  // bfcache listener, which must stand down once this document IS the editor.
  const [openedId, setOpenedId] = useState<string | null>(null);
  const handedOff = useRef(false);
  // How many documents the user owns, before this visit's create. Reported by RecentDocumentsCard's
  // fetch and awaited by the create; gates the interactive tour's welcome offer
  // (docs/specs/007-editor/editor-tour.md), which is for brand-new (zero-document) users only.
  const documentCount = useDocumentCount();
  // Set when the create fails: the card's copy and action (create-failure.ts). Shows instead of
  // navigating to the editor for a document that was never persisted (which would 404). The ref
  // keeps the last attempt's args so Retry can re-run the exact same create.
  const [createError, setCreateError] = useState<CreateFailure | null>(null);
  // Set by Skip and the bypass links: the new tab opens with its start closed (closeStartForBlank).
  const explicitBlank = useRef(false);
  const lastCreateArgs = useRef<{
    kind: TemplateKind | null;
    // Where it goes (new-document-settings.ts): store and placement, decided at commit.
    settings: NewDocumentSettings;
    // The ids it wrote under, reused by its Retry (createIdsFor).
    ids: CreateIds;
  } | null>(null);

  // Landing funnel (docs/specs/019-marketing/landing-funnel.md): the public-page CTA that brought this visit
  // here, if any. Counts the arrival now and the document once it's committed.
  const cta = useCtaAttribution();

  // Wizard bypass (docs/specs/007-editor/new-document-route.md): /new?blank=1 ("Start Blank") and
  // /new?template=<kind> (the marketing template gallery) skip the wizard
  // entirely — the page commits that template (Default theme, the template's
  // default name) the moment it mounts and lands on the editor. The ?folder /
  // ?team placement context still applies (placementParams).
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
  // Where a new document is stored: This Browser for a guest (docs/specs/006-document/save-locations.md), decided at
  // commit.
  const { resolveSaveLocation } = useNewDocumentLocation({ authLoaded, accountUserId });
  useLayoutEffect(() => {
    if (!bypassKindFromUrl()) document.documentElement.removeAttribute('data-just-draw');
  }, []);

  // `?mode=` / `?q=` (docs/specs/007-editor/new-document-route.md): the template step opens
  // narrowed. The prerendered step is unfiltered, so the wizard card stays hidden (the pre-paint
  // `data-wizard-preset` flag) until the render that shows the preset.
  const presetMode = useSyncExternalStore(subscribeNever, presetModeFromUrl, noPreset);
  const presetQuery = useSyncExternalStore(subscribeNever, presetQueryFromUrl, noPreset);
  useLayoutEffect(() => {
    if (presetModeFromUrl() === presetMode && presetQueryFromUrl() === presetQuery) {
      document.documentElement.removeAttribute('data-wizard-preset');
    }
  }, [presetMode, presetQuery]);

  const backOut = () => {
    if (submitting || preparing) return;
    const target = backOutTarget({
      referrer: document.referrer,
      origin: window.location.origin,
      historyLength: window.history.length,
    });
    debugLog(`[new] back out ${target}`);
    track('UI', 'Closed', 'NewDocument');
    if (target === 'back') window.history.back();
    else window.location.assign('/');
  };

  useEffect(() => {
    document.title = 'New Document | livediagram';
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
    // Wait for auth to settle so guest vs signed-in is known.
    if (!authLoaded) return;
    // Daily-active-returns signal (docs/specs/017-telemetry/telemetry.md): once-per-browser-per-UTC-day,
    // gated inside the helper.
    trackDailyReturn(!!accountUserId);
  }, [authLoaded, accountUserId]);
  // The stored profile, once the id is known: the account's, or a guest's signed one.
  const selfId = authLoaded ? (accountUserId ?? guestId) : null;
  useEffect(() => {
    if (!selfId) return;
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
  }, [selfId, seed]);
  // Identity for the commit path. The session's chunk loads deferred, so a fast
  // click-through (or an e2e robot) can reach Create while `self` is still
  // the 'pending' placeholder — the identity bootstrap above hasn't run.
  // Creating then would file the document under the literal owner "pending":
  // a shared id every raced visitor collides on, and one the editor route
  // (fetching with the real id) 404s. So the commit resolves identity
  // itself: wait out the bootstrap (bounded — authLoaded flips by the
  // 5 s auth timeout at the latest), then fall back to the guest id.
  const selfRef = useLatest(self);
  const resolveSelf = async (): Promise<Participant> => {
    const deadline = Date.now() + 8000;
    while (selfRef.current.id === 'pending' && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (selfRef.current.id !== 'pending') return selfRef.current;
    // Still pending (auth never settled): resolve the guest's id here.
    const fallback = { ...selfRef.current, id: (await ensureGuestIdentity()).id };
    setSelf(fallback);
    return fallback;
  };

  // Single commit point, shared by a mode chosen, Create, Skip and the bypass links. Every new document starts on the
  // Default theme; either way we persist the document so the editor route lands on a real row.
  const themeId = NEW_DOCUMENT_THEME_ID;
  const commitNewDocument = async (
    templateKind: TemplateKind | null,
    settings: NewDocumentSettings,
    // Set by Retry: the failed attempt's ids, so a create that did land is not made twice.
    retrying: CreateIds | null = null,
  ) => {
    if (submitting) return;
    setSubmitting(true);
    // A `?q=` preset becomes the search in the new document's start panel (start-query.ts).
    handStartQuery(presetQuery);
    // Save location (docs/specs/006-document/save-locations.md): only This Browser takes the offline branch.
    const offline = isOfflineLocation(settings.saveLocation);
    const { documentId, tabId } = createIdsFor(retrying);
    // An explicit blank (Skip, Start Blank, a blank's link) opens with its start closed (close-start-for-blank.ts).
    if (explicitBlank.current) closeStartForBlank(tabId, templateKind);
    // A mode's blank in the cloud: the template picked later on its start screen may move it to that template's
    // default folder (docs/specs/013-workspace/default-folders.md "A template picked after creation").
    handTemplatePick(
      !offline && templateKind && isBlankTemplate(templateKind)
        ? { documentId, tabId, placementChosen: settings.placementChosen === true }
        : null,
    );
    // A Retry re-runs the create, not the preference write below.
    lastCreateArgs.current = { kind: templateKind, settings, ids: { documentId, tabId } };
    // Named after its template ("Untitled Diagram"); renamed in the editor.
    const documentName = untitledNameForTemplate(templateKind);
    markNameConfirmed();
    // Never create as the 'pending' placeholder — see resolveSelf above.
    const settleIdentity = resolveSelf;
    // A document in This Browser has no owner on the server to wait for (docs/specs/006-document/offline-mode.md
    // "Instant open"): identity settles in the background while it opens. A cloud create needs the owner.
    const cloudOwner = offline ? null : await settleIdentity();
    if (offline) {
      void settleIdentity().catch((err: unknown) =>
        debugLog(`[new] background identity failed: ${String(err)}`),
      );
    }
    // Read before the create, so the new document is not in it. A cloud create has just settled identity, so the
    // count's fetch is in flight: wait for it rather than miss the tour on a quick pick. This Browser opens at once
    // and takes the count only if it is already in.
    const priorDocuments = await documentCount.settled(offline ? 0 : undefined);

    // The template's tab, or one blank tab (lib/new-document-content.ts).
    const tab = newDocumentTab({ templateKind, themeId, tabId });
    try {
      if (offline) {
        // Offline Mode (docs/specs/006-document/offline-mode.md): create the document in IndexedDB only. This
        // also registers its id so every later load / save routes local.
        await offlineCreateDocument(
          { id: documentId, name: documentName, tabs: [tab] },
          Date.now(),
        );
      } else {
        // Placement rides the create (docs/specs/007-editor/new-document-route.md): a /new?folder= / ?team=
        // context is filed by the same write, or the create is refused by name and nothing is written.
        const owner = cloudOwner ?? (await settleIdentity());
        await apiCreateDocument(owner.id, {
          id: documentId,
          name: documentName,
          tabs: [tab],
          // Passed through as given: absent is no choice (a default folder may answer), a null
          // folder the root chosen on purpose (docs/specs/013-workspace/default-folders.md).
          teamId: settings.teamId,
          folderId: settings.folderId,
          // What it opens as, captured now and never re-derived
          // (docs/specs/013-workspace/default-folders.md): with no place chosen, the server files it
          // in the person's default folder for it.
          intent: creationIntentOf(tab, templateFamilyOf(templateKind)),
        });
      }
    } catch (err) {
      // Create FAILED (network / 5xx / a refused placement for cloud, or no IndexedDB for
      // offline). Don't navigate to an editor for a document that was never persisted (that
      // lands on a 404). Surface the error card instead: Retry re-runs this exact create from
      // lastCreateArgs; a refused placement offers another place.
      const failure = createFailureCopy(err);
      debugLog(`[new] create failed action=${failure.action}`);
      setSubmitting(false);
      setCreateError(failure);
      return;
    }
    // Anonymous telemetry (docs/specs/017-telemetry/telemetry.md): a document was created. No id or name is
    // sent — the `type` records only whether it's an Offline or Cloud document
    // (docs/specs/006-document/offline-mode.md). The chosen theme is recorded separately below.
    track('Document', 'Created', offline ? 'Offline' : 'Cloud');
    track('Theme', 'Changed', themeTelemetryLabel(themeId));
    if (templateKind) track('Template', 'Used', titleCaseType(templateKind));
    // A whiteboard tab born from the wizard (docs/specs/023-draw-mode/draw-mode.md "Telemetry").
    if (templateKind === 'whiteboard') track('Draw', 'Created', 'Template');
    cta.trackCreated();
    // Created straight into a team library: the same Team·Added·Document an Explorer move into a
    // team sends (docs/specs/017-telemetry/telemetry.md), only reached once the create, and so
    // its placement, succeeded.
    if (!offline && settings.teamId) track('Team', 'Added', 'Document');
    // "Show me around" (docs/specs/007-editor/editor-tour.md): a brand-new user's (zero owned documents)
    // first document gets the tour's welcome offer once the editor opens —
    // handed across the hard navigation via a sessionStorage flag. The
    // editor gates the offer on the synced `tourSeen` preference.
    if (priorDocuments === 0) {
      markTourPending();
    }
    // Hand off in place: the editor URL takes /new's history entry, and the editor mounts here,
    // reading the id from the rewritten path exactly as a direct visit would.
    handedOff.current = true;
    document.documentElement.removeAttribute('data-just-draw');
    window.history.replaceState(null, '', `/document/${documentId}`);
    setOpenedId(documentId);
  };

  // Every create from /new goes where new documents go by default (docs/specs/007-editor/new-document-route.md
  // "One-step wizard"): the store for who is creating, decided now (a guest at once, a signed-in browser once identity
  // settles), and the /new?folder= / ?team= context when there is one; without one it carries no placement, so a
  // default folder may answer (docs/specs/013-workspace/default-folders.md "Precedence"). `blank` opens it with its
  // start closed (Skip, Start Blank, a blank's link). The ref holds a second choice off while the store resolves.
  const [preparing, setPreparing] = useState(false);
  const creating = useRef(false);
  const createByDefault = async (kind: TemplateKind, blank: boolean) => {
    if (creating.current || submitting) return;
    creating.current = true;
    setPreparing(true);
    const placement = placementParamsFromSearch(window.location.search);
    const placed = !!(placement.folderId || placement.teamId);
    try {
      const saveLocation = await resolveSaveLocation(placed, resolveSelf);
      explicitBlank.current = blank;
      await commitNewDocument(kind, { saveLocation, ...placement, placementChosen: placed });
    } finally {
      creating.current = false;
      setPreparing(false);
    }
  };

  // Start Blank fast path (docs/specs/007-editor/new-document-route.md): fire the Skip-defaults create on mount.
  // commitNewDocument waits out the identity bootstrap itself (resolveSelf),
  // so firing immediately is safe. The ref makes it once-only under Strict
  // Mode's double-invoked effects. Note the tour offer (docs/specs/007-editor/editor-tour.md) can't queue
  // here: the create fires before RecentDocumentsCard reports a count — which
  // is the behaviour we want for someone who asked to just draw.
  const bypassFired = useRef(false);
  const fireBypass = useEffectEvent((kind: TemplateKind) => {
    // Wizard-bypass adoption signal (docs/specs/017-telemetry/telemetry.md): a fixed preset per entry
    // point, never user content. (The template itself is reported by the
    // usual Document / Created event the commit fires.)
    track('UI', 'Used', kind === 'blank' ? 'JustDraw' : 'TemplateLink');
    void createByDefault(kind, true);
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
          documentName="New document"
          hideTitle
          showShare={false}
          shareable={false}
          onOpenShare={() => {}}
          onRename={() => {}}
        />
        <main className="relative flex-1 bg-slate-50 dark:bg-slate-950">
          <ApiErrorPage
            eyebrow={createError.eyebrow}
            title={createError.title}
            message={createError.message}
            retryLabel={createError.actionLabel}
            onRetry={() => {
              if (createError.action === 'choose') {
                // The refused placement would be refused again: reopen the wizard without it.
                window.location.assign(choosePlacementAgainUrl(window.location.search));
                return;
              }
              setCreateError(null);
              const a = lastCreateArgs.current;
              if (a) void commitNewDocument(a.kind, a.settings, a.ids);
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
          __html: trustedHtml(
            "try{var p=new URLSearchParams(location.search);if(p.has('blank')||p.has('template'))document.documentElement.setAttribute('data-just-draw','');if(p.has('mode')||p.has('q'))document.documentElement.setAttribute('data-wizard-preset','')}catch(e){}",
          ),
        }}
      />
      <style>{`html[data-just-draw] [data-wizard-only],html[data-wizard-preset] [data-wizard-only]{visibility:hidden}`}</style>
      {/* A mode card chosen before hydration is kept, not lost (early-mode-choice.ts). */}
      <script dangerouslySetInnerHTML={{ __html: trustedHtml(EARLY_MODE_SCRIPT) }} />
      <style>{EARLY_MODE_STYLE}</style>
      <EditorHeader
        documentName="New document"
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
        {/* No identity spinner: the wizard is static mode data, so it renders immediately; identity resolves in the
            background, and a create waits for it only when it must (resolveSelf). */}
        {/* display:contents so the guard wrapper adds no box of its own;
            visibility inherits to the wizard card. */}
        <div data-wizard-only className="contents">
          <NewDocumentWizard
            busy={submitting || preparing}
            initialMode={presetMode}
            // A mode chosen after a Start Blank link (`?start=blank`) opens its blank with the start closed.
            onCreate={(kind) =>
              void createByDefault(kind, wizardStartsBlank(window.location.search))
            }
            onSkip={() => void createByDefault('blank', true)}
            onOpenExisting={() => window.location.assign('/explorer/recent')}
            // Escape backs out to the page that opened /new, creating nothing
            // (docs/specs/007-editor/new-document-route.md "Escape backs out").
            onBackOut={backOut}
          />
        </div>
        {/* The right rail beside the centred wizard (desktop-only, xl+):
            returning users get "Jump Back In" (docs/specs/007-editor/new-document-route.md, hidden with no
            documents yet). Its fetch also reports the document count that
            gates the interactive tour's welcome offer (docs/specs/007-editor/editor-tour.md). The
            guided-tour sample card that used to sit under it was removed
            when the interactive tour superseded it. */}
        <div
          data-wizard-only
          className="pointer-events-none absolute inset-y-0 right-4 z-10 hidden items-center xl:flex 2xl:right-10"
        >
          <RecentDocumentsCard
            ownerId={self.id === 'pending' ? null : self.id}
            onCount={documentCount.report}
          />
        </div>
      </main>
    </div>
  );
}
