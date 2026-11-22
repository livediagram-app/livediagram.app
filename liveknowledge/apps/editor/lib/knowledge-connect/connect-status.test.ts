import { describe, expect, it } from 'vitest';
import type { KnowledgeAgent } from '@liveknowledge/api-schema';
import { CHECK_EVERY_MS, CHECK_FOR_MS, agentMarks, newConnection } from './connect-status';

const agent = (id: string, readsThisWeek: number, lastSeenAt?: number): KnowledgeAgent => ({
  id,
  name: id,
  readsThisWeek,
  topPages: [],
  ...(lastSeenAt === undefined ? {} : { lastSeenAt }),
});

// docs/specs/030-knowledgebase/mcp-connect.md "The view" 4: an app shows once it reads here.
describe('a new connection', () => {
  const baseline = agentMarks([agent('a', 3, 1_000), agent('old', 0)]);

  it('is none while nothing changed', () => {
    expect(newConnection(baseline, [agent('a', 3, 1_000), agent('old', 0)])).toBeNull();
    expect(newConnection(agentMarks([]), [])).toBeNull();
  });

  it('is one that was not there when the view first read', () => {
    expect(newConnection(baseline, [agent('a', 3, 1_000), agent('new', 1)])?.id).toBe('new');
  });

  it('is one that was there and read or was seen again', () => {
    expect(newConnection(baseline, [agent('a', 4, 1_000)])?.id).toBe('a');
    expect(newConnection(baseline, [agent('a', 3, 2_000)])?.id).toBe('a');
    expect(newConnection(baseline, [agent('old', 0, 5)])?.id).toBe('old');
  });

  it('checks every 10 seconds for 5 minutes', () => {
    expect(CHECK_EVERY_MS).toBe(10_000);
    expect(CHECK_FOR_MS / CHECK_EVERY_MS).toBe(30);
  });
});
