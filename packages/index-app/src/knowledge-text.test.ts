import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  KNOWLEDGE_CHUNKS_PER_SOURCE,
  KNOWLEDGE_CHUNK_MAX_CHARS,
  KNOWLEDGE_PLACE_ELEMENTS_MAX,
  KNOWLEDGE_SOURCE_MAX_CHARS,
  isKnowledgeText,
} from '@liveworkspace/index-client';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { handleInternalItems, type InternalItemHandlers } from './internal';
import { knowledgeTextFromExport } from './knowledge-source-doors';
import { canvasKnowledgeChunks, elementWords, plainWords } from './knowledge-text';
import { cardWords, planKnowledgeChunks } from './knowledge-text-plan';

afterEach(() => vi.restoreAllMocks());

const canvas = (tabs: unknown[], name = 'Checkout Flow') => ({
  kind: 'livediagram',
  document: { name, tabs },
});

describe('canvas walker', () => {
  it('reads shape words in order, names the tab and its elements, skips connected tabs and drafts', () => {
    const read = canvasKnowledgeChunks(
      canvas([
        {
          id: 't1',
          name: 'Payments',
          elements: [
            { id: 'a', type: 'shape', label: 'Checkout', fill: '#fff' },
            { id: 'b', type: 'shape', text: 'Stripe', note: 'Retries 3 times' },
            {
              id: 'c',
              type: 'image',
              src: 'data:image/png;base64,xx',
              alt: 'https://x.test/a.png',
            },
            { id: 'd', type: 'text', richText: [{ text: 'Hello ' }, { text: 'world' }] },
          ],
          articles: {
            main: { blocks: [{ runs: [{ text: 'Saved words' }] }] },
            draft: { blocks: [{ runs: [{ text: 'Unsaved words' }] }] },
          },
        },
        { id: 't2', name: 'Linked plan', connection: { id: 'c1' } },
      ]),
    );
    expect(read.name).toBe('Checkout Flow');
    expect(read.chunks).toHaveLength(1);
    expect(read.chunks[0]).toEqual({
      ref: 't1:0',
      title: 'Payments',
      text: 'Payments\nCheckout\nStripe Retries 3 times\nHello world\nSaved words',
      place: { tabId: 't1', elementIds: ['a', 'b', 'd'] },
    });
    expect(isKnowledgeText({ name: read.name, version: 1, chunks: read.chunks })).toBe(true);
  });

  it('keeps a tab with only its name, and reads nothing from a file without tabs', () => {
    expect(
      canvasKnowledgeChunks(canvas([{ id: 't', name: 'Roadmap', elements: [] }])).chunks,
    ).toEqual([{ ref: 't:0', title: 'Roadmap', text: 'Roadmap', place: { tabId: 't' } }]);
    expect(canvasKnowledgeChunks({ nope: 1 })).toEqual({ name: '', chunks: [] });
    expect(canvasKnowledgeChunks(null)).toEqual({ name: '', chunks: [] });
  });

  it('drops links and data, folds whitespace and bounds a deep element', () => {
    expect(plainWords('  a \n\t b ')).toBe('a b');
    expect(plainWords('https://example.test/x')).toBe('');
    expect(plainWords('data:text/plain,hi')).toBe('');
    let deep: Record<string, unknown> = { label: 'bottom' };
    for (let i = 0; i < 20; i++) deep = { child: deep };
    expect(elementWords({ label: 'top', deep })).toBe('top');
    expect(elementWords({ label: 'same', text: 'same' })).toBe('same');
  });

  it('stays within every cap on a huge canvas, quickly', () => {
    const elements = Array.from({ length: 20_000 }, (_, i) => ({
      id: `e${i}`,
      label: `Shape ${i} ${'word '.repeat(30)}`,
    }));
    const tabs = Array.from({ length: 5 }, (_, t) => ({ id: `t${t}`, name: `Tab ${t}`, elements }));
    let read = canvasKnowledgeChunks(canvas([]));
    const ms = cpuMsOf(() => {
      read = canvasKnowledgeChunks(canvas(tabs));
    });
    expect(read.chunks.length).toBeLessThanOrEqual(KNOWLEDGE_CHUNKS_PER_SOURCE);
    expect(read.chunks.reduce((n, c) => n + c.text.length, 0)).toBeLessThanOrEqual(
      KNOWLEDGE_SOURCE_MAX_CHARS,
    );
    for (const chunk of read.chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(KNOWLEDGE_CHUNK_MAX_CHARS);
      expect(chunk.place.elementIds?.length ?? 0).toBeLessThanOrEqual(KNOWLEDGE_PLACE_ELEMENTS_MAX);
    }
    expect(isKnowledgeText({ name: read.name, version: 1, chunks: read.chunks })).toBe(true);
    expect(ms).toBeLessThan(cpuBudgetMs(150));
  });
});

describe('plan walker', () => {
  const plan = {
    kind: 'liveplanner',
    project: {
      name: 'Launch Plan',
      tabs: [
        { id: 'board', name: 'Board', elements: [{ id: 'b1', type: 'board', title: 'Sprint' }] },
      ],
      items: [
        {
          id: 'old',
          key: 1,
          updatedAt: 1,
          fields: {
            title: 'Pick a date',
            status: 'Done',
            owner: { name: 'Ana' },
            dueDate: 'Friday',
          },
        },
        {
          id: 'new',
          key: 2,
          updatedAt: 5,
          fields: {
            title: 'Payments go live',
            description: 'Stripe first',
            points: 3,
            blocked: true,
          },
        },
        { id: 'gone', updatedAt: 9, fields: { title: 'Archived', archived: true } },
        { id: 'eg', updatedAt: 9, fields: { title: 'Example', example: true } },
        { id: 'blank', updatedAt: 0, fields: {} },
      ],
      threads: [
        { cards: [{ itemId: 'new' }], comments: [{ text: 'Approved by finance' }, { text: '' }] },
        { cards: 'x', comments: [] },
      ],
    },
  };

  it('reads cards newest first with fields and comments, each opening its card, then the tabs', () => {
    const read = planKnowledgeChunks(plan);
    expect(read.name).toBe('Launch Plan');
    expect(read.chunks.map((c) => c.ref)).toEqual(['card:new', 'card:old', 'board:0']);
    expect(read.chunks[0]).toEqual({
      ref: 'card:new',
      title: '#2 Payments go live',
      text: 'Payments go live\nStripe first\nPoints: 3\nBlocked: Yes\nComments: Approved by finance',
      place: { cardId: 'new' },
    });
    expect(read.chunks[1]!.text).toBe('Pick a date\nStatus: Done\nOwner: Ana\nDue Date: Friday');
    expect(planKnowledgeChunks('nope')).toEqual({ name: '', chunks: [] });
  });

  it('words a card from rich text and lists', () => {
    expect(
      cardWords(
        { title: { runs: [{ text: 'A' }, { text: 'B' }] }, tags: ['x', 'y'], flag: false },
        [],
      ),
    ).toBe('AB\nTags: x, y');
  });
});

describe('knowledge source doors', () => {
  const KEY = 'k';
  const send = (
    method: string,
    path: string,
    body: unknown,
    handlers: Partial<InternalItemHandlers>,
  ) =>
    handleInternalItems(
      new Request(`https://app.test${path}`, {
        method,
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      { key: KEY, handlers: { purge: async () => {}, ...handlers } },
    );

  it('answers an item text, a 404 for none, and a 500 past the caps', async () => {
    const text = {
      name: 'Flow',
      version: 2,
      chunks: [{ ref: 'r', title: 't', text: 'x', place: { tabId: 't' } }],
    };
    const ok = await send('GET', '/api/internal/items/A/knowledge-text', undefined, {
      knowledgeText: async () => ({ status: 'ok', text }),
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual(text);
    const none = await send('GET', '/api/internal/items/A/knowledge-text', undefined, {
      knowledgeText: async () => ({ status: 'not_found' }),
    });
    expect(none.status).toBe(404);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const big = await send('GET', '/api/internal/items/A/knowledge-text', undefined, {
      knowledgeText: async () => ({
        status: 'ok',
        text: { ...text, chunks: [{ ...text.chunks[0]!, text: 'x'.repeat(5000) }] },
      }),
    });
    expect(big.status).toBe(500);
    // An app with no handler has no door.
    expect((await send('GET', '/api/internal/items/A/knowledge-text', undefined, {})).status).toBe(
      404,
    );
  });

  it('takes a change signal, refusing a bad body and swallowing a handler failure', async () => {
    const knowledgeSourceChanged = vi.fn(async () => {});
    const res = await send(
      'POST',
      '/api/internal/items/KB/knowledge-source-changed',
      { app: 'livediagram', itemId: 'D', gone: true },
      { knowledgeSourceChanged },
    );
    expect(res.status).toBe(202);
    expect(knowledgeSourceChanged).toHaveBeenCalledWith('KB', {
      app: 'livediagram',
      itemId: 'D',
      gone: true,
    });
    const bad = await send(
      'POST',
      '/api/internal/items/KB/knowledge-source-changed',
      { app: 'x' },
      {
        knowledgeSourceChanged,
      },
    );
    expect(bad.status).toBe(400);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = await send(
      'POST',
      '/api/internal/items/KB/knowledge-source-changed',
      { app: 'livediagram', itemId: 'D' },
      { knowledgeSourceChanged: async () => Promise.reject(new Error('down')) },
    );
    expect(failing.status).toBe(202);
  });

  it('reads an export file once and walks it', async () => {
    const exportItem = vi.fn(async (id: string) =>
      id === 'none'
        ? ({ status: 'not_found' } as const)
        : id === 'empty'
          ? ({ status: 'empty', version: 4 } as const)
          : id === 'bad'
            ? ({ status: 'ok', body: '{', contentType: 'application/json', version: 1 } as const)
            : ({
                status: 'ok',
                body: new TextEncoder().encode(JSON.stringify(canvas([{ id: 't', name: 'Only' }]))),
                contentType: 'application/json',
                version: 7,
              } as const),
    );
    const read = knowledgeTextFromExport(exportItem, canvasKnowledgeChunks);
    expect(await read('none')).toEqual({ status: 'not_found' });
    expect(await read('bad')).toEqual({ status: 'not_found' });
    expect(await read('empty')).toEqual({
      status: 'ok',
      text: { name: '', version: 4, chunks: [] },
    });
    const ok = await read('A');
    expect(ok).toEqual({
      status: 'ok',
      text: {
        name: 'Checkout Flow',
        version: 7,
        chunks: [{ ref: 't:0', title: 'Only', text: 'Only', place: { tabId: 't' } }],
      },
    });
    expect(exportItem).toHaveBeenCalledWith('A', expect.objectContaining({ format: 'file' }));
  });
});
