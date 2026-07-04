// Pure aggregation of realtime presence state into the row shapes the
// editor renders: per-tab avatar buckets, remote cursor rows, laser-trail
// rows, and the per-element remote-selection map. Lifted out of
// useEditorState so this join logic (presence x tab-focus x idle, scoped
// to the active tab and filtered to live participants) is unit-testable
// without standing up the room. `now` and the last-seen map are passed in
// rather than read from Date.now() / a ref, keeping the functions pure.
import { statusFromIdleMs, type Participant } from './identity';
import type { LaserPoint } from './laser-buffer';

// Row shapes the builders below return. Module-private: only this file's own
// functions name them, so they carry no `export` (consumers get the inferred
// return types).
type CursorRow = { id: string; name: string; color: string; x: number; y: number };
type LaserTrailRow = { participantId: string; color: string; points: LaserPoint[] };
type RemoteSelector = { id: string; name: string; color: string };

// Group participants by the tab they're focused on, so each TabBar entry
// renders the right avatar dots. Always includes the local participant on
// their active tab; remote peers without a tab-focus op yet default to the
// first tab. Status is per-viewer (on my tab -> online, elsewhere -> away)
// unless idle has dragged them to away/offline. Returns an empty map for
// private (unshared) diagrams.
export function buildParticipantsByTab(input: {
  diagramShareable: boolean;
  // A team diagram (spec/35) is collaborative for its members even
  // with no share link, so tab presence shows there too.
  diagramTeamId: string | null;
  activeId: string;
  selfParticipant: Participant;
  tabs: { id: string }[];
  remoteTabFocus: Map<string, string>;
  livePresence: Participant[];
  livePresenceById: Map<string, Participant>;
  lastSeen: Map<string, number>;
  now: number;
}): Map<string, Participant[]> {
  const {
    diagramShareable,
    diagramTeamId,
    activeId,
    selfParticipant,
    tabs,
    remoteTabFocus,
    livePresence,
    livePresenceById,
    lastSeen,
    now,
  } = input;
  const map = new Map<string, Participant[]>();
  if (!diagramShareable && !diagramTeamId) return map;
  map.set(activeId, [{ ...selfParticipant, status: 'online', lastActiveAt: now }]);
  const defaultTabId = tabs[0]?.id ?? activeId;
  const tabFocus = new Map<string, string>(remoteTabFocus);
  for (const p of livePresence) {
    if (p.id === selfParticipant.id) continue;
    if (!tabFocus.has(p.id)) tabFocus.set(p.id, defaultTabId);
  }
  for (const [id, tabId] of tabFocus) {
    if (id === selfParticipant.id) continue;
    const p = livePresenceById.get(id);
    if (!p) continue;
    const lastActiveAt = lastSeen.get(id) ?? now;
    const idleStatus = statusFromIdleMs(now - lastActiveAt);
    const status =
      idleStatus === 'offline'
        ? 'offline'
        : idleStatus === 'away'
          ? 'away'
          : tabId === activeId
            ? 'online'
            : 'away';
    const withStatus: Participant = { ...p, status, lastActiveAt };
    const bucket = map.get(tabId);
    if (bucket) bucket.push(withStatus);
    else map.set(tabId, [withStatus]);
  }
  return map;
}

// Remote cursor rows joined with presence (fresh colour + name) and
// filtered to the active tab, dropping self + off-canvas (null) cursors.
export function buildRemoteCursorRows(
  remoteCursors: Map<string, { tabId: string; x: number; y: number } | null>,
  livePresenceById: Map<string, Participant>,
  selfId: string,
  activeId: string,
): CursorRow[] {
  const rows: CursorRow[] = [];
  for (const [id, pos] of remoteCursors) {
    if (!pos) continue;
    if (id === selfId) continue;
    if (pos.tabId !== activeId) continue;
    const p = livePresenceById.get(id);
    if (!p) continue;
    rows.push({ id, name: p.name, color: p.color, x: pos.x, y: pos.y });
  }
  return rows;
}

// Laser-trail rows for the overlay: the local trail first, then any peers
// whose latest sample is on the active tab and who are still present.
export function buildLaserTrailRows(input: {
  localLaserTrail: LaserPoint[];
  remoteLaserTrails: Map<string, { tabId: string; points: LaserPoint[] }>;
  livePresenceById: Map<string, Participant>;
  selfId: string;
  selfColor: string;
  activeId: string;
}): LaserTrailRow[] {
  const { localLaserTrail, remoteLaserTrails, livePresenceById, selfId, selfColor, activeId } =
    input;
  const rows: LaserTrailRow[] = [];
  if (localLaserTrail.length > 0) {
    rows.push({ participantId: selfId, color: selfColor, points: localLaserTrail });
  }
  for (const [id, entry] of remoteLaserTrails) {
    if (id === selfId) continue;
    if (entry.tabId !== activeId) continue;
    const p = livePresenceById.get(id);
    if (!p) continue;
    rows.push({ participantId: id, color: p.color, points: entry.points });
  }
  return rows;
}

// Three-tier resolution for the canvas's top-middle "Owner" badge,
// lifted out of EditorCanvasHost:
//   1. Self IS the owner -> always have name + colour.
//   2. Owner is currently in the room -> use the live presence row so
//      the avatar (and its online dot) matches what visitors see in
//      the TabBar.
//   3. Owner is offline -> fall back to the joined name + colour we
//      got from the diagram fetch (api worker LEFT JOINs participants
//      on owner_id).
// Returns null only when the owner truly has no participant record on
// the server.
export function resolveOwnerBadge(input: {
  isOwner: boolean;
  selfParticipant: Participant;
  livePresence: Participant[];
  diagramOwnerId: string | null;
  diagramOwnerName: string | null;
  diagramOwnerColor: string | null;
}): Participant | null {
  const {
    isOwner,
    selfParticipant,
    livePresence,
    diagramOwnerId,
    diagramOwnerName,
    diagramOwnerColor,
  } = input;
  if (isOwner) return selfParticipant;
  // The share endpoint redacts ownerId to '' for visitors (so an
  // observer can't learn + claim a guest's owner-id), so a
  // visitor can't match the owner's live presence row by id.
  // When we have the real id (owner opening their own link) match
  // on it; otherwise fall back to the joined owner name + colour,
  // which is the same identity the fetch already trusts. Without
  // this, an online owner always resolved to the offline branch
  // below and showed a red (offline) dot to viewers.
  const live = diagramOwnerId
    ? livePresence.find((p) => p.id === diagramOwnerId)
    : livePresence.find((p) => p.name === diagramOwnerName && p.color === diagramOwnerColor);
  if (live) return live;
  // Owner not in the room: key the badge off the NAME, not the
  // (blanked) id, or viewers never get the badge at all. The id
  // here is display-only, so a synthetic fallback is fine.
  if (diagramOwnerName) {
    return {
      id: diagramOwnerId || 'owner',
      name: diagramOwnerName,
      color: diagramOwnerColor ?? '#94a3b8',
      status: 'offline' as const,
    };
  }
  return null;
}

// A peer's current selection: the element id plus the tab it lives on.
// `tabId` is optional for wire compatibility (an older peer's frame
// omits it and is treated as tab-unknown — visible everywhere, the old
// behaviour).
export type RemoteSelection = { elementId: string | null; tabId?: string };

// Per-element map of which remote participants have it selected (for the
// on-element badges). Drops self + null (deselected) entries, and — like
// cursors and lasers — entries scoped to a DIFFERENT tab: element ids
// aren't unique across tabs in older diagrams (tab duplication used to
// copy them verbatim), so an unscoped badge also LOCKED the same-id
// element on other tabs via the spec/07 selection lock.
export function buildRemoteSelectionsByElement(
  remoteSelections: Map<string, RemoteSelection>,
  livePresenceById: Map<string, Participant>,
  selfId: string,
  activeTabId: string,
): Map<string, RemoteSelector[]> {
  const out = new Map<string, RemoteSelector[]>();
  for (const [participantId, selection] of remoteSelections) {
    if (!selection.elementId) continue;
    if (selection.tabId !== undefined && selection.tabId !== activeTabId) continue;
    if (participantId === selfId) continue;
    const participant = livePresenceById.get(participantId);
    if (!participant) continue;
    const list = out.get(selection.elementId) ?? [];
    list.push({ id: participant.id, name: participant.name, color: participant.color });
    out.set(selection.elementId, list);
  }
  return out;
}
