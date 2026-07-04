import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Tab } from '@livediagram/diagram';
import type { Diagram } from '@livediagram/api-schema';
import { apiLoadTab } from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import { placeholdersFromSummaries } from './editor-page-helpers';

type SetState<T> = Dispatch<SetStateAction<T>>;

// The common "seed the editor from a fetched diagram" body shared by
// useIdentityBootstrap's two arrival branches (share-code visitor and
// owner URL), which used to carry it twice: placeholder tabs + the
// eager first-tab fetch, the autosave "last saved" mirror, the diagram
// name, the #t=<id> hash tab pick, and the shareable / team / owner
// fields. The branches keep what genuinely differs — isOwner / session
// role / share-code bookkeeping, the change-log fetch, and the
// identity-prompt rules.
export function makeSeedFetchedDiagram(deps: {
  activeId: string;
  resetTabs: Dispatch<SetStateAction<Tab[]>>;
  lastSavedTabsRef: MutableRefObject<Tab[]>;
  lastSavedNameRef: MutableRefObject<string>;
  loadedTabIdsRef: MutableRefObject<Set<string>>;
  setActiveId: SetState<string>;
  setDiagramName: SetState<string>;
  setDiagramOwnerColor: SetState<string | null>;
  setDiagramOwnerId: SetState<string | null>;
  setDiagramOwnerName: SetState<string | null>;
  setDiagramShareable: SetState<boolean>;
  setDiagramShareCode: SetState<string | null>;
  setDiagramTeamId: SetState<string | null>;
  setLoadedExistingDiagram: SetState<boolean>;
  setLoadedTabIds: SetState<Set<string>>;
}) {
  const {
    activeId,
    resetTabs,
    lastSavedTabsRef,
    lastSavedNameRef,
    loadedTabIdsRef,
    setActiveId,
    setDiagramName,
    setDiagramOwnerColor,
    setDiagramOwnerId,
    setDiagramOwnerName,
    setDiagramShareable,
    setDiagramShareCode,
    setDiagramTeamId,
    setLoadedExistingDiagram,
    setLoadedTabIds,
  } = deps;
  // `tabShareCode` is the share code the per-tab fetch presents as
  // authorisation: the visitor's session code, or null for the owner.
  return async (selfId: string, fetched: Diagram, tabShareCode: string | null) => {
    // Lazy per-tab fetch (spec/13): the active tab (first in the
    // summaries) gets its full payload inline so the first paint
    // has real content; the rest land as placeholders and the
    // lazy-load effect fetches each one when the user switches.
    const placeholderTabs: Tab[] = placeholdersFromSummaries(fetched.tabs);
    const firstSummary = fetched.tabs[0];
    if (firstSummary) {
      const first = await apiLoadTab(selfId, fetched.id, firstSummary.id, tabShareCode).catch(
        () => null,
      );
      // Only mark the tab loaded when the eager fetch actually
      // returned content. If it failed (e.g. a transient 403 from
      // a request that raced ahead of the Clerk token / session
      // share code being wired up), leave it OUT of the loaded set
      // so the lazy-load effect retries it once auth is in place.
      // Marking it loaded regardless used to leave the first tab
      // permanently blank while later tabs — fetched through that
      // effect after bootstrap — loaded fine.
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
    setDiagramShareable(fetched.shareable);
    setDiagramTeamId(fetched.teamId ?? null);
    setDiagramShareCode(fetched.shareCode);
    setDiagramOwnerId(fetched.ownerId);
    setDiagramOwnerName(fetched.ownerName ?? null);
    setDiagramOwnerColor(fetched.ownerColor ?? null);
    // Telemetry (spec/22): an existing diagram was opened — every open,
    // owner URL or share URL, the counterpart to Diagram/Created.
    track('Diagram', 'Loaded');
  };
}
