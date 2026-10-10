import { describe, expect, it } from 'vitest';
import type { PageChange } from '@livediagram/api-schema';
import {
  articlesOf,
  illustratePagesOf,
  layOutIllustratePages,
  MAX_ILLUSTRATE_PAGES,
  type Element,
  type IllustratePage,
  type Tab,
} from '@livediagram/document';
import { layoutCatalogueFor } from '@livediagram/templates';
import { applyPageChanges, backgroundPatch } from './page-changes';
import { pageSummaries } from './summary';

// docs/specs/024-agents/illustrate-for-agents.md "Which tab", "Naming a page", "change_pages".

const counter = (prefix: string) => {
  let n = 0;
  return () => `${prefix}-${++n}`;
};
const ids = () => ({ page: counter('pg'), flow: counter('art') });

const box = (id: string, x: number, y: number): Element =>
  ({ id, type: 'shape', shape: 'square', x, y, width: 40, height: 40 }) as Element;

const tabOf = (extra: Partial<Tab> = {}): Tab =>
  ({ id: 't', name: 'T', elements: [], opensIn: 'illustrate', ...extra }) as Tab;

const page = (id: string, extra: Partial<IllustratePage> = {}): IllustratePage => ({
  id,
  orientation: 'portrait',
  kind: 'infographic',
  ...extra,
});

const onPage = (pages: IllustratePage[], index: number, id: string): Element => {
  const r = layOutIllustratePages(pages)[index]!.rect;
  return box(id, r.x + r.width / 2 - 20, r.y + r.height / 2 - 20);
};

const run = (tab: Tab, changes: PageChange[]) => {
  const out = applyPageChanges(tab, changes, ids());
  if ('refusal' in out) throw new Error(`${out.refusal.code}: ${out.refusal.message}`);
  return out;
};
const refusal = (tab: Tab, changes: PageChange[]) => {
  const out = applyPageChanges(tab, changes, ids());
  if (!('refusal' in out)) throw new Error('expected a refusal');
  return out.refusal;
};
const kinds = (tab: Tab) => pageSummaries(tab).map((p) => p.kind);

describe('fresh ids and the unexpected', () => {
  it('mints its own page ids when none are given', () => {
    const out = applyPageChanges(tabOf({ pages: [page('p1')] }), [{ op: 'add', kind: 'slide' }]);
    if ('refusal' in out) throw new Error('refused');
    expect(illustratePagesOf(out.tab)[1]!.id).toMatch(/^page-/);
  });

  it('lets an error that is not a refusal through', () => {
    const hostile = {
      get op(): never {
        throw new TypeError('boom');
      },
    } as unknown as PageChange;
    expect(() => applyPageChanges(tabOf(), [hostile])).toThrow('boom');
  });
});

describe('which tab', () => {
  it('switches a diagram tab into Illustrate, saying so', () => {
    const out = run(tabOf({ opensIn: undefined }), [{ op: 'add', kind: 'slide' }]);
    expect(out.switched).toBe(true);
    expect(out.tab.opensIn).toBe('illustrate');
    expect(out.lines[0]).toBe('Switched the tab to Illustrate.');
  });

  it('refuses a locked tab and an Event Storming board', () => {
    expect(refusal(tabOf({ locked: true }), [{ op: 'add', kind: 'slide' }]).code).toBe(
      'tab_locked',
    );
    expect(refusal(tabOf({ kind: 'event-storming' }), [{ op: 'add', kind: 'slide' }]).code).toBe(
      'tab_kind',
    );
  });
});

describe('adding', () => {
  it('turns the fresh tab’s empty first page into the page asked for', () => {
    const out = run(tabOf(), [{ op: 'add', kind: 'slide' }]);
    expect(kinds(out.tab)).toEqual(['slide']);
    expect(out.lines).toEqual(['Added page 1 (slide, Slide (16:9)).']);
  });

  it('adds after the last page, with its fields, a layout and a place', () => {
    const tab = tabOf({ pages: [page('p1'), page('p2')] });
    const slide = layoutCatalogueFor('slide').layouts[0]!;
    const out = run(tab, [
      {
        op: 'add',
        kind: 'slide',
        name: 'Cover',
        background: { color: '#0f172a' },
        layout: slide.id,
        at: 1,
      },
    ]);
    const pages = illustratePagesOf(out.tab);
    expect(pages.map((p) => p.id)).toEqual(['pg-1', 'p1', 'p2']);
    expect(pages[0]).toMatchObject({ kind: 'slide', name: 'Cover' });
    expect(out.tab.elements.length).toBeGreaterThan(0);
    expect(out.lines[0]).toBe(
      `Added page 1 (slide, Slide (16:9)) from layout ${slide.label}: name "Cover", background #0f172a.`,
    );
  });

  it('adds logo and infographic pages, sized and turned', () => {
    const tab = tabOf({ pages: [page('p1')] });
    const out = run(tab, [
      { op: 'add', kind: 'logo' },
      { op: 'add', kind: 'infographic', size: 'a3', orientation: 'landscape' },
    ]);
    expect(kinds(out.tab)).toEqual(['infographic', 'logo', 'infographic']);
    expect(out.lines[1]).toBe('Added page 3 (infographic, A3 landscape): size a3, landscape.');
  });

  it('refuses an article (write_article makes them) and a size the kind lacks', () => {
    expect(refusal(tabOf(), [{ op: 'add', kind: 'article' }]).code).toBe('article_by_write');
    const r = refusal(tabOf({ pages: [page('p1')] }), [{ op: 'add', kind: 'slide', size: 'a4' }]);
    expect(r).toMatchObject({ code: 'size_not_offered', change: 0 });
    expect(r.message).toContain('slide, slide-classic');
  });

  it('refuses a layout of another kind, and any on an article page', () => {
    const r = refusal(tabOf({ pages: [page('p1')] }), [
      { op: 'add', kind: 'logo', layout: 'title' },
    ]);
    expect(r.code).toBe('layout_unknown');
    expect(r.message).toContain('A logo page takes the layouts');
    const withArticle = tabOf({
      pages: [page('a', { kind: 'article', flow: 'f' })],
      articles: { f: { blocks: [] } },
    });
    expect(refusal(withArticle, [{ op: 'layout', page: 1, layout: 'title' }]).message).toContain(
      'write_article',
    );
  });

  it('refuses past the page limit', () => {
    const full = tabOf({
      pages: Array.from({ length: MAX_ILLUSTRATE_PAGES }, (_, i) => page(`p${i}`)),
    });
    expect(refusal(full, [{ op: 'add', kind: 'slide' }]).code).toBe('page_limit');
  });
});

describe('naming a page', () => {
  const tab = tabOf({ pages: [page('p1', { name: 'Cover Page' }), page('p2'), page('p3')] });

  it('by id, place, place as text, or name with case and spacing aside', () => {
    for (const ref of ['p2', 2, '2']) {
      const out = run(tab, [{ op: 'set', page: ref, name: 'X' }]);
      expect(illustratePagesOf(out.tab)[1]!.name).toBe('X');
    }
    const out = run(tab, [{ op: 'set', page: 'cover-page', name: 'Front' }]);
    expect(illustratePagesOf(out.tab)[0]!.name).toBe('Front');
  });

  it('reads places against the pages as earlier changes left them', () => {
    const out = run(tab, [
      { op: 'delete', page: 2 },
      { op: 'set', page: 2, name: 'Was third' },
    ]);
    expect(illustratePagesOf(out.tab).find((p) => p.id === 'p3')!.name).toBe('Was third');
  });

  it('refuses an unknown page, listing the pages', () => {
    const r = refusal(tab, [{ op: 'set', page: 9, name: 'X' }]);
    expect(r.code).toBe('page_unknown');
    expect(r.message).toContain('1 Cover Page (infographic), 2 (infographic), 3 (infographic)');
    expect(refusal(tab, [{ op: 'delete', page: 'nope' }]).code).toBe('page_unknown');
  });
});

describe('setting', () => {
  it('sets each field and says what it set', () => {
    const tab = tabOf({ pages: [page('p1')] });
    const out = run(tab, [
      {
        op: 'set',
        page: 1,
        name: '',
        size: 'square',
        background: { gradient: ['#000000', '#ffffff'], pattern: 'grid' },
        locked: true,
      },
    ]);
    expect(illustratePagesOf(out.tab)[0]).toMatchObject({ size: 'square', locked: true });
    expect(out.lines[0]).toBe(
      'Set page 1: no name, size square, background gradient #000000 → #ffffff, grid pattern, locked.',
    );
  });

  it('unlocks before editing, and refuses an edit of a locked page', () => {
    const tab = tabOf({ pages: [page('p1', { locked: true })] });
    expect(refusal(tab, [{ op: 'set', page: 1, name: 'A' }]).code).toBe('page_locked');
    const out = run(tab, [{ op: 'set', page: 1, name: 'A', locked: false }]);
    expect(illustratePagesOf(out.tab)[0]).toMatchObject({ name: 'A' });
    expect(illustratePagesOf(out.tab)[0]!.locked).toBeUndefined();
  });

  it('refuses a turn of a slide and a pattern on a logo', () => {
    const tab = tabOf({
      pages: [
        page('s', { kind: 'slide', size: 'slide', orientation: 'landscape' }),
        page('l', { kind: 'logo', size: 'logo' }),
      ],
    });
    expect(refusal(tab, [{ op: 'set', page: 1, orientation: 'portrait' }]).code).toBe(
      'no_orientation',
    );
    expect(refusal(tab, [{ op: 'set', page: 2, background: { pattern: 'dots' } }]).code).toBe(
      'pattern_not_offered',
    );
  });

  it('says the paper and no pattern in words', () => {
    const tab = tabOf({
      pages: [
        page('p1', { background: { fill: { kind: 'solid', color: '#000' }, pattern: 'dots' } }),
      ],
    });
    const out = run(tab, [{ op: 'set', page: 1, background: { paper: true, pattern: 'none' } }]);
    expect(out.lines[0]).toBe('Set page 1: background paper, no pattern.');
  });

  it('reads a background input as the patch it means', () => {
    expect(backgroundPatch({ paper: true })).toEqual({ fill: undefined });
    expect(backgroundPatch({ pattern: 'none' })).toEqual({ pattern: undefined });
    expect(backgroundPatch({ gradient: ['#000', '#fff'], angle: 90 })).toEqual({
      fill: { kind: 'gradient', from: '#000', to: '#fff', angle: 90 },
    });
  });
});

describe('laying out, moving, duplicating, deleting', () => {
  it('lays a page out in place of what was on it', () => {
    const pages = [page('p1')];
    const tab = tabOf({ pages, elements: [onPage(pages, 0, 'old')] });
    const layout = layoutCatalogueFor('infographic').layouts[0]!;
    const out = run(tab, [{ op: 'layout', page: 1, layout: layout.id }]);
    expect(out.tab.elements.some((e) => e.id === 'old')).toBe(false);
    expect(out.lines[0]).toBe(`Laid out page 1 as ${layout.label} (replaced 1 elements).`);
  });

  it('moves a page to a place', () => {
    const tab = tabOf({ pages: [page('p1'), page('p2'), page('p3')] });
    const out = run(tab, [{ op: 'move', page: 'p3', to: 1 }]);
    expect(illustratePagesOf(out.tab).map((p) => p.id)).toEqual(['p3', 'p1', 'p2']);
    expect(out.lines[0]).toBe('Moved page p3 to 1.');
    expect(
      illustratePagesOf(run(tab, [{ op: 'move', page: 1, to: 99 }]).tab).map((p) => p.id),
    ).toEqual(['p2', 'p3', 'p1']);
  });

  it('duplicates a page and an article', () => {
    const tab = tabOf({
      pages: [page('p1'), page('a1', { kind: 'article', flow: 'f' })],
      articles: { f: { blocks: [{ id: 'b', type: 'paragraph', runs: [{ text: 'Hi' }] }] } },
    });
    const out = run(tab, [
      { op: 'duplicate', page: 1 },
      { op: 'duplicate', page: 'a1' },
    ]);
    expect(out.lines).toEqual([
      'Duplicated page 1 as page 2.',
      'Duplicated the article on page 3 (1 pages, from page 4).',
    ]);
    expect(Object.keys(articlesOf(out.tab))).toHaveLength(2);
  });

  it('deletes a page with what is on it, and a whole article', () => {
    const pages = [page('p1'), page('p2'), page('a1', { kind: 'article', flow: 'f' })];
    const tab = tabOf({
      pages,
      elements: [onPage(pages, 1, 'x')],
      articles: { f: { blocks: [] } },
    });
    const out = run(tab, [
      { op: 'delete', page: 2 },
      { op: 'delete', page: 'a1' },
    ]);
    expect(illustratePagesOf(out.tab).map((p) => p.id)).toEqual(['p1']);
    expect(out.tab.elements).toEqual([]);
    expect(out.lines).toEqual([
      'Deleted page 2 and 1 elements on it.',
      'Deleted the article on page 2 (1 pages, writing and 0 elements).',
    ]);
    expect(refusal(tabOf({ pages: [page('p1')] }), [{ op: 'delete', page: 1 }]).code).toBe(
      'last_page',
    );
  });

  it('stops at the first refusal and writes nothing, naming the change', () => {
    const tab = tabOf({ pages: [page('p1')] });
    const r = refusal(tab, [
      { op: 'add', kind: 'slide' },
      { op: 'delete', page: 7 },
    ]);
    expect(r).toMatchObject({ code: 'page_unknown', change: 1 });
  });
});

describe('the answer', () => {
  it('lists each page with its rectangle and what is on it', () => {
    const pages = [
      page('p1', {
        name: 'One',
        background: { fill: { kind: 'solid', color: '#fff' }, pattern: 'dots' },
      }),
      page('s', { kind: 'slide', size: 'slide', orientation: 'landscape', locked: true }),
    ];
    const tab = tabOf({ pages, elements: [onPage(pages, 0, 'b')] });
    const [one, two] = pageSummaries(tab);
    expect(one).toMatchObject({
      place: 1,
      name: 'One',
      kind: 'infographic',
      size: 'a4',
      orientation: 'portrait',
      background: '#fff, dots pattern',
      elements: 1,
    });
    expect(one!.rect.width).toBe(794);
    expect(two).toMatchObject({ kind: 'slide', orientation: null, locked: true, background: null });
  });
});

describe('worst case', () => {
  it('applies 50 changes on a 100-page tab with 2,000 elements in budget', () => {
    const pages = Array.from({ length: MAX_ILLUSTRATE_PAGES - 1 }, (_, i) => page(`p${i}`));
    const elements = Array.from({ length: 2000 }, (_, i) =>
      onPage(pages, i % pages.length, `e${i}`),
    );
    const tab = tabOf({ pages, elements });
    const changes: PageChange[] = Array.from({ length: 50 }, (_, i) =>
      i % 2
        ? { op: 'move', page: (i % 90) + 1, to: 1 }
        : { op: 'set', page: (i % 90) + 1, name: `N${i}` },
    );
    const started = performance.now();
    run(tab, changes);
    // Measured 29 to 57 ms on a loaded machine (load average 50); held at 2,000 ms for CI under load.
    expect(performance.now() - started).toBeLessThan(2000);
  });
});
