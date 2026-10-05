import {
  CHANGESET_RELAY_MAX_BYTES,
  sha256Hex,
  type ChangesetAuthor,
  type ChangesetCounts,
  type ChangesetRoomOp,
} from '@livediagram/api-schema';
import type { ElementOp, Tab } from '@livediagram/document';

// The relay payload of one changeset (docs/specs/024-agents/agent-changesets.md "What the room
// does"). Its element ops ride along when their UTF-8 JSON fits CHANGESET_RELAY_MAX_BYTES; past
// that, editors re-fetch the tab in place, and `touched` still names every element for the outline.

export type RoomOpInput = {
  id: string;
  tabId: string;
  rev: number;
  prevRev: number | null;
  author: ChangesetAuthor;
  summary: string | null;
  counts: ChangesetCounts;
  elementOps: ElementOp[];
  agentKey?: string;
  tab?: Omit<Tab, 'elements'>;
  revertOf?: string | null;
};

export function changesetRoomOp(input: RoomOpInput): ChangesetRoomOp {
  const fits =
    new TextEncoder().encode(JSON.stringify(input.elementOps)).length <= CHANGESET_RELAY_MAX_BYTES;
  return {
    kind: 'changeset',
    tabId: input.tabId,
    id: input.id,
    rev: input.rev,
    prevRev: input.prevRev,
    author: input.author,
    ...(input.agentKey ? { agentKey: input.agentKey } : {}),
    ...(input.summary ? { summary: input.summary } : {}),
    counts: input.counts,
    ...(fits
      ? { elementOps: input.elementOps }
      : { refetch: true as const, touched: touchedIds(input.elementOps) }),
    ...(input.tab ? { tab: input.tab } : {}),
    ...(input.revertOf ? { revertOf: input.revertOf } : {}),
  };
}

function touchedIds(ops: readonly ElementOp[]): string[] {
  const ids = new Set<string>();
  for (const op of ops) {
    if (op.kind === 'remove') ids.add(op.id);
    else if (op.kind !== 'reorder') ids.add(op.element.id);
  }
  return [...ids];
}

// How editors group one token's changesets into one toast without the token id reaching them:
// the first 12 hex characters of its SHA-256 (CS22).
export async function agentKeyFor(tokenId: string): Promise<string> {
  return (await sha256Hex(new TextEncoder().encode(tokenId))).slice(0, 12);
}
