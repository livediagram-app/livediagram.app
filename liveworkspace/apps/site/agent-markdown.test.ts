import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import sitemap from './app/sitemap';
import worker from './worker/index';

// Markdown for agents (liveworkspace/docs/specs/010-site/markdown-for-agents.md): the site's Worker runs first only on
// the pages that answer Markdown. Those are the sitemap's pages but the ones the build skips (drawn in the browser), and
// /pricing (listed only where Pro is on, so named whatever this test's build of the flag says).
const wrangler = readFileSync(new URL('./wrangler.toml', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  scripts: { build: string };
};
const build = manifest.scripts.build;

function runWorkerFirst(): string[][] {
  return wrangler
    .split('\n')
    .filter((line) => line.startsWith('run_worker_first'))
    .map((line) => JSON.parse(line.slice(line.indexOf('=') + 1)) as string[]);
}

describe('the Markdown pages', () => {
  const skipped = build.match(/--skip (\S+)/)![1]!.split(',');

  it('builds Markdown for the sitemap, skipping the pages drawn in the browser', () => {
    expect(build).toContain('packages/agent-markdown/scripts/agent-markdown.ts --out out');
    expect(skipped).toEqual(['/community', '/status', '/telemetry']);
  });

  it('runs the Worker first on exactly those pages, in production and staging', () => {
    const pages = new Set(
      sitemap()
        .map((entry) => new URL(entry.url).pathname)
        .filter((path) => !skipped.includes(path)),
    );
    pages.add('/pricing');
    const lists = runWorkerFirst();
    expect(lists).toHaveLength(2);
    for (const list of lists) expect(new Set(list)).toEqual(pages);
    expect(wrangler).toContain('main = "worker/index.ts"');
    expect(wrangler.match(/binding = "ASSETS"/g)).toHaveLength(2);
  });
});

describe('the Worker', () => {
  const assets = {
    fetch: (request: Request) => {
      const { pathname } = new URL(request.url);
      if (pathname === '/compare.md')
        return Promise.resolve(
          new Response('# Comparison', { headers: { 'Content-Type': 'text/markdown' } }),
        );
      return Promise.resolve(
        new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } }),
      );
    },
  };
  const get = (accept: string) =>
    new Request('https://www.liveworkspace.app/compare', { headers: { Accept: accept } });

  it('answers the Markdown to an agent and the HTML to a browser, both varied', async () => {
    const markdown = await worker.fetch(get('text/markdown'), { ASSETS: assets });
    expect(markdown.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(markdown.headers.get('Vary')).toBe('Accept');
    expect(await markdown.text()).toBe('# Comparison');
    const html = await worker.fetch(get('text/html,*/*;q=0.8'), { ASSETS: assets });
    expect(html.headers.get('Content-Type')).toBe('text/html');
    expect(html.headers.get('Vary')).toBe('Accept');
  });
});
