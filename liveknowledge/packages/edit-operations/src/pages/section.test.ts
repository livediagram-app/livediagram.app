// An append under a heading, with a picture (liveworkspace/docs/specs/004-index/send-to-knowledge.md "The section").
import { describe, expect, it } from 'vitest';
import {
  ARTICLE_ZONE_MAX,
  ARTICLE_ZONE_MIN,
  articlesOf,
  type ArticleFlow,
  type Page,
  type Tab,
} from '@liveknowledge/document';
import { applyArticleWrite } from './article-write';
import { parsePagesRequest } from './parse';
import { articleHeadings, pictureZoneSize, sectionEndOf } from './section';

type Block = ArticleFlow['blocks'][number];
const para = (id: string, text: string, style?: 'h1' | 'h2' | 'h3'): Block => ({
  id,
  type: 'paragraph',
  ...(style ? { style } : {}),
  runs: [{ text }],
});
const page = (id: string, extra: Partial<Page> = {}): Page => ({
  id,
  orientation: 'portrait',
  ...extra,
});
const tabWith = (blocks: Block[]): Tab => ({
  id: 't',
  name: 'T',
  elements: [],
  pages: [page('pg1', { kind: 'article', flow: 'art' })],
  articles: { art: { blocks } },
});

const blocks = [
  para('intro', 'Intro'),
  para('h-a', 'Overview', 'h2'),
  para('a1', 'About it'),
  para('h-a1', 'Detail', 'h3'),
  para('a2', 'Deep'),
  para('h-b', 'Payments', 'h2'),
  para('b1', 'Pay'),
];

const texts = (tab: Tab) =>
  articlesOf(tab).art!.blocks.map((b) =>
    'runs' in b ? b.runs.map((r) => r.text).join('') : b.type,
  );

describe('sectionEndOf', () => {
  it('ends a heading’s part before the next heading of the same or a higher level', () => {
    expect(sectionEndOf(blocks, 'h-a')).toBe(5);
    expect(sectionEndOf(blocks, 'h-a1')).toBe(5);
    expect(sectionEndOf(blocks, 'h-b')).toBe(7);
  });

  it('finds a heading by its words, case and spacing aside, and nothing for another block', () => {
    expect(sectionEndOf(blocks, '  overview ')).toBe(5);
    expect(sectionEndOf(blocks, 'intro')).toBeNull();
    expect(sectionEndOf(blocks, 'a1')).toBeNull();
    expect(sectionEndOf(blocks, 'Nowhere')).toBeNull();
  });
});

describe('articleHeadings', () => {
  it('lists headings with their levels, skipping empty ones', () => {
    expect(articleHeadings({ blocks: [...blocks, para('h-empty', '  ', 'h1')] })).toEqual([
      { id: 'h-a', level: 2, text: 'Overview' },
      { id: 'h-a1', level: 3, text: 'Detail' },
      { id: 'h-b', level: 2, text: 'Payments' },
    ]);
  });
});

describe('an append under a heading, with a picture', () => {
  it('writes the blocks at the end of the heading’s part', () => {
    const out = applyArticleWrite(tabWith(blocks), {
      markdown: '## Sent\n\nNew words',
      mode: 'append',
      after: 'h-a',
    });
    if ('refusal' in out) throw new Error(out.refusal.message);
    expect(texts(out.tab)).toEqual([
      'Intro',
      'Overview',
      'About it',
      'Detail',
      'Deep',
      'Sent',
      'New words',
      'Payments',
      'Pay',
    ]);
  });

  it('places the picture after the words in a parked object zone, its image there', () => {
    const out = applyArticleWrite(tabWith(blocks), {
      markdown: 'Words',
      mode: 'append',
      picture: { imageId: 'img_1', width: 4000, height: 1000, alt: 'The selection' },
    });
    if ('refusal' in out) throw new Error(out.refusal.message);
    const doc = articlesOf(out.tab).art!;
    const zone = doc.blocks.at(-1)!;
    expect(doc.blocks.at(-2)).toMatchObject({ type: 'paragraph', runs: [{ text: 'Words' }] });
    expect(zone).toMatchObject({ type: 'zone', zone: 'object', align: 'left' });
    if (zone.type !== 'zone') throw new Error('no zone');
    expect(zone.width).toBeLessThan(4000);
    expect(zone.at!.x).toBeLessThan(0);
    const image = out.tab.elements.find((e) => e.type === 'image')!;
    expect(image).toMatchObject({
      imageId: 'img_1',
      width: zone.width,
      height: zone.height,
      naturalWidth: 4000,
      naturalHeight: 1000,
      alt: 'The selection',
    });
  });

  it('puts the picture where a [picture] line stands', () => {
    const out = applyArticleWrite(tabWith(blocks), {
      markdown: 'Words\n\n[picture]\n\nSent from here',
      mode: 'append',
      picture: { imageId: 'img_1', width: 40, height: 20 },
    });
    if ('refusal' in out) throw new Error(out.refusal.message);
    expect(texts(out.tab).slice(-3)).toEqual(['Words', 'zone', 'Sent from here']);
  });

  it('refuses a heading the page does not have', () => {
    const out = applyArticleWrite(tabWith(blocks), {
      markdown: 'x',
      mode: 'append',
      after: 'Gone',
    });
    expect('refusal' in out && out.refusal.code).toBe('heading_unknown');
  });
});

describe('pictureZoneSize', () => {
  it('scales a picture down to the text and a zone’s tallest, never up, within a zone’s sides', () => {
    expect(pictureZoneSize({ width: 300, height: 200 }, 600)).toEqual({ width: 300, height: 200 });
    expect(pictureZoneSize({ width: 1200, height: 600 }, 600)).toEqual({ width: 600, height: 300 });
    expect(pictureZoneSize({ width: 100, height: 9000 }, 600).height).toBe(ARTICLE_ZONE_MAX);
    expect(pictureZoneSize({ width: 2, height: 2 }, 600).width).toBe(ARTICLE_ZONE_MIN);
  });
});

describe('the wire', () => {
  it('reads "after" and "picture" with an append, and refuses them otherwise', () => {
    expect(
      parsePagesRequest({
        article: {
          markdown: 'x',
          mode: 'append',
          after: 'Overview',
          picture: { imageId: 'i', width: 2, height: 3 },
        },
      }),
    ).toEqual({
      article: {
        markdown: 'x',
        mode: 'append',
        after: 'Overview',
        picture: { imageId: 'i', width: 2, height: 3 },
      },
    });
    expect(parsePagesRequest({ article: { markdown: 'x', after: 'Overview' } })).toMatchObject({
      refusal: { code: 'invalid_value' },
    });
    expect(
      parsePagesRequest({
        article: { markdown: 'x', mode: 'append', picture: { imageId: 'i', width: 0, height: 3 } },
      }),
    ).toMatchObject({ refusal: { code: 'invalid_value' } });
    expect(
      parsePagesRequest({
        article: {
          markdown: 'x',
          mode: 'append',
          picture: { imageId: 'i', width: 2, height: 3, src: 'x' },
        },
      }),
    ).toMatchObject({ refusal: { code: 'invalid_value' } });
    expect(
      parsePagesRequest({ article: { markdown: 'x', mode: 'append', picture: 'i' } }),
    ).toMatchObject({
      refusal: { code: 'invalid_value' },
    });
  });
});
