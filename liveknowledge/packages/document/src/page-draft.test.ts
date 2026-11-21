import { describe, expect, it } from 'vitest';
import {
  DRAFT_FLOW,
  DRAFT_KEEP_MS,
  DRAFT_TOUCH_MS,
  blockPrint,
  draftDiffers,
  draftIsStale,
  draftOf,
  holdsDraft,
  isDraftFlow,
  mergeDraftOverSaved,
  pageTitleOf,
  parseTabDraft,
  printsOf,
  savedArticleOf,
  savedArticlesOf,
  savedChangesUnderDraft,
  savedFlowOf,
  touchedDraft,
  withDraftDiscarded,
  withDraftMade,
  withDraftSaved,
  withoutDraft,
  type ArticleBlock,
  type ArticleFlow,
  type Tab,
} from './index';

// docs/specs/030-knowledgebase/editing.md; blueprint blueprints/editing.md "Interfaces and contracts".

const para = (id: string, text: string, style?: 'title'): ArticleBlock =>
  ({
    id,
    type: 'paragraph',
    ...(style ? { style } : {}),
    runs: text ? [{ text }] : [],
  });

const flowOf = (...blocks: ArticleBlock[]): ArticleFlow => ({ blocks });

const page = (blocks: ArticleBlock[], extra: Partial<Tab> = {}): Tab =>
  ({
    id: 't1',
    name: 'Onboarding',
    elements: [],
    pages: [
      {
        id: 'p1',
        orientation: 'portrait',
        kind: 'article',
        flow: 'art-1',
        size: 'fit',
        fit: { width: 856, height: 400 },
      },
    ],
    articles: { 'art-1': flowOf(...blocks) },
    ...extra,
  });

const saved = [para('t', 'Onboarding', 'title'), para('a', 'First'), para('b', 'Second')];

describe('the saved writing', () => {
  it('never includes the draft', () => {
    const tab = withDraftMade(page(saved), flowOf(para('t', 'Draft', 'title')), 'Priya', 1);
    expect(Object.keys(savedArticlesOf(tab))).toEqual(['art-1']);
    expect(savedFlowOf(tab)).toBe('art-1');
    expect(savedArticleOf(tab)?.blocks.map((b) => b.id)).toEqual(['t', 'a', 'b']);
    // The title and name follow the saved writing, not the draft.
    expect(pageTitleOf(tab)).toBe('Onboarding');
  });

  it('keeps its object while the articles do', () => {
    const tab = withDraftMade(page(saved), flowOf(para('t', 'x')), 'Priya', 1);
    expect(savedArticlesOf(tab)).toBe(savedArticlesOf(tab));
    const plain = page(saved);
    expect(savedArticlesOf(plain)).toBe(savedArticlesOf(plain));
  });

  it('falls back to the first saved flow when no page names one', () => {
    const tab = { ...page(saved), pages: [] } as Tab;
    expect(savedFlowOf(tab)).toBe('art-1');
    expect(savedFlowOf({ id: 'x', name: '', elements: [] } as Tab)).toBeUndefined();
    expect(savedArticleOf({ id: 'x', name: '', elements: [] } as Tab)).toBeUndefined();
  });
});

describe('the draft record', () => {
  it('reads defensively', () => {
    expect(parseTabDraft(null)).toBeUndefined();
    expect(parseTabDraft([])).toBeUndefined();
    expect(parseTabDraft({ by: 1, at: 1 })).toBeUndefined();
    expect(parseTabDraft({ by: 'a', at: Number.NaN })).toBeUndefined();
    expect(
      parseTabDraft({ by: 'x'.repeat(200), at: 5, height: -3, base: { a: 'p', b: 2, '': 'q' } }),
    ).toEqual({ by: 'x'.repeat(80), at: 5, base: { a: 'p' } });
    expect(parseTabDraft({ by: 'a', at: 1, height: 900, base: [] })).toEqual({
      by: 'a',
      at: 1,
      height: 900,
      base: {},
    });
  });

  it('caps the base at the article block limit', () => {
    const base = Object.fromEntries(Array.from({ length: 5100 }, (_, i) => [`b${i}`, 'p']));
    expect(Object.keys(parseTabDraft({ by: 'a', at: 1, base })!.base)).toHaveLength(5000);
  });

  it('is touched at most once a minute by the same person', () => {
    const r = { by: 'Priya', at: 1000, base: {} };
    expect(touchedDraft(r, 'Priya', 1000 + DRAFT_TOUCH_MS - 1)).toBe(r);
    expect(touchedDraft(r, 'Priya', 1000 + DRAFT_TOUCH_MS)).toEqual({
      ...r,
      at: 1000 + DRAFT_TOUCH_MS,
    });
    expect(touchedDraft(r, 'Sam', 1001)).toEqual({ by: 'Sam', at: 1001, base: {} });
  });
});

describe('making, discarding and stripping a draft', () => {
  it('makes both halves, with the saved blocks as its base', () => {
    const tab = withDraftMade(page(saved), flowOf(...saved, para('c', 'Third')), 'Priya', 7, 610);
    const draft = draftOf(tab)!;
    expect(draft.flow.blocks.map((b) => b.id)).toEqual(['t', 'a', 'b', 'c']);
    expect(draft.record).toEqual({
      by: 'Priya',
      at: 7,
      height: 610,
      base: printsOf(flowOf(...saved)),
    });
    expect(holdsDraft(tab)).toBe(true);
    expect(holdsDraft(page(saved))).toBe(false);
  });

  it('answers no draft for a half of one', () => {
    const tab = withDraftMade(page(saved), flowOf(...saved), 'Priya', 7);
    expect(draftOf({ ...tab, draft: undefined })).toBeNull();
    expect(draftOf({ ...page(saved), draft: { by: 'a', at: 1, base: {} } })).toBeNull();
  });

  it('discards and strips both halves, and keeps a tab with none as it is', () => {
    const plain = page(saved);
    const tab = withDraftMade(plain, flowOf(...saved), 'Priya', 7);
    const gone = withDraftDiscarded(tab);
    expect(holdsDraft(gone)).toBe(false);
    expect(gone.articles).toEqual(plain.articles);
    expect(withoutDraft(plain)).toBe(plain);
    const recordOnly = { ...plain, draft: { by: 'a', at: 1, base: {} } };
    expect(holdsDraft(withoutDraft(recordOnly))).toBe(false);
    expect(withoutDraft(recordOnly).articles).toBe(plain.articles);
  });

  it('drops the margin notes only the draft marked, and keeps those the saved writing marks', () => {
    const marked = (id: string, note: string): ArticleBlock =>
      ({ id, type: 'paragraph', runs: [{ text: 'on-call', note, nk: 'action' }] });
    const marker = (id: string) => ({ id, type: 'article-note', kind: 'action', x: 0, y: 0 });
    const plain = page([...saved, marked('c', 'kept')], {
      elements: [
        marker('kept'),
        marker('draft-only'),
        { id: 'box', type: 'shape' },
      ] as unknown as Tab['elements'],
    });
    const tab = withDraftMade(
      plain,
      flowOf(...saved, marked('c', 'kept'), marked('d', 'draft-only')),
      'Priya',
      7,
    );
    expect(withDraftDiscarded(tab).elements.map((e) => e.id)).toEqual(['kept', 'box']);
    // Saved, the draft's note is the page's own.
    expect(withDraftSaved(tab).elements.map((e) => e.id)).toEqual(['kept', 'draft-only', 'box']);
  });

  it('says whether the draft differs from the saved page', () => {
    expect(draftDiffers(page(saved))).toBe(false);
    expect(draftDiffers(withDraftMade(page(saved), flowOf(...saved), 'P', 1))).toBe(false);
    expect(
      draftDiffers(withDraftMade(page(saved), flowOf(para('t', 'New', 'title')), 'P', 1)),
    ).toBe(true);
    const noSaved = withDraftMade(
      { id: 't', name: '', elements: [] },
      flowOf(para('x', 'y')),
      'P',
      1,
    );
    expect(draftDiffers(noSaved)).toBe(true);
  });

  it('is stale after thirty days untouched', () => {
    const tab = withDraftMade(page(saved), flowOf(...saved), 'P', 1000);
    expect(draftIsStale(tab, 1000 + DRAFT_KEEP_MS - 1)).toBe(false);
    expect(draftIsStale(tab, 1000 + DRAFT_KEEP_MS)).toBe(true);
    expect(draftIsStale(page(saved), Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});

describe('Save', () => {
  it('makes the draft the saved page, names the page from its Title and takes its height', () => {
    const draft = flowOf(
      para('t', 'Getting Started', 'title'),
      para('a', 'First, edited'),
      para('c', 'New'),
    );
    const tab = withDraftMade(page(saved), draft, 'Priya', 1, 980);
    const out = withDraftSaved(tab);
    expect(holdsDraft(out)).toBe(false);
    expect(out.articles!['art-1']!.blocks).toEqual(draft.blocks);
    expect(out.name).toBe('Getting Started');
    expect(out.pages![0]!.fit!.height).toBe(980);
  });

  it('keeps the name when the Title is blank, and the height when the draft has none', () => {
    const tab = withDraftMade(page(saved), flowOf(para('t', '', 'title'), para('a', 'x')), 'P', 1);
    const out = withDraftSaved(tab);
    expect(out.name).toBe('Onboarding');
    expect(out.pages![0]!.fit!.height).toBe(400);
  });

  it('answers a tab with no draft as it is, and drops a stray half', () => {
    const plain = page(saved);
    expect(withDraftSaved(plain)).toBe(plain);
    const stray = { ...plain, draft: { by: 'a', at: 1, base: {} } };
    expect(holdsDraft(withDraftSaved(stray))).toBe(false);
    const noFlow = withDraftMade(
      { id: 't', name: 'n', elements: [] },
      flowOf(para('x', 'y')),
      'P',
      1,
    );
    expect(holdsDraft(withDraftSaved(noFlow))).toBe(false);
  });
});

describe('an agent writing under a draft', () => {
  const base = printsOf(flowOf(...saved));

  it('is nothing to merge when nothing moved', () => {
    const draft = flowOf(para('a', 'Mine'));
    expect(mergeDraftOverSaved(base, draft, flowOf(...saved))).toBe(draft);
    expect(mergeDraftOverSaved(base, draft, undefined)).toBe(draft);
  });

  it("keeps the draft's changed blocks and the agent's others", () => {
    // The draft changed `a`; the agent changed `a` and `b`, and added `n` after `b`.
    const draft = flowOf(saved[0]!, para('a', 'Mine'), saved[2]!);
    const agent = flowOf(
      saved[0]!,
      para('a', 'Agent'),
      para('b', 'Agent b'),
      para('n', 'Agent new'),
    );
    const out = mergeDraftOverSaved(base, draft, agent);
    expect(
      out.blocks.map((b) => [b.id, (b as { runs: { text: string }[] }).runs[0]?.text]),
    ).toEqual([
      ['t', 'Onboarding'],
      ['a', 'Mine'],
      ['b', 'Agent b'],
      ['n', 'Agent new'],
    ]);
  });

  it("keeps the agent's removal of a block the draft left alone, and the draft's removal of one", () => {
    // The agent removed `b`; the draft removed `a`.
    const draft = flowOf(saved[0]!, saved[2]!, para('d', 'Draft new'));
    const agent = flowOf(saved[0]!, saved[1]!, para('z', 'Agent first'));
    const out = mergeDraftOverSaved(base, draft, agent);
    expect(out.blocks.map((b) => b.id)).toEqual(['t', 'z', 'd']);
  });

  it('puts a block the agent added at the top first', () => {
    const agent = flowOf(para('top', 'Agent top'), ...saved);
    const out = mergeDraftOverSaved(base, flowOf(...saved), agent);
    expect(out.blocks.map((b) => b.id)).toEqual(['top', 't', 'a', 'b']);
  });

  it('counts the blocks the agent changed', () => {
    const tab = withDraftMade(page(saved), flowOf(...saved), 'P', 1);
    expect(savedChangesUnderDraft(tab)).toBe(0);
    const agentWrote = {
      ...tab,
      articles: { ...tab.articles, 'art-1': flowOf(saved[0]!, para('a', 'Agent')) },
    } as Tab;
    // `a` changed and `b` went.
    expect(savedChangesUnderDraft(agentWrote)).toBe(2);
    expect(savedChangesUnderDraft(page(saved))).toBe(0);
    expect(withDraftSaved(agentWrote).articles!['art-1']!.blocks.map((b) => b.id)).toEqual([
      't',
      'a',
    ]);
  });

  it('prints the same value the same, and tells two values apart', () => {
    expect(blockPrint(para('a', 'x'))).toBe(blockPrint(para('a', 'x')));
    expect(blockPrint(para('a', 'x'))).not.toBe(blockPrint(para('a', 'y')));
  });

  it('never names a draft flow as a generated one', () => {
    expect(DRAFT_FLOW).not.toMatch(/^art-/);
    expect(isDraftFlow(DRAFT_FLOW)).toBe(true);
    expect(isDraftFlow('art-1')).toBe(false);
  });
});
