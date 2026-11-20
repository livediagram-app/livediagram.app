// One planned page as the tab it is stored as (docs/specs/020-import-export/blueprints/knowledgebase-import.md
// "A page's tab"): its Markdown read the way Markdown import and `write_article` read it (articleFromMarkdown), its
// `knowledgebase-page:<key>` links as page-link runs and its `knowledgebase-picture:<index>` pictures as picture
// zones, parked as Word import parks them until the editor first lays the writing out. Pure: the page ids and the
// stored pictures are handed in, so every page is written once, with its links, in one pass.

import { MAX_TAB_BYTES } from '@liveknowledge/api-schema';
import {
  ARTICLE_MARKDOWN_MAX,
  ARTICLE_ZONE_MAX,
  KNOWLEDGEBASE_FLOW,
  MAX_ARTICLE_BLOCKS,
  NEW_PAGE_NAME,
  articleFromMarkdown,
  articleMarginPx,
  knowledgebasePage,
  layOutPages,
  nextArticleBlockId,
  pageDimensions,
  truncateName,
  type ArticleBlock,
  type ArticleRun,
  type ArticleZoneBlock,
  type Element,
  type Tab,
} from '@liveknowledge/document';
import { PAGE_LINK_KEY } from '@liveknowledge/knowledge';
import {
  PAGE_LINK_SCHEME,
  PICTURE_SCHEME,
  type PlannedPage,
} from '@liveknowledge/knowledge-import';
import type { ImportImageOutcome } from '@/lib/import-images';
import { parkedZoneAt, pictureElement, pictureZoneSize } from '@/lib/office-import/build-article';
import { tabBytes } from '@/lib/office-import/tab-bytes';

/** What a page's picture came to: stored, or why not. Absent for one that was never asked for. */
export type PictureResult = ImportImageOutcome | undefined;

export type ImportedPageInput = {
  page: PlannedPage;
  /** The tab id this page takes. */
  id: string;
  /** The page it lands under, absent at the top level. */
  parent?: string;
  /** The tab id of a planned page by its key; undefined for one that is not being written. */
  pageIdOf: (key: string) => string | undefined;
  /** One per `page.pictures`, in its order. */
  pictures: readonly PictureResult[];
  /** The look the pages take (the open page's theme and font), as a new page takes it. */
  seed?: Partial<Tab>;
  /** An Offline knowledgebase never reaches the api, so its pages are not held to the api's size. */
  offline?: boolean;
};

export type ImportedPage = { ok: true; tab: Tab; flow: string } | { ok: false; reason: string };

// A page link's address while the Markdown is read: the article reader keeps only http, https and mailto, so the
// plan's own scheme would be dropped. `.invalid` never resolves (RFC 2606), and the nonce keeps a page that
// happens to write such an address from being read as a link to a page.
const sentinelOf = (nonce: string) => `https://page-${nonce}.invalid/`;

const PAGE_LINK = new RegExp(`\\]\\(${PAGE_LINK_SCHEME}(p\\d+)\\)`, 'g');
// `![alt](knowledgebase-picture:<index>)`: the alt may hold an escaped bracket.
const PICTURE = new RegExp(`!\\[((?:\\\\.|[^\\]\\\\\\n])*)\\]\\(${PICTURE_SCHEME}(\\d+)\\)`, 'g');
const ZONE_LINE = /^\s*\[zone [^\]\s]{1,64}\]\s*$/;
const FENCE = /^\s*(`{3,}|~{3,})/;

type PlacedPicture = { zone: string; index: number; alt: string };

// The Markdown with each stored picture as a `[zone <id>]` line of its own (the form articleFromMarkdown keeps a
// zone by) and each picture that was not stored as its alt text. A picture alone on its line becomes the zone line;
// one inside other writing (a sentence, a list item, a table row) leaves the line and its zone follows the block,
// since a zone is a block of its own. Fenced code is left as written. One pass over the lines.
function placePictures(
  markdown: string,
  stored: (index: number) => boolean,
  nextZone: () => string,
): { markdown: string; placed: PlacedPicture[] } {
  const placed: PlacedPicture[] = [];
  const out: string[] = [];
  // Zones waiting for the block they were written in to end.
  let waiting: string[] = [];
  let fence: string | null = null;
  const flush = () => {
    for (const zone of waiting) out.push('', `[zone ${zone}]`, '');
    waiting = [];
  };
  for (const line of markdown.split('\n')) {
    const mark = FENCE.exec(line)?.[1];
    if (fence) {
      if (mark && mark[0] === fence[0] && mark.length >= fence.length) fence = null;
      out.push(line);
      continue;
    }
    if (mark) {
      flush();
      fence = mark;
      out.push(line);
      continue;
    }
    if (line.trim() === '') flush();
    // A line the source wrote that reads as a zone line names no zone of this page: kept as its words.
    if (ZONE_LINE.test(line)) {
      out.push(line.replace('[zone', '\\[zone'));
      continue;
    }
    if (!line.includes(PICTURE_SCHEME)) {
      out.push(line);
      continue;
    }
    const zones: string[] = [];
    const rest = line.replace(PICTURE, (_all, alt: string, at: string) => {
      const index = Number(at);
      if (!stored(index)) return alt;
      const zone = nextZone();
      zones.push(zone);
      placed.push({ zone, index, alt });
      return '';
    });
    if (zones.length === 0) out.push(rest);
    else if (rest.trim() === '') for (const zone of zones) out.push('', `[zone ${zone}]`, '');
    else {
      out.push(rest);
      waiting.push(...zones);
    }
  }
  flush();
  return { markdown: out.join('\n'), placed };
}

// Every run of the writing through `change`; blocks without runs pass as they are.
function mapRuns(blocks: ArticleBlock[], change: (run: ArticleRun) => ArticleRun): ArticleBlock[] {
  const runsOf = (runs: readonly ArticleRun[]) => runs.map(change);
  return blocks.map((block) => {
    if (block.type === 'paragraph' || block.type === 'list') {
      return { ...block, runs: runsOf(block.runs) };
    }
    if (block.type !== 'table') return block;
    return {
      ...block,
      rows: block.rows.map((row) => ({ ...row, cells: row.cells.map(runsOf) })),
    };
  });
}

const fail = (reason: string): ImportedPage => ({ ok: false, reason });

/** The tab a planned page is stored as, or why it cannot be one. */
export function importedPageTab(input: ImportedPageInput): ImportedPage {
  const { page, id, parent, pageIdOf, pictures } = input;
  if (page.markdown.length > ARTICLE_MARKDOWN_MAX) {
    return fail(
      `Its writing is longer than a page takes (${ARTICLE_MARKDOWN_MAX.toLocaleString('en-GB')} characters).`,
    );
  }
  const sheet = knowledgebasePage();
  const laid = layOutPages([sheet])[0]!;
  const textWidth = pageDimensions(laid).width - 2 * articleMarginPx(undefined);

  const taken = new Set<string>();
  const nextZone = () => {
    const zone = nextArticleBlockId(taken);
    taken.add(zone);
    return zone;
  };
  const sentinel = sentinelOf(crypto.randomUUID());
  const { markdown, placed } = placePictures(
    page.markdown.replace(PAGE_LINK, (_all, key: string) => `](${sentinel}${key})`),
    (index) => pictures[index]?.ok === true,
    nextZone,
  );

  // The zones the Markdown names, parked a slot each, and the picture in each.
  const elements: Element[] = [];
  const zones: ArticleZoneBlock[] = placed.map(({ zone, index, alt }, slot) => {
    const outcome = pictures[index];
    const picture = { path: page.pictures[index]!.path, widthPx: 0, heightPx: 0, alt };
    const size = pictureZoneSize(picture, outcome, textWidth, ARTICLE_ZONE_MAX);
    const at = parkedZoneAt(sheet.id, slot);
    elements.push(
      pictureElement(picture, outcome, { x: laid.rect.x + at.x, y: laid.rect.y + at.y, ...size }),
    );
    return { id: zone, type: 'zone', zone: 'object', ...size, at };
  });

  const read = articleFromMarkdown(markdown, { blocks: zones });
  if ('tooLong' in read) return fail('One of its paragraphs is longer than a page takes.');
  if ('unknownZone' in read) return fail('Its writing could not be read.');
  // The Title block says the page's name, as every page's does; the name is capped as every name is.
  const name = truncateName(page.title) || NEW_PAGE_NAME;
  const ids = new Set(read.blocks.map((b) => b.id));
  const title: ArticleBlock = {
    id: nextArticleBlockId(ids),
    type: 'paragraph',
    style: 'title',
    runs: [{ text: name }],
  };
  ids.add(title.id);
  const body: ArticleBlock[] =
    read.blocks.length > 0
      ? mapRuns(read.blocks, (run) => {
          if (!run.href?.startsWith(sentinel)) return run;
          const { href, ...rest } = run;
          const target = pageIdOf(href.slice(sentinel.length));
          // A page that is not being written has no address to keep: its link reads as its words.
          return target ? ({ ...rest, [PAGE_LINK_KEY]: target } as ArticleRun) : rest;
        })
      : // A page always has a paragraph to write in.
        [{ id: nextArticleBlockId(ids), type: 'paragraph', runs: [] }];
  const blocks = [title, ...body];
  if (blocks.length > MAX_ARTICLE_BLOCKS) {
    return fail(
      `It makes ${blocks.length.toLocaleString('en-GB')} blocks; a page holds at most ${MAX_ARTICLE_BLOCKS.toLocaleString('en-GB')}.`,
    );
  }
  const tab: Tab = {
    id,
    name,
    elements,
    defaultTextSize: 'sm',
    templateChosen: true,
    ...input.seed,
    ...(parent ? { parent } : {}),
    pages: [sheet],
    articles: { [KNOWLEDGEBASE_FLOW]: { blocks } },
  };
  if (!input.offline && tabBytes(tab) > MAX_TAB_BYTES) {
    return fail('It is larger than a page may be.');
  }
  return { ok: true, tab, flow: KNOWLEDGEBASE_FLOW };
}
