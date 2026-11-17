'use client';

import dynamic from 'next/dynamic';
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { EditorHeader } from '@/components/chrome/EditorHeader';
import { ApiErrorPage } from '@liveworkspace/workbench/components/chrome/ApiErrorPage';
import type { NewDocumentSettings } from './new-document-settings';
import { DocumentLoading } from '@/components/chrome/DocumentLoading';
import { OpeningScreen } from '@/components/chrome/OpeningScreen';
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
import { useNewDocumentLocation } from './useNewDocumentLocation';
import { randomColor, randomName, type Participant } from '@/lib/identity';
import { firstVisitName } from '@/app/document/[id]/resolve-participant';
import { titleCaseType, track } from '@/lib/telemetry';
import { trackDailyReturn } from '@/lib/daily-return';
import { markNameConfirmed } from '@/lib/local-identity';
import { ensureGuestIdentity } from '@/lib/guest-identity';
import { useGuestId } from '@/hooks/persistence/useGuestId';
import { useLegacyGuestClaim } from '@/hooks/persistence/useLegacyGuestClaim';
import { useSettledOwnerId } from '@/hooks/persistence/useSettledOwnerId';
import { handTemplatePick } from '@liveworkspace/explorer';
import {
  templateFamilyOf,
  untitledNameForTemplate,
  type TemplateKind,
} from '@livediagram/templates';
import { creationIntentOf } from '@livediagram/api-schema';
import {
  choosePlacementAgainUrl,
  newDocumentKind,
  placementParamsFromSearch,
  wizardPresetQuery,
} from '@/lib/new-document-params';
import { backOutTarget } from '@liveworkspace/workbench/lib/back-out';
import { themeTelemetryLabel } from '@/lib/theme-telemetry-label';
import { useResolveSelf } from '@liveworkspace/workbench/hooks/persistence/useResolveSelf';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { handStartQuery } from '@liveworkspace/workbench/components/start/start-query';
import { closeStartForBlank } from '@/components/start/close-start-for-blank';
import { isBlankTemplate } from '@livediagram/templates';
import {
  NEW_DOCUMENT_THEME_ID,
  newDocumentPresentation,
  newDocumentTab,
} from '@/lib/new-document-content';

// In-place handoff (docs/specs/007-editor/new-document-route.md): once a document is created, this page
// renders the editor itself under the rewritten /document/<id> URL instead of paying for a second page
// load. `loadEditor` is also called on mount to fetch the chunk ahead; if it still isn't in at
// handoff, the opening screen holds at its "opening" stage.
const loadEditor = () => import('@/app/document/[id]/editor-page');
const EditorPage = dynamic(loadEditor, {
  ssr: false,
  loading: () => <OpeningScreen />,
});

// What a /new URL asks for (docs/specs/007-editor/new-document-route.md "No welcome step"), read as an external store
// whose server snapshot is null: the static export prerenders the page without a query string, so the hydration
// render has to match the server HTML (the opening screen either way). The URL does not change under the page, so
// nothing needs to subscribe.
const subscribeNever = () => () => {};
const searchFromUrl = () => window.location.search;
const noSearch = () => null;
// The create-new flow, see docs/specs/007-editor/new-document-route.md. Owns identity bootstrap and the
// "commit a new document" handoff. It asks nothing: the document is made on arrival, as the URL asks, and opens on
// its start, where the mode and the templates are chosen.
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
  const { authLoaded, sessionAnswered, accountUserId, accountDisplayName } = useAccountBootstrap();

  // Who is creating (docs/specs/003-system-architecture/react-state-and-effects.md): derived during render.
  // The base is the account id once auth has settled, else the guest id read from its store, with a name and
  // colour seeded once per visit. `selfOverride` holds what replaces it: the stored profile,
  // or the commit's fallback. Until auth settles it is the 'pending' placeholder.
  // A guest's id is their guest token's, resolved before any owner-scoped call
  // (docs/specs/014-identity/auth-and-guest-access.md): until then `self` stays
  // 'pending', which gates every owner-scoped read below.
  const guestId = useGuestId(authLoaded, accountUserId);
  // A returning old livediagram.app guest's work is claimed in the background
  // (docs/specs/014-identity/auth-and-guest-access.md "Returning guests from the old site").
  useLegacyGuestClaim(true, useSettledOwnerId(authLoaded, accountUserId));
  const [guestSeed] = useState(() => ({ name: randomName(), color: randomColor() }));
  // A signed-in person is seeded with their account name, as the editor seeds them; a guest with the random one.
  const seedName = firstVisitName(accountUserId, accountDisplayName, guestSeed.name);
  const seed = useMemo(
    () => ({ name: seedName, color: guestSeed.color }),
    [seedName, guestSeed.color],
  );
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
  // Set when the create fails: the card's copy and action (create-failure.ts). Shows instead of
  // navigating to the editor for a document that was never persisted (which would 404). The ref
  // keeps the last attempt's args so Retry can re-run the exact same create.
  const [createError, setCreateError] = useState<CreateFailure | null>(null);
  // Set by Start Blank and the template links: the new tab opens with its start closed (closeStartForBlank).
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

  // What to create, once the page runs in the browser.
  const search = useSyncExternalStore(subscribeNever, searchFromUrl, noSearch);
  const plan = useMemo(() => (search === null ? null : newDocumentKind(search)), [search]);
  const presetQuery = useMemo(() => (search === null ? null : wizardPresetQuery(search)), [search]);
  // Where a new document is stored: This Browser for a guest (docs/specs/006-document/save-locations.md), decided at
  // commit.
  const { resolveSaveLocation } = useNewDocumentLocation({
    authLoaded,
    sessionAnswered,
    accountUserId,
  });

  useEffect(() => {
    document.title = 'New Canvas | livediagram';
    // Fetch the editor's chunk while identity + the create run. Fire-and-forget: a failure here
    // just leaves `dynamic` to retry the import at handoff.
    loadEditor().catch(() => {});
  }, []);

  // Back/forward-cache restore (new-document-route.md "No welcome step"): the browser can restore this page as it was
  // frozen mid-create, on "Creating…" for ever. Re-firing the create would trap Back behind a page that always
  // navigates forward, so it goes back again (or home), creating nothing.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted || handedOff.current) return;
      const target = backOutTarget({
        referrer: document.referrer,
        origin: window.location.origin,
        historyLength: window.history.length,
      });
      debugLog(`[new] restored, back out ${target}`);
      if (target === 'back') window.history.back();
      else window.location.assign('/');
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

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
  const { resolveSelf } = useResolveSelf(self, setSelf, ensureGuestIdentity);

  // Single commit point, for every /new create. Every new document starts on the
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
    // An explicit blank (Start Blank, a template link) opens with its start closed (close-start-for-blank.ts).
    if (explicitBlank.current) closeStartForBlank(tabId, templateKind);
    // A mode's blank in the cloud: the template picked later on its start screen may move it to that template's
    // default folder (docs/specs/013-workspace/default-folders.md "A template picked after creation").
    handTemplatePick(
      !offline && templateKind && isBlankTemplate(templateKind)
        ? { itemId: documentId, tabId, placementChosen: settings.placementChosen === true }
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
    // The template's tab, or one blank tab (lib/new-document-content.ts).
    const tab = newDocumentTab({ templateKind, themeId, tabId });
    // A presented template's slides, so Present runs it in talk order from the start.
    const presentation = newDocumentPresentation(templateKind, tab);
    try {
      if (offline) {
        // Offline Mode (docs/specs/006-document/offline-mode.md): create the document in IndexedDB only. This
        // also registers its id so every later load / save routes local.
        await offlineCreateDocument(
          { id: documentId, name: documentName, tabs: [tab], presentation },
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
          ...(presentation ? { presentation } : {}),
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
    // A whiteboard tab born on /new (docs/specs/023-draw-mode/draw-mode.md "Telemetry").
    if (templateKind === 'whiteboard') track('Draw', 'Created', 'Template');
    cta.trackCreated();
    // Created straight into a team library: the same Team·Added·Document an Explorer move into a
    // team sends (docs/specs/017-telemetry/telemetry.md), only reached once the create, and so
    // its placement, succeeded.
    if (!offline && settings.teamId) track('Team', 'Added', 'Document');
    // Hand off in place: the editor URL takes /new's history entry, and the editor mounts here,
    // reading the id from the rewritten path exactly as a direct visit would.
    handedOff.current = true;
    document.documentElement.removeAttribute('data-just-draw');
    window.history.replaceState(null, '', `/document/${documentId}`);
    setOpenedId(documentId);
  };

  // Every create from /new goes where new documents go by default (docs/specs/007-editor/new-document-route.md
  // "No welcome step"): This Browser for a guest, livediagram for a signed-in person or anyone with a /new?folder= /
  // ?team= context (docs/specs/006-document/save-locations.md), and that context when there is one;
  // without one it carries no placement, so a default folder may answer (docs/specs/013-workspace/default-folders.md
  // "Precedence"). `startClosed` opens it with its start closed (Start Blank, a template link).
  const createByDefault = async (kind: TemplateKind, startClosed: boolean) => {
    const placement = placementParamsFromSearch(window.location.search);
    const placed = !!(placement.folderId || placement.teamId);
    const saveLocation = await resolveSaveLocation(placed, resolveSelf, null);
    explicitBlank.current = startClosed;
    await commitNewDocument(kind, { saveLocation, ...placement, placementChosen: placed });
  };

  // Create on arrival. commitNewDocument waits out the identity bootstrap itself (resolveSelf), so firing at once is
  // safe. The ref makes it once-only under Strict Mode's double-invoked effects.
  const fired = useRef(false);
  const fire = useEffectEvent((next: NonNullable<typeof plan>) => {
    // Link adoption (docs/specs/017-telemetry/telemetry.md): a fixed preset per entry point, never user content.
    // (The template itself is reported by the usual Document / Created event the commit fires.)
    if (next.link) track('UI', 'Used', next.link === 'blank' ? 'JustDraw' : 'TemplateLink');
    void createByDefault(next.kind, next.startClosed);
  });
  useEffect(() => {
    if (!plan || fired.current) return;
    fired.current = true;
    fire(plan);
  }, [plan]);

  // Keyed on the id so a second handoff (not reachable today) would remount a fresh editor.
  if (openedId) return <EditorPage key={openedId} />;

  if (createError) {
    return (
      <div className="flex h-dvh flex-col">
        <EditorHeader
          documentName="New canvas"
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
                // The refused placement would be refused again: reopen /new without it.
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

  // The opening screen, at its "creating" stage, holds the screen from first paint (the prerender too) to the
  // handoff (docs/specs/007-editor/new-document-route.md). The editor's own load renders the same screen, so
  // create → open reads as one moment. Create failures fall through to the retryable error card above.
  return <DocumentLoading stage="creating" />;
}
