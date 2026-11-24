// Markdown for agents, the build's plan (liveworkspace/docs/specs/010-site/markdown-for-agents.md): which exported
// pages get a Markdown file, where each file goes, and the site's /llms.txt. Pure, so it is tested without a build;
// scripts/agent-markdown.ts does the reading and writing.
import { markdownPathOf } from './negotiate.ts';

export type BuildOptions = {
  /** The path the site is served under (`/help`), stripped from each sitemap address to find its file. */
  basePath?: string;
  /** The site's pages end in a slash (`trailingSlash: true`): `<page>/index.html`. */
  trailingSlash?: boolean;
  /** Sitemap paths left out (pages drawn in the browser, whose export holds no content), before `basePath` is cut. */
  skip?: readonly string[];
};

/** One page of the plan: its address, the exported HTML file and the Markdown file beside it, both relative to the
 *  export's folder, and the Markdown's own address. */
export type PlannedPage = {
  url: string;
  html: string;
  markdown: string;
  markdownUrl: string;
};

/** Every `<loc>` of a sitemap, in order. Read with indexOf, left to right. */
export function sitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  let at = 0;
  for (;;) {
    const start = xml.indexOf('<loc>', at);
    if (start < 0) break;
    const end = xml.indexOf('</loc>', start);
    if (end < 0) break;
    urls.push(
      xml
        .slice(start + 5, end)
        .trim()
        .replaceAll('&amp;', '&'),
    );
    at = end + 6;
  }
  return urls;
}

/** The pages of a sitemap that get Markdown, each with its files. A page outside the site (another origin's address,
 *  or outside `basePath`) and a skipped one are left out; an address listed twice is planned once. */
export function planPages(xml: string, options: BuildOptions = {}): PlannedPage[] {
  const { basePath = '', trailingSlash = false, skip = [] } = options;
  const skipped = new Set(skip.map(bare));
  const seen = new Set<string>();
  const pages: PlannedPage[] = [];
  for (const url of sitemapUrls(xml)) {
    const { pathname, origin } = new URL(url);
    const path = bare(pathname);
    if (skipped.has(path) || seen.has(path)) continue;
    if (basePath && path !== basePath && !path.startsWith(`${basePath}/`)) continue;
    seen.add(path);
    const inside = path.slice(basePath.length) || '/';
    const html =
      inside === '/'
        ? 'index.html'
        : trailingSlash
          ? `${inside.slice(1)}/index.html`
          : `${inside.slice(1)}.html`;
    const page = inside === '/' ? '/' : trailingSlash ? `${inside}/` : inside;
    const markdown = markdownPathOf(page, { trailingSlash }).slice(1);
    pages.push({ url, html, markdown, markdownUrl: `${origin}${basePath}/${markdown}` });
  }
  return pages;
}

/**
 * Every page of an export, from its HTML files (paths relative to the export, `/`-separated), for a site whose pages
 * are not all in its sitemap (the help centre: an article several apps share is listed on its canonical address only,
 * but each app's copy is a page too). The not-found pages and Next's own files (`_next/`, `_not-found`) are left out.
 */
export function planFiles(
  files: readonly string[],
  origin: string,
  options: BuildOptions = {},
): PlannedPage[] {
  const { basePath = '', trailingSlash = false, skip = [] } = options;
  const skipped = new Set(skip.map(bare));
  const pages: PlannedPage[] = [];
  for (const html of [...files].sort()) {
    if (!html.endsWith('.html') || html.split('/').some((part) => part.startsWith('_'))) continue;
    if (html === '404.html' || html.endsWith('/404.html')) continue;
    if (trailingSlash && html !== 'index.html' && !html.endsWith('/index.html')) continue;
    const stem = html.slice(0, -'.html'.length);
    const page =
      stem === 'index' ? '/' : trailingSlash ? `/${stem.slice(0, -'index'.length)}` : `/${stem}`;
    if (skipped.has(bare(page))) continue;
    const markdown = `${stem}.md`;
    pages.push({
      url: `${origin}${basePath}${page}`,
      html,
      markdown,
      markdownUrl: `${origin}${basePath}/${markdown}`,
    });
  }
  return pages;
}

export type LlmsPage = { title: string; description: string; markdownUrl: string };

export type LlmsOptions = {
  /** The site's name, the file's heading. */
  name: string;
  /** What the site is: its front page's description. */
  summary: string;
  /** Other lists to read, by name: the help centre's from a site or a marketing page. */
  links?: readonly { name: string; url: string; description?: string }[];
};

/** `/a/b/` → `/a/b`, `/` stays `/`: a loop, not a regex anchored after a repeat. */
function bare(pathname: string): string {
  let end = pathname.length;
  while (end > 1 && pathname[end - 1] === '/') end--;
  return pathname.slice(0, end);
}

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();
const linkText = (text: string) => oneLine(text).replaceAll('[', '(').replaceAll(']', ')');

/** The site's /llms.txt (llmstxt.org): its name, what it is, how to ask for Markdown, and every Markdown page. */
export function llmsTxt(pages: readonly LlmsPage[], options: LlmsOptions): string {
  const line = (title: string, url: string, description?: string) =>
    `- [${linkText(title)}](${url})${description ? `: ${oneLine(description)}` : ''}`;
  const parts = [
    `# ${oneLine(options.name)}`,
    '',
    ...(options.summary ? [`> ${oneLine(options.summary)}`, ''] : []),
    'Every page below answers Markdown to a request that sends `Accept: text/markdown`, at its own address; the links' +
      ' are the same Markdown as files.',
    '',
    '## Pages',
    '',
    ...pages.map((p) => line(p.title, p.markdownUrl, p.description)),
  ];
  if (options.links?.length)
    parts.push(
      '',
      '## Optional',
      '',
      ...options.links.map((l) => line(l.name, l.url, l.description)),
    );
  return `${parts.join('\n')}\n`;
}
