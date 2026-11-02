import { describe, expect, it } from 'vitest';
import { layOutPages, pagesOf, type ImageElement, type TextElement } from '@livedocuments/document';
import { buildDeckTab, slideSizeFor, slideTextSize } from './build-deck';
import type { PptxRead } from './pptx';
import type { PictureOutcome } from './store-images';

const text = (x: number, y: number, label: string, sizePt = 44) => ({
  kind: 'text' as const,
  box: { x, y, cx: 6096000, cy: 1000000 },
  label,
  sizePt,
  alignX: 'center' as const,
  alignY: 'middle' as const,
  bold: true,
  italic: true,
  underline: true,
});

describe('buildDeckTab', () => {
  const read: Pick<PptxRead, 'cx' | 'cy' | 'slides'> = {
    cx: 12192000,
    cy: 6858000,
    slides: [
      { items: [text(0, 0, 'Title')], notes: 'Say hello' },
      {
        items: [
          {
            kind: 'picture',
            box: { x: 6096000, y: 3429000, cx: 1219200, cy: 685800 },
            picture: { path: 'ppt/media/a.png', widthPx: 128, heightPx: 72, cropped: true },
          },
          text(0, 0, 'Small', 1),
        ],
        hidden: true,
      },
      { items: [] },
    ],
  };
  const outcomes = new Map<string, PictureOutcome>([
    ['ppt/media/a.png', { ok: true, imageId: 'img', width: 10, height: 5, kind: 'deduped' }],
  ]);
  const { tab, slides } = buildDeckTab(read, outcomes, 'Deck');
  const pages = layOutPages(pagesOf(tab));

  it('makes a 16:9 slide page per slide, with fresh page ids and no articles', () => {
    expect(pages.map((p) => [p.kind, p.size])).toEqual([
      ['slide', 'slide'],
      ['slide', 'slide'],
      ['slide', 'slide'],
    ]);
    expect(new Set(pages.map((p) => p.id)).size).toBe(3);
    expect(pages.every((p) => p.id.startsWith('page-') && p.id !== 'page-1')).toBe(true);
    expect(tab.articles).toEqual({});
    expect(tab.templateChosen).toBe(true);
  });

  it('places each item where it sits on its slide, scaled to the page', () => {
    const [title, image, small] = tab.elements as [TextElement, ImageElement, TextElement];
    const p0 = pages[0]!.rect;
    const p1 = pages[1]!.rect;
    // 1920 px / 12,192,000 EMU: half the slide's width is 960 px; 44 pt is 88 px.
    expect(title).toMatchObject({
      type: 'text',
      x: p0.x,
      y: p0.y,
      width: 960,
      label: 'Title',
      // 44 pt on a 1920px slide is 88px: the editor's largest size, scaled up.
      textSize: 48,
      textScale: 1.83,
      textAlignX: 'center',
      textAlignY: 'middle',
      textBold: true,
      textItalic: true,
      textUnderline: true,
    });
    expect(image).toMatchObject({
      type: 'image',
      x: p1.x + 960,
      y: p1.y + 540,
      width: 192,
      height: 108,
      imageId: 'img',
      objectFit: 'cover',
    });
    // Never smaller than 8 px.
    expect(small.textSize).toBe(8);
  });

  it('hands the Slide Deck each page’s notes and hidden flag', () => {
    expect(slides).toEqual([
      { pageId: pages[0]!.id, notes: 'Say hello' },
      { pageId: pages[1]!.id, hidden: true },
    ]);
  });

  it('centres a deck of another shape and makes one empty page of an empty deck', () => {
    const square = buildDeckTab(
      {
        cx: 1000,
        cy: 1000,
        slides: [{ items: [{ ...text(0, 0, 'x'), box: { x: 0, y: 0, cx: 1000, cy: 1000 } }] }],
      },
      new Map(),
      '',
    );
    const page = layOutPages(pagesOf(square.tab))[0]!;
    expect(page.size).toBe('slide-classic');
    expect(square.tab.elements[0]).toMatchObject({
      x: page.rect.x + 180,
      y: page.rect.y,
      width: 1080,
      height: 1080,
    });
    expect(square.tab.name).toBe('Imported');
    const empty = buildDeckTab({ cx: 1, cy: 1, slides: [] }, new Map(), 'E');
    expect(pagesOf(empty.tab)).toHaveLength(1);
    expect(empty.slides).toEqual([]);
  });
});

describe('slideSizeFor', () => {
  it('picks the nearer of 16:9 and 4:3', () => {
    expect(slideSizeFor(9144000, 5143500)).toBe('slide');
    expect(slideSizeFor(9144000, 6858000)).toBe('slide-classic');
    expect(slideSizeFor(16, 10)).toBe('slide');
  });
});

describe('slideTextSize', () => {
  it('keeps an exact size up to 48px, at least 8px, and scales the largest past it', () => {
    expect(slideTextSize(4)).toEqual({ textSize: 8 });
    expect(slideTextSize(23.6)).toEqual({ textSize: 24 });
    expect(slideTextSize(48)).toEqual({ textSize: 48 });
    expect(slideTextSize(120)).toEqual({ textSize: 48, textScale: 2.5 });
    expect(slideTextSize(100_000)).toEqual({ textSize: 48, textScale: 40 });
  });
});
