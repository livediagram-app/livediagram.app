// An agent's article write (docs/specs/024-agents/illustrate-for-agents.md "write_article"): an
// article's text from Markdown, replacing or appending, on a new article or a named one, with its
// look. The pages its writing reaches are the editor's to count ("Pages for the writing").
import type { ArticleWrite, IllustrateRefusal } from '@livediagram/api-schema';
import {
  ARTICLE_LOOK_IDS,
  articleFromMarkdown,
  articleNoteIds,
  articlesOf,
  articleTitleOf,
  elementIdsOnPage,
  illustratePagesOf,
  layOutIllustratePages,
  MAX_ARTICLE_BLOCK_TEXT,
  MAX_ARTICLE_BLOCKS,
  nextArticleBlockId,
  nextArticleFlowId,
  nextIllustratePageId,
  offersPageKindChoice,
  pageAdded,
  pageResized,
  pageSizesFor,
  pageTurned,
  withArticleFlow,
  withNoteMarkersRemoved,
  withPageKindChosen,
  withZoneContentsRemoved,
  type ArticleBlock,
  type ArticleFlow,
  type ArticleStyle,
  type ArticleZoneBlock,
  type PageEdit,
  type Tab,
} from '@livediagram/document';
import { enterIllustrate, type IllustrateIds } from './enter';

export type ArticleWriteOutcome =
  | { tab: Tab; flow: string; created: boolean; lines: string[]; switched: boolean }
  | { refusal: IllustrateRefusal };

const refuse = (code: IllustrateRefusal['code'], message: string) => ({
  refusal: { code, message },
});

const nameKey = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const settled = (out: PageEdit<Tab>, before: Tab): Tab => ('tab' in out ? out.tab : before);

export function applyArticleWrite(
  tab: Tab,
  write: ArticleWrite,
  ids: IllustrateIds = {},
): ArticleWriteOutcome {
  const entered = enterIllustrate(tab);
  if ('refusal' in entered) return entered;
  let current = entered.tab;
  const lines: string[] = entered.switched ? ['Switched the tab to Illustrate.'] : [];
  const articles = articlesOf(current);
  const flows = Object.keys(articles);
  const titles = () => flows.map((f) => `"${articleTitleOf(articles[f]!)}" (${f})`).join(', ');

  // Which article.
  let flow: string | undefined;
  if (write.article !== undefined) {
    const key = nameKey(write.article);
    flow =
      flows.find((f) => f === write.article) ??
      flows.find((f) => nameKey(articleTitleOf(articles[f]!)) === key);
    if (!flow)
      return refuse(
        'article_unknown',
        flows.length
          ? `No article "${write.article}". Articles: ${titles()}.`
          : `No article "${write.article}": the tab has none. Leave "article" out to start one.`,
      );
  } else if (!write.new) {
    if (flows.length > 1)
      return refuse(
        'article_ambiguous',
        `The tab has ${flows.length} articles; name one: ${titles()}.`,
      );
    flow = flows[0];
  }

  // A new article: on the fresh tab's empty, unchosen first page, else after the last page.
  const created = flow === undefined;
  if (created) {
    if (write.size && (write.size === 'fit' || !pageSizesFor('article').includes(write.size)))
      return refuse(
        'size_not_offered',
        `An article takes the sizes ${pageSizesFor('article').join(', ')}.`,
      );
    const pages = illustratePagesOf(current);
    const laid = layOutIllustratePages(pages);
    const first = pages[0]!;
    const newFlow = ids.flow?.() ?? nextArticleFlowId(new Set(flows));
    let pageId: string;
    if (
      offersPageKindChoice(pages, first.id, elementIdsOnPage(current.elements, laid, first.id).size)
    ) {
      current = withPageKindChosen(current, first.id, 'article', newFlow)!;
      pageId = first.id;
    } else {
      pageId = ids.page?.() ?? nextIllustratePageId(pages);
      const added = pageAdded(current, 'article', pageId, newFlow);
      if ('refused' in added)
        return refuse('page_limit', 'A tab holds at most 100 pages: delete one first.');
      current = added.tab;
    }
    // A fresh page: neither can be refused (the size was checked, an article turns).
    if (write.size) current = settled(pageResized(current, pageId, write.size), current);
    if (write.orientation)
      current = settled(pageTurned(current, pageId, write.orientation), current);
    flow = newFlow;
  }
  const doc: ArticleFlow = articlesOf(current)[flow!]!;

  // A locked page holds its article as it is.
  if (illustratePagesOf(current).some((p) => p.flow === flow && p.locked))
    return refuse(
      'page_locked',
      'A page of that article is locked: unlock it first (change_pages set { locked: false }).',
    );

  // The writing.
  const read = articleFromMarkdown(write.markdown, doc);
  if ('tooLong' in read)
    return refuse(
      'article_too_large',
      `A paragraph holds at most ${MAX_ARTICLE_BLOCK_TEXT.toLocaleString('en')} characters: split the long one with a blank line.`,
    );
  if ('unknownZone' in read)
    return refuse(
      'zone_unknown',
      `The article has no zone "${read.unknownZone}". Its zones are the [zone <id>] lines the pages view prints.`,
    );
  const append = write.mode === 'append';
  let blocks: ArticleBlock[];
  let gone: ArticleZoneBlock[] = [];
  if (append) {
    // An empty new article's placeholder Title and paragraph give way to what is appended.
    blocks = [...(created ? [] : doc.blocks), ...read.blocks];
  } else {
    blocks = read.blocks;
    gone = doc.blocks.filter(
      (b): b is ArticleZoneBlock => b.type === 'zone' && read.droppedZones.includes(b.id),
    );
  }
  // An article always has a block to write in.
  if (blocks.length === 0) blocks = [{ id: nextArticleBlockId(), type: 'paragraph', runs: [] }];
  if (blocks.length > MAX_ARTICLE_BLOCKS)
    return refuse(
      'article_too_large',
      `That makes ${blocks.length.toLocaleString('en')} blocks; an article holds at most ${MAX_ARTICLE_BLOCKS.toLocaleString('en')}.`,
    );
  // The look.
  const style: ArticleStyle = { ...doc.style };
  if (write.look && ARTICLE_LOOK_IDS.includes(write.look)) style.look = write.look;
  if (write.accent) style.accent = write.accent;
  if (write.pageNumbers !== undefined) style.pageNumbers = write.pageNumbers;
  const next: ArticleFlow = Object.keys(style).length ? { blocks, style } : { blocks };

  // Zones left out go with their elements; margin notes whose text is gone lose their markers.
  const notesBefore = articleNoteIds({ [flow!]: doc });
  if (gone.length) current = withZoneContentsRemoved(current, flow!, gone);
  current = withArticleFlow(current, flow!, next);
  const notesAfter = articleNoteIds({ [flow!]: next });
  const lostNotes = new Set([...notesBefore].filter((id) => !notesAfter.has(id)));
  const before = current.elements.length;
  current = withNoteMarkersRemoved(current, lostNotes);
  const markersGone = before - current.elements.length;

  const title = articleTitleOf(next);
  lines.push(
    `${created ? 'Started' : append ? 'Appended to' : 'Wrote'} the article "${title}" (${flow}): ${append ? `${read.blocks.length} blocks added, ` : ''}${blocks.length} blocks.`,
  );
  if (read.tables)
    lines.push(
      `Wrote ${read.tables} Markdown table${read.tables === 1 ? '' : 's'} as a list: an article's text holds no tables (put a table element on a page with update_document).`,
    );
  if (gone.length)
    lines.push(
      `Removed ${gone.length} zone${gone.length === 1 ? '' : 's'} and what was in them: ${gone.map((z) => z.id).join(', ')}.`,
    );
  if (markersGone)
    lines.push(
      `Removed ${markersGone} margin note${markersGone === 1 ? '' : 's'} whose text is gone.`,
    );
  lines.push('The writing flows onto as many pages as it needs when it is laid out in the editor.');
  return { tab: current, flow: flow!, created, lines, switched: entered.switched };
}
