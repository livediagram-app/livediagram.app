// The edges of Publish to the Web (blueprint publishing.md P7, P17, P21): the address registry's own rules, a
// refresh that fails, an edge cache that fails, untitled and connected pages, and the CPU a publish costs.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';
import type { PublishingState } from '@liveknowledge/api-schema';
import { knowledgeKit, page, type Kit } from '../routes/knowledge-test-kit';
import { documentRoom } from '../document-client';
import { handlePublicSite } from './public-site';
import { siteAddressIn, SITE_ADDRESS_KEY } from './site-addresses';

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

const ORIGIN = 'https://www.liveknowledge.app';
const PUBLISHING = '/api/documents/kb/publishing';
const publish = (kit: Kit, over: object = {}) =>
  kit.call('editor', 'PUT', PUBLISHING, {
    address: 'handbook',
    root: null,
    noindex: false,
    showWriters: false,
    ...over,
  });
const read = (kit: Kit, path: string) =>
  handlePublicSite(new Request(`${ORIGIN}${path}`), kit.db.env, () => {});

describe('the address registry', () => {
  const storage = () => {
    const kept = new Map<string, unknown>();
    return {
      kept,
      get: async <T>(key: string) => kept.get(key) as T | undefined,
      put: async (key: string, value: unknown) => void kept.set(key, value),
      delete: async (key: string) => kept.delete(key),
    } as unknown as DurableObjectStorage & { kept: Map<string, unknown> };
  };

  it('gives an address to one knowledgebase, moves it and lets it go', async () => {
    const s = storage();
    expect(await siteAddressIn(s, { kind: 'read' })).toBeNull();
    expect(await siteAddressIn(s, { kind: 'claim', documentId: 'a' })).toBe('held');
    expect(await siteAddressIn(s, { kind: 'claim', documentId: 'b' })).toBe('taken');
    expect(await siteAddressIn(s, { kind: 'move', documentId: 'b', to: 'x' })).toBe('taken');
    expect(await siteAddressIn(s, { kind: 'release', documentId: 'b' })).toBe('taken');
    expect(await siteAddressIn(s, { kind: 'move', documentId: 'a', to: 'new' })).toBe('held');
    expect(await siteAddressIn(s, { kind: 'read' })).toEqual({ documentId: 'a', movedTo: 'new' });
    expect(await siteAddressIn(s, { kind: 'claim', documentId: 'a' })).toBe('held');
    expect(s.kept.get(SITE_ADDRESS_KEY)).toEqual({ documentId: 'a' });
    expect(await siteAddressIn(s, { kind: 'release', documentId: 'a' })).toBe('held');
    expect(s.kept.size).toBe(0);
  });
});

describe('failures', () => {
  it('answers from the snapshot when a refresh fails', async () => {
    const kit = await knowledgeKit();
    await publish(kit);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    kit.db.sql.exec('DROP TABLE published_empty');
    kit.db.sql.exec("INSERT INTO published_dirty (tab) VALUES ('holidays')");
    const res = await read(kit, '/kb/handbook/holidays');
    expect(res.status).toBe(200);
    expect(warn).toHaveBeenCalledWith('[publishing] refresh_failed', expect.anything());
  });

  it('serves the page when the edge cache fails', async () => {
    const broken = {
      match: async () => {
        throw new Error('down');
      },
      put: async () => {
        throw new Error('down');
      },
      delete: async () => {
        throw new Error('down');
      },
    };
    vi.stubGlobal('caches', { default: broken });
    const kit = await knowledgeKit();
    await publish(kit);
    const waits: Promise<unknown>[] = [];
    const res = await handlePublicSite(
      new Request(`${ORIGIN}/kb/handbook`),
      kit.db.env,
      (p) => void waits.push(p),
    );
    expect(res.status).toBe(200);
    await expect(Promise.all(waits)).resolves.toBeDefined();
    const { purgePublished } = await import('./public-site');
    purgePublished(
      new Response('', { headers: { 'X-Publish-Purge': '["/kb/handbook"]' } }),
      ORIGIN,
      (p) => void waits.push(p),
    );
    await expect(Promise.all(waits)).resolves.toBeDefined();
  });
});

describe('pages with no title, and connected files', () => {
  it('words an untitled page and never publishes a connected file', async () => {
    const kit = await knowledgeKit();
    await kit.call('editor', 'PUT', '/api/documents/kb/tabs/plan', {
      id: 'plan',
      name: 'Launch Plan',
      elements: [],
      parent: 'deploys',
      connection: { id: 'cn_abcdefghijklmnop', app: 'liveplanner', itemId: 'plan_1' },
    });
    await kit.call('editor', 'PUT', '/api/documents/kb/tabs/holidays/name', { name: ' ' });
    const state = await (await kit.call('editor', 'GET', PUBLISHING)).json<PublishingState>();
    expect(state.preview.pages.map((p) => p.id)).not.toContain('plan');
    await publish(kit);
    expect(await (await read(kit, '/kb/handbook/launch-plan')).text()).toContain('Page Not Found');
  });
});

describe('reads with nothing to show', () => {
  it('answers none with no site, no document or no page left, and words a blank name', async () => {
    const kit = await knowledgeKit();
    const room = documentRoom(kit.db.env, 'kb');
    expect(await room.publishedRead({ kind: 'sitemap' })).toEqual({ status: 'none' });
    await publish(kit);
    kit.db.sql.exec("UPDATE document SET name = ''");
    kit.db.sql.exec("UPDATE tabs SET name = '' WHERE id = 'holidays'");
    expect(await (await read(kit, '/kb/handbook')).text()).toContain('Untitled Knowledgebase');
    const state = await (await kit.call('editor', 'GET', PUBLISHING)).json<PublishingState>();
    expect(state.preview.pages.at(-1)).toEqual({ id: 'holidays', title: 'Untitled Page' });
    // The front page renamed: its old address leads to the site's own.
    kit.db.sql.exec("UPDATE tabs SET name = 'Deploy Guide' WHERE id = 'deploys'");
    const moved = await read(kit, '/kb/handbook/deploys');
    expect(moved.status).toBe(301);
    expect(moved.headers.get('Location')).toBe('/kb/handbook');
    // Every page emptied: the site shows nothing.
    kit.db.sql.exec(
      `UPDATE tabs SET data = json_set(data, '$.articles', json('{"f1":{"blocks":[]}}')), rev = rev + 1`,
    );
    expect((await read(kit, '/kb/handbook')).status).toBe(404);
    // The document gone: nothing either.
    kit.db.sql.exec('DELETE FROM document');
    expect(await room.publishedRead({ kind: 'page', address: null })).toEqual({ status: 'none' });
  });
});

describe('cost', () => {
  it('publishes 200 pages of 50 blocks within the CPU budget', async () => {
    const blocks = Array.from({ length: 50 }, (_, i) => ({
      id: `b${i}`,
      type: 'paragraph',
      runs: [{ text: `Paragraph ${i} about deploys, rollbacks and the release channel.` }],
    }));
    const pages = Array.from({ length: 200 }, (_, i) => page(`p${i}`, `Page ${i}`, blocks));
    const kit = await knowledgeKit({}, pages);
    const start = cpuNowMs();
    expect((await publish(kit)).status).toBe(200);
    const spent = cpuNowMs() - start;
    console.info('[publishing] publish of 200 pages', { cpuMs: Math.round(spent) });
    expect(spent).toBeLessThan(cpuBudgetMs(4000));
    // A read of a page after one save redraws that page alone.
    const readStart = cpuNowMs();
    expect((await read(kit, '/kb/handbook/page-10')).status).toBe(200);
    expect(cpuNowMs() - readStart).toBeLessThan(cpuBudgetMs(500));
  });
});
