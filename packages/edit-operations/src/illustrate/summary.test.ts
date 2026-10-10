import { describe, expect, it } from 'vitest';
import type { IllustratePage, Tab } from '@livediagram/document';
import { articleSummaries, describeBackground, pageLabel, resolvePage, sizeLabel } from './summary';

// docs/specs/024-agents/illustrate-for-agents.md "change_pages" (the answer), "Naming a page".

const page = (id: string, extra: Partial<IllustratePage> = {}): IllustratePage => ({
  id,
  orientation: 'portrait',
  ...extra,
});

describe('backgrounds in words', () => {
  it('names the paper, a colour, a gradient and a pattern', () => {
    expect(describeBackground(undefined)).toBeNull();
    expect(describeBackground({})).toBeNull();
    expect(describeBackground({ fill: { kind: 'solid', color: '#fff' } })).toBe('#fff');
    expect(
      describeBackground({
        fill: { kind: 'gradient', from: '#000', to: '#fff', angle: 160 },
        pattern: 'grid',
      }),
    ).toBe('gradient #000 → #fff, grid pattern');
    expect(describeBackground({ pattern: 'lines' })).toBe('lines pattern');
  });
});

describe('sizes and labels', () => {
  it('names a size with its turn where it has one', () => {
    expect(sizeLabel(page('p'))).toBe('A4 portrait');
    expect(sizeLabel(page('p', { size: 'social', orientation: 'landscape' }))).toBe(
      'Landscape post (5:4) landscape',
    );
    expect(sizeLabel(page('p', { size: 'square' }))).toBe('Square');
    expect(sizeLabel(page('l', { size: 'logo', kind: 'logo' }))).toBe('1024 x 1024');
  });

  it('labels a page by place, name and kind', () => {
    const base = {
      id: 'p',
      size: 'a4',
      orientation: null,
      rect: { x: 0, y: 0, width: 1, height: 1 },
      background: null,
      locked: false,
      flow: null,
      elements: 0,
    } as const;
    expect(pageLabel({ ...base, place: 2, name: 'Cover', kind: 'slide' })).toBe('2 Cover (slide)');
    expect(pageLabel({ ...base, place: 3, name: null, kind: 'article' })).toBe('3 (article)');
  });
});

describe('naming a page', () => {
  const pages = [
    page('page-1', { name: 'Cover' }),
    page('p2'),
    page('p3', { name: 'Team_photos' }),
  ];

  it('reads an id, a place, a place as text, then a name', () => {
    expect(resolvePage(pages, 'p2')?.id).toBe('p2');
    expect(resolvePage(pages, 3)?.id).toBe('p3');
    expect(resolvePage(pages, ' 1 ')?.id).toBe('page-1');
    expect(resolvePage(pages, 'team photos')?.id).toBe('p3');
    expect(resolvePage(pages, 'COVER')?.id).toBe('page-1');
    expect(resolvePage(pages, 'Nope')).toBeUndefined();
    expect(resolvePage(pages, 9)).toBeUndefined();
  });
});

describe('articles in the answer', () => {
  it('lists each article once, in row order, with its pages and size', () => {
    const tab = {
      elements: [],
      pages: [
        page('i'),
        page('b1', { kind: 'article', flow: 'b' }),
        page('a1', { kind: 'article', flow: 'a' }),
        page('a2', { kind: 'article', flow: 'a' }),
        page('x', { kind: 'article', flow: 'missing' }),
      ],
      articles: {
        a: {
          blocks: [{ id: '1', type: 'paragraph', style: 'title', runs: [{ text: 'Alpha' }] }],
          style: { look: 'report' },
        },
        b: { blocks: [{ id: '2', type: 'paragraph', runs: [{ text: 'two words' }] }] },
      },
    } as unknown as Pick<Tab, 'elements' | 'pages' | 'articles'>;
    expect(articleSummaries(tab)).toEqual([
      { flow: 'b', title: 'Untitled', pages: [2], blocks: 1, words: 2, look: null },
      { flow: 'a', title: 'Alpha', pages: [3, 4], blocks: 1, words: 1, look: 'report' },
    ]);
  });
});
