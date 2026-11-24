// Writes a site's Markdown for agents after `next build` (liveworkspace/docs/specs/010-site/markdown-for-agents.md
// "What the Markdown holds"): each sitemap page's Markdown beside its exported HTML, and the site's /llms.txt.
//
//   node ../../../packages/agent-markdown/scripts/agent-markdown.ts --out out --name livediagram \
//     [--base-path /help] [--trailing-slash] [--skip /status,/telemetry] [--link 'Help Centre=/help/llms.txt']
//     [--every-page]
//
// The pages are the sitemap's, or with --every-page every page of the export (the help centre, whose app scopes hold
// pages their sitemaps leave to the canonical address).
//
// Run by path, never through node_modules: Node strips types only outside it.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

import { llmsTxt, planFiles, planPages, sitemapUrls, type LlmsPage } from '../src/build.ts';
import { pageToMarkdown } from '../src/convert.ts';

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: 'out' },
    name: { type: 'string' },
    'base-path': { type: 'string', default: '' },
    'trailing-slash': { type: 'boolean', default: false },
    skip: { type: 'string', default: '' },
    link: { type: 'string', multiple: true, default: [] },
    'every-page': { type: 'boolean', default: false },
  },
});

const out = resolve(values.out);
const basePath = values['base-path'];
const started = process.hrtime.bigint();
const sitemap = join(out, 'sitemap.xml');
if (!existsSync(sitemap)) throw new Error(`[agent-markdown] no sitemap.xml in ${out}`);
const xml = readFileSync(sitemap, 'utf8');
const planOptions = {
  basePath,
  trailingSlash: values['trailing-slash'],
  skip: values.skip ? values.skip.split(',') : [],
};
const htmlFiles = () =>
  readdirSync(out, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.html'))
    .map((file) => relative(out, join(out, file)).split(sep).join('/'));
const pages = values['every-page']
  ? planFiles(htmlFiles(), new URL(sitemapUrls(xml)[0] ?? 'https://invalid').origin, planOptions)
  : planPages(xml, planOptions);

const listed: LlmsPage[] = [];
let bytes = 0;
let summary = '';
const missing: string[] = [];
for (const page of pages) {
  const file = join(out, page.html);
  if (!existsSync(file)) {
    missing.push(page.html);
    continue;
  }
  const result = pageToMarkdown(readFileSync(file, 'utf8'), page.url);
  if (!result) {
    missing.push(page.html);
    continue;
  }
  writeFileSync(join(out, page.markdown), result.markdown);
  bytes += Buffer.byteLength(result.markdown);
  if (page.markdown === 'index.md') summary = result.description;
  listed.push({
    title: result.title,
    description: result.description,
    markdownUrl: page.markdownUrl,
  });
}
if (listed.length === 0) throw new Error(`[agent-markdown] no page in ${sitemap} gave Markdown`);

const origin = new URL(pages[0]!.url).origin;
const links = values.link.map((spec) => {
  const eq = spec.indexOf('=');
  return { name: spec.slice(0, eq), url: new URL(spec.slice(eq + 1), origin).toString() };
});
writeFileSync(
  join(out, 'llms.txt'),
  llmsTxt(listed, { name: values.name ?? new URL(origin).host, summary, links }),
);

const ms = Number(process.hrtime.bigint() - started) / 1e6;
console.log(
  `[agent-markdown] ${listed.length} pages, ${Math.round(bytes / 1024)} KiB of Markdown, llms.txt, in ${Math.round(ms)} ms` +
    (missing.length
      ? `; no Markdown for ${missing.length} (no file, no content, a redirect or noindex): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ', ...' : ''}`
      : ''),
);
