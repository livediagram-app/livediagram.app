import { describe, expect, it } from 'vitest';
import {
  DRAFT_FLOW,
  DRAFT_TOUCH_MS,
  draftOf,
  holdsDraft,
  savedArticleOf,
  withDraftMade,
  withDraftSaved,
  type ArticleBlock,
  type ArticleFlow,
  type Tab,
} from '@liveknowledge/document';
import { liftTabs, lowerPage, lowerTabs, pageEditLens, pageReadLens } from './lens';

// docs/specs/030-knowledgebase/blueprints/editing.md "The choice": the editor works on a page through a lens.

const para = (id: string, text: string): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: text ? [{ text }] : [],
});
const flowOf = (...blocks: ArticleBlock[]): ArticleFlow => ({ blocks });
const textOf = (flow: ArticleFlow | undefined) =>
  flow?.blocks.map((b) => (b as { runs: { text: string }[] }).runs[0]?.text ?? '');

const page = (text = 'Saved', height = 400): Tab => ({
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
      fit: { width: 856, height },
    },
  ],
  articles: { 'art-1': flowOf(para('a', text)) },
});

const writer = (by = 'Priya', at = 1000) => ({ by, now: () => at });
// What a typing commit does through the lens: writes the saved flow's key.
const typed = (tab: Tab, text: string): Tab => ({
  ...tab,
  articles: { ...tab.articles, 'art-1': flowOf(para('a', text)) },
});
const laidOut = (tab: Tab, height: number): Tab => ({
  ...tab,
  pages: tab.pages!.map((p) => ({ ...p, fit: { ...p.fit!, height } })),
});

describe('the edit lens', () => {
  it('is the page itself while it has no draft, so entering edit mode changes nothing', () => {
    const tab = page();
    expect(pageEditLens(tab)).toBe(tab);
  });

  it("shows the draft under the saved flow's id, as tall as the draft, with no draft key", () => {
    const tab = withDraftMade(page(), flowOf(para('a', 'Draft')), 'Priya', 1, 900);
    const lens = pageEditLens(tab);
    expect(textOf(lens.articles!['art-1'])).toEqual(['Draft']);
    expect(lens.articles![DRAFT_FLOW]).toBeUndefined();
    expect(lens.draft).toBeUndefined();
    expect(lens.pages![0]!.fit!.height).toBe(900);
    expect(pageEditLens(tab)).toBe(lens);
  });

  it('hides half a draft', () => {
    const half = { ...page(), draft: { by: 'P', at: 1, base: {} } } as Tab;
    expect(holdsDraft(pageEditLens(half))).toBe(false);
  });
});

describe('the read lens', () => {
  it('is the saved page, locked for someone who could edit it', () => {
    const tab = withDraftMade(page(), flowOf(para('a', 'Draft')), 'Priya', 1);
    const lens = pageReadLens(tab, true);
    expect(textOf(lens.articles!['art-1'])).toEqual(['Saved']);
    expect(holdsDraft(lens)).toBe(false);
    expect(lens.locked).toBe(true);
    expect(pageReadLens(tab, true)).toBe(lens);
    expect(pageReadLens(tab, false).locked).toBeUndefined();
    const plain = page();
    expect(pageReadLens(plain, false)).toBe(plain);
  });
});

describe('lowering a change', () => {
  it('makes the draft on the first change and keeps the saved writing', () => {
    const real = page();
    const lifted = pageEditLens(real);
    const out = lowerPage(real, lifted, typed(lifted, 'Hello'), writer());
    expect(textOf(savedArticleOf(out))).toEqual(['Saved']);
    const draft = draftOf(out)!;
    expect(textOf(draft.flow)).toEqual(['Hello']);
    expect(draft.record.by).toBe('Priya');
    expect(draft.record.at).toBe(1000);
  });

  it('writes an existing draft, touching its record at most once a minute', () => {
    const real = withDraftMade(page(), flowOf(para('a', 'One')), 'Priya', 1000);
    const lifted = pageEditLens(real);
    const soon = lowerPage(real, lifted, typed(lifted, 'Two'), writer('Priya', 1000 + 5));
    expect(textOf(draftOf(soon)!.flow)).toEqual(['Two']);
    expect(soon.draft).toBe(real.draft);
    const later = lowerPage(
      real,
      lifted,
      typed(lifted, 'Two'),
      writer('Sam', 1000 + DRAFT_TOUCH_MS),
    );
    expect(draftOf(later)!.record.by).toBe('Sam');
    expect(textOf(savedArticleOf(later))).toEqual(['Saved']);
  });

  it("gives the draft its layout's height and keeps the saved page's", () => {
    const real = withDraftMade(page('Saved', 400), flowOf(para('a', 'Long')), 'Priya', 1000);
    const lifted = pageEditLens(real);
    const out = lowerPage(real, lifted, laidOut(lifted, 1200), writer());
    expect(out.pages![0]!.fit!.height).toBe(400);
    expect(draftOf(out)!.record.height).toBe(1200);
  });

  it("lets the saved page's own height settle with no draft", () => {
    const real = page('Saved', 400);
    const out = lowerPage(real, real, laidOut(real, 500), writer());
    expect(out.pages![0]!.fit!.height).toBe(500);
    expect(holdsDraft(out)).toBe(false);
  });

  it('keeps everything else the change made, and the real tab when it made nothing', () => {
    const real = withDraftMade(page(), flowOf(para('a', 'One')), 'Priya', 1000);
    const lifted = pageEditLens(real);
    expect(lowerPage(real, lifted, lifted, writer())).toBe(real);
    const renamed = lowerPage(real, lifted, { ...lifted, name: 'New' }, writer());
    expect(renamed.name).toBe('New');
    expect(textOf(draftOf(renamed)!.flow)).toEqual(['One']);
    const empty = { id: 'e', name: '', elements: [] } as Tab;
    const changed = { ...empty, name: 'x' };
    expect(lowerPage(empty, empty, changed, writer())).toBe(changed);
  });

  it('saves what was typed through the lens', () => {
    const real = page();
    const lifted = pageEditLens(real);
    const drafted = lowerPage(real, lifted, typed(lifted, 'Published'), writer());
    expect(textOf(savedArticleOf(withDraftSaved(drafted)))).toEqual(['Published']);
  });
});

describe('lifting and lowering the tabs', () => {
  it('lifts the page being edited only, and answers the same array when nothing changes', () => {
    const other = { ...page(), id: 't2' };
    const real = withDraftMade(page(), flowOf(para('a', 'D')), 'P', 1);
    const ts = [real, other];
    const lifted = liftTabs(ts, 't1');
    expect(lifted[1]).toBe(other);
    expect(textOf(lifted[0]!.articles!['art-1'])).toEqual(['D']);
    expect(liftTabs(ts, 'gone')).toBe(ts);
    expect(liftTabs([page()], 't1')).toEqual([page()]);
    expect(lowerTabs(ts, lifted, lifted, 't1', writer())).toBe(ts);
    expect(lowerTabs(ts, lifted, lifted.slice(), 't1', writer())).toBe(ts);
  });

  it('lowers the edited page and passes the others through as mapped', () => {
    const other = { ...page(), id: 't2' };
    const ts = [page(), other];
    const lifted = liftTabs(ts, 't1');
    const mapped = lifted.map((t) => (t.id === 't1' ? typed(t, 'New') : { ...t, name: 'Renamed' }));
    const out = lowerTabs(ts, lifted, mapped, 't1', writer());
    expect(textOf(draftOf(out[0]!)!.flow)).toEqual(['New']);
    expect(out[1]!.name).toBe('Renamed');
    // A tab the map added comes through as it is.
    const added = lowerTabs(ts, lifted, [...lifted, { ...page(), id: 't3' }], 't1', writer());
    expect(added).toHaveLength(3);
  });
});
