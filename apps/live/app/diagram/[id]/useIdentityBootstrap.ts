import { useLayoutEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Tab } from '@livediagram/diagram';
import {
  apiListChangeLog,
  apiListShareLinks,
  apiLoadDiagram,
  apiLoadSelf,
  apiLoadShared,
  apiLoadTab,
  apiSaveSelf,
  getSessionSharePassword,
  readCachedSharePassword,
  setSessionSharePassword,
  writeCachedSharePassword,
  type ChangeLogEntry,
  type ShareLink,
  type SharedWithItem,
  type ShareRole,
} from '@/lib/api-client';
import { randomColor, randomName, type Participant } from '@/lib/identity';
import { hasConfirmedName } from '@/lib/local-identity';
import { ensureSignedGuestIdentity } from '@/lib/guest-identity';
import { trackDailyReturn } from '@/lib/daily-return';
import { track } from '@/lib/telemetry';
import { placeholdersFromSummaries, resolveDiagramSession } from './editor-page-helpers';

type SetState<T> = Dispatch<SetStateAction<T>>;

// One-shot identity + diagram hydration (Clerk gate -> guest id ->
// participant -> diagram/share/password resolution -> tab seeding),
// lifted out of editor-page.tsx verbatim. The most entangled effect in
// the page: it reads/writes ~25 state slices, so the setters + the
// last-saved/loaded refs are passed as grouped bundles. Auth resolution
// goes through the tested resolveDiagramSession kernel. Deps array stays
// [authLoaded, passwordRetry].
export function useIdentityBootstrap(opts: {
  authLoaded: boolean;
  passwordRetry: number;
  hydrated: boolean;
  clerkUserId: string | null | undefined;
  clerkDisplayName: string | null | undefined;
  activeId: string;
  selfParticipant: Participant;
  refreshDiagramList: (ownerId: string) => void;
  refreshSharedList: (ownerId: string) => void;
  resetTabs: Dispatch<SetStateAction<Tab[]>>;
  refs: {
    lastPersistedSelfRef: MutableRefObject<{ name: string; color: string } | null>;
    lastSavedTabsRef: MutableRefObject<Tab[]>;
    lastSavedNameRef: MutableRefObject<string>;
    loadedTabIdsRef: MutableRefObject<Set<string>>;
  };
  set: {
    setActiveId: SetState<string>;
    setChangeLog: SetState<ChangeLogEntry[]>;
    setChangeLogLoading: SetState<boolean>;
    setDiagramId: SetState<string | null>;
    setDiagramName: SetState<string>;
    setDiagramNotFound: SetState<boolean>;
    setLoadError: SetState<boolean>;
    setDiagramOwnerColor: SetState<string | null>;
    setDiagramOwnerId: SetState<string | null>;
    setDiagramOwnerName: SetState<string | null>;
    setDiagramShareable: SetState<boolean>;
    setDiagramTeamId: SetState<string | null>;
    setDiagramShareCode: SetState<string | null>;
    setHydrated: SetState<boolean>;
    setIsOwner: SetState<boolean>;
    setLoadedExistingDiagram: SetState<boolean>;
    setLoadedTabIds: SetState<Set<string>>;
    setLoadingDiagram: SetState<boolean>;
    setNameConfirmed: SetState<boolean>;
    setSelfParticipant: SetState<Participant>;
    setSessionRole: SetState<ShareRole>;
    setSessionShareCode: SetState<string | null>;
    setSharedDiagrams: SetState<SharedWithItem[]>;
    setShareLinks: SetState<ShareLink[]>;
    setSharePassword: SetState<string | null>;
    setSharePasswordGate: SetState<{ invalid: boolean } | null>;
    setTemplatePickerMode: SetState<'welcome' | 'templates' | 'identity'>;
  };
}) {
  const {
    authLoaded,
    passwordRetry,
    hydrated,
    clerkUserId,
    clerkDisplayName,
    activeId,
    selfParticipant,
    refreshDiagramList,
    refreshSharedList,
    resetTabs,
    refs,
    set,
  } = opts;
  const { lastPersistedSelfRef, lastSavedTabsRef, lastSavedNameRef, loadedTabIdsRef } = refs;
  const {
    setActiveId,
    setChangeLog,
    setChangeLogLoading,
    setDiagramId,
    setDiagramName,
    setDiagramNotFound,
    setLoadError,
    setDiagramOwnerColor,
    setDiagramOwnerId,
    setDiagramOwnerName,
    setDiagramShareable,
    setDiagramShareCode,
    setDiagramTeamId,
    setHydrated,
    setIsOwner,
    setLoadedExistingDiagram,
    setLoadedTabIds,
    setLoadingDiagram,
    setNameConfirmed,
    setSelfParticipant,
    setSessionRole,
    setSessionShareCode,
    setSharedDiagrams,
    setShareLinks,
    setSharePassword,
    setSharePasswordGate,
    setTemplatePickerMode,
  } = set;

  useLayoutEffect(() => {
    if (hydrated) return;
    // Wait for Clerk to determine the auth state before bootstrapping.
    // Otherwise a signed-in user lands here with `clerkUserId === null`
    // briefly, we mint a guest id, and the participant record + every
    // subsequent diagram load uses the wrong owner. With this gate
    // the effect re-runs once `authLoaded` flips true.
    if (!authLoaded) return;
    // Daily-active-returns signal (spec/22): once auth has settled we
    // know whether this open is a guest or a signed-in user. Fire-and-
    // forget, gated to once per browser per UTC day inside the helper,
    // so it's safe to run on every editor mount.
    trackDailyReturn(!!clerkUserId);
    // The post-mount hydration is async (the API is HTTP) so we run it
    // inside an IIFE. UI stays at the placeholder during the fetch;
    // the welcome modal is gated on `hydrated` so it doesn't flash the
    // Guest placeholder name into the input.
    //
    // Path scheme (spec/14): `/diagram/<id>` is the owner URL.
    // The static export ships a single placeholder file at
    // `out/diagram/placeholder/index.html`; the live worker rewrites
    // `/diagram/<anything>` → that file so the browser receives the
    // editor HTML. The client router still fires notFound() for
    // every non-`placeholder` id, but `apps/live/app/not-found.tsx`
    // rescues that by rendering the editor in the not-found slot —
    // see the file comment there. Either way this component mounts
    // with the real id still in `window.location.pathname`, which
    // we parse out here.
    const initialUrl = new URL(window.location.href);
    // Clean routing (spec/08): the editor lives at `/diagram/<id>`, no
    // `/live` prefix. Match the id straight off the path.
    const pathMatch = initialUrl.pathname.match(/\/diagram\/([^/?#]+)/);
    const rawPathId = pathMatch ? pathMatch[1]! : null;
    // `placeholder` is the static-export build artefact, not a real
    // diagram id — ignore it so the IIFE doesn't try to fetch it.
    const initialId = rawPathId && rawPathId !== 'placeholder' ? rawPathId : null;
    const initialShareCode = initialUrl.searchParams.get('s');
    // No path id and no share code → the user landed on the placeholder
    // route directly. Hand off to /live/new for the welcome flow.
    if (!initialId && !initialShareCode) {
      window.location.assign(`${window.location.origin}/new`);
      return;
    }
    void (async () => {
      const id = initialId;
      const shareCodeParam = initialShareCode;

      // Identity comes first because every diagram fetch needs an
      // owner id. On password retries (passwordRetry > 0) we already
      // resolved the participant on the first attempt — reuse it rather
      // than hitting /api/participants again on every wrong guess.
      let self: Participant;
      if (selfParticipant.id !== 'self') {
        // Already resolved — skip the network round-trip.
        self = selfParticipant;
      } else {
        // Two ways in (spec/04): when signed in, the Clerk userId becomes
        // the canonical participant id. When signed out, fall back to the
        // localStorage guest UUID.
        // For a guest, resolve a SERVER-SIGNED id (minting one on first
        // visit, upgrading a legacy unsigned id) so the eventual sign-up
        // migrate can prove possession. Falls back to a local unsigned id
        // offline. See spec/04 + lib/guest-identity.ts.
        const selfId = clerkUserId ?? (await ensureSignedGuestIdentity()).id;
        const storedSelf = await apiLoadSelf(selfId).catch(() => null);
        // Signed-in users always use their Clerk-known name on the
        // participant record. For a brand-new participant (no storedSelf)
        // this seeds the row; for an existing one we overwrite so it stays
        // in sync with the user's Clerk profile. Guests keep the existing
        // random placeholder so their chosen identity isn't blown away.
        const baseSelf: Participant = storedSelf ?? {
          id: selfId,
          name: randomName(),
          color: randomColor(),
          status: 'online',
        };
        self =
          clerkUserId && clerkDisplayName
            ? { ...baseSelf, name: clerkDisplayName, status: 'online' }
            : { ...baseSelf, status: 'online' };
        setSelfParticipant({ ...self, status: 'online' });
        // Persist on first load, or when a signed-in user's Clerk display
        // name has drifted from what we have on the server.
        const nameDrifted = !!(
          storedSelf &&
          clerkUserId &&
          clerkDisplayName &&
          storedSelf.name !== clerkDisplayName
        );
        if (!storedSelf || nameDrifted) await apiSaveSelf(self).catch(() => {});
        // Seed the persistence guard so the post-hydration effect doesn't
        // immediately echo the same name/color back via PUT.
        lastPersistedSelfRef.current = { name: self.name, color: self.color };
      }

      // Two URL flavours: `?d=<id>` is the owner's private URL,
      // `?s=<code>` is a share URL another participant follows. Visitor
      // arrivals get full diagram data via the share-code endpoint and
      // are flagged `!isOwner` so the Share button hides.
      if (shareCodeParam) {
        // Warm-cache the share password (spec/24) before the first
        // call so a returning visitor whose password didn't change
        // gets straight to the canvas without the gate. The seed is
        // a no-op when the cache is empty (apiHeaders sees null and
        // skips the X-Share-Password header), and if the server
        // rejects the cached value we'll clear the entry below.
        const cachedPassword = readCachedSharePassword(shareCodeParam);
        if (cachedPassword) setSessionSharePassword(cachedPassword);
        // Pass the visitor's owner id so the api worker can record
        // their visit into shared_with — without it the server can't
        // identify the visitor and the "Shared with you" list stays
        // empty forever.
        let resolution;
        try {
          resolution = await apiLoadShared(shareCodeParam, self.id);
        } catch {
          // Couldn't reach the server to resolve the share link (network
          // / 5xx). Retryable, so show the error page instead of the
          // "link revoked / diagram gone" NotFound below.
          setLoadError(true);
          setHydrated(true);
          setLoadingDiagram(false);
          setNameConfirmed(hasConfirmedName());
          return;
        }
        if (!resolution) {
          // The share code didn't resolve. Either it never existed,
          // the owner revoked it, or the diagram was deleted while
          // the visitor still had the link. Surface a NotFound page
          // so the visitor sees an explicit error instead of a
          // silent blank canvas (which used to read as "the
          // diagram loaded but is empty").
          setDiagramNotFound(true);
          setHydrated(true);
          setLoadingDiagram(false);
          setNameConfirmed(hasConfirmedName());
          return;
        }
        if ('passwordRequired' in resolution) {
          // The diagram is password-protected (spec/24). Show the gate
          // instead of hydrating. Deliberately leave `hydrated` false
          // so bumping `passwordRetry` (on submit) re-runs this effect
          // with the password now set on the session. `invalid` marks
          // a wrong attempt so the gate can show an error. A cached
          // password that the server just rejected goes into both
          // buckets: clear it so we don't loop the same wrong value
          // on the next retry, and reset the session attempt too so
          // the gate's empty-input prompt isn't lying about what's
          // about to be sent.
          if (cachedPassword) {
            writeCachedSharePassword(shareCodeParam, null);
            setSessionSharePassword(null);
          }
          setSharePasswordGate({ invalid: resolution.invalid });
          setLoadingDiagram(false);
          setNameConfirmed(hasConfirmedName());
          return;
        }
        // Success path. Persist whatever password the session is
        // currently using (cached seed OR fresh user input) so the
        // next load skips the gate.
        const accepted = getSessionSharePassword();
        if (accepted) writeCachedSharePassword(shareCodeParam, accepted);
        {
          const { diagram: fetched, role } = resolution;
          const session = resolveDiagramSession({
            diagramOwnerId: fetched.ownerId,
            selfId: self.id,
            shareRole: role,
            shareCodeParam,
          });
          const codeForVisitor = session.sessionShareCode;
          // Lazy per-tab fetch (spec/13): the active tab (first in the
          // summaries) gets its full payload inline so the first paint
          // has real content; the rest land as placeholders and a
          // useEffect below fetches each one when the user switches.
          const placeholderTabs: Tab[] = placeholdersFromSummaries(fetched.tabs);
          const firstSummary = fetched.tabs[0];
          if (firstSummary) {
            const first = await apiLoadTab(
              self.id,
              fetched.id,
              firstSummary.id,
              codeForVisitor,
            ).catch(() => null);
            // Only mark the tab loaded when the eager fetch actually
            // returned content. If it failed (e.g. a transient 403 from
            // a request that raced ahead of the Clerk token / session
            // share code being wired up), leave it OUT of the loaded set
            // so the lazy-load effect below retries it once auth is in
            // place. Marking it loaded regardless used to leave the
            // first tab permanently blank while later tabs — fetched
            // through that effect after bootstrap — loaded fine.
            if (first) {
              placeholderTabs[0] = first;
              loadedTabIdsRef.current.add(firstSummary.id);
              setLoadedTabIds((prev) => new Set(prev).add(firstSummary.id));
              // Telemetry (spec/22): the first tab's content was fetched.
              // Subsequent tabs count via usePerTabLoad on switch.
              track('Tab', 'Loaded');
            }
          }
          resetTabs(placeholderTabs);
          // Seed the autosave's "last saved" mirror with the hydrated
          // state so the first save-cycle treats it as unchanged.
          // Otherwise the autosave would diff the EMPTY-elements
          // placeholders against an empty [] baseline and PUT them
          // back to the server, wiping every other tab's content
          // before the lazy-load could populate it.
          lastSavedTabsRef.current = placeholderTabs;
          lastSavedNameRef.current = fetched.name;
          setDiagramName(fetched.name);
          // Prefer the tab id pinned in the URL fragment (#t=<id>) when
          // it points at a real loaded tab — round-trips the user back
          // to whichever tab they last had open before a refresh.
          {
            const hashMatch = window.location.hash.match(/t=([^&]+)/);
            const hashedId = hashMatch ? hashMatch[1] : null;
            const pickFromHash = hashedId && placeholderTabs.some((t) => t.id === hashedId);
            setActiveId(pickFromHash ? hashedId! : (placeholderTabs[0]?.id ?? activeId));
          }
          setLoadedExistingDiagram(true);
          setDiagramId(fetched.id);
          setDiagramShareable(fetched.shareable);
          setDiagramTeamId(fetched.teamId ?? null);
          setDiagramShareCode(fetched.shareCode);
          setIsOwner(session.isOwner);
          setDiagramOwnerId(fetched.ownerId);
          setDiagramOwnerName(fetched.ownerName ?? null);
          setDiagramOwnerColor(fetched.ownerColor ?? null);
          // Visitors inherit the role from their share code; owners are
          // always 'edit' (see resolveDiagramSession).
          setSessionRole(session.sessionRole);
          // Visitor: stash the code they came in on so any log
          // writes can present it as authorisation. Owner accessing
          // via a share URL keeps null.
          setSessionShareCode(session.sessionShareCode);
          // Visitors with an edit-role share code can read + write the
          // log too. View-only visitors get nothing from the endpoint
          // (the API gates POST/DELETE but currently still serves
          // GET when authorised; we skip the fetch so view-only
          // visitors don't even attempt it). Owner case is handled
          // in the ?d= branch below.
          if (session.canEditLog) {
            const codeForFetch = session.sessionShareCode;
            apiListChangeLog(self.id, fetched.id, codeForFetch)
              .then((entries) => {
                setChangeLog(entries);
                setChangeLogLoading(false);
              })
              .catch(() => setChangeLogLoading(false));
          } else {
            setChangeLogLoading(false);
          }
          // Signed-in user opening their own diagram via a share URL
          // already has a confirmed identity — never prompt. Visitors
          // (signed in or not) still see the welcome card so they get
          // the "you're joining X's diagram" context; the name input
          // is locked downstream when they have a Clerk identity so
          // they can't pretend to be someone else.
          const isOwnerVisit = fetched.ownerId === self.id;
          if (!isOwnerVisit && !hasConfirmedName()) {
            setTemplatePickerMode('identity');
          }
          // Optimistically add the current diagram to the shared-with
          // list so it appears in the Explorer immediately, before the
          // refreshSharedList network round-trip completes. The server
          // fetch will replace this with the full list; deduplicate so
          // returning visitors don't see a duplicate row.
          if (!isOwnerVisit) {
            setSharedDiagrams((prev) =>
              prev.some((d) => d.id === fetched.id)
                ? prev
                : [
                    {
                      id: fetched.id,
                      name: fetched.name,
                      savedAt: fetched.savedAt,
                      role,
                      shareCode: shareCodeParam,
                      ownerName: fetched.ownerName ?? null,
                      ownerColor: fetched.ownerColor ?? null,
                    },
                    ...prev,
                  ],
            );
          }
          // Telemetry (spec/22): an existing diagram was opened via a
          // share URL. Fires for every open (owner-via-share or visitor),
          // the counterpart to Diagram/Created.
          track('Diagram', 'Loaded');
          // A visitor joined a shared diagram. Owners opening their own
          // share URL don't count as a join. `type` is the share role
          // (Edit / View), a preset.
          if (!isOwnerVisit) {
            track('Diagram', 'Joined', role === 'edit' ? 'Edit' : 'View');
          }
        }
      } else if (id) {
        let fetched;
        try {
          fetched = await apiLoadDiagram(self.id, id);
        } catch {
          // The load FAILED (network down / 5xx) — not a clean 404.
          // Surface a retryable error page rather than NotFound, which
          // would wrongly tell the user the diagram doesn't exist.
          setDiagramId(id);
          setLoadError(true);
          setHydrated(true);
          setLoadingDiagram(false);
          setNameConfirmed(hasConfirmedName());
          return;
        }
        if (!fetched) {
          // URL had a ?d=<id> but the API didn't return anything for
          // us — either the diagram doesn't exist or we don't own it.
          // Surface a NotFound page instead of dropping the user into
          // the new-diagram welcome flow.
          setDiagramId(id);
          setDiagramNotFound(true);
          setHydrated(true);
          setLoadingDiagram(false);
          setNameConfirmed(hasConfirmedName());
          return;
        }
        if (fetched) {
          // Lazy per-tab fetch — see the share branch above for
          // rationale.
          const placeholderTabs: Tab[] = placeholdersFromSummaries(fetched.tabs);
          const firstSummary = fetched.tabs[0];
          if (firstSummary) {
            const first = await apiLoadTab(self.id, fetched.id, firstSummary.id, null).catch(
              () => null,
            );
            // Only mark loaded on success, so a failed eager fetch falls
            // through to the lazy-load effect's retry (see the visitor
            // branch above for the full rationale).
            if (first) {
              placeholderTabs[0] = first;
              loadedTabIdsRef.current.add(firstSummary.id);
              setLoadedTabIds((prev) => new Set(prev).add(firstSummary.id));
              // Telemetry (spec/22): the first tab's content was fetched.
              // Subsequent tabs count via usePerTabLoad on switch.
              track('Tab', 'Loaded');
            }
          }
          resetTabs(placeholderTabs);
          // Seed the autosave's "last saved" mirror with the hydrated
          // state — same rationale as the visitor branch above.
          lastSavedTabsRef.current = placeholderTabs;
          lastSavedNameRef.current = fetched.name;
          setDiagramName(fetched.name);
          // Prefer the tab id pinned in the URL fragment (#t=<id>) when
          // it points at a real loaded tab — round-trips the user back
          // to whichever tab they last had open before a refresh.
          {
            const hashMatch = window.location.hash.match(/t=([^&]+)/);
            const hashedId = hashMatch ? hashMatch[1] : null;
            const pickFromHash = hashedId && placeholderTabs.some((t) => t.id === hashedId);
            setActiveId(pickFromHash ? hashedId! : (placeholderTabs[0]?.id ?? activeId));
          }
          setLoadedExistingDiagram(true);
          // Telemetry (spec/22): an existing diagram was opened (owner URL
          // / refresh). Fires on every open, the counterpart to Created.
          track('Diagram', 'Loaded');
          setDiagramShareable(fetched.shareable);
          setDiagramTeamId(fetched.teamId ?? null);
          setDiagramShareCode(fetched.shareCode);
          setIsOwner(fetched.ownerId === self.id);
          setDiagramOwnerId(fetched.ownerId);
          setDiagramOwnerName(fetched.ownerName ?? null);
          setDiagramOwnerColor(fetched.ownerColor ?? null);
          setSessionRole('edit');
          // If we own the diagram, prefetch its full share-link list so
          // the dialog opens populated.
          if (fetched.ownerId === self.id) {
            apiListShareLinks(self.id, fetched.id)
              .then(({ links, password }) => {
                setShareLinks(links);
                setSharePassword(password);
              })
              .catch(() => {});
            apiListChangeLog(self.id, fetched.id, null)
              .then((entries) => {
                setChangeLog(entries);
                setChangeLogLoading(false);
              })
              .catch(() => setChangeLogLoading(false));
          } else {
            setChangeLogLoading(false);
          }
          // Owner branch (`?d=<id>` / `/diagram/<id>`): a signed-in
          // user is by definition the owner here and their identity is
          // settled — skip the identity prompt entirely. Guests fall
          // back to the legacy localStorage gate so they still get the
          // one-time naming nudge.
          if (!clerkUserId && !hasConfirmedName()) {
            setTemplatePickerMode('identity');
          }
        }
        setDiagramId(id);
      }
      // No URL params → no diagram yet → no log to fetch. Clear the
      // skeleton so the panel renders the empty-state copy.
      if (!shareCodeParam && !id) {
        setChangeLogLoading(false);
      }
      setNameConfirmed(hasConfirmedName());
      refreshDiagramList(self.id);
      refreshSharedList(self.id);
      // Folder list is auto-loaded by the useFolders hook once
      // selfParticipant.id transitions off the placeholder — no
      // manual fetch needed here.
      setHydrated(true);
      setLoadingDiagram(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded, passwordRetry]);
}
