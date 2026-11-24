import { describe, expect, it } from 'vitest';
import worker from './worker';

// The Worker (liveworkspace/docs/specs/017-help/blueprints/help-centre.md "The Worker"): a scope's page, its Markdown to
// an agent that prefers it (liveworkspace/docs/specs/010-site/markdown-for-agents.md), the scope's 404 and the map's
// redirects.
const manifest = {
  articles: { 'tabs/using-tabs': ['livediagram'] },
  categories: { tabs: ['livediagram'] },
  redirects: [{ from: 'old', to: 'tabs/using-tabs' }],
  origins: { all: 'https://www.liveworkspace.app', livediagram: 'https://www.livediagram.app' },
};
const files: Record<string, [string, string]> = {
  '/manifest.json': [JSON.stringify(manifest), 'application/json'],
  '/livediagram/tabs/using-tabs/': ['<html>Using tabs</html>', 'text/html'],
  '/livediagram/tabs/using-tabs/index.md': ['# Using Tabs', 'text/markdown'],
  '/livediagram/404.html': ['<html>Not found</html>', 'text/html'],
};
const env = {
  ASSETS: {
    fetch: (input: Request | string) => {
      const { pathname } = new URL(typeof input === 'string' ? input : input.url);
      const file = files[pathname];
      return Promise.resolve(
        file
          ? new Response(file[0], { headers: { 'Content-Type': file[1] } })
          : new Response('missing', { status: 404 }),
      );
    },
  },
};
const get = (path: string, accept: string, method = 'GET') =>
  new Request(`https://www.livediagram.app${path}`, {
    method,
    headers: { Accept: accept, 'x-help-app': 'livediagram' },
  });

describe('the help Worker', () => {
  it('answers an article’s Markdown to an agent, with the help headers and both Vary names', async () => {
    const res = await worker.fetch(get('/tabs/using-tabs/', 'text/markdown'), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(res.headers.get('Vary')).toBe('Accept, x-help-app');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(await res.text()).toBe('# Using Tabs');
  });

  it('answers the article’s HTML to a browser and to */*', async () => {
    for (const accept of ['text/html,*/*;q=0.8', '*/*']) {
      const res = await worker.fetch(get('/tabs/using-tabs/', accept), env);
      expect(res.headers.get('Content-Type')).toBe('text/html');
      expect(res.headers.get('Vary')).toBe('Accept, x-help-app');
      expect(await res.text()).toBe('<html>Using tabs</html>');
    }
  });

  it('answers the scope’s 404 page for a missing page, Markdown asked for or not', async () => {
    for (const accept of ['text/markdown', 'text/html']) {
      const res = await worker.fetch(get('/nowhere/', accept), env);
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('<html>Not found</html>');
    }
  });

  it('redirects a moved page before negotiating, and refuses a write', async () => {
    const moved = await worker.fetch(get('/old/', 'text/markdown'), env);
    expect(moved.status).toBe(308);
    expect(moved.headers.get('Location')).toBe('/tabs/using-tabs/');
    expect((await worker.fetch(get('/', '*/*', 'POST'), env)).status).toBe(405);
  });
});
