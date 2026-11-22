// Publish to the Web (docs/specs/030-knowledgebase/publishing.md; blueprint publishing.md P1 to P9, P15 to P21): who
// may publish, what a publish puts on the site, how the site follows saves, renames and an Unpublish.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublishingState } from '@liveknowledge/api-schema';
import { knowledgeKit, OWNER, page, type Kit, type Who } from '../routes/knowledge-test-kit';
import { makeTestRouteContext } from '../routes/test-route-context';
import { handleDocuments } from '../routes/documents';
import { handlePublicSite, purgePublished } from './public-site';
import { PUBLISH_PURGE_HEADER } from './publishing-routes';

vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});
// The writers' names, as the accounts Worker would answer them.
vi.mock('../person/profiles', async (original) => ({
  ...(await original<typeof import('../person/profiles')>()),
  getParticipants: async (_env: unknown, ids: readonly string[]) =>
    new Map(
      ids.filter((id) => id === OWNER).map((id) => [id, { ownerId: id, name: 'Olive Owner' }]),
    ),
}));
let offered = true;
vi.mock('@liveknowledge/knowledge', async (original) => ({
  ...(await original<typeof import('@liveknowledge/knowledge')>()),
  publishingOffered: () => offered,
}));

afterEach(() => {
  offered = true;
  vi.restoreAllMocks();
});

const PUBLISHING = '/api/documents/kb/publishing';
const ORIGIN = 'https://www.liveknowledge.app';
const publish = (kit: Kit, over: object = {}, who: Who = 'editor') =>
  kit.call(who, 'PUT', PUBLISHING, {
    address: 'handbook',
    root: null,
    noindex: false,
    showWriters: false,
    ...over,
  });
const stateOf = async (res: Response) => res.json<PublishingState>();

/** A public read, as a reader's browser sends it: no identity at all. */
async function read(kit: Kit, path: string, init: RequestInit = {}) {
  const res = await handlePublicSite(new Request(`${ORIGIN}${path}`, init), kit.db.env, () => {});
  return { res, text: await res.text() };
}

describe('who may publish', () => {
  it('lets an Editor read the state and preview of a knowledgebase never published', async () => {
    const kit = await knowledgeKit();
    const res = await kit.call('editor', 'GET', PUBLISHING);
    expect(res.status).toBe(200);
    expect(await stateOf(res)).toEqual({
      offered: true,
      published: false,
      site: null,
      defaultAddress: 'handbook',
      preview: {
        root: null,
        pages: [
          { id: 'deploys', title: 'Deploys' },
          { id: 'rollbacks', title: 'Rollbacks' },
          { id: 'holidays', title: 'Holidays' },
        ],
        leftOut: [],
      },
    });
    const section = await stateOf(await kit.call('editor', 'GET', `${PUBLISHING}?root=deploys`));
    expect(section.preview.pages.map((p) => p.id)).toEqual(['deploys', 'rollbacks']);
    const whole = await stateOf(await kit.call('editor', 'GET', `${PUBLISHING}?root=`));
    expect(whole.preview.root).toBeNull();
    expect(
      (await stateOf(await kit.call('editor', 'GET', `${PUBLISHING}?root=nope`))).preview.pages,
    ).toEqual([]);
  });

  it.each<[Who, string]>([
    ['participant', 'forbidden'],
    ['viewer', 'forbidden'],
    ['link', 'forbidden'],
    ['edit-link', 'forbidden'],
    ['page-link', 'forbidden'],
    ['page-edit-link', 'forbidden'],
    ['agent', 'needs_a_person'],
    ['agent-stored', 'needs_a_person'],
    ['participant-agent', 'needs_a_person'],
  ])('refuses %s', async (who, error) => {
    const kit = await knowledgeKit();
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const res =
        method === 'PUT' ? await publish(kit, {}, who) : await kit.call(who, method, PUBLISHING);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error });
    }
  });

  it('refuses a stranger, and the owner with no account', async () => {
    const kit = await knowledgeKit();
    expect((await kit.call('stranger', 'GET', PUBLISHING)).status).toBe(403);
    const guest = await handleDocuments(
      makeTestRouteContext('GET', PUBLISHING, {
        env: kit.db.env,
        owner: OWNER,
        accountUserId: null,
      }),
    );
    expect(guest.status).toBe(403);
    expect(await guest.json()).toMatchObject({ error: 'sign_in_required' });
  });

  it('refuses a publish when publishing is not offered, but still lets the site come down', async () => {
    const kit = await knowledgeKit();
    expect((await publish(kit)).status).toBe(200);
    offered = false;
    const res = await publish(kit);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'publishing_unavailable' });
    expect((await stateOf(await kit.call('editor', 'GET', PUBLISHING))).offered).toBe(false);
    expect((await kit.call('editor', 'DELETE', PUBLISHING)).status).toBe(200);
  });

  it('refuses another method and a body that does not read', async () => {
    const kit = await knowledgeKit();
    expect((await kit.call('editor', 'POST', PUBLISHING, {})).status).toBe(405);
    // No body at all reads as no body.
    expect(await (await kit.call('editor', 'PUT', PUBLISHING)).json()).toMatchObject({
      error: 'invalid_body',
    });
    for (const body of [
      null,
      [],
      { address: 1 },
      { address: 'abc', root: 2 },
      { address: 'abc', root: null },
    ])
      expect(await (await kit.call('editor', 'PUT', PUBLISHING, body)).json()).toMatchObject({
        error: 'invalid_body',
      });
    expect(await (await publish(kit, { address: 'A B' })).json()).toMatchObject({
      error: 'invalid_address',
    });
    expect(await (await publish(kit, { address: 'search' })).json()).toMatchObject({
      error: 'address_reserved',
    });
    expect(await (await publish(kit, { root: 'nope' })).json()).toMatchObject({
      error: 'invalid_root',
    });
  });
});

describe('the public site', () => {
  it('serves the published pages with links, the tree, search and a sitemap', async () => {
    const kit = await knowledgeKit();
    const res = await publish(kit);
    const state = await stateOf(res);
    expect(state.published).toBe(true);
    expect(state.site).toMatchObject({
      address: 'handbook',
      root: null,
      noindex: false,
      showWriters: false,
    });
    expect(state.site!.url).toMatch(/\/kb\/handbook$/);
    expect(JSON.parse(res.headers.get(PUBLISH_PURGE_HEADER)!)).toContain('/kb/handbook/rollbacks');

    const front = await read(kit, '/kb/handbook');
    expect(front.res.status).toBe(200);
    expect(front.res.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(front.res.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(front.res.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(front.res.headers.get('X-Robots-Tag')).toBeNull();
    expect(front.text).toContain('<h1>Deploys</h1>');
    expect(front.text).toContain('Deploys go out on Tuesdays');
    expect(front.text).toContain('<a href="/kb/handbook/rollbacks">Rollbacks</a>');
    expect(front.text).toContain('<h2 id="when-we-deploy">When we deploy</h2>');
    expect(front.text).not.toContain('<script');

    const sub = await read(kit, '/kb/handbook/rollbacks/');
    expect(sub.text).toContain('<a href="/kb/handbook">Deploys</a></li></ol>');
    // The front page is read at the site's own address.
    const again = await read(kit, '/kb/handbook/deploys');
    expect(again.res.status).toBe(301);
    expect(again.res.headers.get('Location')).toBe('/kb/handbook');

    const search = await read(kit, '/kb/handbook/search?q=tuesdays');
    expect(search.text).toContain('<a href="/kb/handbook">Deploys</a><p>');
    expect(search.text).toContain('<mark>Tuesdays</mark>');
    expect(search.res.headers.get('X-Robots-Tag')).toBe('noindex, follow');
    expect((await read(kit, '/kb/handbook/search?q=%22%20OR%20*')).text).toContain(
      'No page matches',
    );
    expect((await read(kit, '/kb/handbook/search')).text).toContain('Type a word');

    const sitemap = await read(kit, '/kb/handbook/sitemap.xml');
    expect(sitemap.res.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    expect(sitemap.text).toContain(`<loc>${ORIGIN}/kb/handbook/holidays</loc><lastmod>`);
    const head = await read(kit, '/kb/handbook', { method: 'HEAD' });
    expect(head.res.status).toBe(200);
    expect(head.text).toBe('');
  });

  it('answers 404 for what holds nothing, and 405 for a write', async () => {
    const kit = await knowledgeKit();
    expect((await read(kit, '/kb/handbook')).res.status).toBe(404);
    await publish(kit);
    for (const path of [
      '/kb',
      '/kb/',
      '/kb/A',
      '/kb/handbook/nope',
      '/kb/handbook/a/b',
      '/kb/handbook/Bad_Page',
      '/kb/other',
    ])
      expect((await read(kit, path)).res.status, path).toBe(404);
    expect((await read(kit, '/kb/handbook/nope')).text).toContain('Page Not Found');
    expect((await read(kit, '/kb/handbook', { method: 'POST' })).res.status).toBe(405);
  });

  it('hides the site from search engines when asked', async () => {
    const kit = await knowledgeKit();
    await publish(kit, { noindex: true });
    const front = await read(kit, '/kb/handbook');
    expect(front.res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(front.text).toContain('<meta name="robots" content="noindex, nofollow">');
    expect((await read(kit, '/kb/handbook/sitemap.xml')).text).not.toContain('<url>');
  });

  it('publishes one section, and names the writers only when chosen', async () => {
    const kit = await knowledgeKit();
    await publish(kit, { root: 'deploys' });
    expect((await read(kit, '/kb/handbook/holidays')).res.status).toBe(404);
    expect((await read(kit, '/kb/handbook')).text).not.toContain('Olive Owner');
    await publish(kit, { root: 'deploys', showWriters: true });
    expect((await read(kit, '/kb/handbook')).text).toContain('Written by Olive Owner');
  });

  it('limits searches per network', async () => {
    const kit = await knowledgeKit({
      SEARCH_RATE_LIMITER: { limit: async () => ({ success: false }) },
    });
    await publish(kit);
    const res = await read(kit, '/kb/handbook/search?q=x');
    expect(res.res.status).toBe(429);
    expect(res.res.headers.get('Retry-After')).toBe('60');
    expect((await read(kit, '/kb/handbook')).res.status).toBe(200);
    const open = await knowledgeKit({
      SEARCH_RATE_LIMITER: { limit: async () => ({ success: true }) },
    });
    await publish(open);
    expect((await read(open, '/kb/handbook/search?q=x')).res.status).toBe(200);
  });
});

const savePage = (kit: Kit, tab: object) =>
  kit.call('editor', 'PUT', `/api/documents/kb/tabs/${(tab as { id: string }).id}`, tab);

describe('the site follows the knowledgebase', () => {
  it('shows a save on the next read, keeps renamed pages at their old address and drops a removed page', async () => {
    const kit = await knowledgeKit();
    await publish(kit);
    const para = (text: string) => ({ id: 'p', type: 'paragraph', runs: [{ text }] });
    expect(
      (await savePage(kit, page('holidays', 'Time Off', [para('Take the whole of August off.')])))
        .status,
    ).toBeLessThan(300);
    const moved = await read(kit, '/kb/handbook/holidays');
    expect(moved.res.status).toBe(301);
    expect(moved.res.headers.get('Location')).toBe('/kb/handbook/time-off');
    expect((await read(kit, '/kb/handbook/time-off')).text).toContain('whole of August');
    // Renamed back, it takes its first address again.
    await savePage(kit, page('holidays', 'Holidays', [para('Back again.')]));
    expect((await read(kit, '/kb/handbook/holidays')).text).toContain('Back again.');
    expect((await read(kit, '/kb/handbook/time-off')).res.headers.get('Location')).toBe(
      '/kb/handbook/holidays',
    );
    // A page emptied leaves the site; its link on another page turns to text.
    await savePage(kit, page('rollbacks', 'Rollbacks', [para('  ')], { parent: 'deploys' }));
    expect((await read(kit, '/kb/handbook/rollbacks')).res.status).toBe(404);
    const front = await read(kit, '/kb/handbook');
    expect(front.text).not.toContain('href="/kb/handbook/rollbacks"');
    expect(front.text).toContain('See Rollbacks when one fails.');
    const state = await stateOf(await kit.call('editor', 'GET', PUBLISHING));
    expect(state.preview.leftOut).toEqual([
      { id: 'rollbacks', title: 'Rollbacks', reason: 'empty' },
    ]);
    // Written again, it comes back.
    await savePage(
      kit,
      page('rollbacks', 'Rollbacks', [para('Roll back with one command.')], { parent: 'deploys' }),
    );
    expect((await read(kit, '/kb/handbook')).text).toContain('href="/kb/handbook/rollbacks"');
    // Deleted (to the Trash), it is gone; restored from the Trash, it comes back.
    expect((await kit.call('editor', 'DELETE', '/api/documents/kb/tabs/holidays')).status).toBe(
      204,
    );
    expect((await read(kit, '/kb/handbook/holidays')).res.status).toBe(404);
    expect(
      (await kit.call('editor', 'POST', '/api/documents/kb/trash/holidays/restore')).status,
    ).toBe(200);
    expect((await read(kit, '/kb/handbook/holidays')).res.status).toBe(200);
  });

  it('moves the site to a new address and redirects the old one', async () => {
    const kit = await knowledgeKit();
    await publish(kit);
    const res = await publish(kit, { address: 'acme-help' });
    const purged = JSON.parse(res.headers.get(PUBLISH_PURGE_HEADER)!) as string[];
    expect(purged).toContain('/kb/handbook/rollbacks');
    expect(purged).toContain('/kb/acme-help/rollbacks');
    const old = await read(kit, '/kb/handbook/rollbacks');
    expect(old.res.status).toBe(301);
    expect(old.res.headers.get('Location')).toBe('/kb/acme-help/rollbacks');
    expect((await read(kit, '/kb/acme-help/rollbacks')).text).toContain('<h1>Rollbacks</h1>');
    // Taken back, the first address is the site's own again.
    await publish(kit, { address: 'handbook' });
    expect((await read(kit, '/kb/handbook')).res.status).toBe(200);
    expect((await read(kit, '/kb/acme-help')).res.headers.get('Location')).toBe('/kb/handbook');
  });

  it('refuses an address another knowledgebase holds, and a site with no page to show', async () => {
    const kit = await knowledgeKit();
    await kit.db.env.DOCUMENT_ROOM.get(
      kit.db.env.DOCUMENT_ROOM.idFromName('~kb-site:taken'),
    ).siteAddress({ kind: 'claim', documentId: 'other-kb' });
    const res = await publish(kit, { address: 'taken' });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'address_taken' });
    // Every page waiting for approval: nothing may go public.
    kit.db.sql.exec(
      `UPDATE tabs SET data = json_set(data, '$.knowledge.approval', json('{"state":"pending","requestedBy":"user_p","requestedAt":1}')), rev = rev + 1`,
    );
    const nothing = await publish(kit, { address: 'lone' });
    expect(nothing.status).toBe(409);
    expect(await nothing.json()).toMatchObject({ error: 'nothing_to_publish' });
  });

  it('takes the site down on Unpublish and lets the address go', async () => {
    const kit = await knowledgeKit();
    expect(await stateOf(await kit.call('editor', 'DELETE', PUBLISHING))).toMatchObject({
      published: false,
    });
    await publish(kit);
    await publish(kit, { address: 'acme-help' });
    const res = await kit.call('editor', 'DELETE', PUBLISHING);
    expect(await stateOf(res)).toMatchObject({ published: false, site: null });
    expect(JSON.parse(res.headers.get(PUBLISH_PURGE_HEADER)!)).toEqual(
      expect.arrayContaining(['/kb/handbook', '/kb/acme-help', '/kb/acme-help/sitemap.xml']),
    );
    for (const path of [
      '/kb/handbook',
      '/kb/acme-help',
      '/kb/acme-help/rollbacks',
      '/kb/handbook/sitemap.xml',
    ])
      expect((await read(kit, path)).res.status, path).toBe(404);
    for (const table of [
      'published_site',
      'published_pages',
      'published_addresses',
      'published_fts',
    ])
      expect(kit.db.sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get(), table).toEqual({
        n: 0,
      });
    // Another knowledgebase may take the address now.
    const room = kit.db.env.DOCUMENT_ROOM.get(
      kit.db.env.DOCUMENT_ROOM.idFromName('~kb-site:handbook'),
    );
    expect(await room.siteAddress({ kind: 'claim', documentId: 'other-kb' })).toBe('held');
  });
});

describe('the edge copy', () => {
  it('keeps a page and drops it when a publish names it', async () => {
    const kept = new Map<string, Response>();
    const cache = {
      match: async (r: Request) => kept.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => void kept.set(r.url, res),
      delete: async (r: Request) => kept.delete(r.url),
    };
    vi.stubGlobal('caches', { default: cache });
    try {
      const kit = await knowledgeKit();
      await publish(kit);
      const waits: Promise<unknown>[] = [];
      const wait = (p: Promise<unknown>) => void waits.push(p);
      await handlePublicSite(new Request(`${ORIGIN}/kb/handbook?x=1`), kit.db.env, wait);
      await Promise.all(waits);
      expect([...kept.keys()]).toEqual([`${ORIGIN}/kb/handbook`]);
      // Served from the edge even once the site is gone, until purged.
      await kit.call('editor', 'DELETE', PUBLISHING);
      const hit = await handlePublicSite(new Request(`${ORIGIN}/kb/handbook`), kit.db.env, wait);
      expect(hit.status).toBe(200);
      // A search is never kept.
      await handlePublicSite(new Request(`${ORIGIN}/kb/handbook/search?q=x`), kit.db.env, wait);
      expect(kept.size).toBe(1);

      const named = new Response('{}', {
        headers: { [PUBLISH_PURGE_HEADER]: JSON.stringify(['/kb/handbook', '/api/x', 3]) },
      });
      const out = purgePublished(named, ORIGIN, wait);
      await Promise.all(waits);
      expect(out.headers.has(PUBLISH_PURGE_HEADER)).toBe(false);
      expect(kept.size).toBe(0);
      const broken = purgePublished(
        new Response('', { headers: { [PUBLISH_PURGE_HEADER]: 'not json' } }),
        ORIGIN,
        wait,
      );
      expect(broken.headers.has(PUBLISH_PURGE_HEADER)).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('passes an answer with nothing to purge through untouched', () => {
    const res = new Response('ok');
    expect(purgePublished(res, ORIGIN, () => {})).toBe(res);
    // With no edge cache, the header is still stripped.
    const named = new Response('', { headers: { [PUBLISH_PURGE_HEADER]: '["/kb/x"]' } });
    expect(purgePublished(named, ORIGIN, () => {}).headers.has(PUBLISH_PURGE_HEADER)).toBe(false);
  });
});
