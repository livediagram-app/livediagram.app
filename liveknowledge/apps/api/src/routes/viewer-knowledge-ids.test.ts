import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveknowledge/document';
import { knowledgeKit, OWNER, type Kit, type Who } from './knowledge-test-kit';
import { clearTestProfiles, setTestProfile } from '../test-profiles';
import { personToken } from '../knowledge/viewer-people';
import { withServerRules } from '../changesets/submit';

vi.mock('../person/profiles', () => import('../test-profiles'));
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

// A page's people as a Viewer reads them (docs/specs/013-workspace/share-roles.md "Ids a Viewer sees", Work Tracker
// 1479): its owner, who verified it and who asked for and decided its approval reach a Viewer as stand-ins, never
// their ids, with Page Health naming each stand-in, so "Verified by" and the approval lines still show the names.
// Participants, Editors and the owner read every id, and no save made from a Viewer's copy stores a stand-in or
// loses an id.

const ALICE = 'user_alice';
const PAT = 'user_p';
const KNOWLEDGE = {
  owner: ALICE,
  verifiedAt: 1_700_000_000_000,
  verifiedBy: OWNER,
  approval: {
    state: 'approved',
    requestedBy: PAT,
    requestedAt: 1_699_000_000_000,
    requestedByName: 'Pat Doe',
    decidedBy: OWNER,
    decidedAt: 1_700_000_000_000,
    decidedByName: 'Alex Tester',
  },
};
const IDS = [ALICE, PAT, OWNER];
const token = (id: string) => personToken('kb', id);

type Knowledge = typeof KNOWLEDGE;
type TabRead = { tab: Tab & { knowledge?: Knowledge } };

let kit: Kit;
beforeEach(async () => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  setTestProfile(OWNER, 'Alex Tester');
  setTestProfile(ALICE, 'Alice Ng');
  setTestProfile(PAT, 'Pat Doe');
  kit = await knowledgeKit();
  kit.db.sql
    .prepare(
      "UPDATE tabs SET data = json_set(data, '$.knowledge', json(?)), rev = rev + 1 WHERE id = 'deploys'",
    )
    .run(JSON.stringify(KNOWLEDGE));
});
afterEach(() => {
  clearTestProfiles();
  vi.restoreAllMocks();
});

const get = async <T>(who: Who, path: string): Promise<T> => {
  const res = await kit.call(who, 'GET', `/api/documents/kb${path}`);
  expect(res.status).toBe(200);
  return res.json<T>();
};
const stored = (): Knowledge =>
  (
    JSON.parse(
      (kit.db.sql.prepare("SELECT data FROM tabs WHERE id = 'deploys'").get() as { data: string })
        .data,
    ) as { knowledge: Knowledge }
  ).knowledge;
const seenAsTokens = {
  ...KNOWLEDGE,
  owner: token(ALICE),
  verifiedBy: token(OWNER),
  approval: { ...KNOWLEDGE.approval, requestedBy: token(PAT), decidedBy: token(OWNER) },
};
const holdsNoId = (value: unknown) => {
  const text = JSON.stringify(value);
  for (const id of IDS) expect(text).not.toContain(id);
};

describe('the page read, by level', () => {
  it.each<Who>(['viewer', 'link'])('hands a %s stand-ins, never ids', async (who) => {
    const { tab } = await get<TabRead>(who, '/tabs/deploys');
    expect(tab.knowledge).toEqual(seenAsTokens);
    holdsNoId(tab.knowledge);
  });

  it.each<Who>(['participant', 'edit-link', 'editor'])('hands a %s every id', async (who) => {
    expect((await get<TabRead>(who, '/tabs/deploys')).tab.knowledge).toEqual(KNOWLEDGE);
  });

  it("keeps a Viewer's own id", async () => {
    kit.db.sql
      .prepare(
        "UPDATE tabs SET data = json_set(data, '$.knowledge.owner', 'user_v'), rev = rev + 1 WHERE id = 'deploys'",
      )
      .run();
    expect((await get<TabRead>('viewer', '/tabs/deploys')).tab.knowledge?.owner).toBe('user_v');
  });

  it("hands a Viewer each page summary's people as stand-ins on the knowledgebase read", async () => {
    const { document } = await get<{ document: { tabs: { id: string; knowledge?: Knowledge }[] } }>(
      'viewer',
      '',
    );
    expect(document.tabs.find((t) => t.id === 'deploys')!.knowledge).toEqual(seenAsTokens);
    const theirs = await get<{ document: { tabs: { id: string; knowledge?: Knowledge }[] } }>(
      'participant',
      '',
    );
    expect(theirs.document.tabs.find((t) => t.id === 'deploys')!.knowledge).toEqual(KNOWLEDGE);
  });
});

describe('Page Health', () => {
  type Health = {
    knowledge: Knowledge;
    names?: Record<string, string>;
    created?: { by: string };
    updated?: { by: string };
  };

  // "Verified by", the owner and the approval lines name the person: the editor names an id from `names`.
  it('names every stand-in it hands a Viewer, and every id it hands a Participant', async () => {
    const health = await get<Health>('viewer', '/pages/deploys/health');
    expect(health.knowledge).toMatchObject(seenAsTokens);
    expect(health.names).toEqual({
      [token(OWNER)]: 'Alex Tester',
      [token(ALICE)]: 'Alice Ng',
      [token(PAT)]: 'Pat Doe',
    });
    expect(health.names![health.knowledge.verifiedBy]).toBe('Alex Tester');
    expect(health.names![health.knowledge.owner]).toBe('Alice Ng');
    // Who made and last changed the page: the knowledgebase's creator, as a stand-in too.
    expect(health.created?.by).toBe(token(OWNER));
    holdsNoId(health);

    const theirs = await get<Health>('participant', '/pages/deploys/health');
    expect(theirs.knowledge).toMatchObject(KNOWLEDGE);
    expect(theirs.names).toEqual({ [OWNER]: 'Alex Tester', [ALICE]: 'Alice Ng', [PAT]: 'Pat Doe' });
    expect(theirs.created?.by).toBe(OWNER);
  });
});

describe('versions', () => {
  it('hand a Viewer the page as it was, with stand-ins', async () => {
    const named = await kit.call('editor', 'POST', '/api/documents/kb/tabs/deploys/versions', {
      name: 'Before',
    });
    expect(named.status).toBeLessThan(300);
    const { version } = await named.json<{ version: { id: string } }>();
    const path = `/tabs/deploys/versions/${version.id}`;
    const seen = await get<TabRead>('viewer', path);
    expect(seen.tab.knowledge).toEqual(seenAsTokens);
    expect((await get<TabRead>('participant', path)).tab.knowledge).toEqual(KNOWLEDGE);
  });
});

describe('the page list', () => {
  it('hands a Viewer each owner as a stand-in, with the names keyed the same', async () => {
    type List = { pages: { tab: string; owner?: string }[]; names?: Record<string, string> };
    const list = await get<List>('viewer', '/pages?names=1');
    expect(list.pages.find((p) => p.tab === 'deploys')!.owner).toBe(token(ALICE));
    expect(list.names).toEqual({ [token(ALICE)]: 'Alice Ng' });
    holdsNoId(list.pages);
    const theirs = await get<List>('participant', '/pages?names=1');
    expect(theirs.pages.find((p) => p.tab === 'deploys')!.owner).toBe(ALICE);
  });
});

describe('a save made from a Viewer copy', () => {
  // The data-loss guards: the page a Viewer read, saved whole by someone who may write (a link raised while the editor
  // was open), keeps every id it holds.
  it('never stores a stand-in or loses an id through the tab save', async () => {
    const { tab } = await get<TabRead>('viewer', '/tabs/deploys');
    const res = await kit.call('editor', 'PUT', '/api/documents/kb/tabs/deploys', {
      ...tab,
      name: 'Deploys',
    });
    expect(res.status).toBe(200);
    expect(stored()).toEqual(KNOWLEDGE);
    expect(JSON.stringify(stored())).not.toContain('hidden');
  });

  it('never stores a stand-in or loses an id through a changeset', async () => {
    const { tab } = await get<TabRead>('viewer', '/tabs/deploys');
    const storedTab = (await get<TabRead>('editor', '/tabs/deploys')).tab;
    const author = { id: OWNER, name: 'Alex Tester', color: '#000000' };
    const written = withServerRules(tab, { tab: storedTab, rev: 1, orderIndex: 0 }, author);
    expect(written.knowledge).toEqual(KNOWLEDGE);
  });
});
