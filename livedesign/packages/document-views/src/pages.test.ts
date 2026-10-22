import { describe, expect, it } from 'vitest';
import type { PagesView } from '@livedesign/api-schema';
import { layOutPages, type Element, type Page, type Tab } from '@livedesign/document';
import { shapeAt } from './__fixtures__/build';
import { itemLines } from './pages';
import { renderView } from './render-view';

// docs/specs/024-agents/pages-for-agents.md "Reading: the pages view".

const pages: Page[] = [
  { id: 'page-cover', orientation: 'landscape', name: 'Cover' },
  { id: 'page-logo', orientation: 'portrait', size: 'logo', kind: 'logo', locked: true },
  { id: 'page-wf1', orientation: 'portrait', size: 'device', kind: 'wireframe', device: 'iphone' },
];
const cover = layOutPages(pages)[0]!.rect;

const pagesTab = (): Tab =>
  ({
    id: 'tab-deck',
    name: 'Deck',
    opensIn: 'pages',
    pages,
    elements: [shapeAt('square', 'aaaa1111', cover.x + 100, cover.y + 100)],
  }) as unknown as Tab;

const pagesOf = (tab: Tab, budget?: number) => {
  const out = renderView({ view: 'pages', ...(budget ? { budget } : {}) }, tab, { rev: 7 });
  if (!out.ok) throw new Error('refused');
  return out;
};

describe('the items of an element’s lists', () => {
  it('prints each list of words and numbers under its element, cut when long', () => {
    const el = {
      id: 'p1',
      type: 'shape',
      shape: 'process',
      processSteps: [{ label: 'Plan', note: '' }, { label: 'Build' }, 3, null],
      stats: [{ value: '99.9%', caption: 'uptime' }],
      empty: [],
      blanks: [{ x: true }],
      long: Array.from({ length: 80 }, (_, i) => `item ${i}`),
    } as unknown as Element;
    const lines = itemLines(el);
    expect(lines[0]).toBe('    processSteps: Plan | Build | 3');
    expect(lines[1]).toBe('    stats: 99.9% / uptime');
    expect(lines[2]!.endsWith('…')).toBe(true);
    expect(lines).toHaveLength(3);
  });
});

describe('the pages view', () => {
  it('lists each page with its rectangle and the refs on it', () => {
    const out = pagesOf(pagesTab());
    const lines = out.text.split('\n');
    expect(lines[0]).toBe(
      'tab tab-deck "Deck" · 1 element: 1 box · 3 pages: 1 logo, 1 wireframe, 1 blank (view pages) · rev 7',
    );
    expect(lines[1]).toBe(
      `page 1 "Cover" page-cover · blank A4 · at ${Math.round(cover.x)},${Math.round(cover.y)} 1123x794 · 1 element`,
    );
    expect(lines[2]).toBe('  square aaaa1111');
    expect(lines[1]).toBe(
      `page 1 "Cover" page-cover · blank A4 · at ${Math.round(cover.x)},${Math.round(cover.y)} 1123x794 · 1 element`,
    );
    expect(lines[3]).toMatch(/^page 2 page-logo · logo 1024 x 1024 · at .* · locked · empty$/);
    expect(lines[4]).toMatch(/^page 3 page-wf1 · wireframe .* · at .* · empty$/);
    expect(out.text).toContain(
      "Rectangles and elements' x, y are canvas coordinates (the layout view prints positions from the content's corner).",
    );
    expect(out.text).toMatch(/layouts wireframe: /);
    expect(out.text).toMatch(/layouts logo: /);
    const json = out.json as PagesView;
    expect(json.pagesMode).toBe(true);
    expect(json.pages[0]).toMatchObject({ place: 1, kind: null, refs: ['aaaa1111'] });
    expect(json.layouts.map((l) => l.kind)).toEqual(['logo', 'wireframe']);
  });

  it('names a landscape page, its paint and its elements', () => {
    const page: Page = {
      id: 'page-wide',
      orientation: 'landscape',
      background: { fill: { kind: 'solid', color: '#0f172a' } },
    };
    const r = layOutPages([page])[0]!.rect;
    const tab = {
      id: 'tab-wide',
      name: 'Wide',
      opensIn: 'pages',
      pages: [page],
      elements: [
        shapeAt('square', 'cccc3333', r.x + 50, r.y + 50),
        {
          ...shapeAt('square', 'dddd4444', r.x + 300, r.y + 50),
          processSteps: [{ label: 'Plan' }],
        },
      ],
    } as unknown as Tab;
    const lines = pagesOf(tab).text.split('\n');
    expect(lines[1]).toMatch(
      /^page 1 page-wide · blank A4 · at .* · background #0f172a · 2 elements$/,
    );
    expect(lines).toContain('    processSteps: Plan');
  });

  it('keeps to a budget, saying what it left out', () => {
    const out = pagesOf(pagesTab(), 60);
    expect(out.text).toMatch(/hidden/);
    expect((out.json as PagesView).elision).not.toBeNull();
  });
});

describe('a photo page (docs/specs/031-photo/photo-pages.md "Agents")', () => {
  it('names its pixel size and lists its layers top first, and offers no layouts', () => {
    const tab = {
      id: 'tab-photo',
      name: 'Photo',
      opensIn: 'pages',
      pages: [
        {
          id: 'page-ph',
          orientation: 'landscape',
          size: 'photo',
          fit: { width: 2048, height: 1536 },
          kind: 'photo',
        },
      ],
      elements: [],
      photos: {
        'page-ph': {
          width: 4000,
          height: 3000,
          layers: [
            { id: 'ly-00000001', name: 'Background', layerKind: 'pixel', pixels: { tiles: {} } },
            {
              id: 'ly-00000002',
              name: 'Inside',
              layerKind: 'pixel',
              parent: 'ly-00000003',
              pixels: { tiles: {} },
              opacity: 0.5,
            },
            { id: 'ly-00000003', name: 'Group 1', layerKind: 'group', visible: false },
            {
              id: 'ly-00000004',
              name: 'Levels 1',
              layerKind: 'adjustment',
              blend: 'multiply',
              adjustment: { id: 'levels', params: {} },
            },
          ],
        },
      },
    } as unknown as Tab;
    const out = pagesOf(tab);
    expect(out.text).toContain('photo 4000x3000 px, 4 layers');
    const layerLines = out.text.split('\n').filter((l) => l.includes('layer "'));
    expect(layerLines).toEqual([
      '  layer "Levels 1" · adjustment · multiply',
      '  layer "Group 1" · group · hidden',
      '    layer "Inside" · pixel · 50%',
      '  layer "Background" · pixel',
    ]);
    expect(out.text).not.toMatch(/layouts photo/);
  });
});
