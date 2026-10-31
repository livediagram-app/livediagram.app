import { describe, expect, it } from 'vitest';
import {
  articlesOf,
  layOutPages,
  pagesOf,
  parseArticleFlow,
  withZonesFitted,
  withZonesSettled,
  zoneCanvasRect,
  zoneMemberIds,
  type ArticleZoneBlock,
  type ImageElement,
} from '@livedocuments/document';
import { buildArticleTab, pictureZoneSize } from './build-article';
import type { DocxBlock } from './docx';
import type { PictureOutcome } from './store-images';

const para = (id: string, text: string): DocxBlock => ({ id, type: 'paragraph', runs: [{ text }] });
const pic = (
  id: string,
  path: string,
  widthPx: number,
  heightPx: number,
  alt?: string,
): DocxBlock => ({
  id,
  type: 'picture',
  picture: { path, widthPx, heightPx, ...(alt ? { alt } : {}) },
});

const stored = (imageId: string, width = 800, height = 600): PictureOutcome => ({
  ok: true,
  imageId,
  width,
  height,
  kind: 'uploaded',
});

describe('buildArticleTab', () => {
  const blocks = [
    para('b1', 'Intro'),
    pic('b2', 'word/media/a.png', 1200, 600, 'Wide'),
    para('b3', 'Middle'),
    pic('b4', 'word/media/b.png', 200, 100),
    pic('b5', 'word/media/c.png', 0, 0),
  ];
  const outcomes = new Map<string, PictureOutcome>([
    ['word/media/a.png', stored('img-a')],
    ['word/media/b.png', { ok: false, failure: 'gallery-full' }],
    ['word/media/c.png', stored('img-c', 300, 150)],
  ]);
  const tab = buildArticleTab(blocks, outcomes, '  Report ');
  const flow = Object.keys(articlesOf(tab))[0]!;
  const doc = articlesOf(tab)[flow]!;
  const zones = doc.blocks.filter((b): b is ArticleZoneBlock => b.type === 'zone');
  const pages = layOutPages(pagesOf(tab));

  it('is one article page holding the writing, a picture an object zone with an image', () => {
    expect(tab.name).toBe('Report');
    expect(pages).toHaveLength(1);
    expect(pages[0]!.kind).toBe('article');
    expect(pages[0]!.id).not.toBe('page-1');
    expect(doc.blocks.map((b) => b.type)).toEqual([
      'paragraph',
      'zone',
      'paragraph',
      'zone',
      'zone',
    ]);
    expect(zones.map((z) => z.zone)).toEqual(['object', 'object', 'object']);
    expect(tab.elements).toHaveLength(3);
    // The stored writing reads back as it was built.
    expect(parseArticleFlow(doc).blocks).toEqual(doc.blocks);
  });

  it('sizes a zone to its picture, at most the text width, and an image fills it', () => {
    const [wide, small, unsized] = zones;
    // A4's 794 px less two 96 px margins (the article's Normal margins).
    expect(wide).toMatchObject({ width: 602, height: 301 });
    expect(small).toMatchObject({ width: 200, height: 100 });
    // No extent: the stored image's own size.
    expect(unsized).toMatchObject({ width: 300, height: 150 });
    const images = tab.elements as ImageElement[];
    expect(images[0]).toMatchObject({
      imageId: 'img-a',
      naturalWidth: 800,
      naturalHeight: 600,
      alt: 'Wide',
      aspectLocked: true,
    });
    // Not stored: an empty placeholder of the same size.
    expect(images[1]).toMatchObject({ imageId: null, width: 200, height: 100 });
    expect(images[1]!.naturalWidth).toBeUndefined();
  });

  it('parks each zone in a slot of its own, its image exactly there and nothing else', () => {
    for (const [i, zone] of zones.entries()) {
      const rect = zoneCanvasRect(pages, zone)!;
      expect(rect.x + rect.width).toBeLessThan(pages[0]!.rect.x);
      const members = zoneMemberIds(tab.elements, rect);
      expect([...members]).toEqual([tab.elements[i]!.id]);
      expect(tab.elements[i]).toMatchObject(rect);
    }
  });

  it('lets the editor’s first layout carry each image to where its zone lands, and fitting keeps it', () => {
    const page = pages[0]!;
    const settled = withZonesSettled(tab, flow, [
      { id: 'b2', index: 0, x: 72, y: 140 },
      { id: 'b4', index: 0, x: 72, y: 520 },
      { id: 'b5', index: 0, x: 72, y: 700 },
    ]);
    const images = settled.elements as ImageElement[];
    expect(images[0]).toMatchObject({ x: page.rect.x + 72, y: page.rect.y + 140, width: 602 });
    expect(images[1]).toMatchObject({ x: page.rect.x + 72, y: page.rect.y + 520 });
    expect(images[2]).toMatchObject({ x: page.rect.x + 72, y: page.rect.y + 700 });
    // Fitting finds every zone's object where it should be and changes nothing.
    expect(withZonesFitted(settled, flow, 602)).toBe(settled);
    // Fitting before the first layout keeps the parked images too.
    expect(withZonesFitted(tab, flow, 602)).toBe(tab);
  });

  it('gives an empty document one empty paragraph, and an untitled tab a name', () => {
    const empty = buildArticleTab([], new Map(), '');
    expect(empty.name).toBe('Imported');
    expect(articlesOf(empty)[Object.keys(articlesOf(empty))[0]!]!.blocks).toMatchObject([
      { type: 'paragraph', runs: [] },
    ]);
  });
});

describe('pictureZoneSize', () => {
  it('falls back to a modest box, and clamps tiny pictures to a zone’s least side', () => {
    expect(pictureZoneSize({ path: 'a', widthPx: 0, heightPx: 0 }, undefined, 650)).toEqual({
      width: 320,
      height: 240,
    });
    expect(pictureZoneSize({ path: 'a', widthPx: 0, heightPx: 0 }, 'over-cap', 650)).toEqual({
      width: 320,
      height: 240,
    });
    expect(pictureZoneSize({ path: 'a', widthPx: 4, heightPx: 2 }, undefined, 650)).toEqual({
      width: 24,
      height: 24,
    });
  });
});
