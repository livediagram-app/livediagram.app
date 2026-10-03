import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Tab } from '@livediagram/document';
import type { LiveDoc } from '@livediagram/api-schema';
import { apiLoadTab } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { firstTabToLoad, isTabOutOfScope } from '@/lib/tab-scope';
import { placeholdersFromSummaries } from './editor-page-helpers';

type SetState<T> = Dispatch<SetStateAction<T>>;

// The common "seed the editor from a fetched document" body shared by
// useIdentityBootstrap's two arrival branches (share-code visitor and
// owner URL), which used to carry it twice: placeholder tabs + the
// eager first-tab fetch, the autosave "last saved" mirror, the document
// name, the #t=<id> hash tab pick, and the shareable / team / owner
// fields. The branches keep what genuinely differs — isOwner / session
// role / share-code bookkeeping, the change-log fetch, and the
// identity-prompt rules.
export function makeSeedFetchedDocument(deps: {
  activeId: string;
  // Whether this editor's first-tab read is an open of the document, for the reader's Home
  // (docs/specs/013-workspace/explorer-home.md "Opens"): true in the editor, false in an embed.
  recordOpen: boolean;
  resetTabs: Dispatch<SetStateAction<Tab[]>>;
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  lastSavedNameRef: MutableRefObject<string>;
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  setActiveId: SetState<string>;
  setDocumentName: SetState<string>;
  // The stored slide deck (docs/specs/012-collaboration/presentation-mode.md), handed on for useSlideDeck to parse.
  setDocumentPresentation: SetState<string | null>;
  setDocumentOwnerColor: SetState<string | null>;
  setDocumentOwnerId: SetState<string | null>;
  setDocumentOwnerName: SetState<string | null>;
  setDocumentShareable: SetState<boolean>;
  setDocumentShareCode: SetState<string | null>;
  setDocumentTeamId: SetState<string | null>;
  setLoadedExistingDocument: SetState<boolean>;
  setLoadedTabIds: SetState<Set<string>>;
}) {
  const {
    activeId,
    recordOpen,
    resetTabs,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
    setActiveId,
    setDocumentName,
    setDocumentPresentation,
    setDocumentOwnerColor,
    setDocumentOwnerId,
    setDocumentOwnerName,
    setDocumentShareable,
    setDocumentShareCode,
    setDocumentTeamId,
    setLoadedExistingDocument,
    setLoadedTabIds,
  } = deps;
  // `tabShareCode` is the share code the per-tab fetch presents as
  // authorisation: the visitor's session code, or null for the owner.
  //
  // `tabScope` is the one tab a tab-scoped share link opens
  // (docs/specs/013-workspace/tab-scoped-share-links.md): that tab is fetched eagerly and made active,
  // wherever it sits in the bar. Null = the first tab, as for everyone else.
  return async (
    selfId: string,
    fetched: LiveDoc,
    tabShareCode: string | null,
    tabScope: string | null,
  ) => {
    // Lazy per-tab fetch (docs/specs/006-document/per-tab-storage.md): the active tab (first in the
    // summaries, or the scoped one) gets its full payload inline so the first
    // paint has real content; the rest land as placeholders and the
    // lazy-load effect fetches each one when the user switches.
    const placeholderTabs: Tab[] = placeholdersFromSummaries(fetched.tabs);
    const firstId = firstTabToLoad(fetched.tabs, tabScope);
    const firstIndex = placeholderTabs.findIndex((t) => t.id === firstId);
    if (firstId && firstIndex >= 0) {
      const first = await apiLoadTab(selfId, fetched.id, firstId, tabShareCode, {
        open: recordOpen,
      }).catch(() => null);
      // Only mark the tab loaded when the eager fetch actually
      // returned content. If it failed (e.g. a transient 403 from
      // a request that raced ahead of the Clerk token / session
      // share code being wired up), leave it OUT of the loaded set
      // so the lazy-load effect retries it once auth is in place.
      // Marking it loaded regardless used to leave the first tab
      // permanently blank while later tabs — fetched through that
      // effect after bootstrap — loaded fine.
      if (first) {
        placeholderTabs[firstIndex] = first;
        loadedTabIdsRef.current.add(firstId);
        setLoadedTabIds((prev) => new Set(prev).add(firstId));
        // Telemetry (docs/specs/017-telemetry/telemetry.md): the first tab's content was fetched.
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
    setDocumentName(fetched.name);
    setDocumentPresentation(fetched.presentation ?? null);
    // Prefer the tab id pinned in the URL fragment (#t=<id>) when
    // it points at a real loaded tab — round-trips the user back
    // to whichever tab they last had open before a refresh.
    {
      const hashMatch = window.location.hash.match(/t=([^&]+)/);
      const hashedId = hashMatch ? hashMatch[1] : null;
      const pickFromHash =
        hashedId &&
        placeholderTabs.some((t) => t.id === hashedId) &&
        !isTabOutOfScope(hashedId, tabScope);
      setActiveId(pickFromHash ? hashedId! : (firstId ?? activeId));
    }
    setLoadedExistingDocument(true);
    setDocumentShareable(fetched.shareable);
    setDocumentTeamId(fetched.teamId ?? null);
    setDocumentShareCode(fetched.shareCode);
    setDocumentOwnerId(fetched.ownerId);
    setDocumentOwnerName(fetched.ownerName ?? null);
    setDocumentOwnerColor(fetched.ownerColor ?? null);
    // Telemetry (docs/specs/017-telemetry/telemetry.md): an existing document was opened — every open,
    // owner URL or share URL, the counterpart to Document/Created.
    track('Document', 'Loaded');
  };
}
