// An agent's article write (docs/specs/024-agents/pages-for-agents.md "write_article"): an
// article's text from Markdown, replacing or appending, on a new article or a named one, with its
// look. The pages its writing reaches are the editor's to count ("Pages for the writing"). On a
// stack of flashcards (docs/specs/007-editor/flashcards.md "Agents") it writes a card the same way,
// text only.
import type { ArticleWrite, PagesRefusal } from '@livedocuments/api-schema';
import {
  ARTICLE_LOOK_IDS,
  articleFromMarkdown,
  articleNoteIds,
  articlesOf,
  articleTitleOf,
  elementIdsOnPage,
  flashcardCut,
  pagesOf,
  layOutPages,
  MAX_ARTICLE_BLOCK_TEXT,
  MAX_ARTICLE_BLOCKS,
  nextArticleBlockId,
  nextArticleFlowId,
  nextPageId,
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
  tabPageKind,
  type PageEdit,
  type Tab,
} from '@livedocuments/document';
import { enterPages, type PagesIds } from './enter';
import { kindNotOffered } from './page-changes';

type ArticleWriteOutcome =
  { tab: Tab; flow: string; created: boolean; lines: string[] } | { refusal: PagesRefusal };

const refuse = (code: PagesRefusal['code'], message: string) => ({
  refusal: { code, message },
});

const nameKey = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

// A fresh article page: its size was checked against the article's and an article turns, so neither
// edit can be refused.
const fresh = (out: PageEdit<Tab>): Tab => (out as { tab: Tab }).tab;

export function applyArticleWrite(
  tab: Tab,
  write: ArticleWrite,
  ids: PagesIds = {},
): ArticleWriteOutcome {
  const locked = enterPages(tab);
  if (locked) return locked;
  let current = tab;
  const lines: string[] = [];
  const articles = articlesOf(current);
  const flows = Object.keys(articles);
  const titles = () => flows.map((f) => `"${articleTitleOf(articles[f]!)}" (${f})`).join(', ');
  // A stack of flashcards: each card its own writing, named as a card.
  const stack = tabPageKind(pagesOf(current)) === 'flashcard';
  const noun = stack ? 'card' : 'article';

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
          ? `No ${noun} "${write.article}". ${stack ? 'Cards' : 'Articles'}: ${titles()}.`
          : `No article "${write.article}": the tab has none. Leave "article" out to start one.`,
      );
  } else if (!write.new) {
    if (flows.length > 1)
      return refuse(
        'article_ambiguous',
        `The tab has ${flows.length} ${noun}s; name one: ${titles()}.`,
      );
    flow = flows[0];
  }

  // A new article: on the fresh tab's empty, unchosen first page, else after the last page. A new
  // card goes after a stack's last card.
  const created = flow === undefined;
  if (created && stack) {
    if (write.size && write.size !== 'card')
      return refuse('size_not_offered', 'A flashcard takes the size card.');
    if (write.orientation === 'portrait')
      return refuse('size_not_offered', 'A flashcard is landscape: it takes no orientation.');
    const newFlow = ids.flow?.() ?? nextArticleFlowId(new Set(flows));
    const pageId = ids.page?.() ?? nextPageId(pagesOf(current));
    const added = pageAdded(current, 'flashcard', pageId, newFlow);
    if ('refused' in added)
      return refuse('page_limit', 'A tab holds at most 100 pages: delete one first.');
    current = added.tab;
    flow = newFlow;
  } else if (created) {
    const pages = pagesOf(current);
    const laid = layOutPages(pages);
    const first = pages[0]!;
    const takesFirst = offersPageKindChoice(
      pages,
      first.id,
      elementIdsOnPage(current.elements, laid, first.id).size,
    );
    // One kind a tab: a new article joins only an article tab, or the fresh tab's unchosen first page.
    if (!takesFirst && tabPageKind(pages) !== 'article')
      return refuse('kind_not_offered', kindNotOffered(current, 'article'));
    if (write.size && (write.size === 'fit' || !pageSizesFor('article').includes(write.size)))
      return refuse(
        'size_not_offered',
        `An article takes the sizes ${pageSizesFor('article').join(', ')}.`,
      );
    const newFlow = ids.flow?.() ?? nextArticleFlowId(new Set(flows));
    let pageId: string;
    if (takesFirst) {
      current = withPageKindChosen(current, first.id, 'article', newFlow)!;
      pageId = first.id;
    } else {
      pageId = ids.page?.() ?? nextPageId(pages);
      const added = pageAdded(current, 'article', pageId, newFlow);
      if ('refused' in added)
        return refuse('page_limit', 'A tab holds at most 100 pages: delete one first.');
      current = added.tab;
    }
    if (write.size) current = fresh(pageResized(current, pageId, write.size));
    if (write.orientation) current = fresh(pageTurned(current, pageId, write.orientation));
    flow = newFlow;
  }
  const doc: ArticleFlow = articlesOf(current)[flow!]!;

  // A locked page holds its article as it is.
  if (pagesOf(current).some((p) => p.flow === flow && p.locked))
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
  // Front matter an append sets in place: the article's own title or subtitle block.
  let headsSet = 0;
  if (append) {
    // An empty new article's placeholder Title and paragraph give way to what is appended. A `[zone <id>]` line
    // names a zone the article already holds, which stays where it is: appended again, the article held two blocks
    // of one id.
    const kept = new Set(read.keptZones);
    const added = read.blocks.filter((b) => !(b.type === 'zone' && kept.has(b.id)));
    // Front matter (the title and subtitle blocks it reads first) sets the article's title and subtitle, never a
    // title block mid-article.
    let front = 0;
    while (front < added.length && frontStyleOf(added[front]!)) front++;
    blocks = created ? [] : [...doc.blocks];
    for (const head of added.slice(0, front)) {
      const set = withHeadingSet(blocks, head);
      blocks = set.blocks;
      if (set.replaced) headsSet++;
    }
    blocks.push(...added.slice(front));
  } else {
    blocks = read.blocks;
    gone = doc.blocks.filter(
      (b): b is ArticleZoneBlock => b.type === 'zone' && read.droppedZones.includes(b.id),
    );
  }
  // A card holds text only: zones, page breaks and contents are left out, tables written as lists.
  const cut = stack ? flashcardCut(blocks) : { blocks, tables: 0, leftOut: 0 };
  const leftOut = cut.leftOut;
  // Each table written as a list adds its rows less the one block it was.
  const fromTables = cut.blocks.length - blocks.length + leftOut;
  blocks = cut.blocks;
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
    `${created ? 'Started' : append ? 'Appended to' : 'Wrote'} the ${noun} "${title}" (${flow}): ${append ? `${read.blocks.length - read.keptZones.length - headsSet - leftOut + fromTables} blocks added, ` : ''}${blocks.length} blocks.`,
  );
  if (cut.tables)
    lines.push(`Wrote Markdown tables as lists (${cut.tables}): a card holds text only.`);
  if (leftOut)
    lines.push(`Left out zones, page breaks and contents (${leftOut}): a card holds text only.`);
  if (gone.length)
    lines.push(`Removed zones and what was in them: ${gone.map((z) => z.id).join(', ')}.`);
  if (markersGone) lines.push(`Removed margin notes whose text is gone (${markersGone}).`);
  // How many pages it takes is said by the caller, which estimates the layout (pages-summary.ts).
  return { tab: current, flow: flow!, created, lines };
}

// A front-matter block: the title or subtitle paragraph `articleFromMarkdown` reads first (a body never reads as one).
const frontStyleOf = (b: ArticleBlock): 'title' | 'subtitle' | undefined =>
  b.type === 'paragraph' && (b.style === 'title' || b.style === 'subtitle') ? b.style : undefined;

// The article's first block of `head`'s style takes its text (keeping its id); with none, `head` goes first, or a
// subtitle after the title.
function withHeadingSet(
  blocks: ArticleBlock[],
  head: ArticleBlock,
): { blocks: ArticleBlock[]; replaced: boolean } {
  const style = frontStyleOf(head);
  const at = blocks.findIndex((b) => frontStyleOf(b) === style);
  const old = blocks[at];
  if (old?.type === 'paragraph' && head.type === 'paragraph') {
    const next = [...blocks];
    next[at] = { ...old, runs: head.runs };
    return { blocks: next, replaced: true };
  }
  const title = style === 'subtitle' ? blocks.findIndex((b) => frontStyleOf(b) === 'title') : -1;
  const next = [...blocks];
  next.splice(title + 1, 0, head);
  return { blocks: next, replaced: false };
}
