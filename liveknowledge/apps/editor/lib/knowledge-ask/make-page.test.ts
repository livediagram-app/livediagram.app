import { describe, expect, it, vi } from 'vitest';
import type { AskSource } from '@liveknowledge/api-schema';
import { KNOWLEDGEBASE_FLOW, type ArticleBlock, type Tab } from '@liveknowledge/document';
import { PAGE_LINK_KEY } from '@liveknowledge/knowledge';
import {
  DRAFT_MARK,
  draftPageForQuestion,
  makePage,
  saveAnswerAsPage,
  titleFromQuestion,
} from './make-page';

const tab = (id: string, name: string, parent?: string): Tab => ({
  id,
  name,
  elements: [],
  ...(parent ? { parent } : {}),
});

function editor(tabs: Tab[] = [tab('p1', 'Release Process'), tab('p2', 'Hotfixes', 'p1')]) {
  const state = { tabs };
  return {
    state,
    get tabs() {
      return state.tabs;
    },
    activeTab: tabs[0]!,
    markTabLoaded: vi.fn(),
    commitTabs: vi.fn((map: (tabs: Tab[]) => Tab[]) => void (state.tabs = map(state.tabs))),
  };
}
const blocksOf = (page: Tab): ArticleBlock[] => page.articles![KNOWLEDGEBASE_FLOW]!.blocks;
const textOf = (block: ArticleBlock) =>
  'runs' in block ? (block.runs ?? []).map((run) => run.text).join('') : '';
const source = (number: number, tabId: string, title: string): AskSource => ({
  number,
  passageId: `${tabId}:0`,
  tab: tabId,
  title,
  headings: [],
  text: 'We ship on Thursdays.',
  trust: 'verified',
  firstBlock: 'b1',
  lastBlock: 'b1',
});

describe('a page from Markdown', () => {
  it('is added under its parent with its title and writing, and marked loaded', () => {
    const ed = editor();
    const made = makePage(
      ed,
      { title: 'Notes', markdown: 'Hello **there**.', parent: 'p1' },
      () => 'new',
    );
    expect(made).toEqual({ ok: true, id: 'new', title: 'Notes' });
    const page = ed.state.tabs.find((t) => t.id === 'new')!;
    expect(page.parent).toBe('p1');
    expect(blocksOf(page).map(textOf)).toEqual(['Notes', 'Hello there.']);
    expect(ed.markTabLoaded).toHaveBeenCalledWith('new');
  });

  it('is refused in words when the tree takes no more', () => {
    const many = Array.from({ length: 500 }, (_, i) => tab(`t${i}`, `Page ${i}`));
    const ed = editor(many);
    const made = makePage(ed, { title: 'One More', markdown: '' });
    expect(made).toEqual({ ok: false, reason: 'A knowledgebase holds 500 pages at most.' });
    expect(ed.commitTabs).not.toHaveBeenCalled();
  });
});

describe('Save as Page', () => {
  it('makes a subpage titled from the question, markers out, sources linked to their pages', () => {
    const ed = editor();
    const made = saveAnswerAsPage(ed, {
      question: 'When do we   release?',
      text: 'We ship on Thursdays [1]. Hotfixes go any day [2].',
      sources: [source(1, 'p1', 'Release Process'), source(2, 'gone', 'Old Page')],
      parent: 'p2',
    });
    expect(made.ok).toBe(true);
    const page = ed.state.tabs.find((t) => made.ok && t.id === made.id)!;
    expect(page.name).toBe('When do we release?');
    expect(page.parent).toBe('p2');
    const blocks = blocksOf(page);
    expect(blocks.map(textOf)).toEqual([
      'When do we release?',
      'We ship on Thursdays. Hotfixes go any day.',
      'Sources',
      'Release Process',
      'Old Page',
    ]);
    // The page still here is a page link; the one that has gone is its title alone.
    const runs = blocks.flatMap((b) => ('runs' in b ? (b.runs ?? []) : []));
    const linked = runs.filter((run) => (run as Record<string, unknown>)[PAGE_LINK_KEY]);
    expect(
      linked.map((run) => [run.text, (run as Record<string, unknown>)[PAGE_LINK_KEY]]),
    ).toEqual([['Release Process', 'p1']]);
  });

  it('keeps anything that looks like markup in the answer as text or drops it, never as a script', () => {
    const ed = editor();
    const made = saveAnswerAsPage(ed, {
      question: 'Q?',
      text: 'Click [here](javascript:alert(1)) <script>alert(1)</script>',
      sources: [],
      parent: 'p1',
    });
    const page = ed.state.tabs.find((t) => made.ok && t.id === made.id)!;
    const runs = blocksOf(page).flatMap((b) => ('runs' in b ? (b.runs ?? []) : []));
    expect(runs.some((run) => run.href?.startsWith('javascript'))).toBe(false);
  });
});

describe('Draft a Page', () => {
  it('opens with "Draft, Not Verified", then the question as a heading, then the draft', () => {
    const ed = editor();
    const made = draftPageForQuestion(ed, {
      question: 'Who approves a # release?',
      draft: { text: 'The release manager [1].', sources: [source(1, 'p1', 'Release Process')] },
    });
    const page = ed.state.tabs.find((t) => made.ok && t.id === made.id)!;
    expect(page.parent).toBeUndefined();
    expect(blocksOf(page).map(textOf).slice(0, 4)).toEqual([
      'Who approves a # release?',
      DRAFT_MARK,
      'Who approves a # release?',
      'The release manager.',
    ]);
  });

  it('holds the mark and the question alone when there is no draft', () => {
    const ed = editor();
    const made = draftPageForQuestion(ed, { question: 'Who approves?', draft: undefined });
    const page = ed.state.tabs.find((t) => made.ok && t.id === made.id)!;
    expect(blocksOf(page).map(textOf)).toEqual(['Who approves?', DRAFT_MARK, 'Who approves?']);
  });
});

describe('a title from a question', () => {
  it('is one line, capped as a page name is', () => {
    expect(titleFromQuestion('  How\n do we\tship? ')).toBe('How do we ship?');
    expect(titleFromQuestion('x'.repeat(500)).length).toBeLessThan(200);
    expect(titleFromQuestion('   ')).toBe('Untitled Page');
  });
});
