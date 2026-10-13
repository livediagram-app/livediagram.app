import { describe, expect, it, vi } from 'vitest';
import {
  defaultPageBackground,
  getBuiltInTheme,
  illustratePagesOf,
  type Tab,
} from '@livediagram/document';
import { illustratePageEdits } from './illustrate-page-edits';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/007-editor/illustrate-pages.md "A new page's background": a new infographic page
// starts on the tab theme's Mist gradient, unless it carries the page before's background.
const theme = getBuiltInTheme('ocean');

function harness(tab: Tab) {
  let tabs = [tab];
  const commitTabs = vi.fn((map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  });
  const edits = () =>
    illustratePageEdits({
      tabId: tab.id,
      current: illustratePagesOf(tabs[0]!),
      elements: tabs[0]!.elements,
      commitTabs,
      onGoTo: vi.fn(),
      onLayoutPlaced: vi.fn(),
      theme,
    });
  return { edits, pages: () => illustratePagesOf(tabs[0]!) };
}
const tabOf = (pages: unknown[]) => ({ id: 't', name: 'T', elements: [], pages }) as unknown as Tab;

describe("a new page's background", () => {
  it('gives an added infographic page the theme gradient', () => {
    const h = harness(tabOf([{ id: 'page-1', orientation: 'portrait', kind: 'infographic' }]));
    h.edits().addPage!('infographic');
    expect(h.pages()[1]!.background).toEqual(defaultPageBackground(theme));
  });

  it("keeps the page before's background when it has one", () => {
    const night = { fill: { kind: 'solid', color: '#0f172a' } };
    const h = harness(tabOf([{ id: 'page-1', orientation: 'portrait', background: night }]));
    h.edits().addPage!('infographic');
    expect(h.pages()[1]!.background).toEqual(night);
  });

  it('gives the first page the theme gradient when it is chosen as an infographic', () => {
    const h = harness(tabOf([{ id: 'page-1', orientation: 'portrait' }]));
    h.edits().choosePageKind!('page-1', 'infographic');
    expect(h.pages()[0]!.background).toEqual(defaultPageBackground(theme));
  });

  it('leaves slides, articles and logo pages on the paper', () => {
    const h = harness(tabOf([{ id: 'page-1', orientation: 'portrait', kind: 'infographic' }]));
    h.edits().addPage!('slide');
    h.edits().addPage!('logo');
    expect(
      h
        .pages()
        .slice(1)
        .every((p) => !p.background),
    ).toBe(true);
  });
});
