import { beforeEach, describe, expect, it } from 'vitest';
import type { KnowledgeOverviewResponse } from '@liveknowledge/api-schema';
import { knowledgeKit, type Kit } from './knowledge-test-kit';

// AI Knowledge's figures band and Most Read (docs/specs/030-knowledgebase/ai-knowledge.md "Reads"): the overview's
// one read answers the last 14 days' reads by day and the pages read most this week, for every role that may see it.

const DAY = 86_400_000;
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

let kit: Kit;
beforeEach(async () => {
  kit = await knowledgeKit();
});

const reads = (day: string, tab: string, kind: 'person' | 'agent', count: number) =>
  kit.db.sql
    .prepare(`INSERT INTO page_reads (day, tab, reader_kind, agent, reads) VALUES (?, ?, ?, ?, ?)`)
    .run(day, tab, kind, kind === 'agent' ? 'CLI' : '', count);

const overview = async (who: 'editor' | 'viewer' | 'link' = 'editor') =>
  (
    await (
      await kit.call(who, 'GET', '/api/documents/kb/knowledge')
    ).json<KnowledgeOverviewResponse>()
  ).reads;

describe('GET knowledge: reads', () => {
  it('answers 14 days, oldest first, people and agents apart, a quiet day at nought', async () => {
    const now = Date.now();
    // The table is made by the first route that touches the room.
    await overview();
    reads(dayOf(now), 'deploys', 'person', 3);
    reads(dayOf(now), 'deploys', 'agent', 2);
    reads(dayOf(now - 5 * DAY), 'holidays', 'person', 1);
    reads(dayOf(now - 20 * DAY), 'holidays', 'person', 9);
    const { days } = await overview('viewer');
    expect(days).toHaveLength(14);
    expect(days[0]!.day).toBe(dayOf(now - 13 * DAY));
    expect(days[13]).toEqual({ day: dayOf(now), people: 3, agents: 2 });
    expect(days[8]).toEqual({ day: dayOf(now - 5 * DAY), people: 1, agents: 0 });
    expect(days.reduce((sum, d) => sum + d.people + d.agents, 0)).toBe(6);
  });

  it('names the pages read most this week by their titles, leaving out a page that is gone', async () => {
    const now = Date.now();
    await overview();
    reads(dayOf(now), 'holidays', 'person', 4);
    reads(dayOf(now), 'deploys', 'agent', 6);
    reads(dayOf(now - DAY), 'rollbacks', 'person', 1);
    reads(dayOf(now), 'gone-page', 'person', 50);
    // Older than a week.
    reads(dayOf(now - 9 * DAY), 'rollbacks', 'person', 40);
    expect((await overview('link')).mostRead).toEqual([
      { tab: 'deploys', title: 'Deploys', people: 0, agents: 6 },
      { tab: 'holidays', title: 'Holidays', people: 4, agents: 0 },
      { tab: 'rollbacks', title: 'Rollbacks', people: 1, agents: 0 },
    ]);
  });

  it('answers empty lists for a knowledgebase nobody has read', async () => {
    const { days, mostRead } = await overview();
    expect(days.every((d) => d.people === 0 && d.agents === 0)).toBe(true);
    expect(mostRead).toEqual([]);
  });
});
