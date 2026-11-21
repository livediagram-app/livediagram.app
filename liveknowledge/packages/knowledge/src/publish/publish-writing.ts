// A page's saved writing as the public site shows it (docs/specs/030-knowledgebase/publishing.md "What goes public",
// blueprint P11 to P13 and P22): safe HTML built from the blocks, never from stored markup. Every text is escaped,
// every attribute is one this file writes, a link is a web address the article model allows or a page of the same
// site, and what never goes public is dropped here: a margin note's mark, its id, any block id, a zone's picture.
import {
  articleRunsText,
  isArticleHex,
  isSafeArticleHref,
  pageOfRun,
  type ArticleBlock,
  type ArticleListBlock,
  type ArticleRun,
} from '@liveknowledge/document';
import { blockText } from '../writing-text';
import { addressFrom, uniqueAddress } from './publish-address';

export const PUBLISHED_DESCRIPTION_MAX = 160;

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Text made safe for HTML, in an element or an attribute. */
export function escapeHtml(text: string): string {
  let out = '';
  for (const c of text) out += ESCAPES[c] ?? c;
  return out;
}

/** Where a page link goes: the published page's path, or null for a page that is not published. */
export type PageHref = (tabId: string) => string | null;

export type PublishedWriting = {
  /** The writing as HTML, the page's title left out. */
  html: string;
  /** Its words, for search. */
  text: string;
  /** Its first words, for search engines. Empty for a page with no words after its title. */
  description: string;
};

// Writing's headings are the page's sections: the page's title is the document's one h1.
const HEADING_TAG = { h1: 'h2', h2: 'h3', h3: 'h4' } as const;
const ALIGNED = new Set(['center', 'right', 'justify']);

type Footnotes = { count: number; notes: string[] };

function runHtml(run: ArticleRun, href: PageHref, footnotes: Footnotes): string {
  if (run.fn !== undefined) {
    let refs = '';
    for (let i = 0; i < run.text.length; i++) {
      footnotes.notes.push(run.fn);
      const n = ++footnotes.count;
      refs += `<sup class="fn"><a href="#fn-${n}" id="fnref-${n}">${n}</a></sup>`;
    }
    return refs;
  }
  let html = escapeHtml(run.text).replace(/\n/g, '<br>');
  if (run.sup) html = `<sup>${html}</sup>`;
  else if (run.sub) html = `<sub>${html}</sub>`;
  if (run.s) html = `<s>${html}</s>`;
  if (run.u) html = `<u>${html}</u>`;
  if (run.i) html = `<em>${html}</em>`;
  if (run.b) html = `<strong>${html}</strong>`;
  if (run.code) html = `<code>${html}</code>`;
  const styles = [
    ...(isArticleHex(run.color) ? [`color:${run.color}`] : []),
    ...(isArticleHex(run.hl) ? [`background-color:${run.hl}`] : []),
  ];
  if (styles.length) html = `<span style="${styles.join(';')}">${html}</span>`;
  const page = pageOfRun(run);
  if (page !== undefined) {
    const to = href(page);
    return to === null ? html : `<a href="${escapeHtml(to)}">${html}</a>`;
  }
  if (isSafeArticleHref(run.href))
    return `<a href="${escapeHtml(run.href.trim())}" rel="noopener">${html}</a>`;
  return html;
}

const runsHtml = (runs: readonly ArticleRun[], href: PageHref, footnotes: Footnotes) =>
  runs.map((r) => runHtml(r, href, footnotes)).join('');

const alignOf = (align: string | undefined) =>
  align !== undefined && ALIGNED.has(align) ? ` style="text-align:${align}"` : '';

type Heading = { level: 1 | 2 | 3; text: string; anchor: string };

function tocHtml(headings: readonly Heading[], depth: number): string {
  const shown = headings.filter((h) => h.level <= depth);
  if (shown.length === 0) return '';
  const items = shown
    .map(
      (h) =>
        `<li class="toc-${h.level}"><a href="#${escapeHtml(h.anchor)}">${escapeHtml(h.text)}</a></li>`,
    )
    .join('');
  return `<nav class="toc" aria-label="Contents"><ol>${items}</ol></nav>`;
}

const LIST_TAG: Readonly<Record<ArticleListBlock['list'], 'ul' | 'ol'>> = {
  bullet: 'ul',
  numbered: 'ol',
  todo: 'ul',
};

/** The writing of one page, from its blocks (the saved writing), as the public site draws it. */
export function publishedWriting(
  blocks: readonly ArticleBlock[],
  href: PageHref,
): PublishedWriting {
  // The first Title block is the page's title, drawn by the page itself.
  const titleAt = blocks.findIndex((b) => b.type === 'paragraph' && b.style === 'title');
  const body = titleAt === -1 ? blocks : blocks.filter((_, i) => i !== titleAt);

  // Headings first, so a contents block anywhere can list them and each has one anchor.
  const anchors = new Set<string>();
  const headingOf = new Map<ArticleBlock, Heading>();
  for (const b of body) {
    if (b.type !== 'paragraph') continue;
    const level = b.style === 'h1' ? 1 : b.style === 'h2' ? 2 : b.style === 'h3' ? 3 : 0;
    if (level === 0) continue;
    const text = articleRunsText(b.runs).trim();
    const anchor = uniqueAddress(addressFrom(text, 60, 'section'), anchors);
    anchors.add(anchor);
    headingOf.set(b, { level, text, anchor });
  }
  const headings = [...headingOf.values()];

  const footnotes: Footnotes = { count: 0, notes: [] };
  let html = '';
  // The lists open at the current block, deepest last.
  const open: { tag: 'ul' | 'ol'; kind: string; level: number }[] = [];
  const closeLists = (above: number) => {
    while (open.length && open[open.length - 1]!.level > above) {
      html += `</li></${open.pop()!.tag}>`;
    }
  };
  for (const b of body) {
    if (b.type !== 'list') closeLists(-1);
    switch (b.type) {
      case 'paragraph': {
        const inner = runsHtml(b.runs, href, footnotes);
        const heading = headingOf.get(b);
        if (heading) {
          const tag = HEADING_TAG[`h${heading.level}`];
          html += `<${tag} id="${escapeHtml(heading.anchor)}"${alignOf(b.align)}>${inner}</${tag}>`;
        } else if (b.style === 'quote') html += `<blockquote><p>${inner}</p></blockquote>`;
        else if (b.style === 'subtitle') html += `<p class="lead"${alignOf(b.align)}>${inner}</p>`;
        else if (b.style === 'title') html += `<h2${alignOf(b.align)}>${inner}</h2>`;
        else html += `<p${alignOf(b.align)}>${inner}</p>`;
        break;
      }
      case 'list': {
        const level = Math.max(0, Math.floor(b.level ?? 0));
        const tag = LIST_TAG[b.list];
        // Close what is deeper, and a list of another kind at this level.
        closeLists(level);
        const top = open[open.length - 1];
        if (top && top.level === level && top.kind !== b.list) {
          html += `</li></${open.pop()!.tag}>`;
        }
        const check =
          b.list === 'todo'
            ? `<input type="checkbox" disabled${b.checked ? ' checked' : ''} aria-label="${b.checked ? 'Done' : 'Not done'}"> `
            : '';
        const item = `${check}${runsHtml(b.runs, href, footnotes)}`;
        const same = open[open.length - 1];
        if (same && same.level === level) html += `</li><li>${item}`;
        else {
          html += `<${tag}${b.list === 'todo' ? ' class="todo"' : ''}><li>${item}`;
          open.push({ tag, kind: b.list, level });
        }
        break;
      }
      case 'code':
        html += `<pre><code${b.lang ? ` class="language-${escapeHtml(b.lang)}"` : ''}>${escapeHtml(b.text)}</code></pre>`;
        break;
      case 'divider':
        html += '<hr>';
        break;
      case 'table': {
        const cell = (tag: 'th' | 'td', runs: readonly ArticleRun[]) =>
          `<${tag}>${runsHtml(runs, href, footnotes)}</${tag}>`;
        const [first, ...rest] = b.rows;
        const head = b.header && first ? first : null;
        const rows = head ? rest : b.rows;
        html += '<div class="table"><table>';
        if (head)
          html += `<thead><tr>${head.cells.map((c) => cell('th', c)).join('')}</tr></thead>`;
        html += `<tbody>${rows.map((r) => `<tr>${r.cells.map((c) => cell('td', c)).join('')}</tr>`).join('')}</tbody>`;
        html += '</table></div>';
        break;
      }
      case 'toc':
        html += tocHtml(headings, b.depth ?? 3);
        break;
      // A zone holds a picture, chart or drawing, which are not published; a page break draws nothing on a page.
      default:
        break;
    }
  }
  closeLists(-1);
  if (footnotes.notes.length)
    html += `<ol class="footnotes">${footnotes.notes
      .map(
        (note, i) =>
          `<li id="fn-${i + 1}">${escapeHtml(note)} <a href="#fnref-${i + 1}" aria-label="Back to the text">↩</a></li>`,
      )
      .join('')}</ol>`;

  const lines: string[] = [];
  for (const b of body) {
    const text = blockText(b).trim();
    if (text) lines.push(text);
  }
  const text = lines.join('\n');
  return { html, text, description: describe(text) };
}

/** The first words of `text`, whitespace collapsed, cut at a word to PUBLISHED_DESCRIPTION_MAX with an ellipsis. */
export function describe(text: string): string {
  let flat = '';
  let space = false;
  for (const c of text) {
    if (c === ' ' || c === '\n' || c === '\t' || c === '\r') space = flat.length > 0;
    else {
      if (space) flat += ' ';
      flat += c;
      space = false;
    }
    if (flat.length > PUBLISHED_DESCRIPTION_MAX) break;
  }
  if (flat.length <= PUBLISHED_DESCRIPTION_MAX) return flat;
  const cut = flat.lastIndexOf(' ', PUBLISHED_DESCRIPTION_MAX - 1);
  return `${flat.slice(0, cut > 0 ? cut : PUBLISHED_DESCRIPTION_MAX - 1)}…`;
}
