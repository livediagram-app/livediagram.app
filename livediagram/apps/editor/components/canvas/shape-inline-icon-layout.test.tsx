// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createShape, type ShapeElement } from '@livediagram/document';
import {
  ShapeInlineIconLayout,
  inlineIconGap,
  inlineIconMetrics,
} from './shape-inline-icon-layout';

// The inline icon's sizes, shared by the layout and the element indicators' content estimate.
describe('inlineIconMetrics', () => {
  it('ties the icon to a fixed label size, capped by the element', () => {
    const big = inlineIconMetrics({ width: 300, height: 200 }, 'Cloud', 'md');
    expect(big.iconSize).toBeCloseTo(big.fontSize * 1.6, 5);
    const small = inlineIconMetrics({ width: 60, height: 50 }, 'Cloud', 'lg');
    expect(small.iconSize).toBe(small.elementIconSize);
  });

  it('sizes a scale label from the box and an unlabelled icon from the element', () => {
    const scaled = inlineIconMetrics({ width: 300, height: 50 }, 'Hi', 'scale');
    expect(scaled.fontSize).toBe(13);
    const bare = inlineIconMetrics({ width: 300, height: 200 }, '  ', 'md');
    expect(bare.iconSize).toBe(48);
  });
});

describe('inlineIconGap', () => {
  it('gives a side icon more room than a stacked one', () => {
    expect(inlineIconGap(30, true)).toBe(10);
    expect(inlineIconGap(10, true)).toBe(8);
    expect(inlineIconGap(30, false)).toBe(6);
  });
});

describe('ShapeInlineIconLayout', () => {
  it('lays the icon above the label at the shared size and gap', () => {
    const element = {
      ...createShape('cloud', 0, 0),
      width: 270,
      height: 180,
      iconId: 'cloud',
    } as ShapeElement;
    const { container, getByText } = render(
      <ShapeInlineIconLayout
        element={element}
        position="above"
        iconStroke="#000"
        isEditing={false}
        editor={null}
        label="Cloud"
        textColor="#000"
        textSize="md"
        alignX="center"
        alignY="middle"
        padding={14}
      />,
    );
    const { iconSize } = inlineIconMetrics(element, 'Cloud', 'md');
    const layout = container.firstElementChild as HTMLElement;
    expect(layout.style.flexDirection).toBe('column');
    expect(layout.style.gap).toBe(`${inlineIconGap(iconSize, false)}px`);
    expect(getByText('Cloud')).toBeTruthy();
  });

  // A box from an infrastructure import wears a Technology icon (docs/specs/020-import-export/infrastructure-import.md):
  // it draws the brand tile, as the export does, not the line-art placeholder.
  it('draws a Technology icon as its tile, and line art otherwise', () => {
    const props = {
      position: 'left' as const,
      iconStroke: '#000',
      isEditing: false,
      editor: null,
      label: 'db',
      textColor: '#000',
      textSize: 'md' as const,
      alignX: 'center' as const,
      alignY: 'middle' as const,
      padding: 14,
    };
    const shape = { ...createShape('square', 0, 0), width: 240, height: 80 } as ShapeElement;
    const tech = render(
      <ShapeInlineIconLayout {...props} element={{ ...shape, iconId: 'postgres' }} />,
    );
    expect(tech.container.querySelector('rect[rx="4.5"]')).toBeTruthy();
    tech.unmount();
    const line = render(
      <ShapeInlineIconLayout {...props} element={{ ...shape, iconId: 'cloud' }} />,
    );
    expect(line.container.querySelector('rect[rx="4.5"]')).toBeNull();
  });
});
