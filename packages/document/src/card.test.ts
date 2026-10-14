import { describe, expect, it } from 'vitest';
import {
  CARD_TAGS_MAX,
  appendWebRow,
  cardLayout,
  cardSlotsOf,
  createComponent,
  createShape,
  isValidElement,
  migrateLegacyCallouts,
  migrateStoredElements,
  normaliseElement,
  svgBoxed,
  withCardHeader,
  withCardMedia,
  withWebRows,
  type Element,
  type ShapeElement,
} from './index';

const card = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...(createShape('card', 0, 0) as ShapeElement),
  id: 'c1',
  ...over,
});

const slots = (over: Partial<Parameters<typeof cardLayout>[2]> = {}) => ({
  header: false,
  media: false,
  title: false,
  meta: false,
  badge: false,
  tags: [] as string[],
  ...over,
});

describe('card layout (docs/specs/009-elements/card.md)', () => {
  it('gives the body the whole padded box when every other slot is off', () => {
    const l = cardLayout(300, 150, slots());
    expect(l.band).toBeNull();
    expect(l.media).toBeNull();
    expect(l.title).toBeNull();
    expect(l.body.x).toBe(l.body.y);
    expect(l.body.width).toBe(300 - l.body.x * 2);
  });

  it('puts a tile above a full-width body, and a badge beside a body under the title', () => {
    const tile = cardLayout(300, 150, slots({ media: true, title: true }));
    expect(tile.body.x).toBe(tile.media!.x);
    expect(tile.body.y).toBeGreaterThan(tile.media!.y + tile.media!.height);
    const badge = cardLayout(300, 150, slots({ media: true, title: true, badge: true }));
    expect(badge.body.x).toBe(badge.title!.x);
    expect(badge.body.y).toBeLessThan(badge.media!.y + badge.media!.height);
  });

  it('carries the title and the meta line in the header band', () => {
    const l = cardLayout(300, 150, slots({ header: true, title: true, meta: true, media: true }));
    expect(l.band).toEqual({ x: 0, y: 0, width: 300, height: l.band!.height });
    expect(l.title!.y).toBe(0);
    expect(l.meta!.x + l.meta!.width).toBeLessThanOrEqual(300);
    expect(l.media!.height).toBeLessThan(l.band!.height);
    expect(l.body.y).toBeGreaterThan(l.band!.height);
  });

  it('lays tags along the bottom and drops the ones that do not fit', () => {
    const l = cardLayout(200, 150, slots({ tags: ['alpha', 'beta', 'gamma', 'delta', 'epsilon'] }));
    expect(l.tags.length).toBeGreaterThan(0);
    expect(l.tags.length).toBeLessThan(5);
    for (const t of l.tags) expect(t.rect.x + t.rect.width).toBeLessThanOrEqual(200);
    expect(l.body.y + l.body.height).toBeLessThan(l.tags[0]!.rect.y);
  });

  it('drops tags, then the meta line, then media, when the card is too small', () => {
    const l = cardLayout(
      120,
      60,
      slots({ media: true, title: true, meta: true, tags: ['one', 'two'] }),
    );
    expect(l.tags).toEqual([]);
    expect(l.body.height).toBeGreaterThan(0);
  });

  it('reads its slots off the element, and a callout as a badge card', () => {
    expect(cardSlotsOf(card())).toMatchObject({
      media: true,
      title: true,
      meta: true,
      badge: false,
    });
    const callout = { ...card({ cardMedia: undefined }), shape: 'callout' } as ShapeElement;
    expect(cardSlotsOf(callout)).toMatchObject({ media: true, badge: true });
  });
});

describe('card writes', () => {
  it('sets and clears media and the header band on a card only', () => {
    expect(withCardMedia(card(), 'initial').cardMedia).toBe('initial');
    expect('cardMedia' in withCardMedia(card(), null)).toBe(false);
    expect(withCardHeader(card(), true).cardHeader).toBe(true);
    expect('cardHeader' in withCardHeader(card({ cardHeader: true }), false)).toBe(false);
    const square = createShape('square', 0, 0);
    expect(withCardMedia(square, 'tile')).toBe(square);
  });

  it('bounds tags (I1) and stores none as nothing', () => {
    const many = Array.from(
      { length: 9 },
      (_, i) => `  tag ${i}   with   spaces and a very long tail  `,
    );
    const out = withWebRows(card(), { tags: many });
    expect(out.tags).toHaveLength(CARD_TAGS_MAX);
    expect(out.tags![0]!.length).toBeLessThanOrEqual(32);
    expect(out.tags![0]!.startsWith('tag 0 with spaces')).toBe(true);
    expect('tags' in withWebRows(card(), { tags: [] })).toBe(false);
  });

  it('appends a Tag until six', () => {
    let el = card({ tags: [] });
    for (let i = 0; i < 8; i++) el = appendWebRow(el);
    expect(el.tags).toHaveLength(CARD_TAGS_MAX);
    expect(el.tags![0]).toBe('Tag');
  });
});

describe('the Callout preset and migration', () => {
  it('places the Callout as a badge card with its old size and copy', () => {
    const el = createComponent('callout', 100, 100, {
      accent: '#123456',
      surface: '#ffffff',
      ink: '#111111',
    }) as ShapeElement;
    expect(el.shape).toBe('card');
    expect(el.cardMedia).toBe('badge');
    expect(el.pageTitle).toBe('Heads up');
    expect([el.width, el.height]).toEqual([380, 116]);
  });

  it('migrates a stored callout to a card, keeping its fields (I2)', () => {
    const stored = {
      ...card({ cardMedia: undefined, tags: undefined, pageSubtitle: undefined }),
      shape: 'callout',
      pageTitle: 'Note',
      label: 'Body',
      fillColor: '#fff0f0',
    } as unknown as Element;
    const [out] = migrateStoredElements([stored]) as ShapeElement[];
    expect(out).toMatchObject({
      shape: 'card',
      cardMedia: 'badge',
      pageTitle: 'Note',
      label: 'Body',
    });
    expect(out!.fillColor).toBe('#fff0f0');
  });

  it('returns the same array when there is no callout', () => {
    const els = [card()];
    expect(migrateLegacyCallouts(els)).toBe(els);
  });

  it('turns an agent-written callout into a card on write', () => {
    const out = normaliseElement({ ...card(), shape: 'callout' }) as ShapeElement;
    expect(out.shape).toBe('card');
  });
});

describe('card validation', () => {
  it('accepts a card and a legacy callout, and bounds the slots', () => {
    expect(isValidElement(card())).toBe(true);
    expect(isValidElement({ ...card(), shape: 'callout' })).toBe(true);
    expect(isValidElement(card({ tags: Array(7).fill('x') }))).toBe(false);
    expect(isValidElement(card({ tags: ['x'.repeat(33)] }))).toBe(false);
    expect(isValidElement(card({ cardMedia: 'photo' as never }))).toBe(false);
  });
});

describe('card export', () => {
  it('draws the title, the meta line, the body and the tags', () => {
    const svg = svgBoxed(card());
    for (const text of ['Payments', 'Stripe, EU region', 'PCI', 'v2']) expect(svg).toContain(text);
  });

  it('draws the media glyph from the resolver, and the header band in the accent', () => {
    const art = { markup: '<path d="M1 1"/>', colored: false };
    const svg = svgBoxed(card({ cardHeader: true, strokeColor: '#336699' }), {
      resolveIconArt: (id) => (id === 'credit-card' ? art : undefined),
    });
    expect(svg).toContain('<path d="M1 1"/>');
    expect(svg).toContain('clip-path="url(#lvd-cb-c1)"');
    expect(svg).toContain('fill="#336699" clip-path');
  });

  it('draws an initial from the title', () => {
    const svg = svgBoxed(card({ cardMedia: 'initial', pageTitle: 'ops lead' }));
    expect(svg).toMatch(/>O<\/text>/);
  });
});

describe('card lines and inline icons', () => {
  it('switches the title and meta line on with starting words and off entirely', async () => {
    const { withCardLine } = await import('./card');
    expect(withCardLine(card({ pageTitle: undefined }), 'pageTitle', true).pageTitle).toBe('Title');
    expect(withCardLine(card(), 'pageTitle', true).pageTitle).toBe('Payments');
    expect('pageSubtitle' in withCardLine(card(), 'pageSubtitle', false)).toBe(false);
  });

  it('turns on Tile media when an icon lands on a card with none', async () => {
    const { withInlineIcon } = await import('./card');
    expect(withInlineIcon(card({ cardMedia: undefined }), 'zap').cardMedia).toBe('tile');
    expect(withInlineIcon(card({ cardMedia: 'badge' }), 'zap').cardMedia).toBe('badge');
    const sq = withInlineIcon(createShape('square', 0, 0) as ShapeElement, 'zap', 'left');
    expect(sq).toMatchObject({ iconId: 'zap', iconPosition: 'left' });
    expect('cardMedia' in sq).toBe(false);
  });
});

describe('a card with no body text', () => {
  it('keeps its media even when too short for a body', () => {
    const l = cardLayout(176, 60, {
      header: false,
      media: true,
      title: true,
      meta: false,
      badge: false,
      tags: [],
      body: false,
    });
    expect(l.media).not.toBeNull();
  });
});

describe('a one-line card', () => {
  it('centres its title row when it has no body, tags or band', () => {
    const l = cardLayout(216, 72, {
      header: false,
      media: true,
      title: true,
      meta: false,
      badge: false,
      tags: [],
      body: false,
    });
    const mid = l.media!.y + l.media!.height / 2;
    expect(mid).toBeCloseTo(36, 0);
  });
});
