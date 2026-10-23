import { describe, expect, it } from 'vitest';
import type { Page } from '@livedesign/design';
import { describeBackground, pageLabel, resolvePage, sizeLabel } from './summary';

// docs/specs/024-agents/pages-for-agents.md "change_pages" (the answer), "Naming a page".

const page = (id: string, extra: Partial<Page> = {}): Page => ({
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
    expect(
      describeBackground({
        fill: { kind: 'image', imageId: 'i', overlay: { kind: 'light', strength: 0.6 } },
      }),
    ).toBe('image, light 60%');
    expect(describeBackground({ fill: { kind: 'image', imageId: 'i' } })).toBe('image, no overlay');
  });
});

describe('sizes and labels', () => {
  it('names a size with its turn where it has one', () => {
    expect(sizeLabel(page('p'))).toBe('A4 portrait');
    expect(sizeLabel(page('p', { orientation: 'landscape' }))).toBe('A4 landscape');
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
    expect(pageLabel({ ...base, place: 2, name: 'Cover', kind: 'wireframe' })).toBe(
      '2 Cover (wireframe)',
    );
    expect(pageLabel({ ...base, place: 3, name: null, kind: 'logo' })).toBe('3 (logo)');
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
