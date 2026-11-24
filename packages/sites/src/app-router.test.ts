import { describe, expect, it } from 'vitest';
import {
  type AppRouterConfig,
  type AppRouterEnv,
  createAppRouter,
  telemetryDashboardUrlFor,
  telemetryRedirectTo,
  withPrefixedRedirect,
} from './app-router';
import type { ServiceBinding } from './workspace-proxy';

// The seams a product binds `createAppRouter` with. The dispatch table itself is tested through every product's
// router (app-router-testing.ts), where the real oEmbed and Community steps are.

type Env = AppRouterEnv & { EDITOR?: ServiceBinding };

function recording() {
  const urls: string[] = [];
  const binding: ServiceBinding = {
    fetch: (input) => {
      urls.push(input instanceof Request ? input.url : String(input));
      return Promise.resolve(new Response('ok', { headers: { 'Content-Type': 'text/html' } }));
    },
  };
  return { binding, urls };
}

function routerWith(overrides: Partial<AppRouterConfig<Env, null>> = {}) {
  return createAppRouter<Env, null>({
    app: 'livediagram',
    liveRouteSegments: new Set(['new']),
    signedInCookie: 'x_signed_in',
    helpCategorySegments: ['tools'],
    editorBinding: (env) => env.EDITOR,
    editorOrigin: () => undefined,
    oembed: { isOEmbedPath: () => false, oembed: () => Promise.resolve(new Response('oembed')) },
    routeCommunity: () => null,
    communitySite: null,
    telemetryRedirect: () => telemetryRedirectTo('https://dash.test/telemetry', 'livediagram.app'),
    ...overrides,
  });
}

const get = (path: string) => new Request(`https://www.livediagram.app${path}`);
const to = (location: string) => (url: URL) =>
  url.pathname.startsWith('/old') ? Response.redirect(`${url.origin}${location}`, 301) : null;

describe('createAppRouter', () => {
  it('reads the editor through the names the product gives it', async () => {
    const editor = recording();
    await routerWith().fetch(get('/new'), { EDITOR: editor.binding });
    expect(editor.urls).toEqual(['https://www.livediagram.app/new']);
  });

  it('sends /telemetry where the product says', async () => {
    const res = await routerWith().fetch(get('/telemetry/x'), {});
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://dash.test/telemetry?app=livediagram.app');
  });

  it("forwards a product's api-served path to the api, its caching left as the api set it", async () => {
    const api = recording();
    const marketing = recording();
    const env = { API: api.binding, MARKETING: marketing.binding };
    const res = await routerWith({ apiServedPath: '/kb' }).fetch(get('/kb/site'), env);
    expect(res.headers.get('Cache-Control')).toBeNull();
    // Without one the path is marketing's, a page under the caching rules.
    const page = await routerWith().fetch(get('/kb/site'), env);
    expect(page.headers.get('Cache-Control')).toBe('no-store');
    expect(api.urls).toEqual(['https://www.livediagram.app/kb/site']);
    expect(marketing.urls).toEqual(['https://www.livediagram.app/kb/site']);
  });

  it("asks a product's old addresses in order: form, then help, then editor", async () => {
    const env = { MARKETING: recording().binding };
    const location = async (legacy: AppRouterConfig<Env, null>['legacy']) =>
      (await routerWith({ legacy }).fetch(get('/old'), env)).headers.get('Location');
    const form = (url: URL, deployEnv: string | undefined) => to(`/form-${deployEnv}`)(url);
    expect(await location({ form, help: to('/help/a'), editor: to('/new') })).toBe(
      'https://www.livediagram.app/form-undefined',
    );
    expect(await location({ help: to('/help/a'), editor: to('/new') })).toBe(
      'https://www.livediagram.app/help/a',
    );
    expect(await location({ editor: to('/new') })).toBe('https://www.livediagram.app/new');
    expect(await location({})).toBeNull();
  });

  it("lands the bare domain's one hop where a product's old address points", async () => {
    const bare = new Request('https://livediagram.app/old');
    const viaHelp = await routerWith({ legacy: { help: to('/help/a') } }).fetch(bare, {});
    expect(viaHelp.headers.get('Location')).toBe('https://www.livediagram.app/help/a');
    const viaEditor = await routerWith({ legacy: { editor: to('/new') } }).fetch(bare, {});
    expect(viaEditor.headers.get('Location')).toBe('https://www.livediagram.app/new');
  });
});

describe('the telemetry dashboard', () => {
  it('is the deploy environment’s, filtered to the app', () => {
    expect(telemetryDashboardUrlFor(undefined, 'a.app')).toBe(
      'https://www.liveworkspace.app/telemetry?app=a.app',
    );
    expect(telemetryDashboardUrlFor('staging', 'a.app')).toBe(
      'https://staging.liveworkspace.app/telemetry?app=a.app',
    );
    expect(telemetryDashboardUrlFor('local', 'a.app')).toBe(
      'http://localhost:3000/telemetry?app=a.app',
    );
  });
});

describe('withPrefixedRedirect', () => {
  const redirect = (location: string) =>
    new Response(null, { status: 307, headers: { Location: location } });

  it('puts the prefix back on a path inside the stripped app, and leaves every other answer', () => {
    expect(withPrefixedRedirect(redirect('/a/'), '/help').headers.get('Location')).toBe('/help/a/');
    expect(withPrefixedRedirect(redirect('/help/a/'), '/help').headers.get('Location')).toBe(
      '/help/a/',
    );
    expect(withPrefixedRedirect(redirect('//x.test/a'), '/help').headers.get('Location')).toBe(
      '//x.test/a',
    );
    const ok = new Response('ok');
    expect(withPrefixedRedirect(ok, '/help')).toBe(ok);
  });
});

// Markdown for agents (liveworkspace/docs/specs/010-site/markdown-for-agents.md): the marketing pages negotiate here.
describe('the marketing pages answer Markdown to an agent', () => {
  function marketingSite(files: Record<string, string>) {
    const urls: string[] = [];
    const binding: ServiceBinding = {
      fetch: (input) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        urls.push(url.pathname);
        const body = files[url.pathname];
        if (body === undefined) return Promise.resolve(new Response('missing', { status: 404 }));
        const type = url.pathname.endsWith('.md') ? 'text/markdown' : 'text/html';
        return Promise.resolve(new Response(body, { headers: { 'Content-Type': type } }));
      },
    };
    return { binding, urls };
  }
  const accepting = (path: string, accept: string) =>
    new Request(`https://www.livediagram.app${path}`, { headers: { Accept: accept } });
  const files = { '/faq': '<html>FAQ</html>', '/faq.md': '# FAQ', '/index.md': '# Home' };

  it('answers the Markdown file, typed and varied, to a request that prefers it', async () => {
    const site = marketingSite(files);
    const res = await routerWith().fetch(accepting('/faq', 'text/markdown'), {
      MARKETING: site.binding,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(res.headers.get('Vary')).toBe('Accept');
    expect(await res.text()).toBe('# FAQ');
    expect(site.urls).toEqual(['/faq.md']);
  });

  it('answers the home page from /index.md', async () => {
    const site = marketingSite(files);
    const res = await routerWith().fetch(accepting('/', 'text/markdown, text/html'), {
      MARKETING: site.binding,
    });
    expect(await res.text()).toBe('# Home');
  });

  it('answers HTML, no-store and varied, to a browser, with no second fetch', async () => {
    const site = marketingSite(files);
    const res = await routerWith().fetch(
      accepting('/faq', 'text/html,application/xhtml+xml,*/*;q=0.8'),
      { MARKETING: site.binding },
    );
    expect(res.headers.get('Content-Type')).toBe('text/html');
    expect(res.headers.get('Vary')).toBe('Accept');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(site.urls).toEqual(['/faq']);
  });

  it('falls back to the HTML when a page has no Markdown', async () => {
    const site = marketingSite({ '/ai': '<html>AI</html>' });
    const res = await routerWith().fetch(accepting('/ai', 'text/markdown'), {
      MARKETING: site.binding,
    });
    expect(await res.text()).toBe('<html>AI</html>');
    expect(res.headers.get('Vary')).toBe('Accept');
    expect(site.urls).toEqual(['/ai.md', '/ai']);
  });

  it('leaves a file, the editor and the api as they were', async () => {
    const site = marketingSite({ '/robots.txt': 'User-agent: *' });
    const editor = recording();
    const api = recording();
    const env = { MARKETING: site.binding, EDITOR: editor.binding, API: api.binding };
    const file = await routerWith().fetch(accepting('/robots.txt', 'text/markdown'), env);
    expect(file.headers.get('Vary')).toBeNull();
    const page = await routerWith().fetch(accepting('/new', 'text/markdown'), env);
    expect(page.headers.get('Vary')).toBeNull();
    const json = await routerWith().fetch(accepting('/api/x', 'text/markdown'), env);
    expect(json.headers.get('Vary')).toBeNull();
    expect(site.urls).toEqual(['/robots.txt']);
    expect(editor.urls).toEqual(['https://www.livediagram.app/new']);
    expect(api.urls).toEqual(['https://www.livediagram.app/api/x']);
  });
});
