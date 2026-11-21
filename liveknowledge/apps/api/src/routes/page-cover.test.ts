import { afterEach, describe, expect, it, vi } from 'vitest';
import { knowledgeKit, OWNER, page, type Kit, type Who } from './knowledge-test-kit';

// docs/specs/030-knowledgebase/page-surface.md "The cover" and verification.md "Made by a person or an agent".
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const stored = (kit: Kit, tab = 'deploys') =>
  JSON.parse(
    (kit.db.sql.prepare('SELECT data FROM tabs WHERE id = ?').get(tab) as { data: string }).data,
  ) as { cover?: unknown; articles?: unknown };
const refs = (kit: Kit, tab = 'deploys') =>
  kit.db.sql
    .prepare('SELECT image_id FROM image_refs WHERE tab_id = ? ORDER BY image_id')
    .all(tab)
    .map((r) => r.image_id as string);
const write = (kit: Kit, who: Who, body: unknown, tab = 'deploys') =>
  kit.call(who, 'PUT', `/api/documents/kb/pages/${tab}`, body);
const readPage = async (kit: Kit, tab = 'deploys') =>
  (
    await (
      await kit.call('viewer', 'GET', `/api/documents/kb/pages/${tab}`)
    ).json<{
      page: { cover?: unknown };
    }>()
  ).page;
type Stamp = { by: string; at: number; kind: string; agent?: string; via?: string };
const health = async (kit: Kit, tab = 'deploys') =>
  await (
    await kit.call('viewer', 'GET', `/api/documents/kb/pages/${tab}/health`)
  ).json<{
    created?: Stamp;
    updated?: Stamp;
  }>();

describe('a page’s cover from an agent', () => {
  it('sets a picture alone, reads it back, indexes its picture, and leaves the writing as it was', async () => {
    const kit = await knowledgeKit();
    const before = stored(kit).articles;
    const res = await write(kit, 'agent', {
      cover: { kind: 'image', imageId: 'img_cover1', focus: 30 },
    });
    expect(res.status).toBe(200);
    const { lines } = await res.json<{ lines: string[] }>();
    expect(lines.at(-1)).toBe('The page’s cover is now the picture, placed 30% down it.');
    expect(stored(kit).cover).toEqual({ imageId: 'img_cover1', focus: 30 });
    expect(stored(kit).articles).toEqual(before);
    expect(refs(kit)).toEqual(['img_cover1']);
    expect((await readPage(kit)).cover).toEqual({
      kind: 'image',
      imageId: 'img_cover1',
      focus: 30,
    });
  });

  it('sets a gradient with the writing, then takes the cover away', async () => {
    const kit = await knowledgeKit();
    expect(
      (
        await write(kit, 'agent', {
          markdown: 'New words.',
          cover: { kind: 'gradient', preset: 'theme-glow' },
        })
      ).status,
    ).toBe(200);
    expect((await readPage(kit)).cover).toEqual({ kind: 'gradient', preset: 'theme-glow' });
    const gone = await write(kit, 'agent', { cover: null });
    expect(gone.status).toBe(200);
    expect('cover' in stored(kit)).toBe(false);
    expect('cover' in (await readPage(kit))).toBe(false);
  });

  it.each([
    [{ kind: 'gradient', preset: 'Plaid' }, 'cover.preset is one of'],
    [{ kind: 'animated', preset: 'aurora', colouring: 'plaid' }, 'cover.colouring is one of'],
    [{ kind: 'image', imageId: 'img_a', focus: 120 }, 'cover.focus is a whole number'],
    [{ kind: 'image', imageId: 'data:image/png;base64,AAAA' }, 'cover.imageId names a picture'],
    [{ imageId: 'img_a' }, 'Send cover as'],
    [{ kind: 'image', imageId: 'img_a', tint: 'red' }, 'takes no "tint"'],
    ['sunset', 'Send cover as'],
  ])('refuses %j by name and writes nothing', async (cover, says) => {
    const kit = await knowledgeKit();
    const res = await write(kit, 'agent', { cover });
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string; message: string }>();
    expect(body.error).toBe('invalid_cover');
    expect(body.message).toContain(says);
    expect('cover' in stored(kit)).toBe(false);
  });

  it('takes a cover alone on a verified page, where a rewrite is refused', async () => {
    const kit = await knowledgeKit();
    expect(
      (await kit.call('editor', 'POST', '/api/documents/kb/pages/deploys/verify')).status,
    ).toBe(200);
    expect(
      (
        await write(kit, 'agent', {
          markdown: 'Rewritten.',
          cover: { kind: 'animated', preset: 'aurora', colouring: 'night' },
        })
      ).status,
    ).toBe(409);
    expect('cover' in stored(kit)).toBe(false);
    expect(
      (
        await write(kit, 'agent', {
          cover: { kind: 'animated', preset: 'aurora', colouring: 'night' },
        })
      ).status,
    ).toBe(200);
    expect((await readPage(kit)).cover).toEqual({
      kind: 'animated',
      preset: 'aurora',
      colouring: 'night',
    });
  });

  it.each<[Who, number]>([
    ['agent-read-only', 403],
    ['participant-agent', 403],
    ['viewer-agent', 403],
  ])('is refused to %s', async (who, status) => {
    const kit = await knowledgeKit();
    expect(
      (await write(kit, who, { cover: { kind: 'animated', preset: 'aurora', colouring: 'night' } }))
        .status,
    ).toBe(status);
    expect('cover' in stored(kit)).toBe(false);
  });

  it('a mode with a cover alone is refused', async () => {
    const kit = await knowledgeKit();
    expect((await write(kit, 'agent', { cover: null, mode: 'append' })).status).toBe(400);
  });
});

describe('a page’s cover from a person', () => {
  const save = (kit: Kit, who: Who, cover: unknown) =>
    kit.call(who, 'PUT', '/api/documents/kb/tabs/deploys', {
      ...page('deploys', 'Deploys', [
        { id: 'b1', type: 'paragraph', style: 'title', runs: [{ text: 'Deploys' }] },
      ]),
      cover,
    });

  it('rides an Editor’s save, its picture indexed, and an invalid one is dropped', async () => {
    const kit = await knowledgeKit();
    expect((await save(kit, 'editor', { imageId: 'img_mine', focus: 70 })).status).toBeLessThan(
      300,
    );
    expect(stored(kit).cover).toEqual({ imageId: 'img_mine', focus: 70 });
    expect(refs(kit)).toEqual(['img_mine']);
    expect((await save(kit, 'editor', { imageId: 'not a picture id!' })).status).toBeLessThan(300);
    expect('cover' in stored(kit)).toBe(false);
    expect(refs(kit)).toEqual([]);
  });

  it('keeps a gradient or an animated cover by its theme role, never colours', async () => {
    const kit = await knowledgeKit();
    await save(kit, 'editor', { motion: 'aurora', colouring: 'soft', speed: 2 });
    expect(stored(kit).cover).toEqual({ motion: 'aurora', colouring: 'soft', speed: 2 });
    await save(kit, 'editor', { fill: { kind: 'gradient', from: '#fff', to: '#000', angle: 160 } });
    expect('cover' in stored(kit)).toBe(false);
  });

  it('is set by a Participant, as by an Editor', async () => {
    const kit = await knowledgeKit();
    const cover = { motion: 'aurora', colouring: 'soft', speed: 2 };
    expect((await save(kit, 'participant', cover)).status).toBe(200);
    expect(stored(kit).cover).toEqual(cover);
  });

  it.each<Who>(['viewer', 'link'])('is refused to a %s', async (who) => {
    const kit = await knowledgeKit();
    expect((await save(kit, who, { imageId: 'img_mine' })).status).toBe(403);
    expect('cover' in stored(kit)).toBe(false);
  });
});

describe('made by a person or an agent (verification.md)', () => {
  it('stamps a person’s save human, an agent’s write ai with its name and door, keeping who created it', async () => {
    const kit = await knowledgeKit();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
    expect((await write(kit, 'agent', { markdown: 'An agent wrote this.' })).status).toBe(200);
    const after = await health(kit);
    // The knowledgebase's pages were made by its creator; the agent moved Updated alone.
    expect(after.created).toMatchObject({ by: OWNER, kind: 'human' });
    expect(after.updated).toEqual({
      by: OWNER,
      at: 1_000_000,
      kind: 'ai',
      agent: 'Coding Agent',
      via: 'mcp',
    });
    // A cover alone is not the writing: it moves nothing.
    vi.setSystemTime(2_000_000);
    await write(kit, 'agent', { cover: { kind: 'gradient', preset: 'theme-mist' } });
    expect((await health(kit)).updated?.at).toBe(1_000_000);
  });

  it('stamps an agent’s new page ai from its making', async () => {
    const kit = await knowledgeKit();
    const res = await kit.call('agent', 'POST', '/api/documents/kb/pages', {
      title: 'Runbook',
      markdown: 'Steps.',
    });
    expect(res.status).toBe(201);
    const { page: made } = await res.json<{ page: { tab: string } }>();
    const stamps = await health(kit, made.tab);
    expect(stamps.created).toMatchObject({ kind: 'ai', agent: 'Coding Agent', via: 'mcp' });
    expect(stamps.updated).toEqual(stamps.created);
  });

  it('stamps an accepted suggestion as the agent’s edit, by the Editor who accepted it', async () => {
    const kit = await knowledgeKit();
    const made = await kit.call('agent', 'POST', '/api/documents/kb/pages/deploys/suggestions', {
      reason: 'Fridays',
      after: 'Never deploy on a Friday.',
    });
    expect(made.status).toBe(201);
    const { suggestion } = await made.json<{ suggestion: { id: string } }>();
    expect(
      (await kit.call('editor', 'POST', `/api/documents/kb/suggestions/${suggestion.id}/accept`))
        .status,
    ).toBe(200);
    expect((await health(kit)).updated).toMatchObject({
      by: OWNER,
      kind: 'ai',
      agent: 'Coding Agent',
      via: 'suggestion',
    });
  });

  it('stamps an agent’s changeset ai, and a person’s human', async () => {
    const kit = await knowledgeKit();
    let n = 0;
    const changeset = (who: Who) =>
      kit.call(who, 'POST', '/api/documents/kb/tabs/holidays/changesets', {
        operations: [
          {
            op: 'add',
            element: {
              id: `box${++n}`,
              type: 'shape',
              shape: 'square',
              x: 0,
              y: 0,
              width: 120,
              height: 60,
              label: 'Box',
            },
          },
        ],
      });
    const byAgent = await changeset('agent');
    expect(byAgent.status).toBe(200);
    expect((await health(kit, 'holidays')).updated).toMatchObject({ kind: 'ai', via: 'mcp' });
    expect((await changeset('editor')).status).toBe(200);
    expect((await health(kit, 'holidays')).updated).toEqual(
      expect.objectContaining({ by: OWNER, kind: 'human' }),
    );
  });
});
