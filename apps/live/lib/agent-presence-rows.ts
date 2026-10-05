// Agent presence in the editor (docs/specs/024-agents/agent-presence.md "In the editor", blueprint "Editor"): the
// room's `agents` read off a presence frame, folded into the per-tab presence rows the stacks and the Collaborators
// modal render, and the focus each agent names on the active tab. Pure: the clock is passed in.

import {
  AGENT_PRESENCE_FOCUS_MAX,
  AGENT_PRESENCE_STATUS_MAX,
  MAX_COLOR_LEN,
  MAX_PARTICIPANT_NAME_LEN,
  type AgentPresence,
  type ParticipantPresence,
} from '@livediagram/api-schema';
import type { Participant } from './identity';

// The longest id an entry carries: element ids, presence ids and the room's entry ids are all under it.
const AGENT_ID_MAX = 128;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clampedIds = (value: unknown, max: number): string[] | null =>
  Array.isArray(value) && value.every((id) => typeof id === 'string')
    ? value.slice(0, max).map((id: string) => id.slice(0, AGENT_ID_MAX))
    : null;

// One entry as the room sent it, or null when its shape is wrong. Strings are clamped to the room's own limits, so
// a frame from a misbehaving room cannot stretch a row.
function agentEntryOf(value: unknown): AgentPresence | null {
  if (!isRecord(value)) return null;
  const { id, name, color, role, tabId, status, focus, joins, self, person } = value;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof color !== 'string') return null;
  if (role !== 'edit' && role !== 'view') return null;
  if (typeof tabId !== 'string' || typeof person !== 'number') return null;
  if (status !== undefined && typeof status !== 'string') return null;
  const focusIds = clampedIds(focus, AGENT_PRESENCE_FOCUS_MAX);
  const joinIds = clampedIds(joins, Number.MAX_SAFE_INTEGER);
  if (!focusIds || !joinIds) return null;
  return {
    id: id.slice(0, AGENT_ID_MAX),
    name: name.slice(0, MAX_PARTICIPANT_NAME_LEN),
    color: color.slice(0, MAX_COLOR_LEN),
    role,
    tabId: tabId.slice(0, AGENT_ID_MAX),
    ...(status ? { status: status.slice(0, AGENT_PRESENCE_STATUS_MAX) } : {}),
    focus: focusIds,
    joins: joinIds,
    ...(self === true ? { self: true as const } : {}),
    person,
  };
}

// A presence frame's sessions and its agents, apart: nothing that reads `participants` ever sees an agent (PR14).
// A frame from a room older than `agents` carries none.
export function splitPresenceFrame(frame: {
  participants: ParticipantPresence[];
  agents?: unknown;
}): {
  participants: ParticipantPresence[];
  agents: AgentPresence[];
} {
  const raw = Array.isArray(frame.agents) ? frame.agents : [];
  const agents = raw.map(agentEntryOf).filter((entry): entry is AgentPresence => entry !== null);
  return { participants: frame.participants, agents };
}

// The rows of a tab without its standalone agent rows: what a head count, a roll call or the Collaborators count
// reads.
export function withoutAgentRows(rows: readonly Participant[]): Participant[] {
  return rows.filter((row) => !row.agent);
}

// Folds the agents into the per-tab rows. Entries of one person on one tab are one row, the last set's status
// winning; the status goes on the recipient's own row (their agent on their tab), else on the owner's row on that
// tab, else on a row of its own in the owner's name. Entries on tabs this editor does not know are skipped (PR16).
export function foldAgentPresence(input: {
  participantsByTab: Map<string, Participant[]>;
  agents: readonly AgentPresence[];
  selfParticipant: Participant;
  activeId: string;
  tabIds: readonly string[];
  now: number;
}): Map<string, Participant[]> {
  const { participantsByTab, agents, selfParticipant, activeId, tabIds, now } = input;
  if (agents.length === 0) return participantsByTab;
  const known = new Set(tabIds);
  const groups = new Map<
    string,
    { first: AgentPresence; last: AgentPresence; joins: Set<string> }
  >();
  for (const entry of agents) {
    if (!known.has(entry.tabId)) continue;
    const key = `${entry.person}\u0000${entry.tabId}`;
    const group = groups.get(key);
    if (group) {
      group.last = entry;
      for (const id of entry.joins) group.joins.add(id);
    } else groups.set(key, { first: entry, last: entry, joins: new Set(entry.joins) });
  }
  const out = new Map<string, Participant[]>();
  for (const [tabId, rows] of participantsByTab) out.set(tabId, [...rows]);
  for (const { first, last, joins } of groups.values()) {
    const rows = out.get(first.tabId) ?? [];
    const statusLine = last.status;
    const ownIndex =
      first.self && first.tabId === activeId
        ? rows.findIndex((row) => row.id === selfParticipant.id)
        : rows.findIndex((row) => joins.has(row.id));
    if (ownIndex >= 0) {
      if (statusLine) rows[ownIndex] = { ...rows[ownIndex]!, statusLine };
    } else {
      rows.push({
        id: first.id,
        name: first.name,
        color: first.color,
        role: first.role,
        status: 'online',
        lastActiveAt: now,
        ...(statusLine ? { statusLine } : {}),
        agent: true,
      });
    }
    out.set(first.tabId, rows);
  }
  return out;
}

// Who each element on the active tab is in focus for, once per person, for the focus rings. Ids no longer on the
// tab draw nothing (E12). Kept apart from the remote selections: an agent never holds an element.
export function buildAgentFocusByElement(
  agents: readonly AgentPresence[],
  activeId: string,
  elementIds: ReadonlySet<string>,
): Map<string, { name: string; color: string }[]> {
  const out = new Map<string, { name: string; color: string }[]>();
  const seen = new Set<string>();
  for (const entry of agents) {
    if (entry.tabId !== activeId) continue;
    for (const elementId of entry.focus) {
      const key = `${entry.person}\u0000${elementId}`;
      if (!elementIds.has(elementId) || seen.has(key)) continue;
      seen.add(key);
      const list = out.get(elementId) ?? [];
      list.push({ name: entry.name, color: entry.color });
      out.set(elementId, list);
    }
  }
  return out;
}
