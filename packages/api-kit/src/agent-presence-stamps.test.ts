import { describe, expect, it } from 'vitest';
import { AGENT_PRESENCE_STAMP_MS } from '@liveworkspace/api-schema/agent-presence';
import { AGENT_PRESENCE_STAMPS_MAX, AgentPresenceStamps } from './agent-presence-stamps';

describe('AgentPresenceStamps', () => {
  it('stamps a read once per document, token and tab in the window', () => {
    const stamps = new AgentPresenceStamps();
    expect(stamps.shouldStamp('d1', 'tok', 't1', 0)).toBe(true);
    expect(stamps.shouldStamp('d1', 'tok', 't1', AGENT_PRESENCE_STAMP_MS - 1)).toBe(false);
    expect(stamps.shouldStamp('d1', 'tok', 't1', AGENT_PRESENCE_STAMP_MS)).toBe(true);
    // Another token, or the same token on another document, is its own agent.
    expect(stamps.shouldStamp('d1', 'tok2', 't1', AGENT_PRESENCE_STAMP_MS)).toBe(true);
    expect(stamps.shouldStamp('d2', 'tok', 't1', AGENT_PRESENCE_STAMP_MS)).toBe(true);
  });

  it('always stamps a read of another tab, so the agent follows its reads back and forth', () => {
    const stamps = new AgentPresenceStamps();
    expect(stamps.shouldStamp('d1', 'tok', 't1', 0)).toBe(true);
    expect(stamps.shouldStamp('d1', 'tok', 't2', 1)).toBe(true);
    expect(stamps.shouldStamp('d1', 'tok', 't1', 2)).toBe(true);
  });

  it('takes a write as a stamp on its tab', () => {
    const stamps = new AgentPresenceStamps();
    expect(stamps.shouldStamp('d1', 'tok', 't1', 0)).toBe(true);
    stamps.note('d1', 'tok', 't2', 1);
    expect(stamps.shouldStamp('d1', 'tok', 't2', 2)).toBe(false);
    expect(stamps.shouldStamp('d1', 'tok', 't1', 3)).toBe(true);
  });

  it('stays bounded, letting the oldest go, and answers a worst-case burst quickly', () => {
    const stamps = new AgentPresenceStamps();
    const started = performance.now();
    for (let i = 0; i < 100_000; i += 1) stamps.shouldStamp(`d${i % 5_000}`, `tok${i}`, 't1', i);
    expect(performance.now() - started).toBeLessThan(500);
    expect(stamps.size).toBe(AGENT_PRESENCE_STAMPS_MAX);
    // The first is long gone, so it stamps again; the newest is held.
    expect(stamps.shouldStamp('d0', 'tok0', 't1', 100_001)).toBe(true);
    expect(stamps.shouldStamp('d4999', 'tok99999', 't1', 100_001)).toBe(false);
  });
});
