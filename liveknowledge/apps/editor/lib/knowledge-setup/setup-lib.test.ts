// Describe to Set Up's pure parts (docs/specs/030-knowledgebase/describe-to-set-up.md): when a knowledgebase is
// empty, the Review step's ticks and titles, the limits, the plan the write path is handed, and the words.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { KNOWLEDGEBASE_FLOW, MAX_KNOWLEDGEBASE_PAGES, type Tab } from '@liveknowledge/document';
import type { KnowledgeSetupPage } from '@liveknowledge/api-schema';
import {
  EMPTY_SCAN_BLOCKS,
  knowledgebaseIsEmpty,
  pageIsUntouched,
  untouchedOnlyPage,
} from './setup-empty';
import { plainLine, setupPageMarkdown, setupPlan, withRoomUnderHeadings } from './setup-plan';
import {
  reviewPages,
  setupLimitRefusal,
  setupLimitText,
  tickedPages,
  titleOf,
  withTick,
  withTitle,
} from './setup-tree';
import {
  DESCRIBE_CHIPS,
  DESCRIBE_COUNT_FROM,
  DESCRIBE_EXAMPLE,
  SETUP_BUTTON,
  SETUP_BUTTON_LINE,
  createLabel,
  describeHint,
  setupAiLine,
  setupFailureWords,
  setupTitle,
} from './setup-words';

const para = (id: string, text: string, style?: 'title' | 'h1') => ({
  id,
  type: 'paragraph' as const,
  ...(style ? { style } : {}),
  runs: text ? [{ text }] : [],
});
const tab = (id: string, blocks: unknown[] = [para('t', id, 'title'), para('b', '')]): Tab =>
  ({
    id,
    name: id,
    elements: [],
    articles: { [KNOWLEDGEBASE_FLOW]: { blocks } },
  }) as unknown as Tab;
const all = (tabs: Tab[]) => new Set(tabs.map((t) => t.id));

describe('an empty knowledgebase', () => {
  it('is at most three pages, none with writing beyond a title', () => {
    const one = [tab('Start Here')];
    expect(knowledgebaseIsEmpty(one, all(one))).toBe(true);
    const three = [tab('a'), tab('b'), tab('c')];
    expect(knowledgebaseIsEmpty(three, all(three))).toBe(true);
    const four = [...three, tab('d')];
    expect(knowledgebaseIsEmpty(four, all(four))).toBe(false);
    expect(knowledgebaseIsEmpty([], new Set())).toBe(false);
  });

  it('is not empty once any page holds a word, a list, a table or a picture', () => {
    const written = [tab('a'), tab('b', [para('t', 'b', 'title'), para('x', 'Hello')])];
    expect(knowledgebaseIsEmpty(written, all(written))).toBe(false);
    const spaces = [tab('a', [para('t', 'a', 'title'), para('x', '   ')])];
    expect(knowledgebaseIsEmpty(spaces, all(spaces))).toBe(true);
    const list = [
      tab('a', [para('t', 'a', 'title'), { id: 'l', type: 'list', list: 'bullet', runs: [] }]),
    ];
    expect(knowledgebaseIsEmpty(list, all(list))).toBe(false);
    const picture = [{ ...tab('a'), elements: [{ id: 'e1' }] } as unknown as Tab];
    expect(knowledgebaseIsEmpty(picture, all(picture))).toBe(false);
    // A page with no article at all (a page made before its first save) is untouched.
    expect(pageIsUntouched({ id: 'n', name: 'n', elements: [] })).toBe(true);
  });

  it('is not called empty while a page has not been loaded: no page is loaded to find out', () => {
    const tabs = [tab('a'), tab('b')];
    expect(knowledgebaseIsEmpty(tabs, new Set(['a']))).toBe(false);
    expect(knowledgebaseIsEmpty(tabs, new Set(['a', 'b']))).toBe(true);
  });

  it('names the one untouched page a structure starts from', () => {
    const start = tab('Start Here');
    expect(untouchedOnlyPage([start], all([start]))).toBe(start);
    expect(untouchedOnlyPage([start], new Set())).toBeUndefined();
    expect(untouchedOnlyPage([start, tab('b')], new Set(['Start Here', 'b']))).toBeUndefined();
    const written = tab('s', [para('t', 's', 'title'), para('x', 'Hi')]);
    expect(untouchedOnlyPage([written], all([written]))).toBeUndefined();
  });

  it('costs next to nothing on a keystroke, whatever the pages hold', () => {
    // A page of thousands of empty blocks is not read past its bound, and a page already judged is not read again.
    const huge = tab(
      'huge',
      Array.from({ length: 20_000 }, (_x, at) => para(`b${at}`, '')),
    );
    expect(pageIsUntouched(huge)).toBe(false);
    expect(EMPTY_SCAN_BLOCKS).toBeLessThan(100);
    const steady = [tab('a'), tab('b')];
    const loaded = new Set(['a', 'b', 'typed']);
    const spent = cpuMsOf(() => {
      for (let key = 0; key < 20_000; key++) {
        // Each keystroke replaces the page being written with a new object.
        const typed = tab('typed', [para('t', 'typed', 'title'), para('x', '')]);
        knowledgebaseIsEmpty([...steady, typed], loaded);
      }
    });
    expect(spent).toBeLessThan(cpuBudgetMs(150));
    // Past three pages nothing is read at all.
    const many = Array.from({ length: 500 }, (_x, at) => tab(`p${at}`));
    const quick = cpuMsOf(() => {
      for (let key = 0; key < 100_000; key++) knowledgebaseIsEmpty(many, loaded);
    });
    expect(quick).toBeLessThan(cpuBudgetMs(100));
  });
});

const suggested = (
  id: string,
  title: string,
  parent: string | null = null,
  depth = 1,
): KnowledgeSetupPage => ({
  id,
  title,
  summary: `About ${title}.`,
  headings: ['First', 'Second'],
  parent,
  depth,
});
const TREE = [
  suggested('p1', 'Getting Started'),
  suggested('p2', 'Local Setup', 'p1', 2),
  suggested('p3', 'Editors', 'p2', 3),
  suggested('p4', 'How We Ship'),
  suggested('p5', 'Releases', 'p4', 2),
];
const ticks = (pages: readonly { ticked: boolean }[]) => pages.map((p) => (p.ticked ? 1 : 0));

describe('the Review step', () => {
  it('starts with every page ticked', () => {
    expect(ticks(reviewPages(TREE))).toEqual([1, 1, 1, 1, 1]);
  });

  it('unticks a page with its subpages at every level, and no other page', () => {
    expect(ticks(withTick(reviewPages(TREE), 'p1', false))).toEqual([0, 0, 0, 1, 1]);
    expect(ticks(withTick(reviewPages(TREE), 'p2', false))).toEqual([1, 0, 0, 1, 1]);
    expect(ticks(withTick(reviewPages(TREE), 'p5', false))).toEqual([1, 1, 1, 1, 0]);
  });

  it('ticks the pages above a page with it, so it has somewhere to sit, and not its subpages', () => {
    const none = withTick(reviewPages(TREE), 'p1', false);
    expect(ticks(withTick(none, 'p3', true))).toEqual([1, 1, 1, 1, 1]);
    expect(ticks(withTick(none, 'p2', true))).toEqual([1, 1, 0, 1, 1]);
    expect(ticks(withTick(none, 'nowhere', true))).toEqual([0, 0, 0, 1, 1]);
  });

  it('renames in place, within a title, and creates a clean one-line name', () => {
    const renamed = withTitle(reviewPages(TREE), 'p4', '  Shipping\n  It  ');
    expect(renamed[3]!.title).toBe('  Shipping\n  It  ');
    expect(titleOf(renamed[3]!)).toBe('Shipping It');
    expect(withTitle(reviewPages(TREE), 'p4', 'x'.repeat(200))[3]!.title).toHaveLength(80);
    expect(titleOf({ title: '   ' })).toBe('Untitled Page');
    expect(tickedPages(withTick(renamed, 'p1', false)).map((p) => p.id)).toEqual(['p4', 'p5']);
  });

  it('says when the ticked pages would pass the page or depth limit, and counts the replaced page', () => {
    const pages = reviewPages(TREE);
    const top = { existing: 1, replacing: true, parentDepth: 0 };
    expect(setupLimitRefusal(pages, top)).toBeNull();
    expect(setupLimitRefusal(pages, { ...top, existing: MAX_KNOWLEDGEBASE_PAGES - 4 })).toBeNull();
    expect(
      setupLimitRefusal(pages, { ...top, replacing: false, existing: MAX_KNOWLEDGEBASE_PAGES - 4 }),
    ).toBe('page_limit');
    // Unticking makes room.
    expect(
      setupLimitRefusal(withTick(pages, 'p5', false), {
        ...top,
        replacing: false,
        existing: MAX_KNOWLEDGEBASE_PAGES - 4,
      }),
    ).toBeNull();
    // Three levels under a page five deep are level eight; under one six deep they pass it.
    expect(setupLimitRefusal(pages, { existing: 10, replacing: false, parentDepth: 5 })).toBeNull();
    expect(setupLimitRefusal(pages, { existing: 10, replacing: false, parentDepth: 6 })).toBe(
      'depth_limit',
    );
    expect(
      setupLimitRefusal(withTick(pages, 'p3', false), {
        existing: 10,
        replacing: false,
        parentDepth: 6,
      }),
    ).toBeNull();
    expect(setupLimitText('page_limit')).toContain('500 pages');
    expect(setupLimitText('depth_limit')).toContain('8 levels');
  });
});

describe('the plan the write path is handed', () => {
  it('is each ticked page with its summary in italics and its headings', () => {
    const plan = setupPlan(tickedPages(withTick(reviewPages(TREE), 'p2', false)));
    expect(plan.pages.map((p) => [p.key, p.title, p.parentKey])).toEqual([
      ['p1', 'Getting Started', null],
      ['p4', 'How We Ship', null],
      ['p5', 'Releases', 'p4'],
    ]);
    expect(plan.pages[0]!.markdown).toBe('*About Getting Started.*\n\n# First\n\n# Second');
    expect(plan.summary).toMatchObject({ pages: 3, pictures: 0, blocked: null });
    expect(setupPageMarkdown({ summary: '', headings: [] })).toBe('');
    // A page whose parent is not in the plan lands at the top of it.
    expect(setupPlan([reviewPages(TREE)[1]!]).pages[0]!.parentKey).toBeNull();
  });

  it('carries a page’s icon and cover onto the planned page, and none where there is none', () => {
    const [bare, dressed] = setupPlan([
      ...reviewPages(TREE).slice(0, 1),
      { ...reviewPages(TREE)[3]!, icon: 'rocket', cover: 'theme-dawn' },
    ]).pages;
    expect(bare).not.toHaveProperty('icon');
    expect(bare).not.toHaveProperty('cover');
    expect(dressed).toMatchObject({ icon: 'rocket', cover: 'theme-dawn' });
  });

  it('writes what a model sent as words: nothing Markdown or HTML reads as more', () => {
    expect(plainLine('<script>alert(1)</script>')).toBe('<script>alert\\(1\\)</script>');
    expect(plainLine('[x](javascript:alert(1))')).toBe('\\[x\\]\\(javascript:alert\\(1\\)\\)');
    expect(plainLine('![img](https://evil.test/x.png)')).toBe(
      '\\!\\[img\\]\\(https://evil.test/x.png\\)',
    );
    expect(plainLine('# Not a heading')).toBe('\\# Not a heading');
    expect(plainLine('- not a list')).toBe('\\- not a list');
    expect(plainLine('1. not a list')).toBe('\\1. not a list');
    expect(plainLine('> not a quote')).toBe('\\> not a quote');
    expect(plainLine('two\nlines\n\n# here')).toBe('two lines \\# here');
    expect(plainLine('**bold** `code` ~~gone~~ a|b')).toBe(
      '\\*\\*bold\\*\\* \\`code\\` \\~\\~gone\\~\\~ a\\|b',
    );
  });

  it('gives each heading an empty paragraph to write in, and leaves other writing alone', () => {
    const made = withRoomUnderHeadings(
      tab('a', [
        para('t', 'a', 'title'),
        para('s', 'Summary'),
        para('h1', 'First', 'h1'),
        para('h2', 'Second', 'h1'),
        para('w', 'Already written'),
        para('h3', 'Last', 'h1'),
      ]),
    );
    const blocks = made.articles![KNOWLEDGEBASE_FLOW]!.blocks as {
      id: string;
      style?: string;
      runs: unknown[];
    }[];
    expect(blocks.map((b) => (b.runs.length === 0 ? '' : b.id))).toEqual([
      't',
      's',
      'h1',
      '',
      'h2',
      'w',
      'h3',
      '',
    ]);
    expect(new Set(blocks.map((b) => b.id)).size).toBe(blocks.length);
    const bare = { id: 'n', name: 'n', elements: [] } as Tab;
    expect(withRoomUnderHeadings(bare)).toBe(bare);
  });
});

describe('the words', () => {
  it('are the spec own, in Title Case, with no dash', () => {
    expect(SETUP_BUTTON).toBe('Describe to Set Up');
    expect(SETUP_BUTTON_LINE).toBe('Tell AI what this is for and get a page structure.');
    expect(setupTitle('add')).toBe('Describe to Add Pages');
    expect(setupTitle('set-up')).toBe('Describe to Set Up');
    expect(DESCRIBE_EXAMPLE).toContain('12 person logistics startup');
    expect(DESCRIBE_CHIPS).toHaveLength(3);
    for (const chip of DESCRIBE_CHIPS) {
      expect(chip.text.length).toBeGreaterThanOrEqual(20);
      expect(chip.text.length).toBeLessThanOrEqual(1000);
      expect(chip.label + chip.text).not.toContain(String.fromCharCode(0x2014));
    }
    expect(createLabel(14)).toBe('Create 14 Pages');
    expect(createLabel(1)).toBe('Create 1 Page');
  });

  it('counts near the limit and says what stops a description', () => {
    expect(DESCRIBE_COUNT_FROM).toBe(900);
    expect(describeHint(0)).toBeNull();
    expect(describeHint(5)).toContain('at least 20');
    expect(describeHint(20)).toBeNull();
    expect(describeHint(1000)).toBeNull();
    expect(describeHint(1001)).toContain('1,000');
  });

  it.each([
    ['bad-key', 'OpenAI Did Not Accept the Key', 'ai-settings'],
    ['no-credit', 'The OpenAI Account Is Out of Credit', 'try-again'],
    ['rate-limited', 'The OpenAI Account Is at Its Rate Limit', 'try-again'],
    ['overloaded', 'OpenAI Is Busy Right Now', 'try-again'],
    ['refused', 'OpenAI Declined to Answer This', 'none'],
    ['model-unavailable', 'This Key Cannot Use the Chosen Model', 'ai-settings'],
    ['ask_unavailable', 'Describe to Set Up Is Not Available Right Now', 'ai-settings'],
    ['person-limit', 'You Have Asked for 5 Structures This Hour', 'none'],
    ['knowledgebase-limit', 'This Knowledgebase Has Had Its 20 Structures Today', 'none'],
    ['no-structure', 'Could Not Suggest a Structure', 'try-again'],
    ['network', 'The Description Could Not Be Sent', 'try-again'],
    ['forbidden', 'Only a Signed-In Editor Can Do This', 'none'],
    ['description-too-long', 'That Description Cannot Be Used', 'none'],
    ['built-in-unavailable', 'Built-In AI Is Not Set Up Here', 'ai-settings'],
    ['built-in-limit', "You Have Used Today's 10 Built-In Suggestions", 'ai-settings'],
    ['built-in-failed', 'The Built-In AI Could Not Answer', 'try-again'],
    ['anything-else', 'Could Not Suggest a Structure', 'try-again'],
  ])('words %s as Ask does, with its next step', (kind, title, step) => {
    const words = setupFailureWords(kind, { provider: 'openai' });
    expect(words.title).toBe(title);
    expect(words.step).toBe(step);
    expect(words.text).not.toMatch(/ask again|Ask Again|\b[45]\d\d\b/);
    expect(words.title + words.text).not.toContain('Claude');
  });

  it("says which AI answers: built-in with no key, the team's with one, nothing unread", () => {
    expect(setupAiLine(null)).toBeNull();
    expect(setupAiLine({ hasKey: false })).toBe('Uses built-in AI');
    expect(setupAiLine({ hasKey: true })).toBe("Uses this knowledgebase's key");
    expect(setupAiLine({ hasKey: false, uses: 'team' })).toBe("Uses your team's key");
    expect(setupAiLine({ hasKey: false, uses: 'personal' })).toBe('Uses your key');
  });

  it('names Claude when that is the provider, or none is known', () => {
    expect(setupFailureWords('bad-key', { provider: 'anthropic' }).title).toBe(
      'Claude Did Not Accept the Key',
    );
    expect(setupFailureWords('bad-key', {}).title).toBe('Claude Did Not Accept the Key');
  });
});
