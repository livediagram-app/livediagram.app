import { describe, expect, it } from 'vitest';
import {
  canSplitFlashcardAt,
  flashcardBlocks,
  flashcardSpeakingSeconds,
  flashcardWordCount,
  speakingTimeLabel,
  withFlashcardAdded,
  withFlashcardSplit,
} from './flashcards';
import { articlesOf, newFlashcardFlow, type ArticleBlock, type ArticleFlow } from './article-flow';
import { withArticlePageCount, withPageKindChosen } from './article-pages';
import {
  isFlashcardPage,
  isFlashcardStack,
  layOutPages,
  MAX_PAGES,
  newFlashcardPage,
  pageDimensions,
  pageHasOrientation,
  pageKindOf,
  pageLabel,
  pagesOf,
  pageSizesFor,
  type Page,
} from './page';
import { pageAdded, pageResized, pageTurned } from './pages-edits';
import type { Element } from './index';

const card = (id: string, flow = `f-${id}`): Page => newFlashcardPage(id, flow);
const p = (id: string, text: string, style?: 'title' | 'h1'): ArticleBlock => ({
  id,
  type: 'paragraph',
  ...(style ? { style } : {}),
  runs: [{ text }],
});
const tabOf = (pages: Page[], articles: Record<string, ArticleFlow> = {}) => ({
  elements: [] as Element[],
  pages,
  articles,
});

describe('a flashcard page', () => {
  it('reads as a card: the card size, landscape, its own flow', () => {
    const [read] = pagesOf({
      pages: [{ id: 'c', orientation: 'portrait', size: 'a4', kind: 'flashcard', flow: 'f1' }],
    });
    expect(read).toEqual({
      id: 'c',
      orientation: 'landscape',
      size: 'card',
      kind: 'flashcard',
      flow: 'f1',
    });
    expect(pageKindOf(read!)).toBe('flashcard');
    expect(isFlashcardPage(read!)).toBe(true);
    expect(pageDimensions(read!)).toEqual({ width: 900, height: 540 });
    expect(pageHasOrientation(read!)).toBe(false);
    expect(pageSizesFor('flashcard')).toEqual(['card']);
  });

  it('keeps its name, background and lock, and takes its id as a flow it lacks', () => {
    const [read] = pagesOf({
      pages: [
        {
          id: 'c',
          orientation: 'landscape',
          kind: 'flashcard',
          name: 'Opening',
          locked: true,
          background: { fill: { kind: 'solid', color: '#fef3c7' } },
        },
      ],
    });
    expect(read).toMatchObject({ flow: 'c', name: 'Opening', locked: true });
    expect(read!.background?.fill).toBeDefined();
  });

  it('never shares its flow with another card', () => {
    const pages = pagesOf({ pages: [card('a', 'same'), card('b', 'same'), card('c', 'other')] });
    expect(pages.map((x) => x.flow)).toEqual(['same', 'b', 'other']);
  });

  it('is labelled by its size alone', () => {
    expect(pageLabel(card('a'), 0, 3)).toBe('Page 1 · Flashcard (5:3)');
    expect(pageLabel({ ...card('a'), name: 'Opening' }, 0, 3)).toBe('Opening · Flashcard (5:3)');
  });

  it('makes a stack of the tab whose first page is one', () => {
    expect(isFlashcardStack([card('a')])).toBe(true);
    expect(isFlashcardStack([{ kind: 'article' }])).toBe(false);
    expect(isFlashcardStack([])).toBe(false);
  });

  it('offers no other size and no turn', () => {
    const tab = tabOf([card('a')]);
    expect(pageResized(tab, 'a', 'a4')).toEqual({ refused: 'size_not_offered' });
    expect(pageTurned(tab, 'a', 'portrait')).toEqual({ refused: 'no_orientation' });
  });
});

describe('making cards', () => {
  it('turns the first page into the first card of a stack', () => {
    const tab = {
      elements: [] as Element[],
      pages: [{ id: 'p', orientation: 'portrait' as const }],
    };
    const chosen = withPageKindChosen(tab, 'p', 'flashcard', 'f1')!;
    expect(chosen.pages).toEqual([
      { id: 'p', orientation: 'landscape', size: 'card', kind: 'flashcard', flow: 'f1' },
    ]);
    const doc = articlesOf(chosen)['f1']!;
    expect(doc.style).toEqual({ margins: 'narrow' });
    expect(doc.blocks.map((b) => (b.type === 'paragraph' ? (b.style ?? 'body') : b.type))).toEqual([
      'title',
      'body',
    ]);
  });

  it('keeps the first page’s name and background when it becomes a card', () => {
    const background = { fill: { kind: 'solid' as const, color: '#fef3c7' } };
    const tab = {
      elements: [] as Element[],
      pages: [{ id: 'p', orientation: 'portrait' as const, name: 'Intro', background }],
    };
    const chosen = withPageKindChosen(tab, 'p', 'flashcard', 'f1')!;
    expect(chosen.pages[0]).toMatchObject({ name: 'Intro', background });
  });

  it('adds a card after the last, carrying its background', () => {
    const background = { fill: { kind: 'solid' as const, color: '#fef3c7' } };
    const tab = tabOf([{ ...card('a'), background }], { 'f-a': newFlashcardFlow() });
    const out = pageAdded(tab, 'flashcard', 'b', 'f-b');
    if (!('tab' in out)) throw new Error('refused');
    expect(out.tab.pages!.map((x) => x.id)).toEqual(['a', 'b']);
    expect(pagesOf(out.tab)[1]).toMatchObject({ kind: 'flashcard', flow: 'f-b', background });
    expect(articlesOf(out.tab)['f-b']).toBeDefined();
  });

  it('refuses another kind on a stack, and a card at the page limit', () => {
    const tab = tabOf([card('a')]);
    expect(pageAdded(tab, 'article', 'b', 'f-b')).toEqual({ refused: 'kind_not_offered' });
    const full = tabOf(Array.from({ length: MAX_PAGES }, (_, i) => card(`c${i}`)));
    expect(pageAdded(full, 'flashcard', 'x', 'f-x')).toEqual({ refused: 'page_limit' });
    expect(withFlashcardAdded(tabOf([card('a')]), { id: 'a' }, 'f')).toBeNull();
  });

  it('never grows or shrinks a card for its writing', () => {
    const tab = tabOf([card('a')], { 'f-a': newFlashcardFlow() });
    expect(withArticlePageCount(tab, 'f-a', 3)).toBe(tab);
  });

  it('keeps a card’s writing where it starts when the cards before it move', () => {
    const pages = [card('a'), card('b')];
    const laid = layOutPages(pages);
    expect(laid[1]!.rect.x).toBe(laid[0]!.rect.x + 900 + 96);
  });
});

describe('speaking time', () => {
  it('counts the words of every block', () => {
    const flow: ArticleFlow = {
      blocks: [
        p('t', 'Hello there', 'title'),
        p('a', "It's a well-known fact: 3 things."),
        { id: 'c', type: 'code', text: 'npm run' },
        { id: 'd', type: 'divider' },
      ],
    };
    expect(flashcardWordCount(flow)).toBe(2 + 6 + 2);
  });

  it('takes the words at 130 a minute, rounded up, and keeps the count per writing', () => {
    const words = (n: number): ArticleFlow => ({
      blocks: [p('a', Array.from({ length: n }, () => 'word').join(' '))],
    });
    expect(flashcardSpeakingSeconds(words(0))).toBe(0);
    expect(flashcardSpeakingSeconds(words(13))).toBe(6);
    const flow = words(130);
    expect(flashcardSpeakingSeconds(flow)).toBe(60);
    expect(flashcardSpeakingSeconds(flow)).toBe(60);
  });

  it('says a time under a minute in 5 second steps and minutes after', () => {
    expect(speakingTimeLabel(0)).toBeNull();
    expect(speakingTimeLabel(6)).toBe('10 sec');
    expect(speakingTimeLabel(25)).toBe('25 sec');
    expect(speakingTimeLabel(59)).toBe('55 sec');
    expect(speakingTimeLabel(60)).toBe('1 min');
    expect(speakingTimeLabel(150)).toBe('3 min');
  });
});

describe('text only', () => {
  it('leaves zones and page breaks out of a card’s writing', () => {
    const text = [p('a', 'Hi'), { id: 'd', type: 'divider' as const }];
    expect(flashcardBlocks(text)).toBe(text);
    const mixed: ArticleBlock[] = [
      ...text,
      { id: 'b', type: 'pageBreak' },
      { id: 'z', type: 'zone', zone: 'object', width: 100, height: 100 },
    ];
    expect(flashcardBlocks(mixed).map((b) => b.id)).toEqual(['a', 'd']);
  });
});

describe('Split Onto a New Card', () => {
  const doc: ArticleFlow = {
    blocks: [p('t', 'Opening', 'title'), p('a', 'First'), p('b', 'Second'), p('c', 'Third')],
    style: { margins: 'narrow' },
  };

  it('splits only where the card keeps text past its title', () => {
    expect(canSplitFlashcardAt(doc, 'b')).toBe(true);
    expect(canSplitFlashcardAt(doc, 'a')).toBe(false);
    expect(canSplitFlashcardAt(doc, 't')).toBe(false);
    expect(canSplitFlashcardAt(doc, 'nope')).toBe(false);
  });

  it('moves the writing from the block onto a new card right after, its title continued', () => {
    const background = { fill: { kind: 'solid' as const, color: '#fef3c7' } };
    const tab = tabOf([{ ...card('a'), background }, card('z')], {
      'f-a': doc,
      'f-z': newFlashcardFlow(),
    });
    const out = withFlashcardSplit(tab, 'a', 'b', 'n', 'f-n');
    if (!('tab' in out)) throw new Error('refused');
    expect(pagesOf(out.tab).map((x) => x.id)).toEqual(['a', 'n', 'z']);
    expect(pagesOf(out.tab)[1]).toMatchObject({ kind: 'flashcard', flow: 'f-n', background });
    const articles = articlesOf(out.tab);
    expect(articles['f-a']!.blocks.map((b) => b.id)).toEqual(['t', 'a']);
    const moved = articles['f-n']!;
    expect(moved.style).toEqual({ margins: 'narrow' });
    const texts = moved.blocks.map((b) => ('runs' in b ? b.runs.map((r) => r.text).join('') : ''));
    expect(texts).toEqual(['Opening (continued)', 'Second', 'Third']);
    expect(moved.blocks.some((b) => ['t', 'b', 'c'].includes(b.id))).toBe(false);
  });

  it('adds no title when the card has none with words', () => {
    const untitled: ArticleFlow = { blocks: [p('t', ' ', 'title'), p('a', 'One'), p('b', 'Two')] };
    const out = withFlashcardSplit(tabOf([card('a')], { 'f-a': untitled }), 'a', 'b', 'n', 'f-n');
    if (!('tab' in out)) throw new Error('refused');
    expect(articlesOf(out.tab)['f-n']!.blocks).toHaveLength(1);
  });

  it('refuses a page that is not a card, a locked card, the page limit and nothing to move', () => {
    const tab = tabOf([card('a')], { 'f-a': doc });
    expect(withFlashcardSplit(tab, 'x', 'b', 'n', 'f-n')).toEqual({ refused: 'unknown_page' });
    expect(
      withFlashcardSplit(tabOf([{ id: 'i', orientation: 'portrait' }]), 'i', 'b', 'n', 'f-n'),
    ).toEqual({ refused: 'unknown_page' });
    const locked = tabOf([{ ...card('a'), locked: true }], { 'f-a': doc });
    expect(withFlashcardSplit(locked, 'a', 'b', 'n', 'f-n')).toEqual({ refused: 'locked' });
    expect(withFlashcardSplit(tab, 'a', 'b', 'a', 'f-n')).toEqual({ refused: 'page_limit' });
    const full = tabOf(
      Array.from({ length: MAX_PAGES }, (_, i) => card(i === 0 ? 'a' : `c${i}`)),
      { 'f-a': doc },
    );
    expect(withFlashcardSplit(full, 'a', 'b', 'n', 'f-n')).toEqual({ refused: 'page_limit' });
    expect(withFlashcardSplit(tab, 'a', 'a', 'n', 'f-n')).toEqual({ refused: 'nothing_to_move' });
    expect(withFlashcardSplit(tabOf([card('a')]), 'a', 'b', 'n', 'f-n')).toEqual({
      refused: 'nothing_to_move',
    });
  });
});
