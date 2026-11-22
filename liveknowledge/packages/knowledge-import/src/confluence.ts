// A Confluence space's HTML export (docs/specs/020-import-export/knowledgebase-import.md "Confluence"): one `.html`
// file a page, `index.html` listing them as a nested list, each page's breadcrumb naming its parent, and its files
// under `attachments/`. The tree is the index's; a page the index leaves out takes its breadcrumb's last page.

import type { DraftPage, ReadContext, SourceReader } from './draft';
import { parseHtmlDocument } from './html-document';
import { htmlToMarkdown } from './html-to-markdown';
import { readPageSource } from './page-source';
import {
  baseOf,
  compareNames,
  decodeTarget,
  dirOf,
  extOf,
  keyOf,
  resolveFrom,
  stemOf,
} from './paths';

const isHtml = (path: string): boolean => ['html', 'htm'].includes(extOf(path));
const isIndex = (path: string): boolean => /^index\.html?$/i.test(baseOf(path));
const isPage = (path: string): boolean => isHtml(path) && !isIndex(path);

/** A file name as a title: `Release-Process_98765` is `Release Process`. */
export const titleOfConfluenceFile = (path: string): string =>
  stemOf(path)
    .replace(/[_-]\d+$/, '')
    .replace(/[-_+]+/g, ' ')
    .trim() || stemOf(path);

/** A title heading without the space's name before it: `Engineering : Release Process`. */
const withoutSpaceName = (heading: string): string => heading.replace(/^.*? : /, '').trim();

type Listed = { parentId: string | null; title: string; order: number };

/** The key of the archive file an address in `from` leads to, or null. */
function fileKeyOf(from: string, address: string | null): string | null {
  if (!address || /^[a-z][a-z0-9+.-]*:/i.test(address)) return null;
  const path = resolveFrom(dirOf(from), decodeTarget(address.replace(/[?#].*$/, '')));
  return path === null ? null : keyOf(path);
}

const isList = (el: Element): boolean => el.tagName === 'UL' || el.tagName === 'OL';

/** A list item's own link: the first outside the lists nested in it. */
function ownAnchor(item: Element): Element | null {
  for (const child of item.children) {
    if (isList(child)) continue;
    const anchor = child.matches('a[href]') ? child : child.querySelector('a[href]');
    if (anchor) return anchor;
  }
  return null;
}

/** The index's nested list: every page it links, with the page it sits under. */
function readIndex(path: string, doc: Document): Map<string, Listed> {
  const listed = new Map<string, Listed>();
  const walk = (list: Element, parentId: string | null): void => {
    for (const item of list.children) {
      const anchor = ownAnchor(item);
      const id = fileKeyOf(path, anchor?.getAttribute('href') ?? null);
      if (id !== null && !listed.has(id)) {
        listed.set(id, {
          parentId,
          title: anchor!.textContent.replace(/\s+/g, ' ').trim(),
          order: listed.size,
        });
      }
      for (const below of item.children) {
        if (isList(below)) walk(below, id ?? parentId);
      }
    }
  };
  for (const list of doc.querySelectorAll('ul, ol')) {
    if (!list.parentElement!.closest('li')) walk(list, null);
  }
  return listed;
}

async function read(context: ReadContext): Promise<DraftPage[]> {
  const files = [...context.listing.files.values()];
  let listed = new Map<string, Listed>();
  // The index nearest the top: a space's export has one, at its root.
  const index = files
    .filter((file) => isIndex(file.path))
    .toSorted((a, b) => a.path.length - b.path.length)[0];
  if (index) {
    const source = await readPageSource(index, context);
    if (source !== null) listed = readIndex(index.path, parseHtmlDocument(source));
  }
  const drafts: (DraftPage & { order: number })[] = [];
  for (const file of files) {
    if (!isPage(file.path)) continue;
    const source = await readPageSource(file, context);
    if (source === null) continue;
    const id = keyOf(file.path);
    const doc = parseHtmlDocument(source);
    const entry = listed.get(id);
    const heading = doc.querySelector('#title-text')?.textContent ?? '';
    // The breadcrumb's last page that is a file of this archive: the page this one sits under.
    const crumbs = [...doc.querySelectorAll('#breadcrumbs a[href]')]
      .map((anchor) => fileKeyOf(file.path, anchor.getAttribute('href')))
      .filter((key) => key !== null && key !== id && !isIndex(key));
    const body = doc.querySelector('#main-content') ?? doc.body;
    drafts.push({
      id,
      parentId: entry ? entry.parentId : (crumbs.at(-1) ?? null),
      title: entry?.title || withoutSpaceName(heading) || titleOfConfluenceFile(file.path),
      path: file.path,
      paths: [file.path],
      markdown: htmlToMarkdown(body),
      // The page's attachment list sits outside its writing.
      attached: [...doc.querySelectorAll('a[href]')]
        .filter((anchor) => !body.contains(anchor))
        .map((anchor) => anchor.getAttribute('href')!)
        .filter((address) => /(?:^|\/)attachments\//.test(address)),
      warnings: [],
      order: entry ? entry.order : Number.POSITIVE_INFINITY,
    });
  }
  // The index's order, then the pages it leaves out by file name.
  return drafts
    .toSorted((a, b) => a.order - b.order || compareNames(a.path, b.path))
    .map(({ order: _order, ...draft }) => draft);
}

export const confluenceReader: SourceReader = { isPage, read };
