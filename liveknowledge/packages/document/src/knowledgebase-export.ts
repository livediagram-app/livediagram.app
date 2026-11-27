// One page as its file in a Markdown export of a whole knowledgebase (docs/specs/020-import-export/knowledgebase-export.md
// "What the zip holds"; the app's Markdown Folder and the CLI's `export <knowledgebase> <dir>` both write it): front
// matter with the page's title and key facts, the title as a `#` heading, then its writing as Markdown, each link to
// another page a relative link to that page's file, and each picture where it sits in the writing. Pure: the files,
// the pictures' paths and the facts are handed in.
import type { ArticleBlock, ArticleFlow } from '@liveworkspace/article/article-flow';
import { articleRunsText } from '@liveworkspace/article/article-footnotes';
import { articleToMarkdown } from '@liveworkspace/article/article-markdown-io';
import {
  relativePagePath,
  withPageAddressesAsLinks,
  withPageLinksAsFiles,
  withPageLinksResolved,
} from './article-page-links';
import { zoneCanvasRect, zoneMemberIds } from './article-zones';
import { layOutPages, pagesOf } from './page';
import { coverImageId } from './page-cover';
import { savedArticlesOf } from './page-draft';
import { pageFlowOf } from './page-title';
import type { Element, Tab } from './index';

type Picture = { id: string; imageId: string; alt: string };

/** What a page's front matter says beside its title, each left out when unknown. */
export type ExportPageFacts = {
  /** The page's owner, by name. */
  owner?: string;
  /** When the page was last saved, ms since the epoch. */
  updated?: number;
  /** When the page was last verified, ms since the epoch. */
  verified?: number;
  /** The page's labels, by name. */
  labels?: readonly string[];
};

export type PageFileOptions = {
  /** The page's title: its name in the tree. Else its Title block's text, else its stored name. */
  title?: string;
  facts?: ExportPageFacts;
  /** `[[Title]]` written as text: the page of that title, first in tree order (`pageByTitleIn`). */
  pageByTitle?: (title: string) => string | undefined;
  /** An ordinary link's address that names a page of this knowledgebase (`pageOfAddress`). */
  pageOfHref?: (href: string) => string | undefined;
  /** A page's current title, for the words of a link to it. */
  titleOf?: (tab: string) => string | undefined;
};

/** Where a picture was written, as a path from the export's root; an address (`https://...`) when only that is
 *  known; null when it could not be read, which writes its description in italics instead. */
export type PictureAt = (imageId: string) => string | null;

/** The title a page with no name of any kind is exported as. */
export const UNTITLED_EXPORT_PAGE = 'Untitled Page';

// The line articleToMarkdown writes for a zone of the writing.
const ZONE_LINE = /^\[zone ([^\]\s]{1,64})\]$/;

const pictureOf = (element: Element): Picture | null => {
  const { imageId, alt, name } = element as { imageId?: unknown; alt?: unknown; name?: unknown };
  if (element.type !== 'image' || typeof imageId !== 'string' || !imageId) return null;
  const said = typeof alt === 'string' && alt ? alt : typeof name === 'string' ? name : '';
  return { id: element.id, imageId, alt: said.replace(/[[\]\n]/g, ' ').trim() };
};

/** The pictures a page shows in its writing, each once, in the order its elements hold them. */
export function pagePictures(tab: Pick<Tab, 'elements'>): string[] {
  const ids = tab.elements.flatMap((e) => pictureOf(e)?.imageId ?? []);
  return [...new Set(ids)];
}

/** Every picture a page's file names: its cover's first, then its writing's. */
export function pageFilePictures(tab: Pick<Tab, 'elements' | 'cover'>): string[] {
  const cover = coverImageId(tab.cover);
  return [...new Set([...(cover ? [cover] : []), ...pagePictures(tab)])];
}

// The page's one article as saved (never an edit's draft, page-draft.ts): the flow its first article page shows,
// else its first.
function flowOf(tab: Tab): ArticleFlow | undefined {
  const flows = savedArticlesOf(tab);
  return flows[pageFlowOf(tab) ?? Object.keys(flows)[0] ?? ''];
}

const styled = (blocks: readonly ArticleBlock[], style: 'title' | 'subtitle') =>
  blocks.find((b) => b.type === 'paragraph' && b.style === style);

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

// A front matter value: a JSON string is a YAML double-quoted scalar, so a colon, a quote or a `#` reads back whole.
const quoted = (text: string) => JSON.stringify(text);

/** The front matter a page's file opens with: title, then the facts that are known. */
export function pageFrontMatter(
  title: string,
  more: ExportPageFacts & { subtitle?: string; cover?: string } = {},
): string {
  const lines = [`title: ${quoted(title)}`];
  if (more.subtitle) lines.push(`subtitle: ${quoted(more.subtitle)}`);
  if (more.owner) lines.push(`owner: ${quoted(more.owner)}`);
  const date = (ms: number | undefined) =>
    ms !== undefined && Number.isFinite(ms) ? quoted(new Date(ms).toISOString()) : null;
  const updated = date(more.updated);
  if (updated) lines.push(`updated: ${updated}`);
  const verified = date(more.verified);
  if (verified) lines.push(`verified: ${verified}`);
  if (more.labels?.length) lines.push(`labels: [${more.labels.map(quoted).join(', ')}]`);
  if (more.cover) lines.push(`cover: ${quoted(more.cover)}`);
  return ['---', ...lines, '---'].join('\n');
}

// The writing's Markdown with each zone's line given over to the pictures standing in it, and the pictures no zone
// holds; the pictures placed are added to `placed`.
function writingMarkdown(
  tab: Tab,
  flow: ArticleFlow,
  pictures: readonly Picture[],
  line: (p: Picture) => string,
  placed: Set<string>,
): string {
  const laid = layOutPages(pagesOf(tab));
  const inZone = new Map<string, Picture[]>();
  for (const block of flow.blocks) {
    if (block.type !== 'zone') continue;
    const rect = zoneCanvasRect(laid, block);
    const members = rect ? zoneMemberIds(tab.elements, rect) : new Set<string>();
    const held = pictures.filter((p) => members.has(p.id) && !placed.has(p.id));
    held.forEach((p) => placed.add(p.id));
    inZone.set(block.id, held);
  }
  // A code block's lines are its own: a line in one that reads `[zone x]` is code, not a zone (the writer opens a
  // fence with its backticks and a language, and closes it with the backticks alone).
  let fence: string | null = null;
  let afterEmptyZone = false;
  return articleToMarkdown(flow)
    .split('\n')
    .flatMap((text) => {
      const dropBlank = afterEmptyZone;
      afterEmptyZone = false;
      if (fence !== null) {
        if (text === fence) fence = null;
        return [text];
      }
      const opening = /^`{3,}/.exec(text);
      if (opening) {
        fence = opening[0];
        return [text];
      }
      const zone = ZONE_LINE.exec(text);
      const held = zone ? inZone.get(zone[1]!) : undefined;
      if (held) {
        // The blank line after a zone that holds no picture goes with it.
        afterEmptyZone = held.length === 0;
        return held.map(line);
      }
      return text === '' && dropBlank ? [] : [text];
    })
    .join('\n');
}

/**
 * The page's file. `files` is every exported page's path from the export's root (`pageFilePaths`), `file` this
 * page's, and `pictureAt` where each picture was written. A page link, a `[[Title]]` naming a page and an address
 * of a page (`options`) become relative links to that page's file; one to a page with no file is its words.
 */
export function pageFileMarkdown(
  tab: Tab,
  file: string,
  files: ReadonlyMap<string, string>,
  pictureAt: PictureAt,
  options: PageFileOptions = {},
): string {
  const stored = flowOf(tab);
  const blocks = stored?.blocks ?? [];
  const titleBlock = styled(blocks, 'title');
  const subtitleBlock = styled(blocks, 'subtitle');
  const title =
    oneLine(options.title ?? '') ||
    (titleBlock?.type === 'paragraph' ? oneLine(articleRunsText(titleBlock.runs)) : '') ||
    oneLine(tab.name) ||
    UNTITLED_EXPORT_PAGE;
  const subtitle =
    subtitleBlock?.type === 'paragraph' ? oneLine(articleRunsText(subtitleBlock.runs)) : '';

  const hrefOf = (address: string) =>
    /^[a-z][a-z0-9+.-]*:/i.test(address) ? address : relativePagePath(file, address);
  const line = (p: Picture) => {
    const at = pictureAt(p.imageId);
    return at === null ? (p.alt ? `_${p.alt}_` : '') : `![${p.alt}](${hrefOf(at)})`;
  };
  const pictures = tab.elements.flatMap((e) => pictureOf(e) ?? []);
  const placed = new Set<string>();
  let markdown = '';
  if (stored) {
    // The title and the subtitle are said above the writing, so the writer is handed the rest.
    let flow: ArticleFlow = {
      ...stored,
      blocks: blocks.filter((b) => b !== titleBlock && b !== subtitleBlock),
    };
    if (options.pageByTitle)
      flow = { ...flow, blocks: withPageLinksResolved(flow.blocks, options.pageByTitle) };
    if (options.pageOfHref) flow = withPageAddressesAsLinks(flow, options.pageOfHref);
    flow = withPageLinksAsFiles(
      flow,
      (page) => {
        const to = files.get(page);
        return to === undefined ? undefined : relativePagePath(file, to);
      },
      options.titleOf,
    );
    markdown = writingMarkdown(tab, flow, pictures, line, placed);
  }
  const loose = pictures
    .filter((p) => !placed.has(p.id))
    .map(line)
    .filter(Boolean);
  const cover = coverImageId(tab.cover);
  const coverAt = cover ? pictureAt(cover) : null;
  const head = pageFrontMatter(title, {
    ...options.facts,
    ...(subtitle ? { subtitle } : {}),
    ...(coverAt ? { cover: hrefOf(coverAt) } : {}),
  });
  const body = [`# ${title}`, markdown.trim(), ...(loose.length ? [loose.join('\n\n')] : [])]
    .filter(Boolean)
    .join('\n\n');
  return `${head}\n\n${body}\n`;
}
