import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  KnowledgeLabelChangeResponse,
  KnowledgeLabelsResponse,
  KnowledgePageReadResponse,
  KnowledgePagesResponse,
  KnowledgeSearchResponse,
} from '@liveknowledge/api-schema';
import { MAX_KNOWLEDGEBASE_LABELS } from '@liveknowledge/document';
import { fakeClaude, knowledgeKit, PAGES, type Kit, type Who } from './knowledge-test-kit';

// Page labels (docs/specs/030-knowledgebase/page-surface.md "Page labels", search-and-ask.md "By label"): the
// knowledgebase's labels kept once beside its Review Period, a page carrying their ids, and search, Ask and the
// agents' reads scoped by them.
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
  vi.unstubAllGlobals();
});

const LABELS = '/api/documents/kb/labels';
// Deploys and Rollbacks are Engineering's; Holidays is People's.
const LABELLED = PAGES.map((p) => ({
  ...p,
  labels: p.id === 'holidays' ? ['lbl_people'] : ['lbl_eng'],
}));

async function labelledKit(base = {}): Promise<Kit> {
  const kit = await knowledgeKit(base, LABELLED);
  for (const [id, name] of [
    ['lbl_eng', 'Engineering'],
    ['lbl_people', 'People'],
  ] as const) {
    const res = await kit.call('editor', 'POST', LABELS, { id, name });
    if (res.status !== 201) throw new Error(`label: ${res.status}`);
  }
  return kit;
}

const labelsOf = async (kit: Kit, who: Who = 'viewer') =>
  (await (await kit.call(who, 'GET', LABELS)).json<KnowledgeLabelsResponse>()).labels;
const tabRows = (kit: Kit) =>
  JSON.stringify(kit.db.sql.prepare('SELECT id, data, rev, updated_at FROM tabs').all());

describe('GET labels', () => {
  it('lists none for a knowledgebase without, for every role that reads it', async () => {
    const kit = await knowledgeKit();
    for (const who of ['editor', 'participant', 'viewer', 'link', 'agent-read-only'] as const)
      expect(await labelsOf(kit, who)).toEqual([]);
  });

  it('lists the labels most used first, each with its page count', async () => {
    const kit = await labelledKit();
    expect(await labelsOf(kit)).toEqual([
      { id: 'lbl_eng', name: 'Engineering', colour: 'blue', pages: 2 },
      { id: 'lbl_people', name: 'People', colour: 'green', pages: 1 },
    ]);
    const read = await (
      await kit.call('viewer', 'GET', '/api/documents/kb')
    ).json<{ document: { knowledgeSettings: unknown; tabs: { id: string; labels?: string[] }[] } }>();
    expect(read.document.knowledgeSettings).toMatchObject({ reviewEvery: 90 });
    expect(read.document.tabs.find((t) => t.id === 'holidays')?.labels).toEqual(['lbl_people']);
  });

  it('is closed to a link confined to one page and to a stranger', async () => {
    const kit = await knowledgeKit();
    for (const who of ['page-link', 'stranger'] as const)
      expect((await kit.call(who, 'GET', LABELS)).status).toBe(403);
  });
});

describe('changing labels', () => {
  it.each(['editor', 'participant'] as const)('%s makes, renames, recolours and deletes one', async (who) => {
    const kit = await knowledgeKit();
    const made = await kit.call(who, 'POST', LABELS, { name: '  Onboarding ' });
    expect(made.status).toBe(201);
    const { label } = await made.json<KnowledgeLabelChangeResponse>();
    expect(label).toMatchObject({ name: 'Onboarding', colour: 'blue' });
    expect(label!.id).toMatch(/^lbl_[0-9a-z]{10}$/);
    const renamed = await kit.call(who, 'PUT', `${LABELS}/${label!.id}`, {
      name: 'New Starters',
      colour: '#AA00CC',
    });
    expect(await renamed.json<KnowledgeLabelChangeResponse>()).toEqual({
      label: { id: label!.id, name: 'New Starters', colour: '#aa00cc' },
      labels: [{ id: label!.id, name: 'New Starters', colour: '#aa00cc' }],
    });
    const gone = await kit.call(who, 'DELETE', `${LABELS}/${label!.id}`);
    expect(await gone.json<KnowledgeLabelChangeResponse>()).toEqual({ labels: [] });
    expect(await labelsOf(kit)).toEqual([]);
  });

  it.each(['viewer', 'link', 'agent-read-only', 'viewer-agent'] as const)(
    'refuses %s',
    async (who) => {
      const kit = await labelledKit();
      expect((await kit.call(who, 'POST', LABELS, { name: 'Sales' })).status).toBe(403);
      expect((await kit.call(who, 'PUT', `${LABELS}/lbl_eng`, { name: 'X' })).status).toBe(403);
      expect((await kit.call(who, 'DELETE', `${LABELS}/lbl_eng`)).status).toBe(403);
      expect(await labelsOf(kit)).toHaveLength(2);
    },
  );

  it('refuses each bad change by name, writing nothing', async () => {
    const kit = await labelledKit();
    const status = async (method: string, path: string, body?: unknown) => {
      const res = await kit.call('editor', method, path, body);
      return [res.status, (await res.json<{ error: string }>()).error];
    };
    expect(await status('POST', LABELS, { name: 'engineering' })).toEqual([409, 'label_name_taken']);
    expect(await status('POST', LABELS, { name: '' })).toEqual([400, 'invalid_label_name']);
    expect(await status('POST', LABELS, { name: 'X', colour: 'navy' })).toEqual([
      400,
      'invalid_label_colour',
    ]);
    expect(await status('POST', LABELS, { name: 'X', id: 'no spaces' })).toEqual([
      400,
      'invalid_label_id',
    ]);
    expect(await status('POST', LABELS, [1])).toEqual([400, 'invalid_body']);
    expect(await status('PUT', `${LABELS}/lbl_eng`, {})).toEqual([400, 'invalid_body']);
    expect(await status('PUT', `${LABELS}/lbl_eng`, { name: 'People' })).toEqual([
      409,
      'label_name_taken',
    ]);
    expect(await status('PUT', `${LABELS}/lbl_none`, { name: 'Y' })).toEqual([404, 'unknown_label']);
    expect(await status('DELETE', `${LABELS}/lbl_none`)).toEqual([404, 'unknown_label']);
    expect((await kit.call('editor', 'PATCH', `${LABELS}/lbl_eng`, {})).status).toBe(405);
    expect((await kit.call('editor', 'DELETE', LABELS)).status).toBe(405);
    expect((await kit.call('editor', 'GET', `${LABELS}/lbl_eng`)).status).toBe(405);
    expect((await labelsOf(kit)).map((l) => l.name)).toEqual(['Engineering', 'People']);
  });

  it('holds at most 100 labels', async () => {
    const kit = await knowledgeKit();
    for (let n = 0; n < MAX_KNOWLEDGEBASE_LABELS; n++)
      await kit.call('editor', 'POST', LABELS, { name: `Label ${n}`, colour: 'red' });
    const res = await kit.call('editor', 'POST', LABELS, { name: 'One More' });
    expect([res.status, (await res.json<{ error: string }>()).error]).toEqual([409, 'label_limit']);
  });

  it('renames and deletes in one write, rewriting no page however many carry it', async () => {
    const kit = await labelledKit();
    const before = tabRows(kit);
    await kit.call('editor', 'PUT', `${LABELS}/lbl_eng`, { name: 'Platform' });
    await kit.call('editor', 'DELETE', `${LABELS}/lbl_people`);
    expect(tabRows(kit)).toBe(before);
    const { page } = await (
      await kit.call('agent', 'GET', '/api/documents/kb/pages/holidays')
    ).json<KnowledgePageReadResponse>();
    expect(page.labels).toBeUndefined();
    const deploys = await (
      await kit.call('agent', 'GET', '/api/documents/kb/pages/deploys')
    ).json<KnowledgePageReadResponse>();
    expect(deploys.page.labels).toEqual(['Platform']);
  });

  it('keeps the labels when the Review Period changes, and the period when the labels do', async () => {
    const kit = await labelledKit();
    await kit.call('editor', 'PUT', '/api/documents/kb/knowledge-settings', { reviewEvery: 30 });
    expect(await labelsOf(kit)).toHaveLength(2);
    await kit.call('editor', 'POST', LABELS, { name: 'Sales' });
    const settings = await (
      await kit.call('viewer', 'GET', '/api/documents/kb/knowledge-settings')
    ).json<{ knowledgeSettings: { reviewEvery: number; labels: unknown[] } }>();
    expect(settings.knowledgeSettings.reviewEvery).toBe(30);
    expect(settings.knowledgeSettings.labels).toHaveLength(3);
  });

  it('tells every open editor in the document-meta op, with the labels', async () => {
    const relayed: string[] = [];
    const rooms = {
      idFromName: (name: string) => name,
      get: () => ({
        fetch: async (_url: string, init?: RequestInit) => {
          if (typeof init?.body === 'string') relayed.push(init.body);
          return new Response(null, { status: 204 });
        },
      }),
    };
    const kit = await knowledgeKit({ DOCUMENT_ROOM: rooms } as never);
    relayed.length = 0;
    await kit.call('participant', 'POST', LABELS, { id: 'lbl_x', name: 'Sales', colour: 'pink' });
    const metas = relayed.join('\n');
    expect(metas).toContain('"kind":"document-meta"');
    expect(metas).toContain('"labels":[{"id":"lbl_x","name":"Sales","colour":"pink"}]');
  });
});

describe('reads by label', () => {
  const search = async (kit: Kit, query: string, who: Who = 'viewer') => {
    const res = await kit.call(who, 'GET', `/api/documents/kb/search?${query}`);
    return res.status === 200
      ? (await res.json<KnowledgeSearchResponse>()).results.map((r) => r.tab)
      : [res.status, (await res.json<{ error: string; message: string }>()).message];
  };

  it('searches only the pages carrying any of the labels, by id or by name', async () => {
    const kit = await labelledKit();
    expect(new Set(await search(kit, 'q=deploy'))).toEqual(new Set(['deploys', 'rollbacks']));
    expect(await search(kit, 'q=deploy&labels=people')).toEqual([]);
    expect(new Set(await search(kit, 'q=deploy&labels=lbl_people,ENGINEERING'))).toEqual(
      new Set(['deploys', 'rollbacks']),
    );
    expect(await search(kit, 'q=december&labels=People')).toEqual(['holidays']);
    expect(await search(kit, 'q=deploy&labels=Sales')).toEqual([
      400,
      'No label is called "Sales". Labels here: Engineering, People.',
    ]);
  });

  it('records no question for a scoped search that found nothing', async () => {
    const kit = await labelledKit();
    await search(kit, 'q=deploy&labels=People', 'agent-stored');
    expect(kit.db.sql.prepare('SELECT * FROM questions').all()).toEqual([]);
  });

  it('says a knowledgebase with no labels has none', async () => {
    const kit = await knowledgeKit();
    expect(await search(kit, 'q=deploy&labels=Engineering')).toEqual([
      400,
      'This knowledgebase has no labels.',
    ]);
  });

  it("lists an agent the pages of a label, each row with its labels' names", async () => {
    const kit = await labelledKit();
    const all = await (
      await kit.call('agent', 'GET', '/api/documents/kb/pages')
    ).json<KnowledgePagesResponse>();
    expect(all.pages.map((p) => [p.tab, 'labels' in p ? p.labels : undefined])).toEqual([
      ['deploys', ['Engineering']],
      ['rollbacks', ['Engineering']],
      ['holidays', ['People']],
    ]);
    const people = await (
      await kit.call('agent', 'GET', '/api/documents/kb/pages?labels=people')
    ).json<KnowledgePagesResponse>();
    expect(people.pages.map((p) => p.tab)).toEqual(['holidays']);
    expect((await kit.call('agent', 'GET', '/api/documents/kb/pages?labels=x')).status).toBe(400);
  });

  it('answers a question only from the pages of its labels, and records no gap for it', async () => {
    const claude = fakeClaude('<answer>Nothing here says.</answer><gap>When do we deploy?</gap>');
    vi.stubGlobal('fetch', claude.fetch);
    const kit = await labelledKit({ AI_KEY_SECRET: 'test-ai-key-secret' });
    await kit.call('editor', 'PUT', '/api/documents/kb/ai/key', {
      key: 'sk-ant-test-0123456789abcdefghij-4f2a',
    });
    const res = await kit.call('viewer', 'POST', '/api/documents/kb/ask', {
      question: 'When do we deploy on Tuesdays?',
      labels: ['People'],
    });
    expect(res.status).toBe(200);
    await res.text();
    const sent = claude.sent.at(-1)!.body;
    expect(sent).not.toContain('Tuesdays after the morning standup');
    expect(kit.db.sql.prepare('SELECT * FROM questions').all()).toEqual([]);
    const refused = await kit.call('viewer', 'POST', '/api/documents/kb/ask', {
      question: 'When?',
      labels: ['Sales'],
    });
    expect([refused.status, (await refused.json<{ error: string }>()).error]).toEqual([
      400,
      'unknown_label',
    ]);
  });
});
