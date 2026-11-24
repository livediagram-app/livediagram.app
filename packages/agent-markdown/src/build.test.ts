import { describe, expect, it } from 'vitest';
import { llmsTxt, planFiles, planPages, sitemapUrls } from './build';

// liveworkspace/docs/specs/010-site/markdown-for-agents.md "Which pages answer Markdown" and "/llms.txt".

const sitemap = (...urls: string[]) =>
  `<?xml version="1.0"?><urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join('')}</urlset>`;

describe('sitemapUrls', () => {
  it('reads every address in order, unescaped', () => {
    expect(sitemapUrls(sitemap('https://a.test', 'https://a.test/x?a=1&amp;b=2'))).toEqual([
      'https://a.test',
      'https://a.test/x?a=1&b=2',
    ]);
  });

  it('stops at an unclosed address', () => {
    expect(sitemapUrls('<loc>https://a.test</loc><loc>https://b.test')).toEqual(['https://a.test']);
  });
});

describe('planPages', () => {
  it('plans a site without trailing slashes, skipping and deduplicating', () => {
    const xml = sitemap(
      'https://www.liveworkspace.app/',
      'https://www.liveworkspace.app/compare',
      'https://www.liveworkspace.app/community',
      'https://www.liveworkspace.app/status/',
      'https://www.liveworkspace.app/compare/',
    );
    expect(planPages(xml, { skip: ['/community', '/status/'] })).toEqual([
      {
        url: 'https://www.liveworkspace.app/',
        html: 'index.html',
        markdown: 'index.md',
        markdownUrl: 'https://www.liveworkspace.app/index.md',
      },
      {
        url: 'https://www.liveworkspace.app/compare',
        html: 'compare.html',
        markdown: 'compare.md',
        markdownUrl: 'https://www.liveworkspace.app/compare.md',
      },
    ]);
  });

  it('plans a trailing-slash site under a base path, leaving out addresses outside it', () => {
    const xml = sitemap(
      'https://www.livediagram.app/help/',
      'https://www.livediagram.app/help/tabs/using-tabs/',
      'https://www.livediagram.app/elsewhere/',
    );
    expect(planPages(xml, { basePath: '/help', trailingSlash: true })).toEqual([
      {
        url: 'https://www.livediagram.app/help/',
        html: 'index.html',
        markdown: 'index.md',
        markdownUrl: 'https://www.livediagram.app/help/index.md',
      },
      {
        url: 'https://www.livediagram.app/help/tabs/using-tabs/',
        html: 'tabs/using-tabs/index.html',
        markdown: 'tabs/using-tabs/index.md',
        markdownUrl: 'https://www.livediagram.app/help/tabs/using-tabs/index.md',
      },
    ]);
  });
});

describe('planFiles', () => {
  it('plans every page of a trailing-slash export, never a not-found page or Next’s own', () => {
    const files = [
      'tabs/using-tabs/index.html',
      'index.html',
      '404.html',
      'tabs/404.html',
      '_not-found/index.html',
      '_next/static/x.html',
      'og/card.png',
      'stray.html',
      'skipped/index.html',
    ];
    expect(
      planFiles(files, 'https://www.livediagram.app', {
        basePath: '/help',
        trailingSlash: true,
        skip: ['/skipped/'],
      }),
    ).toEqual([
      {
        url: 'https://www.livediagram.app/help/',
        html: 'index.html',
        markdown: 'index.md',
        markdownUrl: 'https://www.livediagram.app/help/index.md',
      },
      {
        url: 'https://www.livediagram.app/help/tabs/using-tabs/',
        html: 'tabs/using-tabs/index.html',
        markdown: 'tabs/using-tabs/index.md',
        markdownUrl: 'https://www.livediagram.app/help/tabs/using-tabs/index.md',
      },
    ]);
  });

  it('plans an export without trailing slashes', () => {
    expect(planFiles(['faq.html', 'index.html'], 'https://a.test').map((p) => p.url)).toEqual([
      'https://a.test/faq',
      'https://a.test/',
    ]);
  });
});

describe('llmsTxt', () => {
  it('lists every Markdown page, then the other lists', () => {
    const text = llmsTxt(
      [
        {
          title: 'Home [beta]',
          description: 'What it is.',
          markdownUrl: 'https://a.test/index.md',
        },
        { title: 'FAQ', description: '', markdownUrl: 'https://a.test/faq.md' },
      ],
      {
        name: 'livediagram',
        summary: 'A free canvas,\n  live.',
        links: [{ name: 'Help Centre', url: 'https://a.test/help/llms.txt' }],
      },
    );
    expect(text).toBe(
      [
        '# livediagram',
        '',
        '> A free canvas, live.',
        '',
        'Every page below answers Markdown to a request that sends `Accept: text/markdown`, at its own address; the links are the same Markdown as files.',
        '',
        '## Pages',
        '',
        '- [Home (beta)](https://a.test/index.md): What it is.',
        '- [FAQ](https://a.test/faq.md)',
        '',
        '## Optional',
        '',
        '- [Help Centre](https://a.test/help/llms.txt)',
        '',
      ].join('\n'),
    );
  });

  it('leaves out an empty summary and the optional list', () => {
    expect(llmsTxt([], { name: 'x', summary: '' })).toBe(
      '# x\n\nEvery page below answers Markdown to a request that sends `Accept: text/markdown`, at its own address; the links are the same Markdown as files.\n\n## Pages\n\n',
    );
  });
});
