import { describe, expect, it } from 'vitest';
import {
  COMPONENT_SIZE,
  createAvatar,
  createComponent,
  createHero,
  createShape,
  headerLayout,
  heroCaptionLayout,
  isValidElement,
  isWebComponentShape,
  processLayout,
  recolourElementForTheme,
  renderElementsToSvg,
  statRowLayout,
  switchThemeElement,
  THEMES,
  NAV_LINKS_MAX,
  PROCESS_MAX_STEPS,
  STATS_MAX,
  WEB_TEXT_MAX,
  appendWebRow,
  canAppendWebRow,
  withWebRows,
  type ComponentKind,
  type ImageElement,
  type ShapeElement,
  type Tab,
} from './index';

const colors = { accent: '#be123c', surface: '#ffe4e6', ink: '#881337' };
const KINDS: ComponentKind[] = ['banner', 'hero', 'header', 'callout', 'stat', 'process', 'avatar'];

describe('components are single elements (spec/146)', () => {
  it('every component builds exactly one element, centred on the drop point', () => {
    for (const k of KINDS) {
      const el = createComponent(k, 100, 50, colors);
      expect(el.type === 'arrow').toBe(false);
      if (el.type === 'arrow') continue;
      expect(el.x + el.width / 2).toBe(100);
      expect(el.y + el.height / 2).toBe(50);
      expect({ width: el.width, height: el.height }).toEqual(COMPONENT_SIZE[k]);
      // Nothing is held together by a group any more.
      expect('groupId' in el).toBe(false);
    }
  });

  it('maps the palette ids onto the shape kinds', () => {
    const kind = (k: ComponentKind) => (createComponent(k, 0, 0, colors) as ShapeElement).shape;
    expect(kind('banner')).toBe('banner');
    expect(kind('header')).toBe('site-header');
    expect(kind('callout')).toBe('callout');
    expect(kind('stat')).toBe('stat-row');
    expect(kind('process')).toBe('process');
  });

  it('dresses the accent-bar kinds in the accent with white text, the cards in surface + ink', () => {
    const banner = createComponent('banner', 0, 0, colors) as ShapeElement;
    expect(banner).toMatchObject({ strokeColor: '#be123c', textColor: '#ffffff' });
    expect(banner.fillColor).toBeUndefined(); // the bar paints in the stroke
    const callout = createComponent('callout', 0, 0, colors) as ShapeElement;
    expect(callout).toMatchObject({
      fillColor: '#ffe4e6',
      strokeColor: '#be123c',
      textColor: '#881337',
    });
  });

  it('starts each one with content that says what it is', () => {
    expect(createShape('banner', 0, 0)).toMatchObject({
      label: 'Banner title',
      pageSubtitle: 'Subtitle or description',
    });
    expect(createShape('callout', 0, 0)).toMatchObject({ pageTitle: 'Heads up' });
    expect(createShape('stat-row', 0, 0).stats).toHaveLength(3);
    expect(createShape('process', 0, 0).processSteps).toEqual(['Plan', 'Build', 'Ship']);
    expect(createShape('site-header', 0, 0)).toMatchObject({
      label: 'Brand',
      navLinks: ['Home', 'About', 'Contact'],
    });
  });

  it('the hero is an image with a caption card in the accent', () => {
    const hero = createHero(0, 0, '#15803d');
    expect(hero).toMatchObject({
      type: 'image',
      objectFit: 'cover',
      fillColor: '#15803d',
      heroCaption: { title: 'Hero title' },
    });
    expect(isValidElement(hero)).toBe(true);
    // The avatar is a plain circular image, no caption.
    expect(createAvatar(0, 0).heroCaption).toBeUndefined();
  });

  it('isWebComponentShape names exactly the five kinds', () => {
    expect(
      (['banner', 'callout', 'stat-row', 'process', 'site-header'] as const).every(
        isWebComponentShape,
      ),
    ).toBe(true);
    expect(isWebComponentShape('square')).toBe(false);
  });
});

describe('validation bounds the rows (spec/146)', () => {
  const base = createShape('stat-row', 0, 0);
  it('accepts the defaults', () => {
    for (const k of ['banner', 'callout', 'stat-row', 'process', 'site-header'] as const) {
      expect(isValidElement(createShape(k, 0, 0))).toBe(true);
    }
  });
  it('rejects over-long or over-many rows', () => {
    const long = 'x'.repeat(WEB_TEXT_MAX + 1);
    expect(isValidElement({ ...base, stats: [{ value: long, caption: '' }] })).toBe(false);
    expect(
      isValidElement({
        ...base,
        stats: Array.from({ length: STATS_MAX + 1 }, () => ({ value: '1', caption: 'a' })),
      }),
    ).toBe(false);
    expect(isValidElement({ ...base, stats: [{ value: 1, caption: 'a' }] })).toBe(false);
    expect(isValidElement({ ...base, processSteps: Array(PROCESS_MAX_STEPS + 1).fill('a') })).toBe(
      false,
    );
    expect(isValidElement({ ...base, navLinks: Array(NAV_LINKS_MAX + 1).fill('a') })).toBe(false);
    expect(isValidElement({ ...base, navLinks: [long] })).toBe(false);
  });
  it('rejects a malformed hero caption', () => {
    const img = createHero(0, 0, '#000');
    expect(isValidElement({ ...img, heroCaption: { title: 3, subtitle: '' } })).toBe(false);
    expect(isValidElement({ ...img, heroCaption: 'nope' })).toBe(false);
  });
});

describe('layouts re-flow with the box (spec/146)', () => {
  it('stat cards share the width and grow their numbers with the height', () => {
    const short = statRowLayout(480, 80, 3);
    const tall = statRowLayout(480, 200, 3);
    expect(short.cards).toHaveLength(3);
    const last = short.cards[2]!;
    expect(last.x + last.width).toBeCloseTo(480);
    expect(short.cards[0]!.width).toBeCloseTo(short.cards[1]!.width);
    expect(tall.valuePx).toBeGreaterThan(short.valuePx);
  });

  it('process circles shrink rather than overlap as steps are added', () => {
    const three = processLayout(300, 120, 3);
    const eight = processLayout(300, 120, 8);
    expect(eight.steps[0]!.r).toBeLessThan(three.steps[0]!.r);
    for (const l of [three, eight]) {
      for (let i = 1; i < l.steps.length; i++) {
        const a = l.steps[i - 1]!;
        const b = l.steps[i]!;
        expect(b.cx - a.cx).toBeGreaterThan(a.r + b.r);
      }
      expect(l.connectors).toHaveLength(l.steps.length - 1);
    }
  });

  it('header links drop from the end when the bar is too narrow, never over the brand', () => {
    const links = ['Home', 'About', 'Pricing', 'Contact'];
    const wide = headerLayout(900, 84, links);
    const narrow = headerLayout(320, 84, links);
    expect(wide.links.map((l) => l.text)).toEqual(links);
    expect(narrow.links.length).toBeLessThan(links.length);
    // The leading links survive, in order.
    expect(narrow.links.map((l) => l.text)).toEqual(links.slice(0, narrow.links.length));
    for (const l of [wide, narrow]) {
      const first = l.links[0];
      if (first) expect(first.rect.x).toBeGreaterThanOrEqual(l.brand.x + l.brand.width);
    }
  });

  it('the hero card stays inside the image', () => {
    for (const [w, h] of [
      [520, 300],
      [200, 120],
      [1200, 900],
    ] as const) {
      const { card } = heroCaptionLayout(w, h);
      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.y).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(w);
      expect(card.y + card.height).toBeLessThanOrEqual(h);
    }
  });
});

describe('theming (spec/146)', () => {
  const [a, b] = [THEMES[1]!, THEMES[2]!];
  it('an accent bar retheme touches only its stroke', () => {
    const banner = { ...createShape('banner', 0, 0), strokeColor: a.elementStroke ?? undefined };
    const next = switchThemeElement(banner, a, b) as ShapeElement;
    expect(next.fillColor).toBeUndefined();
    expect(next.textColor).toBeUndefined();
    const recoloured = recolourElementForTheme(banner, b) as ShapeElement;
    expect(recoloured.fillColor).toBeUndefined();
  });
});

describe('headless render (spec/146)', () => {
  const svgOf = (elements: unknown[]) =>
    renderElementsToSvg({ id: 't', name: 'T', elements } as unknown as Tab);

  it('draws every stat, step and link', () => {
    const svg = svgOf([
      createComponent('stat', 0, 0, colors),
      createComponent('process', 0, 300, colors),
      createComponent('header', 0, 600, colors),
    ]);
    for (const text of ['1.2k', 'Uptime', 'Plan', 'Ship', 'Home', 'Contact', 'Brand']) {
      expect(svg).toContain(text);
    }
  });

  it('draws the banner title once, in its own region', () => {
    const svg = svgOf([createComponent('banner', 0, 0, colors)]);
    expect(svg.match(/Banner title/g)).toHaveLength(1);
    expect(svg).toContain('Subtitle or description');
  });

  it('draws the hero caption over the image', () => {
    const svg = svgOf([createHero(0, 0, '#000') as ImageElement]);
    expect(svg).toContain('Hero title');
  });
});

describe('row writes (spec/146)', () => {
  it('withWebRows bounds text and count, and only lands on the matching kind', () => {
    const stat = createShape('stat-row', 0, 0);
    const long = 'y'.repeat(WEB_TEXT_MAX + 20);
    const next = withWebRows(stat, { stats: [{ value: `  ${long} `, caption: 'a  b' }] });
    expect(next.stats).toEqual([{ value: 'y'.repeat(WEB_TEXT_MAX), caption: 'a b' }]);
    // Too few rows for the kind: refused, element unchanged.
    expect(withWebRows(stat, { stats: [] })).toBe(stat);
    const process = createShape('process', 0, 0);
    expect(withWebRows(process, { processSteps: ['only one'] })).toBe(process);
    // A field for another kind is ignored.
    expect(withWebRows(stat, { navLinks: ['x'] })).toBe(stat);
    // A header may lose every link.
    expect(withWebRows(createShape('site-header', 0, 0), { navLinks: [] }).navLinks).toEqual([]);
  });

  it('appendWebRow adds up to the cap and then stops', () => {
    let el = createShape('process', 0, 0);
    while (canAppendWebRow(el)) el = appendWebRow(el);
    expect(el.processSteps).toHaveLength(PROCESS_MAX_STEPS);
    expect(el.processSteps!.at(-1)).toBe(`Step ${PROCESS_MAX_STEPS}`);
    expect(appendWebRow(el)).toBe(el);
    let stat = createShape('stat-row', 0, 0);
    while (canAppendWebRow(stat)) stat = appendWebRow(stat);
    expect(stat.stats).toHaveLength(STATS_MAX);
    expect(canAppendWebRow(createShape('banner', 0, 0))).toBe(false);
  });
});
