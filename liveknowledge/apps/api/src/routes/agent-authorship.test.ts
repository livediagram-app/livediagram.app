import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PageAuthorStamp, VersionSummary } from '@liveknowledge/api-schema';
import { knowledgeKit, OWNER, page, type Kit, type Who } from './knowledge-test-kit';
import { clearTestProfiles, setTestProfile } from '../test-profiles';

vi.mock('../person/profiles', () => import('../test-profiles'));
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

// A page an agent makes or changes over the MCP or the CLI names the agent for its person, in Page Health's Created and
// Updated and in Version History (docs/specs/030-knowledgebase/verification.md "An agent acting for a person";
// docs/specs/006-document/version-history.md "An agent's mark"; blueprint VH25 to VH27). The kit's agent is the
// owner's token through the MCP, its client named "Coding Agent".

type Health = { created?: PageAuthorStamp; updated?: PageAuthorStamp; editors?: PageAuthorStamp[] };

const health = async (kit: Kit, tab: string, who: Who = 'viewer') =>
  await (await kit.call(who, 'GET', `/api/documents/kb/pages/${tab}/health`)).json<Health>();
const versions = async (kit: Kit, tab: string) =>
  (
    await (
      await kit.call('editor', 'GET', `/api/documents/kb/tabs/${tab}/versions`)
    ).json<{
      versions: VersionSummary[];
    }>()
  ).versions;
const authorOf = (list: VersionSummary[], kind: VersionSummary['kind']) =>
  list.find((v) => v.kind === kind)?.author;

const AGENT = 'Coding Agent';
const PERSON = 'Olive Owner';

beforeEach(() => setTestProfile(OWNER, PERSON, '#0ea5e9'));
afterEach(() => {
  clearTestProfiles();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('a page an agent made', () => {
  it('is Created and Updated by the agent for its person, until a person saves it', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const kit = await knowledgeKit();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
    const made = await kit.call('agent', 'POST', '/api/documents/kb/pages', {
      title: 'Runbook',
      markdown: 'Restart the queue.',
    });
    expect(made.status).toBe(201);
    const { page: created } = await made.json<{ page: { tab: string } }>();
    const tab = created.tab;
    const ai = { by: OWNER, kind: 'ai', agent: AGENT, via: 'mcp' };
    for (const who of ['viewer', 'participant', 'editor'] as const) {
      const read = await health(kit, tab, who);
      expect(read.created).toEqual({ ...ai, at: 1_000_000 });
      expect(read.updated).toEqual({ ...ai, at: 1_000_000 });
    }

    // The agent changes it: Updated stays the agent's; the save and the version before its burst name it.
    vi.setSystemTime(2_000_000);
    const wrote = await kit.call('agent', 'PUT', `/api/documents/kb/pages/${tab}`, {
      markdown: 'Restart the queue, then the workers.',
    });
    expect(wrote.status).toBe(200);
    const changed = await health(kit, tab);
    expect(changed.created).toEqual({ ...ai, at: 1_000_000 });
    expect(changed.updated).toEqual({ ...ai, at: 2_000_000 });
    const afterAgent = await versions(kit, tab);
    expect(authorOf(afterAgent, 'save')).toEqual({ name: PERSON, color: '#0ea5e9', agent: AGENT });
    expect(authorOf(afterAgent, 'agent')).toEqual({ name: PERSON, color: '#0ea5e9', agent: AGENT });

    // A person's save: Updated moves to them, Created stays the agent's, and their version names them alone.
    vi.setSystemTime(3_000_000);
    const saved = await kit.call('editor', 'PUT', `/api/documents/kb/tabs/${tab}`, {
      ...page(tab, 'Runbook', [
        { id: 'p1', type: 'paragraph', runs: [{ text: 'Restart everything.' }] },
      ]),
    });
    expect(saved.status).toBeLessThan(300);
    const later = await health(kit, tab);
    expect(later.created).toEqual({ ...ai, at: 1_000_000 });
    expect(later.updated).toEqual({ by: OWNER, at: 3_000_000, kind: 'human' });
    const mine = (await versions(kit, tab)).filter((v) => v.kind === 'save' && !v.author?.agent);
    expect(mine.map((v) => v.author)).toEqual([{ name: PERSON, color: '#0ea5e9' }]);
    // The agent's versions keep their mark.
    expect((await versions(kit, tab)).filter((v) => v.author?.agent).length).toBe(2);
  });

  it('marks nothing when a person makes and changes a page', async () => {
    const kit = await knowledgeKit();
    const save = (text: string) =>
      kit.call('editor', 'PUT', '/api/documents/kb/tabs/fresh', {
        ...page('fresh', 'Fresh', [{ id: 'p1', type: 'paragraph', runs: [{ text }] }]),
      });
    expect((await save('One')).status).toBeLessThan(300);
    expect((await save('One and two')).status).toBeLessThan(300);
    const read = await health(kit, 'fresh');
    expect(read.created?.kind).toBe('human');
    expect(read.updated?.kind).toBe('human');
    const list = await versions(kit, 'fresh');
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((v) => !v.author?.agent)).toBe(true);
  });

  it('names a refused write nowhere', async () => {
    const kit = await knowledgeKit();
    // No writing to replace with: refused, so nothing is stamped.
    const refused = await kit.call('agent', 'PUT', '/api/documents/kb/pages/deploys', {
      markdown: '   ',
    });
    expect(refused.status).toBe(400);
    expect((await health(kit, 'deploys')).updated?.kind).toBe('human');
    expect((await versions(kit, 'deploys')).every((v) => !v.author?.agent)).toBe(true);
  });
});
