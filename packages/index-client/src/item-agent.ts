// An agent writing for its person, as the index's event log names it (liveworkspace/docs/specs/004-index/
// one-explorer-contracts.md "The event log", Work Tracker 1381): the one rule for its name, which the apps apply as
// they read it from a request and the index applies again as it takes it, so the two never differ.
import { ITEM_AGENT_NAME_MAX, ITEM_AGENT_VIAS, type ItemAgentVia } from './constants';
import type { ItemAgent } from './types';

// Control characters (C0, DEL and C1): never part of a name, and the outbox keys an agent's edit by its name.
// oxlint-disable-next-line no-control-regex -- the control range is the point
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;
const SPACES = /\s+/g;

/** An agent's name as it is kept: control characters dropped, runs of space made one, trimmed, cut to
 *  ITEM_AGENT_NAME_MAX. Null when nothing is left. Linear in the name. */
export function cleanItemAgentName(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw
    .replace(CONTROL, ' ')
    .replace(SPACES, ' ')
    .trim()
    .slice(0, ITEM_AGENT_NAME_MAX)
    .trim();
  return name || null;
}

export const isItemAgentVia = (value: unknown): value is ItemAgentVia =>
  (ITEM_AGENT_VIAS as readonly unknown[]).includes(value);

/** A body's `agent`: null when left out (a person's), the agent as kept, or undefined when it is not
 *  `{name, via}` with a name and a known door. */
export function parseItemAgent(value: unknown): ItemAgent | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  const { name, via } = value as Record<string, unknown>;
  const clean = typeof name === 'string' ? cleanItemAgentName(name) : null;
  if (!clean || !isItemAgentVia(via)) return undefined;
  return { name: clean, via };
}
