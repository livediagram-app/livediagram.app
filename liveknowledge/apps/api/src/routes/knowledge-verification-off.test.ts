import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CreatePageResponse,
  KnowledgeOverviewResponse,
  KnowledgePageReadResponse,
  KnowledgePagesResponse,
  KnowledgeSearchResponse,
  PageHealthResponse,
} from '@liveknowledge/api-schema';
import { isKnowledgePageRow } from '@liveknowledge/api-schema';
import { knowledgeKit, type Kit, type Who } from './knowledge-test-kit';

// docs/specs/030-knowledgebase/verification.md "Under a Review Period of Never" (agents' trust fields keep their
// shape and say `off`), and ai-knowledge.md "Page Insights" and "Not Read in 90 Days" (both ride reads already made).
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

afterEach(() => {
  vi.useRealTimers();
});

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 2, 9);

const get = async <T>(kit: Kit, who: Who, path: string) => {
  const res = await kit.call(who, 'GET', `/api/documents/kb/${path}`);
  expect(res.status).toBe(200);
  return res.json<T>();
};
const setPeriod = async (kit: Kit, reviewEvery: number | 'never') =>
  expect(
    (await kit.call('editor', 'PUT', '/api/documents/kb/knowledge-settings', { reviewEvery }))
      .status,
  ).toBe(200);

describe('agents under a Review Period of Never', () => {
  it('say off, with no date and never stale, and every mark comes back with its date once a period is set', async () => {
    const kit = await knowledgeKit();
    await kit.call('editor', 'POST', '/api/documents/kb/pages/deploys/verify');
    const read = async () =>
      (await get<KnowledgePageReadResponse>(kit, 'agent', 'pages/deploys')).page.trust;
    const verifiedAt = (await read()).verifiedAt;
    expect(verifiedAt).toBeGreaterThan(0);

    await setPeriod(kit, 'never');
    const off = await read();
    expect(off).toMatchObject({ state: 'off', stale: false });
    expect(off).not.toHaveProperty('verifiedAt');
    expect(off).not.toHaveProperty('verifiedBy');
    expect(off).not.toHaveProperty('reviewAt');
    const tree = await get<KnowledgePagesResponse>(kit, 'agent', 'pages');
    expect(tree.reviewEvery).toBe('never');
    expect(tree.pages.filter(isKnowledgePageRow).every((row) => row.trust.state === 'off')).toBe(
      true,
    );
    const found = await get<KnowledgeSearchResponse>(kit, 'agent', 'search?q=deploy');
    expect(found.results.length).toBeGreaterThan(0);
    expect(found.results.every((r) => r.trust === 'off' && r.verifiedAt === undefined)).toBe(true);
    const made = await kit.call('agent', 'POST', '/api/documents/kb/pages', {
      title: 'Incidents',
      markdown: 'Page the owner.',
    });
    expect((await made.json<CreatePageResponse>()).trust).toBe('off');

    await setPeriod(kit, 90);
    expect(await read()).toMatchObject({ state: 'verified', verifiedAt, stale: false });
    const again = await kit.call('agent', 'POST', '/api/documents/kb/pages', {
      title: 'Oncall',
      markdown: 'Rotate weekly.',
    });
    expect((await again.json<CreatePageResponse>()).trust).toBe('never-verified');
  });
});

describe('Page Insights', () => {
  it('rides Page Health: 30 days of reads by day, people and agents apart, and the citations', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    const kit = await knowledgeKit();
    // A person opens the page today; an agent reads it today and five days back.
    await kit.call('viewer', 'GET', '/api/documents/kb/pages/deploys/health?opened=1');
    await get(kit, 'agent', 'pages/deploys');
    vi.setSystemTime(T0 + 5 * DAY);
    await get(kit, 'agent', 'pages/deploys');
    for (const who of ['editor', 'participant', 'viewer', 'link'] as const) {
      const health = await get<PageHealthResponse>(kit, who, 'pages/deploys/health');
      const days = health.insights!.days;
      expect(days).toHaveLength(30);
      expect(days.at(-6)).toMatchObject({ people: 1, agents: 1 });
      expect(days.at(-1)).toMatchObject({ people: 0, agents: 1 });
      expect(health.insights!.cited).toBe(0);
      expect(health.reads).toEqual({ people: 1, agents: 2 });
    }
    // A link confined to one page has no Ask: nothing cited is said.
    const scoped = await get<PageHealthResponse>(kit, 'page-link', 'pages/holidays/health');
    expect(scoped.insights).toBeDefined();
    expect(scoped.insights).not.toHaveProperty('cited');
  });
});

describe('Not Read in 90 Days', () => {
  it('lists pages older than 90 days nobody read in them, from the overview’s one read', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    const kit = await knowledgeKit();
    const overview = () => get<KnowledgeOverviewResponse>(kit, 'viewer', 'knowledge');
    // Pages made today have not had 90 days to be read.
    expect((await overview()).notRead).toEqual({ days: 90, pages: [], total: 0 });
    vi.setSystemTime(T0 + 100 * DAY);
    const all = (await overview()).notRead!;
    expect(all.total).toBeGreaterThan(1);
    expect(all.pages.map((p) => p.tab)).toContain('deploys');
    await kit.call('viewer', 'GET', '/api/documents/kb/pages/deploys/health?opened=1');
    const after = (await overview()).notRead!;
    expect(after.total).toBe(all.total - 1);
    expect(after.pages.map((p) => p.tab)).not.toContain('deploys');
  });
});
