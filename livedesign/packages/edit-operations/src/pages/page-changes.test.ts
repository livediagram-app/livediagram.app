import { describe, expect, it } from 'vitest';
import type { PageChange } from '@livedesign/api-schema';
import {
  articlesOf,
  pagesOf,
  layOutPages,
  MAX_PAGES,
  type Element,
  type Page,
  type Tab,
} from '@livedesign/document';
import { getBuiltInTheme } from '@livedesign/document';
import { layoutCatalogueFor } from '@livedesign/templates';
import { applyPageChanges, backgroundPatch } from './page-changes';
import { pageSummaries } from './summary';

// docs/specs/024-agents/pages-for-agents.md "Which tab", "Naming a page", "change_pages".

const counter = (prefix: string) => {
  let n = 0;
  return () => `${prefix}-${++n}`;
};
const ids = () => ({ page: counter('pg'), flow: counter('art') });

const box = (id: string, x: number, y: number): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y,
  width: 40,
  height: 40,
});

const tabOf = (extra: Partial<Tab> = {}): Tab => ({
  id: 't',
  name: 'T',
  elements: [],
  opensIn: 'pages',
  ...extra,
});

const page = (id: string, extra: Partial<Page> = {}): Page => ({
  id,
  orientation: 'portrait',
  kind: 'infographic',
  ...extra,
});

const onPage = (pages: Page[], index: number, id: string): Element => {
  const r = layOutPages(pages)[index]!.rect;
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
    expect(pagesOf(out.tab)[1]!.id).toMatch(/^page-/);
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
  it('switches a diagram tab into Pages, saying so', () => {
    const out = run(tabOf({ opensIn: undefined }), [{ op: 'add', kind: 'slide' }]);
    expect(out.switched).toBe(true);
    expect(out.tab.opensIn).toBe('pages');
    expect(out.lines[0]).toBe('Switched the tab to Pages.');
  });

  it('refuses a locked tab', () => {
    expect(refusal(tabOf({ locked: true }), [{ op: 'add', kind: 'slide' }]).code).toBe(
      'tab_locked',
    );
  });
});

describe('adding', () => {
  it('turns the fresh tab’s empty first page into the page asked for', () => {
    const out = run(tabOf(), [{ op: 'add', kind: 'slide' }]);
    expect(kinds(out.tab)).toEqual(['slide']);
    expect(out.lines).toEqual(['Added page 1 (slide, Slide (16:9)).']);
  });

  it('turns a blank of the kind asked for (a blank deck’s one empty slide) into the page asked for', () => {
    const blank = tabOf({ pages: [page('p1', { kind: 'slide' })] });
    const slide = layoutCatalogueFor('slide').layouts[0]!;
    const out = run(blank, [
      { op: 'add', kind: 'slide', name: 'Cover', layout: slide.id },
      { op: 'add', kind: 'slide', name: 'Problem' },
    ]);
    expect(pagesOf(out.tab).map((p) => [p.id, p.name])).toEqual([
      ['p1', 'Cover'],
      ['pg-1', 'Problem'],
    ]);
    // Of another kind, named or holding anything, the one page stays and the new one follows it.
    for (const kept of [
      tabOf({ pages: [page('p1', { kind: 'infographic' })] }),
      tabOf({ pages: [page('p1', { kind: 'slide', name: 'Title' })] }),
    ])
      expect(pagesOf(run(kept, [{ op: 'add', kind: 'slide' }]).tab)).toHaveLength(2);
  });

  it('never takes a page the same call added as a blank', () => {
    const out = run(tabOf(), [
      { op: 'add', kind: 'slide' },
      { op: 'add', kind: 'slide', name: 'Two' },
    ]);
    expect(pagesOf(out.tab).map((p) => p.name ?? null)).toEqual([null, 'Two']);
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
    const pages = pagesOf(out.tab);
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
      pages: Array.from({ length: MAX_PAGES }, (_, i) => page(`p${i}`)),
    });
    expect(refusal(full, [{ op: 'add', kind: 'slide' }]).code).toBe('page_limit');
  });
});

describe('naming a page', () => {
  const tab = tabOf({ pages: [page('p1', { name: 'Cover Page' }), page('p2'), page('p3')] });

  it('by id, place, place as text, or name with case and spacing aside', () => {
    for (const ref of ['p2', 2, '2']) {
      const out = run(tab, [{ op: 'set', page: ref, name: 'X' }]);
      expect(pagesOf(out.tab)[1]!.name).toBe('X');
    }
    const out = run(tab, [{ op: 'set', page: 'cover-page', name: 'Front' }]);
    expect(pagesOf(out.tab)[0]!.name).toBe('Front');
  });

  it('reads places against the pages as earlier changes left them', () => {
    const out = run(tab, [
      { op: 'delete', page: 2 },
      { op: 'set', page: 2, name: 'Was third' },
    ]);
    expect(pagesOf(out.tab).find((p) => p.id === 'p3')!.name).toBe('Was third');
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
    expect(pagesOf(out.tab)[0]).toMatchObject({ size: 'square', locked: true });
    expect(out.lines[0]).toBe(
      'Set page 1: no name, size square, background gradient #000000 → #ffffff, grid pattern, locked.',
    );
  });

  it('keeps a picture background through a pattern change, and a colour replaces it', () => {
    const picture = {
      kind: 'image' as const,
      imageId: 'img-1',
      overlay: { kind: 'dark' as const, strength: 0.6 },
    };
    const tab = tabOf({ pages: [page('p1', { background: { fill: picture } })] });
    expect(pageSummaries(tab)[0]!.background).toBe('image, dark 60%');
    const patterned = run(tab, [{ op: 'set', page: 1, background: { pattern: 'dots' } }]);
    expect(pagesOf(patterned.tab)[0]!.background).toEqual({
      fill: picture,
      pattern: 'dots',
    });
    const coloured = run(tab, [{ op: 'set', page: 1, background: { color: '#fef9c3' } }]);
    expect(pagesOf(coloured.tab)[0]!.background).toEqual({
      fill: { kind: 'solid', color: '#fef9c3' },
    });
  });

  it('unlocks before editing, and refuses an edit of a locked page', () => {
    const tab = tabOf({ pages: [page('p1', { locked: true })] });
    expect(refusal(tab, [{ op: 'set', page: 1, name: 'A' }]).code).toBe('page_locked');
    const out = run(tab, [{ op: 'set', page: 1, name: 'A', locked: false }]);
    expect(pagesOf(out.tab)[0]).toMatchObject({ name: 'A' });
    expect(pagesOf(out.tab)[0]!.locked).toBeUndefined();
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
    expect(out.lines[0]).toBe(`Laid out page 1 as ${layout.label} (replaced 1 element).`);
  });

  it('moves a page to a place', () => {
    const tab = tabOf({ pages: [page('p1'), page('p2'), page('p3')] });
    const out = run(tab, [{ op: 'move', page: 'p3', to: 1 }]);
    expect(pagesOf(out.tab).map((p) => p.id)).toEqual(['p3', 'p1', 'p2']);
    expect(out.lines[0]).toBe('Moved page p3 to 1.');
    expect(pagesOf(run(tab, [{ op: 'move', page: 1, to: 99 }]).tab).map((p) => p.id)).toEqual([
      'p2',
      'p3',
      'p1',
    ]);
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
      'Duplicated the article on page 3 (1 page, from page 4).',
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
    expect(pagesOf(out.tab).map((p) => p.id)).toEqual(['p1']);
    expect(out.tab.elements).toEqual([]);
    expect(out.lines).toEqual([
      'Deleted page 2 and 1 element on it.',
      'Deleted the article on page 2 (1 page, writing and 0 elements).',
    ]);
    expect(refusal(tabOf({ pages: [page('p1')] }), [{ op: 'delete', page: 1 }]).code).toBe(
      'last_page',
    );
  });

  // The benchmark's I4: an agent replacing a starter page wrote [add, delete 1], and the add had taken that page.
  it('takes a delete of the blank an earlier add took as done, deleting nothing', () => {
    const fresh = run(tabOf(), [
      { op: 'add', kind: 'logo', name: 'Badge' },
      { op: 'delete', page: 1 },
    ]);
    expect(pagesOf(fresh.tab).map((p) => [p.kind, p.name])).toEqual([['logo', 'Badge']]);
    expect(fresh.lines[1]).toBe(
      'Page 1 was the empty first page, which change 1 made the page it added; nothing deleted.',
    );
    // With a second page added, the first is kept too, by place or by the blank's id.
    for (const ref of [1, 'p1'] as const) {
      const deck = run(tabOf({ pages: [page('p1', { kind: 'slide' })] }), [
        { op: 'add', kind: 'slide', name: 'Cover' },
        { op: 'add', kind: 'slide', name: 'Problem' },
        { op: 'delete', page: ref },
      ]);
      expect(pagesOf(deck.tab).map((p) => p.name)).toEqual(['Cover', 'Problem']);
    }
    // A page the call appended is deleted as asked.
    const appended = run(tabOf({ pages: [page('p1', { name: 'One' })] }), [
      { op: 'add', kind: 'infographic', name: 'Two' },
      { op: 'delete', page: 2 },
    ]);
    expect(pagesOf(appended.tab).map((p) => p.id)).toEqual(['p1']);
  });

  it('takes a delete of a page an earlier delete took with its article as done', () => {
    const pages = [
      page('s1'),
      page('a1', { kind: 'article', flow: 'f' }),
      page('a2', { kind: 'article', flow: 'f' }),
      page('a3', { kind: 'article', flow: 'f' }),
    ];
    const tab = tabOf({ pages, articles: { f: { blocks: [] } } });
    const out = run(tab, [
      { op: 'delete', page: 'a1' },
      { op: 'delete', page: 'a2' },
      { op: 'delete', page: 'a3' },
    ]);
    expect(pagesOf(out.tab).map((p) => p.id)).toEqual(['s1']);
    expect(out.lines).toEqual([
      'Deleted the article on page 2 (3 pages, writing and 0 elements).',
      'Page a2 went with what an earlier delete in this change took.',
      'Page a3 went with what an earlier delete in this change took.',
    ]);
  });

  it('takes a delete naming a page an earlier delete took, by its name, as done', () => {
    const pages = [
      page('s1'),
      page('a1', { kind: 'article', flow: 'f' }),
      page('a2', { kind: 'article', flow: 'f', name: 'Chapter 2' }),
    ];
    const tab = tabOf({ pages, articles: { f: { blocks: [] } } });
    const out = run(tab, [
      { op: 'delete', page: 'a1' },
      { op: 'delete', page: 'Chapter 2' },
    ]);
    expect(pagesOf(out.tab).map((p) => p.id)).toEqual(['s1']);
    expect(out.lines[1]).toBe(
      'Page Chapter 2 went with what an earlier delete in this change took.',
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
    const pages = Array.from({ length: MAX_PAGES - 1 }, (_, i) => page(`p${i}`));
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

// docs/specs/007-editor/pages-mode.md "Layouts": a layout placed on a themed tab takes the theme where it sets no
// colour, as any element made on the tab does.
describe('a layout on a themed tab', () => {
  it('takes the tab’s theme', () => {
    const out = run(tabOf({ pages: [page('p1', { kind: 'slide' })], theme: 'mocha' }), [
      { op: 'layout', page: 1, layout: 'slide-three-points' },
    ]);
    const circle = out.tab.elements.find((el) => el.type === 'shape' && el.shape === 'circle');
    expect(circle?.strokeColor).toBe(getBuiltInTheme('mocha').elementStroke);
  });
});

// docs/specs/024-agents/pages-for-agents.md "change_pages": apply_background_to_all, the
// Background tab's Apply to All.
describe('giving every page of a kind one background', () => {
  const slide = (id: string, extra: Partial<Page> = {}) =>
    page(id, { kind: 'slide', orientation: 'landscape', ...extra });

  it('sets a slide, then gives every other slide its background, in one call', () => {
    const tab = tabOf({ pages: [slide('s1'), slide('s2'), page('i1'), slide('s3')] });
    const out = run(tab, [
      { op: 'set', page: 1, background: { gradient: ['#1e1b4b', '#4c1d95'], pattern: 'dots' } },
      { op: 'apply_background_to_all', page: 1 },
    ]);
    expect(out.lines[1]).toBe('Gave 2 other slide pages the background of page 1.');
    const bg = Object.fromEntries(pageSummaries(out.tab).map((p) => [p.id, p.background]));
    expect(bg.s2).toBe(bg.s1);
    expect(bg.s3).toBe(bg.s1);
    expect(bg.i1).toBeNull();
  });

  it('says how many locked slides kept their own', () => {
    const tab = tabOf({
      pages: [
        slide('s1', { background: { fill: { kind: 'solid', color: '#0f172a' } } }),
        slide('s2', { locked: true }),
        slide('s3'),
      ],
    });
    expect(run(tab, [{ op: 'apply_background_to_all', page: 's1' }]).lines[0]).toBe(
      'Gave 1 other slide page the background of page 1; 1 locked kept their own.',
    );
  });

  it('is refused with no other page of the kind', () => {
    const tab = tabOf({ pages: [slide('s1'), page('i1')] });
    expect(refusal(tab, [{ op: 'apply_background_to_all', page: 1 }])).toMatchObject({
      code: 'no_other_pages',
      change: 0,
    });
  });
});

// docs/specs/007-editor/wireframe-pages.md: an agent adds a wireframe page in its device and sets its
// frame look and system bars.
describe('wireframe pages', () => {
  it('adds a page in its device, saying the device, the frame look and the bars', () => {
    const out = run(tabOf({ pages: [page('p1')] }), [
      { op: 'add', kind: 'wireframe', device: 'watch', frameLook: 'dark', systemBars: false },
    ]);
    const added = pagesOf(out.tab)[1]!;
    expect(added).toMatchObject({
      kind: 'wireframe',
      device: 'watch',
      frameLook: 'dark',
      systemBars: false,
    });
    expect(out.lines.join(' ')).toContain('device watch');
    expect(out.lines.join(' ')).toContain('frame dark');
    expect(out.lines.join(' ')).toContain('no system bars');
  });

  it('sets a wireframe page’s look and bars back on', () => {
    const tab = tabOf({
      pages: [
        page('w', { kind: 'wireframe', size: 'device', device: 'iphone', systemBars: false }),
      ],
    });
    const out = run(tab, [{ op: 'set', page: 1, frameLook: 'outline', systemBars: true }]);
    expect(pagesOf(out.tab)[0]).toMatchObject({ frameLook: 'outline' });
    expect(pagesOf(out.tab)[0]!.systemBars).toBeUndefined();
    expect(out.lines.join(' ')).toContain('frame outline');
    expect(out.lines.join(' ')).toContain('system bars');
    const barsOnly = run(tab, [{ op: 'set', page: 1, systemBars: true }]);
    expect(barsOnly.lines.join(' ')).not.toContain('frame');
    const lookOnly = run(tab, [{ op: 'set', page: 1, frameLook: 'light' }]);
    expect(lookOnly.lines.join(' ')).not.toContain('system bars');
  });

  it('refuses a frame look on a page that is not a wireframe', () => {
    expect(
      refusal(tabOf({ pages: [page('p1')] }), [{ op: 'set', page: 1, frameLook: 'dark' }]).code,
    ).toBe('not_a_wireframe');
  });

  it('refuses a device on a page added as another kind, rather than saying it was set', () => {
    const why = refusal(tabOf({ pages: [page('p1')] }), [
      { op: 'add', kind: 'slide', device: 'watch' },
    ]);
    expect(why.code).toBe('not_a_wireframe');
    expect(why.message).toMatch(/^A slide page has no device/);
    expect(
      refusal(tabOf({ pages: [page('p1')] }), [{ op: 'set', page: 1, frameLook: 'dark' }]).message,
    ).toMatch(/^An infographic page has no device/);
  });

  it("names the page's size by its device", () => {
    const out = run(tabOf({ pages: [page('p1')] }), [
      { op: 'add', kind: 'wireframe', device: 'ipad', orientation: 'landscape' },
      { op: 'add', kind: 'wireframe', device: 'laptop' },
    ]);
    expect(out.lines[0]).toContain('(wireframe, iPad landscape)');
    expect(out.lines[1]).toContain('(wireframe, Laptop)');
  });
});
