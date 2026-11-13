import { describe, expect, it } from 'vitest';
import { componentFactoriesFor } from './component-factories';
import type { Element } from './element';
import { FLOWCHART_STEP_SIZE } from './flowchart';
import { SHAPE_DEFAULT_SIZE, createShape } from './testing/elements';
import { createFlowchartStart } from './testing/flowchart';

// The palette's ready-made components (each product's canvas-and-palette spec), bound to the product-neutral builders.
const sizes = {
  ...SHAPE_DEFAULT_SIZE,
  banner: { width: 600, height: 80 },
  'site-header': { width: 800, height: 64 },
  callout: { width: 320, height: 160 },
  'stat-row': { width: 600, height: 120 },
  process: { width: 640, height: 140 },
  card: { width: 320, height: 160 },
};
const {
  componentShapeKind,
  createAvatar,
  createHero,
  createCalloutCard,
  createComponent,
  COMPONENT_SIZE,
} = componentFactoriesFor<Element, string>({
  createShape,
  shapeDefaultSize: sizes,
  createFlowchartStart,
});
const colors = { accent: '#f00', surface: '#fff', ink: '#111' };

describe('component factories', () => {
  it('sizes each component from its kind, its own box or the flowchart Start', () => {
    expect(COMPONENT_SIZE.banner).toEqual(sizes.banner);
    expect(COMPONENT_SIZE.avatar).toEqual({ width: 96, height: 96 });
    expect(COMPONENT_SIZE.flowchart).toEqual(FLOWCHART_STEP_SIZE.terminator);
    expect(componentShapeKind('header')).toBe('site-header');
    expect(componentShapeKind('hero')).toBeUndefined();
  });

  it('makes the avatar and hero as images centred on the point', () => {
    expect(createAvatar(100, 100)).toMatchObject({ type: 'image', x: 52, y: 52, borderRadius: 'full' });
    expect(createHero(0, 0, '#0af')).toMatchObject({ type: 'image', width: 520, fillColor: '#0af' });
    expect(createComponent('avatar', 0, 0, colors).type).toBe('image');
    expect(createComponent('hero', 0, 0, colors).type).toBe('image');
  });

  it('dresses the shapes in the theme: the bars in the accent, the cards in the surface', () => {
    expect(createComponent('banner', 0, 0, colors)).toMatchObject({ shape: 'banner', strokeColor: '#f00' });
    expect(createComponent('stat', 0, 0, colors)).toMatchObject({ shape: 'stat-row', fillColor: '#fff' });
    expect(createComponent('callout', 0, 0, colors)).toMatchObject({ shape: 'card', textColor: '#111' });
    expect(createCalloutCard(0, 0)).toMatchObject({ shape: 'card' });
    expect(createComponent('flowchart', 0, 0, colors).type).toBe('shape');
  });
});
