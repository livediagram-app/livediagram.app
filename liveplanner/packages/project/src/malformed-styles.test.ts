import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { createArrow } from './factories';
import { migrateIncomingTab } from './stored-tab';
import { dropMalformedStyles } from './malformed-styles';
import { renderElementsToSvg } from './svg-render';
import type { Element, Tab } from './index';

// Style fields have their types (docs/specs/006-project/project-structure.md "Styles have their types").
const shape = (fields: Record<string, unknown>) =>
  ({ ...createShape('square', 0, 0), label: 'Hello', ...fields }) as unknown as Element;

describe('dropMalformedStyles', () => {
  it('keeps well-typed styles, a name this build does not know included, and hands the same array back', () => {
    const els = [
      shape({ padding: 'lg', borderRadius: 'full', rotation: 12, opacity: 0.5, textSize: 18 }),
      shape({ padding: 'xxl', strokeWidth: 'hairline', textSize: 'huge' }),
      { ...createArrow(0, 0, 10, 0), strokeWidth: 3 } as Element,
      shape({ shadow: { offsetX: 1, offsetY: 2, blur: 3, opacity: 0.2 } }),
    ];
    expect(dropMalformedStyles(els)).toBe(els);
  });

  it('drops each style of the wrong type and keeps the rest', () => {
    const [out] = dropMalformedStyles([
      shape({
        padding: 12,
        borderRadius: [],
        strokeStyle: {},
        textAlignX: 1,
        textSize: true,
        rotation: '45',
        opacity: '50%',
        shadow: true,
        strokeWidth: 2,
      }),
    ]);
    for (const k of [
      'padding',
      'borderRadius',
      'strokeStyle',
      'textAlignX',
      'textSize',
      'rotation',
      'opacity',
      'shadow',
      'strokeWidth',
    ])
      expect(k in out!, k).toBe(false);
    expect((out as { label: string }).label).toBe('Hello');
  });

  it("reads an arrow's stroke width as px, every other element's as a name", () => {
    const [arrow] = dropMalformedStyles([
      { ...createArrow(0, 0, 10, 0), strokeWidth: 'thin' } as unknown as Element,
    ]);
    expect('strokeWidth' in arrow!).toBe(false);
  });
});

describe('a mistyped style on the way in', () => {
  it('no longer draws NaN: a numeric padding keeps the label on the shape', () => {
    const tab = migrateIncomingTab({
      id: 't',
      name: 'T',
      elements: [shape({ padding: 12, opacity: '50%' })],
    }) as Tab;
    expect(renderElementsToSvg(tab)).not.toMatch(/NaN/);
  });
});
