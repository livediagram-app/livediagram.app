import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PAGE_REACTION_EMOJI_MAX,
  PAGE_REACTIONS_MAX,
  PERSON_PAGE_REACTIONS_MAX,
  type PageReaction,
} from '@liveknowledge/api-schema';
import { knowledgeKit, type Kit, type Who } from './knowledge-test-kit';
import { createReactionRate, parseReactionChange } from './knowledge-reaction-routes';
import { reactionRefusal } from '../knowledge/page-reactions';

// docs/specs/030-knowledgebase/page-reactions.md: who reads and reacts, one of each emoji a person, the bounds, the
// room op, and that a reaction is no edit and tells nobody.
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});
const relayed = vi.hoisted(() => vi.fn(async () => 1));
vi.mock('../room-client', async (original) => ({
  ...(await original<typeof import('../room-client')>()),
  relayPages: relayed,
}));
const NAMES: Record<string, string> = { user_o: 'Olu', user_p: 'Priya', user_v: 'Vic' };
vi.mock('../person/profiles', async (original) => ({
  ...(await original<typeof import('../person/profiles')>()),
  getParticipant: async (_env: unknown, id: string) =>
    NAMES[id] ? { id, name: NAMES[id], color: '#123456' } : null,
}));

// Each test a minute and more after the last, so the room's rate limit (shared by the file) starts afresh.
let clock = Date.UTC(2026, 10, 22);
beforeEach(() => {
  clock += 120_000;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(clock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

const PATH = '/api/documents/kb/pages/deploys/reactions';
const react = (kit: Kit, who: Who, body: object, path = PATH) => kit.call(who, 'POST', path, body);
const list = async (kit: Kit, who: Who = 'viewer', path = PATH) =>
  (await (await kit.call(who, 'GET', path)).json<{ reactions: PageReaction[] }>()).reactions;
const errorOf = async (res: Response) => (await res.json<{ error: string }>()).error;

// Every row of every table but the reactions', so a test can say nothing else moved.
function everythingElse(kit: Kit): string {
  const tables = kit.db.sql
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'page_reactions' ORDER BY name",
    )
    .all() as { name: string }[];
  return JSON.stringify(
    tables.map((t) => [t.name, kit.db.sql.prepare(`SELECT * FROM "${t.name}"`).all()]),
  );
}

describe('pages/:tab/reactions', () => {
  it.each(['editor', 'participant', 'viewer'] as const)(
    'lets %s add and take back their own, and tells the room',
    async (who) => {
      const kit = await knowledgeKit();
      const added = await react(kit, who, { emoji: '👏', on: true });
      expect(added.status).toBe(200);
      const body = await added.json<{ reaction: PageReaction; changed: boolean }>();
      expect(body.changed).toBe(true);
      // Named by profile, keyed by collab key: no account id on the wire.
      expect(body.reaction.name).toBe(NAMES[who === 'editor' ? 'user_o' : `user_${who[0]}`]);
      expect(body.reaction.by).toMatch(/^[0-9a-f]+$/);
      expect(JSON.stringify(body)).not.toContain('user_');
      expect(relayed).toHaveBeenLastCalledWith(
        expect.anything(),
        'kb',
        [{ kind: 'page-reaction', tabId: 'deploys', reaction: body.reaction, on: true }],
        '[page-reactions]',
      );
      expect(await list(kit, 'link')).toEqual([body.reaction]);
      // One of each emoji a person: a second add moves nothing and tells nobody.
      relayed.mockClear();
      const again = await react(kit, who, { emoji: '👏', on: true });
      expect((await again.json<{ changed: boolean }>()).changed).toBe(false);
      expect(relayed).not.toHaveBeenCalled();
      const back = await react(kit, who, { emoji: '👏', on: false });
      expect((await back.json<{ changed: boolean }>()).changed).toBe(true);
      expect(relayed).toHaveBeenLastCalledWith(
        expect.anything(),
        'kb',
        [{ kind: 'page-reaction', tabId: 'deploys', reaction: body.reaction, on: false }],
        '[page-reactions]',
      );
      expect(await list(kit)).toEqual([]);
      // Taking back what is not there moves nothing.
      const none = await react(kit, who, { emoji: '👏', on: false });
      expect((await none.json<{ changed: boolean }>()).changed).toBe(false);
    },
  );

  it('keeps everyone’s, oldest first, and lets nobody take back another’s', async () => {
    const kit = await knowledgeKit();
    await react(kit, 'editor', { emoji: '👏', on: true });
    await react(kit, 'viewer', { emoji: '👏', on: true });
    await react(kit, 'viewer', { emoji: '❤️', on: true });
    // The editor's "take back" of a heart they never gave changes only their own: none.
    await react(kit, 'editor', { emoji: '❤️', on: false });
    expect((await list(kit)).map((r) => [r.emoji, r.name])).toEqual([
      ['👏', 'Olu'],
      ['👏', 'Vic'],
      ['❤️', 'Vic'],
    ]);
  });

  it.each(['link', 'edit-link', 'page-link', 'agent', 'agent-stored', 'viewer-agent'] as const)(
    'refuses %s a change, and still lets them read',
    async (who) => {
      const kit = await knowledgeKit();
      await react(kit, 'editor', { emoji: '🎉', on: true });
      const res = await react(kit, who, { emoji: '👏', on: true });
      expect([401, 403, 404]).toContain(res.status);
      if (res.status === 403)
        expect(await errorOf(res)).toMatch(/reaction_needs_account|forbidden/);
      if (who !== 'page-link') expect((await list(kit, who)).map((r) => r.emoji)).toEqual(['🎉']);
    },
  );

  it('refuses a stranger, and a page a link does not reach', async () => {
    const kit = await knowledgeKit();
    expect([403, 404]).toContain((await react(kit, 'stranger', { emoji: '👏', on: true })).status);
    // A link confined to Holidays reads Deploys as missing.
    expect((await kit.call('page-link', 'GET', PATH)).status).toBe(404);
  });

  it('lets a link confined to a page read that page’s reactions', async () => {
    const kit = await knowledgeKit();
    const path = '/api/documents/kb/pages/holidays/reactions';
    expect((await kit.call('page-link', 'GET', path)).status).toBe(200);
  });

  it('refuses what is not one emoji, and other methods', async () => {
    const kit = await knowledgeKit();
    expect(await errorOf(await react(kit, 'viewer', { emoji: '👏' }))).toBe('invalid_change');
    expect(await errorOf(await react(kit, 'viewer', { emoji: 'clap', on: true }))).toBe(
      'invalid_emoji',
    );
    expect((await react(kit, 'viewer', { emoji: '👏👏', on: true })).status).toBe(400);
    expect((await kit.call('viewer', 'DELETE', PATH)).status).toBe(405);
    expect(parseReactionChange(null)).toBeNull();
    expect(parseReactionChange({ emoji: '👏', on: true, name: `  ${'n'.repeat(90)} ` })).toEqual({
      emoji: '👏',
      on: true,
      name: 'n'.repeat(80),
    });
    expect(parseReactionChange('x')).toBeNull();
  });

  it('is no edit and tells nobody: nothing but the reactions’ own rows moves', async () => {
    const kit = await knowledgeKit();
    const before = everythingElse(kit);
    const fetches = vi.spyOn(globalThis, 'fetch');
    await react(kit, 'viewer', { emoji: '👏', on: true });
    await react(kit, 'participant', { emoji: '🎉', on: true });
    await react(kit, 'viewer', { emoji: '👏', on: false });
    // No revision, Updated stamp, version, History, outbox, email claim or automation event.
    expect(everythingElse(kit)).toBe(before);
    // No email, no inbox and no index call leave the room: only the room op (relayPages, mocked).
    expect(fetches).not.toHaveBeenCalled();
    fetches.mockRestore();
    expect(await list(kit)).toHaveLength(1);
  });

  it('goes with its page and with a closed account', async () => {
    const kit = await knowledgeKit();
    await react(kit, 'viewer', { emoji: '👏', on: true });
    await react(kit, 'participant', { emoji: '👏', on: true });
    const { anonymiseDocument } = await import('../document-room/document-anonymise');
    await anonymiseDocument(kit.db.env, 'kb', 'user_v');
    expect((await list(kit)).map((r) => r.name)).toEqual(['Priya']);
    kit.db.sql.exec("DELETE FROM tabs WHERE id = 'deploys'");
    expect(kit.db.sql.prepare('SELECT COUNT(*) AS n FROM page_reactions').get()).toEqual({ n: 0 });
  });

  it('names a person by their profile, and by their cursor only when the profile has no name', async () => {
    const kit = await knowledgeKit();
    const named = await react(kit, 'viewer', { emoji: '👏', on: true, name: 'Not Vic' });
    expect((await named.json<{ reaction: PageReaction }>()).reaction.name).toBe('Vic');
    delete NAMES.user_p;
    try {
      const cursor = await react(kit, 'participant', { emoji: '👏', on: true, name: 'Priya P' });
      expect((await cursor.json<{ reaction: PageReaction }>()).reaction.name).toBe('Priya P');
      const none = await react(kit, 'participant', { emoji: '🎉', on: true });
      expect((await none.json<{ reaction: PageReaction }>()).reaction.name).toBe('Someone');
    } finally {
      NAMES.user_p = 'Priya';
    }
  });

  it('holds a person to the reactions a page takes', async () => {
    const kit = await knowledgeKit();
    const emoji = ['👏', '❤️', '👍', '🎉', '👀', '🔥', '💯', '🙏', '😂', '🚀', '🤯'];
    for (const e of emoji.slice(0, PERSON_PAGE_REACTIONS_MAX))
      expect((await react(kit, 'viewer', { emoji: e, on: true })).status).toBe(200);
    const res = await react(kit, 'viewer', { emoji: emoji[PERSON_PAGE_REACTIONS_MAX]!, on: true });
    expect(res.status).toBe(409);
    expect(await errorOf(res)).toBe('too_many_reactions');
    // Another person may still add one already on the page.
    expect((await react(kit, 'editor', { emoji: '👏', on: true })).status).toBe(200);
  });

  it('slows a person who reacts too fast', async () => {
    const kit = await knowledgeKit();
    let last = 200;
    for (let i = 0; i < 40 && last === 200; i++)
      last = (await react(kit, 'participant', { emoji: '👏', on: i % 2 === 0 })).status;
    expect(last).toBe(429);
  });
});

describe('the bounds and the rate, on their own', () => {
  const rows = (n: number, kinds: number, person = 'p') =>
    Array.from({ length: n }, (_, i) => ({ emoji: `e${i % kinds}`, person: `${person}${i}` }));

  it('refuses a page that is full of reactions or of different emoji', () => {
    expect(reactionRefusal(rows(PAGE_REACTIONS_MAX, 3), 'e0', 'new')).toBe('reactions_full');
    expect(reactionRefusal(rows(30, PAGE_REACTION_EMOJI_MAX), 'other', 'new')).toBe(
      'reactions_full',
    );
    // An emoji already on the page is no new kind.
    expect(reactionRefusal(rows(30, PAGE_REACTION_EMOJI_MAX), 'e1', 'new')).toBeNull();
    // What already stands is never refused.
    expect(reactionRefusal([{ emoji: 'e0', person: 'me' }], 'e0', 'me')).toBeNull();
  });

  it('lets a person go again after a minute, and forgets its oldest past the bound', () => {
    const rate = createReactionRate(2, 2);
    expect(rate.take('a', 0)).toBe(true);
    expect(rate.take('a', 10)).toBe(true);
    expect(rate.take('a', 20)).toBe(false);
    expect(rate.take('a', 60_001)).toBe(true);
    rate.take('b', 1);
    rate.take('c', 2);
    expect(rate.size()).toBe(2);
  });
});
