import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  KnowledgeAgentContextResponse,
  KnowledgePageReadResponse,
  KnowledgeSettingsResponse,
} from '@liveknowledge/api-schema';
import type { AiEditing } from '@liveknowledge/knowledge';
import { knowledgeKit, OWNER, type Kit, type Who } from './knowledge-test-kit';

// AI Editing (docs/specs/030-knowledgebase/ai-editing.md): the knowledgebase's ceiling on every agent write of a page,
// beside the token's scopes, who may set it, what it does to a page's verification, and what get_context says of it.
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

afterEach(() => vi.restoreAllMocks());

const SETTINGS = '/api/documents/kb/knowledge-settings';
const DAY = 86_400_000;

const settingsOf = async (kit: Kit, who: Who = 'editor') =>
  (await (await kit.call(who, 'GET', SETTINGS)).json<KnowledgeSettingsResponse>())
    .knowledgeSettings;

/** A page verified `days` ago, as the room holds it after a Verify (90 days and more is Review Due). */
const verifiedDaysAgo = (kit: Kit, tab: string, days: number) =>
  kit.db.sql
    .prepare(
      `UPDATE tabs SET data = json_set(data, '$.knowledge', json(?)), rev = rev + 1 WHERE id = ?`,
    )
    .run(
      JSON.stringify({ owner: OWNER, verifiedAt: Date.now() - days * DAY, verifiedBy: OWNER }),
      tab,
    );

const write = async (kit: Kit, who: Who, body: object = { markdown: 'Rewritten by an agent.' }) => {
  const res = await kit.call(who, 'PUT', '/api/documents/kb/pages/holidays', body);
  const answer = res.status === 200 ? {} : await res.json<{ error?: string; message?: string }>();
  return { status: res.status, error: answer.error, message: answer.message };
};

const trustOf = async (kit: Kit) =>
  (
    await (
      await kit.call('editor', 'GET', '/api/documents/kb/pages/holidays')
    ).json<KnowledgePageReadResponse>()
  ).page.trust;

type PageState = 'never-verified' | 'verified' | 'review-due';
const pageIn = (kit: Kit, state: PageState) => {
  if (state === 'verified') verifiedDaysAgo(kit, 'holidays', 1);
  if (state === 'review-due') verifiedDaysAgo(kit, 'holidays', 120);
};

describe('an agent write under each level', () => {
  // [level, page state, the write-scoped agent's answer]
  const cases: [AiEditing, PageState, number, string | undefined][] = [
    ['suggest', 'never-verified', 409, 'ai_editing_suggest_only'],
    ['suggest', 'verified', 409, 'ai_editing_suggest_only'],
    ['suggest', 'review-due', 409, 'ai_editing_suggest_only'],
    ['unverified', 'never-verified', 200, undefined],
    ['unverified', 'verified', 409, 'page_verified'],
    ['unverified', 'review-due', 409, 'page_review_due'],
    ['any', 'never-verified', 200, undefined],
    ['any', 'verified', 200, undefined],
    ['any', 'review-due', 200, undefined],
  ];

  it.each(cases)(
    '%s on a %s page: a write-scoped agent answers %i %s',
    async (level, state, status, error) => {
      vi.spyOn(console, 'info').mockImplementation(() => {});
      const kit = await knowledgeKit({}, undefined, { aiEditing: level });
      pageIn(kit, state);
      const answer = await write(kit, 'agent');
      expect([answer.status, answer.error]).toEqual([status, error]);
      // Every refusal names the setting and says what to do instead.
      if (error) {
        expect(answer.message).toContain('AI Editing');
        expect(answer.message).toContain('suggest_edit');
      }
      // A token without `write` never writes, whatever the level: its scopes come first.
      expect((await write(kit, 'agent-stored')).status).toBe(403);
      // A person's own write is never the setting's.
      expect((await write(kit, 'editor')).status).toBe(200);
    },
  );

  it('refuses a cover alone under Suggest Edits Only, and takes it above', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const cover = { cover: { kind: 'animated', preset: 'aurora', colouring: 'night' } };
    const suggesting = await knowledgeKit({}, undefined, { aiEditing: 'suggest' });
    expect((await write(suggesting, 'agent', cover)).error).toBe('ai_editing_suggest_only');
    const unverified = await knowledgeKit({}, undefined, { aiEditing: 'unverified' });
    pageIn(unverified, 'verified');
    expect((await write(unverified, 'agent', cover)).status).toBe(200);
  });

  it('keeps suggest_edit open under Suggest Edits Only', async () => {
    const kit = await knowledgeKit({}, undefined, { aiEditing: 'suggest' });
    const res = await kit.call(
      'agent-stored',
      'POST',
      '/api/documents/kb/pages/holidays/suggestions',
      {
        reason: 'The week moved.',
        before: 'last week of December',
        after: 'first week of January',
      },
    );
    expect(res.status).toBe(201);
  });

  it.each<[AiEditing, number]>([
    ['suggest', 409],
    ['any', 200],
  ])('takes a version restore by a token as a rewrite: %s answers %i', async (level, status) => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const kit = await knowledgeKit({}, undefined, { aiEditing: level });
    const named = await kit.call('editor', 'POST', '/api/documents/kb/tabs/holidays/versions', {
      name: 'Before',
    });
    expect(named.status).toBeLessThan(300);
    const { version } = await named.json<{ version: { id: string } }>();
    const res = await kit.call(
      'agent',
      'POST',
      `/api/documents/kb/tabs/holidays/versions/${version.id}/restore`,
    );
    expect(res.status).toBe(status);
  });
});

describe('Remove Verification When AI Edits', () => {
  const setUp = async (unverifies: boolean) => {
    const kit = await knowledgeKit({}, undefined, { aiEditing: 'any' });
    if (unverifies)
      expect((await kit.call('editor', 'PUT', SETTINGS, { aiEditUnverifies: true })).status).toBe(
        200,
      );
    return kit;
  };

  it.each<[boolean, PageState, string]>([
    [false, 'verified', 'verified'],
    [false, 'review-due', 'review-due'],
    [true, 'verified', 'never-verified'],
    [true, 'review-due', 'never-verified'],
    [true, 'never-verified', 'never-verified'],
  ])('on %s, an agent rewriting a %s page leaves it %s', async (unverifies, state, after) => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const kit = await setUp(unverifies);
    pageIn(kit, state);
    expect((await write(kit, 'agent')).status).toBe(200);
    expect((await trustOf(kit)).state).toBe(after);
  });

  it('keeps the owner, and leaves the mark for a cover alone and for a person’s save', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const kit = await setUp(true);
    pageIn(kit, 'verified');
    expect(
      (
        await write(kit, 'agent', {
          cover: { kind: 'animated', preset: 'aurora', colouring: 'night' },
        })
      ).status,
    ).toBe(200);
    expect((await trustOf(kit)).state).toBe('verified');
    expect((await write(kit, 'editor')).status).toBe(200);
    expect((await trustOf(kit)).state).toBe('verified');
    expect((await write(kit, 'agent')).status).toBe(200);
    const read = await (
      await kit.call('editor', 'GET', '/api/documents/kb/pages/holidays/health')
    ).json<{ owner?: { id?: string } | string | null }>();
    expect(JSON.stringify(read)).toContain(OWNER);
    expect((await trustOf(kit)).state).toBe('never-verified');
  });

  it('is in effect under Edit Any Page alone', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const kit = await setUp(true);
    expect((await kit.call('editor', 'PUT', SETTINGS, { aiEditing: 'unverified' })).status).toBe(
      200,
    );
    // Kept while another level is chosen.
    expect(await settingsOf(kit)).toMatchObject({
      aiEditing: 'unverified',
      aiEditUnverifies: true,
    });
    pageIn(kit, 'verified');
    expect((await write(kit, 'agent')).error).toBe('page_verified');
    expect((await trustOf(kit)).state).toBe('verified');
  });
});

describe('PUT knowledge-settings, the AI fields', () => {
  it.each<[Who, number, string | undefined]>([
    ['editor', 200, undefined],
    ['participant', 403, undefined],
    ['viewer', 403, undefined],
    // A token granted `write` acts as an Editor, and still never changes AI Editing.
    ['agent', 403, 'needs_a_person'],
    ['agent-stored', 403, undefined],
  ])('as %s answers %i', async (who, status, error) => {
    const kit = await knowledgeKit({}, undefined, { aiEditing: 'suggest' });
    const res = await kit.call(who, 'PUT', SETTINGS, { aiEditing: 'any' });
    expect(res.status).toBe(status);
    if (error) expect((await res.json<{ error: string }>()).error).toBe(error);
    expect((await settingsOf(kit)).aiEditing).toBe(status === 200 ? 'any' : undefined);
  });

  it('lets a write-scoped token still set the Review Period alone', async () => {
    const kit = await knowledgeKit({}, undefined, { aiEditing: 'suggest' });
    expect((await kit.call('agent', 'PUT', SETTINGS, { reviewEvery: 30 })).status).toBe(200);
    expect((await kit.call('agent', 'PUT', SETTINGS, { aiEditUnverifies: true })).status).toBe(403);
  });

  it('takes only the three levels and a boolean, and keeps the period and labels', async () => {
    const kit = await knowledgeKit({}, undefined, { aiEditing: 'suggest' });
    const error = async (body: unknown) => {
      const res = await kit.call('editor', 'PUT', SETTINGS, body);
      return [res.status, (await res.json<{ error: string }>()).error];
    };
    for (const aiEditing of ['write', 'Any', null, 2])
      expect(await error({ aiEditing })).toEqual([400, 'invalid_ai_editing']);
    for (const aiEditUnverifies of ['yes', 1, null])
      expect(await error({ aiEditUnverifies })).toEqual([400, 'invalid_ai_edit_unverifies']);
    await kit.call('editor', 'PUT', SETTINGS, { reviewEvery: 180 });
    await kit.call('editor', 'PUT', SETTINGS, { aiEditing: 'unverified' });
    expect(await settingsOf(kit)).toEqual({ reviewEvery: 180, aiEditing: 'unverified' });
    // Back to the default stores nothing of it.
    await kit.call('editor', 'PUT', SETTINGS, { aiEditing: 'suggest' });
    expect(await settingsOf(kit)).toEqual({ reviewEvery: 180 });
  });

  it('tells every open editor in the document-meta op', async () => {
    const relayed: string[] = [];
    const rooms = {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async (_url: string, init?: RequestInit) => {
          relayed.push(typeof init?.body === 'string' ? init.body : '');
          return new Response(null, { status: 204 });
        },
      }),
    };
    const kit = await knowledgeKit({ DOCUMENT_ROOM: rooms } as never, undefined, {
      aiEditing: 'suggest',
    });
    relayed.length = 0;
    await kit.call('editor', 'PUT', SETTINGS, { aiEditing: 'any', aiEditUnverifies: true });
    expect(relayed.join('')).toContain('"aiEditing":"any","aiEditUnverifies":true');
  });
});

describe('get_context', () => {
  it.each<[AiEditing, boolean]>([
    ['suggest', false],
    ['unverified', false],
    ['any', true],
  ])('carries the level %s', async (level, unverifies) => {
    const kit = await knowledgeKit({}, undefined, { aiEditing: level });
    await kit.call('editor', 'PUT', SETTINGS, { aiEditUnverifies: true });
    const context = await (
      await kit.call('agent', 'GET', '/api/documents/kb/context')
    ).json<KnowledgeAgentContextResponse>();
    expect(context.aiEditing).toBe(level);
    // Remove Verification When AI Edits is said on only where it is in effect.
    expect(context.aiEditUnverifies).toBe(unverifies);
  });
});

describe('a create carrying the settings', () => {
  it('keeps AI Editing from a person, never from an agent', async () => {
    const kit = await knowledgeKit({}, undefined, { aiEditing: 'suggest' });
    const make = (who: Who, id: string) =>
      kit.call(who, 'POST', '/api/documents', {
        id,
        name: id,
        knowledgeSettings: { reviewEvery: 90, aiEditing: 'any', aiEditUnverifies: true },
        tabs: [],
      });
    expect((await make('editor', 'kb-person')).status).toBe(201);
    const person = await (
      await kit.call('editor', 'GET', '/api/documents/kb-person/knowledge-settings')
    ).json<KnowledgeSettingsResponse>();
    expect(person.knowledgeSettings).toMatchObject({ aiEditing: 'any', aiEditUnverifies: true });
    const made = await make('agent', 'kb-agent');
    if (made.status === 201) {
      const agent = await (
        await kit.call('editor', 'GET', '/api/documents/kb-agent/knowledge-settings')
      ).json<KnowledgeSettingsResponse>();
      expect(agent.knowledgeSettings.aiEditing).toBeUndefined();
      expect(agent.knowledgeSettings.aiEditUnverifies).toBeUndefined();
    }
  });
});
