import { statusLabel, type Participant, type ParticipantStatus } from '@/lib/identity';
import { relativeSince } from '@/lib/relative-time';
import { withoutAgentRows } from '@/lib/agent-presence-rows';

// The Collaborators modal's roster (docs/specs/012-collaboration/collaborator-enhancements.md): everyone in the document,
// grouped by the tab they are on. Built from the same `participantsByTab`
// map the tab bar's presence stacks render, so the modal and the stacks can
// never disagree about who is where.

type RosterTab = { id: string; name: string };

export type RosterGroup<T extends RosterTab = RosterTab> = {
  // null for people whose tab focus points at a tab that no longer exists
  // (a peer can briefly sit on a tab someone just deleted). Grouped rather
  // than dropped so nobody vanishes from the list.
  tab: T | null;
  isActive: boolean;
  participants: Participant[];
};

export type CollaboratorRoster<T extends RosterTab = RosterTab> = {
  groups: RosterGroup<T>[];
  // People only: an agent's row is listed but never counted (docs/specs/024-agents/agent-presence.md).
  peopleCount: number;
  // The tabs those people are on.
  peopleTabCount: number;
};

const STATUS_ORDER: Record<ParticipantStatus, number> = { online: 0, away: 1, offline: 2 };

export function buildCollaboratorRoster<T extends RosterTab>(input: {
  participantsByTab: Map<string, Participant[]>;
  tabs: T[];
  activeId: string;
  selfId: string;
}): CollaboratorRoster<T> {
  const { participantsByTab, tabs, activeId, selfId } = input;
  const order = (a: Participant, b: Participant) => {
    if (a.id === selfId) return -1;
    if (b.id === selfId) return 1;
    return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name);
  };
  const groups: RosterGroup<T>[] = [];
  const known = new Set<string>();
  for (const tab of tabs) {
    known.add(tab.id);
    const people = participantsByTab.get(tab.id);
    if (!people || people.length === 0) continue;
    groups.push({
      tab,
      isActive: tab.id === activeId,
      participants: [...people].sort(order),
    });
  }
  const strays: Participant[] = [];
  for (const [tabId, people] of participantsByTab) {
    if (!known.has(tabId)) strays.push(...people);
  }
  if (strays.length > 0) {
    groups.push({ tab: null, isActive: false, participants: strays.sort(order) });
  }
  const people = groups.map((g) => withoutAgentRows(g.participants).length);
  const peopleCount = people.reduce((n, count) => n + count, 0);
  const peopleTabCount = people.filter((count) => count > 0).length;
  return { groups, peopleCount, peopleTabCount };
}

// The chips beside a participant's name wherever they are listed (the
// presence-stack hover card and the Collaborators modal row): "You" plus your
// role, a peer's role when the room told us it, and "Following" for the
// person we follow (docs/specs/012-collaboration/follow-me-viewport.md).
export function participantBadges(
  p: Participant,
  selfId: string,
  selfRole: 'edit' | 'view',
  followingId?: string | null,
  // Whether this person holds the facilitator baton (docs/specs/012-collaboration/facilitator.md). Passed in
  // rather than read off the participant: the holder is a presence id, and
  // your own row cannot be recognised by one.
  opts?: { isFacilitator?: boolean },
): string[] {
  const badges: string[] = [];
  if (p.id === selfId) badges.push('You', selfRole === 'view' ? 'Viewer' : 'Editor');
  else if (p.role) badges.push(p.role === 'view' ? 'Viewer' : 'Editor');
  if (opts?.isFacilitator) badges.push('Facilitating');
  if (followingId && followingId === p.id) badges.push('Following');
  return badges;
}

// A Collaborators row's second line: an agent row says what it is doing (or that it is online); a person's row
// says their agent's status line first, then their status and, for anyone but you, how long ago they were active
// (docs/specs/024-agents/blueprints/agent-presence.md "Presentation and UX").
export function collaboratorRowDetail(p: Participant, isSelf: boolean, now: number): string {
  if (p.agent) return p.statusLine ?? statusLabel(p.status);
  const active =
    p.lastActiveAt !== undefined && !isSelf
      ? ` · Active ${relativeSince(p.lastActiveAt, now)}`
      : '';
  return `${p.statusLine ? `${p.statusLine} · ` : ''}${statusLabel(p.status)}${active}`;
}

// "3 people across 2 tabs" / "Just you". The stray group counts as a tab:
// those people are somewhere, just not anywhere we can name.
export function rosterSummary(roster: CollaboratorRoster): string {
  const { peopleCount, peopleTabCount: tabs } = roster;
  if (peopleCount <= 1) return 'Just you so far';
  return `${peopleCount} people across ${tabs} ${tabs === 1 ? 'tab' : 'tabs'}`;
}
