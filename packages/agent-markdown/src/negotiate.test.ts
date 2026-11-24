import { cpuBudgetMs, cpuGrowthLimitMs, cpuLeastMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it, vi } from 'vitest';
import {
  ACCEPT_READ_LIMIT,
  MARKDOWN_CONTENT_TYPE,
  isPagePath,
  markdownPathOf,
  markdownResponse,
  negotiatePage,
  prefersMarkdown,
  requestFor,
  withVaryAccept,
} from './negotiate';

// liveworkspace/docs/specs/010-site/markdown-for-agents.md "How it is negotiated" and "The answer".

describe('prefersMarkdown', () => {
  it.each([
    'text/markdown',
    'TEXT/MARKDOWN',
    'text/markdown, text/html',
    'text/html, text/markdown',
    'text/markdown, */*;q=0.8',
    'text/markdown;charset=utf-8',
    'text/html;q=0.5, text/markdown;q=0.9',
    'text/markdown;q=0.5, text/*;q=0.4',
    'text/markdown;q=1.000',
    'text/markdown ; q = 0.7 , text/html ; q = 0.7',
    'text/markdown;level=1;q=0.8, */*;q=0.1',
  ])('picks Markdown for %s', (accept) => {
    expect(prefersMarkdown(accept)).toBe(true);
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['*/*'],
    ['text/*'],
    ['text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'],
    ['text/html, text/markdown;q=0.5'],
    ['text/markdown;q=0.5, */*'],
    ['text/markdown;q=0.4, text/*;q=0.5'],
    ['text/markdown;q=0'],
    ['text/markdown;q=0, text/html;q=0'],
    ['text/markdown;q=abc'],
    ['text/markdown;q=2'],
    ['text/markdown;q=0x1'],
    ['text/markdown;q=1e0'],
    ['text/markdown;q=0.12345'],
    ['text/markdown;q=0..1'],
    ['text/markdown;q='],
    ['text/x-markdown'],
    ['application/markdown-ish'],
  ])('keeps HTML for %s', (accept) => {
    expect(prefersMarkdown(accept)).toBe(false);
  });

  it('takes the most specific range for HTML: text/html over text/* over */*', () => {
    expect(prefersMarkdown('text/markdown;q=0.5, text/html;q=0.4, */*')).toBe(true);
    expect(prefersMarkdown('text/markdown;q=0.5, text/*;q=0.6, */*;q=0.1')).toBe(false);
  });

  it('takes the higher weight when a range is named twice', () => {
    expect(prefersMarkdown('text/markdown;q=0.1, text/markdown, text/html')).toBe(true);
  });

  it('ignores a parameter that is not q, and a part with no type', () => {
    expect(prefersMarkdown('text/markdown;variant=gfm;flag, , text/html;q=0.9')).toBe(true);
  });

  it(`reads only the first ${ACCEPT_READ_LIMIT} characters`, () => {
    const padded = `${'a/b, '.repeat(ACCEPT_READ_LIMIT / 5)}text/markdown`;
    expect(prefersMarkdown(padded)).toBe(false);
    expect(prefersMarkdown(`text/markdown, ${padded}`)).toBe(true);
  });

  it('decides a browser header on the fast path, and a long hostile header in linear time', () => {
    const browser =
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
    expect(
      cpuLeastMsOf(() => {
        for (let i = 0; i < 10_000; i++) prefersMarkdown(browser);
      }),
    ).toBeLessThan(cpuBudgetMs(20));
    const hostile = (n: number) => `text/markdown${';'.repeat(n)}${' ,'.repeat(n)}`;
    const short = hostile(1_000);
    const long = hostile(100_000);
    const small = cpuLeastMsOf(() => {
      for (let i = 0; i < 200; i++) prefersMarkdown(short);
    });
    const large = cpuLeastMsOf(() => {
      for (let i = 0; i < 200; i++) prefersMarkdown(long);
    });
    // The header is cut at ACCEPT_READ_LIMIT first, so a hundred times the input is the same work.
    expect(large).toBeLessThan(cpuGrowthLimitMs(small, 2, 2));
  });
});

describe('paths', () => {
  it('negotiates pages only, never files', () => {
    expect(isPagePath('/')).toBe(true);
    expect(isPagePath('/faq')).toBe(true);
    expect(isPagePath('/help/tabs/using-tabs/')).toBe(true);
    expect(isPagePath('/faq.md')).toBe(false);
    expect(isPagePath('/_next/static/chunks/a.js')).toBe(false);
    expect(isPagePath('/v1.2/notes')).toBe(true);
  });

  it('finds the Markdown beside the HTML', () => {
    expect(markdownPathOf('/')).toBe('/index.md');
    expect(markdownPathOf('/pricing')).toBe('/pricing.md');
    expect(markdownPathOf('/alternatives/miro')).toBe('/alternatives/miro.md');
    expect(markdownPathOf('/pricing/')).toBe('/pricing/index.md');
    expect(markdownPathOf('/tabs/using-tabs/', { trailingSlash: true })).toBe(
      '/tabs/using-tabs/index.md',
    );
    expect(markdownPathOf('/tabs/using-tabs', { trailingSlash: true })).toBe(
      '/tabs/using-tabs/index.md',
    );
  });

  it('asks for another file of the site with the method and headers kept', () => {
    const request = new Request('https://x.test/faq?a=1', {
      method: 'HEAD',
      headers: { Accept: 'text/markdown', 'If-None-Match': '"1"' },
    });
    const other = requestFor(request, '/faq.md');
    expect(other.url).toBe('https://x.test/faq.md?a=1');
    expect(other.method).toBe('HEAD');
    expect(other.headers.get('If-None-Match')).toBe('"1"');
  });
});

describe('the answer’s headers', () => {
  it('adds Vary: Accept once, beside what was there', () => {
    const varied = withVaryAccept(new Response('x', { headers: { Vary: 'x-help-app' } }));
    expect(varied.headers.get('Vary')).toBe('x-help-app, Accept');
    expect(withVaryAccept(varied)).toBe(varied);
    const star = new Response('x', { headers: { Vary: '*' } });
    expect(withVaryAccept(star)).toBe(star);
  });

  it('leaves a WebSocket upgrade as it is', () => {
    const upgrade = { status: 101, headers: new Headers() } as Response;
    expect(withVaryAccept(upgrade)).toBe(upgrade);
  });

  it('types a Markdown file with its charset, keeping its other headers', () => {
    const file = new Response('# A', {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Length': '3',
        'X-Content-Type-Options': 'nosniff',
      },
    });
    const res = markdownResponse(file);
    expect(res.headers.get('Content-Type')).toBe(MARKDOWN_CONTENT_TYPE);
    expect(res.headers.get('Vary')).toBe('Accept');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});

describe('negotiatePage', () => {
  const site = (files: Record<string, string>, status = 200) =>
    vi.fn((path: string) =>
      Promise.resolve(
        path in files
          ? new Response(status === 304 ? null : files[path], {
              status,
              headers: { 'Content-Type': 'text/markdown' },
            })
          : new Response('missing', { status: 404 }),
      ),
    );
  const html = () => new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } });
  const req = (accept?: string, method = 'GET') =>
    new Request('https://x.test/faq', { method, headers: accept ? { Accept: accept } : {} });

  it('answers the Markdown to a request that prefers it', async () => {
    const file = site({ '/faq.md': '# FAQ' });
    const res = await negotiatePage(req('text/markdown'), '/faq', file, html);
    expect(res.headers.get('Content-Type')).toBe(MARKDOWN_CONTENT_TYPE);
    expect(res.headers.get('Vary')).toBe('Accept');
    expect(await res.text()).toBe('# FAQ');
  });

  it('answers a HEAD with the Markdown’s headers', async () => {
    const res = await negotiatePage(
      req('text/markdown', 'HEAD'),
      '/faq',
      site({ '/faq.md': '' }),
      html,
    );
    expect(res.headers.get('Content-Type')).toBe(MARKDOWN_CONTENT_TYPE);
  });

  it('passes a revalidated Markdown file’s 304 on', async () => {
    const res = await negotiatePage(
      req('text/markdown'),
      '/faq',
      site({ '/faq.md': '' }, 304),
      html,
    );
    expect(res.status).toBe(304);
    expect(res.headers.get('Vary')).toBe('Accept');
  });

  it('answers the HTML, varied, with no extra fetch, to a browser and to */*', async () => {
    for (const accept of [undefined, '*/*', 'text/html,*/*;q=0.8']) {
      const file = site({ '/faq.md': '# FAQ' });
      const res = await negotiatePage(req(accept), '/faq', file, html);
      expect(res.headers.get('Content-Type')).toBe('text/html');
      expect(res.headers.get('Vary')).toBe('Accept');
      expect(file).not.toHaveBeenCalled();
    }
  });

  it('falls back to the HTML when the Markdown is missing or its fetch fails', async () => {
    const missing = await negotiatePage(req('text/markdown'), '/faq', site({}), html);
    expect(missing.headers.get('Content-Type')).toBe('text/html');
    const failing = await negotiatePage(
      req('text/markdown'),
      '/faq',
      () => Promise.reject(new Error('down')),
      html,
    );
    expect(failing.headers.get('Content-Type')).toBe('text/html');
    expect(failing.headers.get('Vary')).toBe('Accept');
  });

  it('never negotiates a file, or a method other than GET and HEAD', async () => {
    const file = site({ '/a.js.md': 'x', '/faq.md': 'x' });
    const asset = new Response('js');
    expect(await negotiatePage(req('text/markdown'), '/a.js', file, () => asset)).toBe(asset);
    const post = await negotiatePage(req('text/markdown', 'POST'), '/faq', file, html);
    expect(post.headers.get('Content-Type')).toBe('text/html');
    expect(file).not.toHaveBeenCalled();
  });

  it('finds a trailing-slash site’s Markdown in the page’s folder', async () => {
    const file = site({ '/all/tabs/index.md': '# Tabs' });
    const res = await negotiatePage(req('text/markdown'), '/all/tabs/', file, html, {
      trailingSlash: true,
    });
    expect(await res.text()).toBe('# Tabs');
  });
});
