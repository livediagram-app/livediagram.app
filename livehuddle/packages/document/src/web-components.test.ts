import { describe, expect, it } from 'vitest';
import {
  CARD_TAGS_MAX,
  COMPONENT_SIZE,
  createAvatar,
  createComponent,
  createHero,
  createShape,
  heroCaptionLayout,
  isValidElement,
  isWebComponentShape,
  renderElementsToSvg,
  appendWebRow,
  canAppendWebRow,
  withWebRows,
  type ComponentKind,
  type ShapeElement,
  type Tab,
} from './index';

const colors = { accent: '#be123c', surface: '#ffe4e6', ink: '#881337' };
const KINDS: ComponentKind[] = ['hero', 'callout', 'avatar'];

describe('components are single elements (docs/specs/009-elements/web-components-and-no-groups.md)', () => {
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

  it('maps the Callout onto a card', () => {
    // The Callout is a Card preset (docs/specs/009-elements/card.md).
    expect((createComponent('callout', 0, 0, colors) as ShapeElement).shape).toBe('card');
  });

  it('dresses the callout card in surface + ink with the accent border', () => {
    const callout = createComponent('callout', 0, 0, colors) as ShapeElement;
    expect(callout).toMatchObject({
      fillColor: '#ffe4e6',
      strokeColor: '#be123c',
      textColor: '#881337',
    });
  });

  it('starts the callout with content that says what it is', () => {
    expect(createShape('callout', 0, 0)).toMatchObject({ pageTitle: 'Heads up' });
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

  it('isWebComponentShape names exactly the card and the callout', () => {
    expect((['callout', 'card'] as const).every(isWebComponentShape)).toBe(true);
    expect(isWebComponentShape('square')).toBe(false);
  });
});

describe('validation bounds the rows (docs/specs/009-elements/web-components-and-no-groups.md)', () => {
  it('accepts the defaults', () => {
    for (const k of ['callout', 'card'] as const) {
      expect(isValidElement(createShape(k, 0, 0))).toBe(true);
    }
  });
  it('rejects a malformed hero caption', () => {
    const img = createHero(0, 0, '#000');
    expect(isValidElement({ ...img, heroCaption: { title: 3, subtitle: '' } })).toBe(false);
    expect(isValidElement({ ...img, heroCaption: 'nope' })).toBe(false);
  });
});

describe('layouts re-flow with the box (docs/specs/009-elements/web-components-and-no-groups.md)', () => {
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

describe('headless render (docs/specs/009-elements/web-components-and-no-groups.md)', () => {
  const svgOf = (elements: unknown[]) =>
    renderElementsToSvg({ id: 't', name: 'T', elements } as unknown as Tab);

  it('draws the hero caption over the image', () => {
    const svg = svgOf([createHero(0, 0, '#000')]);
    expect(svg).toContain('Hero title');
  });
});

describe('row writes (docs/specs/009-elements/web-components-and-no-groups.md)', () => {
  it('withWebRows only lands on the matching kind', () => {
    // A card's tags are ignored on a plain shape.
    const square = createShape('square', 0, 0);
    expect(withWebRows(square, { tags: ['x'] })).toBe(square);
  });

  it('appendWebRow adds card tags up to the cap and then stops', () => {
    let el = createShape('card', 0, 0);
    while (canAppendWebRow(el)) el = appendWebRow(el);
    expect(el.tags).toHaveLength(CARD_TAGS_MAX);
    expect(el.tags!.at(-1)).toBe('Tag');
    expect(appendWebRow(el)).toBe(el);
    expect(canAppendWebRow(createShape('square', 0, 0))).toBe(false);
  });
});
