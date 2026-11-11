import { describe, expect, it } from 'vitest';
import { createShape, createSticky, createText, type BoxedElement } from '@livehuddle/document';
import { drawsShapeSvgOverlay } from './ShapeContentRouter';
import { wrapperShapeAnimation } from './useBoxedElementAnimation';

describe('drawsShapeSvgOverlay', () => {
  it('is true for kinds that paint their own body and false for box-path and self-faced kinds', () => {
    expect(drawsShapeSvgOverlay('plant')).toBe(true);
    expect(drawsShapeSvgOverlay('screen')).toBe(true);
    for (const k of ['mode-button', 'portal', 'chair', 'sticker', 'icon'] as const) {
      expect(drawsShapeSvgOverlay(k)).toBe(false);
    }
  });
});

describe('wrapperShapeAnimation', () => {
  const sticky = (animation: string) => ({ ...createSticky(0, 0), animation }) as BoxedElement;
  it('draws a Shape member’s own value', () => {
    expect(wrapperShapeAnimation({ ...createShape('mode-button', 0, 0), animation: 'pulse' })).toBe(
      'pulse',
    );
  });
  it('draws a sticky’s shared motions and kept values, not its own set', () => {
    expect(wrapperShapeAnimation(sticky('glow'))).toBe('glow');
    expect(wrapperShapeAnimation(sticky('bounce'))).toBe('bounce');
    expect(wrapperShapeAnimation(sticky('flutter'))).toBeUndefined();
  });

  it('drops a text element’s legacy value once it has a Text animation', () => {
    const text = { ...createText(0, 0), animation: 'glow' as const };
    expect(wrapperShapeAnimation(text)).toBe('glow');
    expect(wrapperShapeAnimation({ ...text, textAnimation: 'wave' as const })).toBeUndefined();
  });
});
