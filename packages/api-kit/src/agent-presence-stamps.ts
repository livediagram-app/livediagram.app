import { AGENT_PRESENCE_STAMP_MS } from '@liveworkspace/api-schema/agent-presence';

// The api's side of the read stamp (each product's docs/specs/024-agents/blueprints/agent-presence.md "Read stamps",
// PR38): an agent's reads refresh its presence at most once per document and tab every AGENT_PRESENCE_STAMP_MS,
// so a burst of MCP reads costs one room call, not one each. Held in memory per isolate and bounded; the room keeps
// its own stamp too, so an isolate that missed a stamp still writes nothing new.

// Agents, by document, an isolate remembers; the oldest is let go first.
export const AGENT_PRESENCE_STAMPS_MAX = 1_000;

export class AgentPresenceStamps {
  // `${documentId}\u0000${tokenId}` → the tab it was last stamped on, and when. Insertion order is recency.
  private readonly last = new Map<string, { tabId: string; at: number }>();

  // Whether a read now should refresh the agent's presence, noting it when so. A read of the tab it was last
  // stamped on inside the window is skipped; a read of another tab always goes, since the agent moves there.
  shouldStamp(documentId: string, tokenId: string, tabId: string, now: number): boolean {
    const prior = this.last.get(`${documentId}\u0000${tokenId}`);
    if (prior && prior.tabId === tabId && now - prior.at < AGENT_PRESENCE_STAMP_MS) return false;
    this.note(documentId, tokenId, tabId, now);
    return true;
  }

  // A write refreshed presence on this tab: later reads of it wait out the window, and a read of the tab the agent
  // left goes through.
  note(documentId: string, tokenId: string, tabId: string, now: number): void {
    const key = `${documentId}\u0000${tokenId}`;
    this.last.delete(key);
    this.last.set(key, { tabId, at: now });
    if (this.last.size > AGENT_PRESENCE_STAMPS_MAX)
      this.last.delete(this.last.keys().next().value as string);
  }

  get size(): number {
    return this.last.size;
  }
}

// The isolate's one set of stamps.
export const agentPresenceStamps = new AgentPresenceStamps();
