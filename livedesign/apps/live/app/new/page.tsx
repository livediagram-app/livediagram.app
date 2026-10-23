'use client';

import dynamic from 'next/dynamic';
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { EditorHeader } from '@/components/chrome/EditorHeader';
import { ApiErrorPage } from '@/components/chrome/ApiErrorPage';
import type { NewDesignSettings } from './new-design-settings';
import { DesignLoading } from '@/components/chrome/DesignLoading';
import { OpeningScreen } from '@/components/chrome/OpeningScreen';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import { useCtaAttribution } from './useCtaAttribution';
import { apiCreateDesign, apiLoadSelf, apiSaveSelf } from '@/lib/api-client';
import {
  createFailureCopy,
  createIdsFor,
  type CreateFailure,
  type CreateIds,
} from './create-failure';
import { offlineCreateDesign } from '@/lib/offline/offline-store';
import { isOfflineLocation } from '@/lib/save-locations';
import { useNewDesignLocation } from './useNewDesignLocation';
import { randomColor, randomName, type Participant } from '@/lib/identity';
import { titleCaseType, track } from '@/lib/telemetry';
import { trackDailyReturn } from '@/lib/daily-return';
import { markNameConfirmed } from '@/lib/local-identity';
import { ensureSignedGuestIdentity } from '@/lib/guest-identity';
import { useSignedGuestId } from '@/hooks/persistence/useSignedGuestId';
import { untitledNameForTemplate, type TemplateKind } from '@livedesign/templates';
import { creationIntentOf } from '@livedesign/api-schema';
import {
  choosePlacementAgainUrl,
  newDesignKind,
  newDesignQuery,
  newDesignStartsBlank,
  placementParamsFromSearch,
} from '@/lib/new-design-params';
import { backOutTarget } from '@/lib/back-out';
import { themeTelemetryLabel } from '@/lib/custom-theme-registry';
import { useLatest } from '@/hooks/ui/useLatest';
import { debugLog } from '@/lib/debug-log';
import { handStartQuery } from '@/components/start/start-query';
import { closeStartForBlank } from '@/components/start/close-start-for-blank';
import { handTemplatePick } from '@/lib/placement-defaults/template-pick-handoff';
import { isBlankTemplate } from '@livedesign/templates';
import { NEW_DESIGN_THEME_ID, newDesignContent } from '@/lib/new-design-content';

// In-place handoff (docs/specs/007-editor/new-design-route.md): once a design is created, this page
// renders the editor itself under the rewritten /design/<id> URL instead of paying for a second page
// load. `loadEditor` is also called on mount to fetch the chunk ahead; if it still isn't in at
// handoff, the opening screen holds at its "opening" stage.
const loadEditor = () => import('@/app/design/[id]/editor-page');
const EditorPage = dynamic(loadEditor, {
  ssr: false,
  loading: () => <OpeningScreen />,
});

// Dedicated create-new flow, see docs/specs/007-editor/new-design-route.md. Owns identity bootstrap and the
// "commit a new design" handoff: it asks nothing, makes the design the URL names (`?template=`, `?blank=1`, or one
// that opens on its start) as it mounts, and hands it to the editor in place.
const PENDING_SELF: Participant = {
  id: 'pending',
  name: 'Guest',
  color: '#0ea5e9',
  status: 'online',
};

export default function NewDesignPage() {
  // Stable placeholder so the first paint matches the SSG render; the
  // real participant lands once the identity has resolved.
  // Clerk wiring (token provider + guest to authed migration), the same
  // hook as the editor route; see hooks/useClerkApiBootstrap.ts.
  const { authLoaded, clerkUserId } = useClerkApiBootstrap();

  // Who is creating (docs/specs/003-system-architecture/react-state-and-effects.md): derived during render.
  // The base is the Clerk id once auth has settled, else the guest id read from its store, with a name and
  // colour seeded once per visit. `selfOverride` holds what replaces it: the stored profile, or the commit's
  // fallback. Until auth settles it is the 'pending' placeholder.
  // A guest's id is the SIGNED one, resolved before any owner-scoped call
  // (docs/specs/014-identity/auth-and-guest-access.md "Signed guest ids"): until then `self` stays
  // 'pending', which gates every owner-scoped read below.
  const guestId = useSignedGuestId(authLoaded, clerkUserId);
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
  // Set once the created design has been handed to the in-place editor. The ref mirrors it for the
  // bfcache listener, which must stand down once this design IS the editor.
  const [openedId, setOpenedId] = useState<string | null>(null);
  const handedOff = useRef(false);
  // Set when the create fails: the card's copy and action (create-failure.ts). Shows instead of
  // navigating to the editor for a design that was never persisted (which would 404). The ref
  // keeps the last attempt's args so Retry can re-run the exact same create.
  const [createError, setCreateError] = useState<CreateFailure | null>(null);
  const lastCreateArgs = useRef<{
    kind: TemplateKind | null;
    // string, not ThemeId: the picker can hand back a custom `custom:<uuid>`
    // theme id (docs/specs/011-theme/custom-themes.md) as well as a built-in one.
    // Where it goes (new-design-settings.ts): store and placement, decided at commit.
    settings: NewDesignSettings;
    // The ids it wrote under, reused by its Retry (createIdsFor).
    ids: CreateIds;
  } | null>(null);

  // Landing funnel (docs/specs/019-marketing/landing-funnel.md): the public-page CTA that brought this visit
  // here, if any. Counts the arrival now and the design once it's committed.
  const cta = useCtaAttribution();

  // Where a new design is stored: This Browser for a guest (docs/specs/006-design/save-locations.md), decided at
  // commit.
  const { resolveSaveLocation } = useNewDesignLocation({ authLoaded, clerkUserId });

  useEffect(() => {
    document.title = 'New Design | livedesign';
    // Fetch the editor's chunk while identity + the create run. Fire-and-forget: a failure here
    // just leaves `dynamic` to retry the import at handoff.
    loadEditor().catch(() => {});
  }, []);

  // Back/forward-cache restore: /new creates as it mounts, so a restore would either strand the person on a frozen
  // "Creating…" screen or (re-firing the create) trap Back behind a page that always navigates forward again. It
  // backs out to the page that opened /new instead.
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
      else window.location.replace('/');
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  useLayoutEffect(() => {
    // Wait for Clerk to settle so guest vs signed-in is known.
    if (!authLoaded) return;
    // Daily-active-returns signal (docs/specs/017-telemetry/telemetry.md): once-per-browser-per-UTC-day,
    // gated inside the helper.
    trackDailyReturn(!!clerkUserId);
  }, [authLoaded, clerkUserId]);
  // The stored profile, once the id is known: the Clerk one, or a guest's signed one.
  const selfId = authLoaded ? (clerkUserId ?? guestId) : null;
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
  // Identity for the commit path. Clerk's chunk loads deferred, so a fast
  // click-through (or an e2e robot) can reach Create while `self` is still
  // the 'pending' placeholder — the identity bootstrap above hasn't run.
  // Creating then would file the design under the literal owner "pending":
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
    // Still pending (auth never settled): resolve the guest's signed id here.
    const fallback = { ...selfRef.current, id: (await ensureSignedGuestIdentity()).id };
    setSelf(fallback);
    return fallback;
  };

  // Single commit point, shared by the create on mount and Retry. Every new design starts on the Default theme; we
  // persist the design so the editor route lands on a real row.
  const themeId = NEW_DESIGN_THEME_ID;
  const commitNewDesign = async (
    templateKind: TemplateKind | null,
    settings: NewDesignSettings,
    // Set by Retry: the failed attempt's ids, so a create that did land is not made twice.
    retrying: CreateIds | null = null,
  ) => {
    if (submitting) return;
    setSubmitting(true);
    // A `?q=` preset becomes the search in the new design's start (start-query.ts).
    handStartQuery(newDesignQuery(window.location.search));
    const startsBlank = newDesignStartsBlank(window.location.search);
    // Save location (docs/specs/006-design/save-locations.md): only This Browser takes the offline branch.
    const offline = isOfflineLocation(settings.saveLocation);
    const { designId, tabId } = createIdsFor(retrying);
    // A blank asked for (`?blank=1`, `?start=blank`) opens with its start closed (close-start-for-blank.ts).
    if (startsBlank) closeStartForBlank(tabId, templateKind);
    // A blank in the cloud: the template picked later on its start may move it to that template's default folder
    // (docs/specs/013-workspace/default-folders.md "A template picked after creation").
    handTemplatePick(
      !offline && (!templateKind || isBlankTemplate(templateKind))
        ? { designId, tabId, placementChosen: settings.placementChosen === true }
        : null,
    );
    // A Retry re-runs the create, not the preference write below.
    lastCreateArgs.current = { kind: templateKind, settings, ids: { designId, tabId } };
    // Named after its template ("Untitled Diagram"); renamed in the editor.
    const designName = untitledNameForTemplate(templateKind);
    markNameConfirmed();
    // Never create as the 'pending' placeholder — see resolveSelf above.
    const settleIdentity = resolveSelf;
    // A design in This Browser has no owner on the server to wait for (docs/specs/006-design/offline-mode.md
    // "Instant open"): identity settles in the background while it opens. A cloud create needs the owner.
    const cloudOwner = offline ? null : await settleIdentity();
    if (offline) {
      void settleIdentity().catch((err: unknown) =>
        debugLog(`[new] background identity failed: ${String(err)}`),
      );
    }
    // The template's tabs, or one blank tab: its start open unless a blank was asked for (new-design-content.ts).
    const { tabs, tab } = await newDesignContent({
      templateKind,
      themeId,
      tabId,
      templateChosen: templateKind !== null || startsBlank,
    });
    try {
      if (offline) {
        // Offline Mode (docs/specs/006-design/offline-mode.md): create the design in IndexedDB only. This
        // also registers its id so every later load / save routes local.
        await offlineCreateDesign(
          { id: designId, name: designName, tabs: tabs ?? [tab] },
          Date.now(),
        );
      } else {
        // Placement rides the create (docs/specs/007-editor/new-design-route.md): a /new?folder= / ?team=
        // context is filed by the same write, or the create is refused by name and nothing is written.
        const owner = cloudOwner ?? (await settleIdentity());
        await apiCreateDesign(owner.id, {
          id: designId,
          name: designName,
          tabs: tabs ?? [tab],
          // Passed through as given: absent is no choice (a default folder may answer), a null
          // folder the root chosen on purpose (docs/specs/013-workspace/default-folders.md).
          teamId: settings.teamId,
          folderId: settings.folderId,
          // What it opens as, captured now and never re-derived
          // (docs/specs/013-workspace/default-folders.md): with no place chosen, the server files it
          // in the person's default folder for it.
          intent: creationIntentOf(tab),
        });
      }
    } catch (err) {
      // Create FAILED (network / 5xx / a refused placement for cloud, or no IndexedDB for
      // offline). Don't navigate to an editor for a design that was never persisted (that
      // lands on a 404). Surface the error card instead: Retry re-runs this exact create from
      // lastCreateArgs; a refused placement offers another place.
      const failure = createFailureCopy(err);
      debugLog(`[new] create failed action=${failure.action}`);
      setSubmitting(false);
      setCreateError(failure);
      return;
    }
    // Anonymous telemetry (docs/specs/017-telemetry/telemetry.md): a design was created. No id or name is
    // sent — the `type` records only whether it's an Offline or Cloud design
    // (docs/specs/006-design/offline-mode.md). The chosen theme is recorded separately below.
    track('Document', 'Created', offline ? 'Offline' : 'Cloud');
    track('Theme', 'Changed', themeTelemetryLabel(themeId));
    if (templateKind) track('Template', 'Used', titleCaseType(templateKind));
    cta.trackCreated();
    // Created straight into a team library: the same Team·Added·Document an Explorer move into a
    // team sends (docs/specs/017-telemetry/telemetry.md), only reached once the create, and so
    // its placement, succeeded.
    if (!offline && settings.teamId) track('Team', 'Added', 'Design');
    // Hand off in place: the editor URL takes /new's history entry, and the editor mounts here,
    // reading the id from the rewritten path exactly as a direct visit would.
    handedOff.current = true;
    window.history.replaceState(null, '', `/design/${designId}`);
    setOpenedId(designId);
  };

  // Every create from /new goes where new designs go by default (docs/specs/007-editor/new-design-route.md): the
  // store for who is creating, decided now (a guest at once, a signed-in browser once identity settles), and the
  // /new?folder= / ?team= context when there is one; without one it carries no placement, so a default folder may
  // answer (docs/specs/013-workspace/default-folders.md "Precedence").
  const createByDefault = async (kind: TemplateKind | null) => {
    const placement = placementParamsFromSearch(window.location.search);
    const placed = !!(placement.folderId || placement.teamId);
    const saveLocation = await resolveSaveLocation(placed, resolveSelf);
    await commitNewDesign(kind, { saveLocation, ...placement, placementChosen: placed });
  };

  // The create fires on mount: commitNewDesign waits out the identity bootstrap itself (resolveSelf), so firing at
  // once is safe. The ref makes it once-only under Strict Mode's double-invoked effects.
  const created = useRef(false);
  const createOnMount = useEffectEvent(() => {
    const kind = newDesignKind(window.location.search);
    // A template link's adoption signal (docs/specs/017-telemetry/telemetry.md): a fixed preset, never user content.
    if (kind) track('UI', 'Used', 'TemplateLink');
    void createByDefault(kind);
  });
  useEffect(() => {
    if (created.current) return;
    created.current = true;
    createOnMount();
  }, []);

  // Keyed on the id so a second handoff (not reachable today) would remount a fresh editor.
  if (openedId) return <EditorPage key={openedId} />;

  if (createError) {
    return (
      <div className="flex h-dvh flex-col">
        <EditorHeader
          designName="New design"
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
                // The refused placement would be refused again: make it without one.
                window.location.assign(choosePlacementAgainUrl(window.location.search));
                return;
              }
              setCreateError(null);
              const a = lastCreateArgs.current;
              if (a) void commitNewDesign(a.kind, a.settings, a.ids);
            }}
          />
        </main>
      </div>
    );
  }

  // The opening screen, at its "creating" stage, holds the screen from mount to the handoff
  // (docs/specs/007-editor/new-design-route.md). The editor's own load renders the same screen, so create → open reads
  // as one moment. Create failures fall through to the retryable error card above.
  return <DesignLoading stage="creating" />;
}
