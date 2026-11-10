import type { BoxedElement, RunSize } from '@livedocuments/document';
import { describe, expect, it } from 'vitest';
import { effectiveRunStyle } from './label-style';
import { runEffectCss } from './run-effect-style';

const SHADOW = { offsetX: 0, offsetY: 2, blur: 8, opacity: 0.18 };

describe('runEffectCss (docs/specs/008-canvas/text-effects.md)', () => {
  it('adds nothing to a run without effects, or with ones it does not know', () => {
    expect(runEffectCss({})).toEqual({});
    expect(runEffectCss({ highlight: 'red', gradient: 'rainbow' })).toEqual({});
  });

  it('draws a highlight as a padded, cloned band that does not move the words', () => {
    const css = runEffectCss({ highlight: '#fde68a' });
    expect(css.backgroundImage).toContain('#fde68a 38%');
    expect(css.backgroundClip).toBe('border-box');
    expect(css.padding).toBe('0 0.125em');
    expect(css.margin).toBe('0 -0.125em');
    expect(css.boxDecorationBreak).toBe('clone');
    expect(css.color).toBeUndefined();
  });

  it('fills a gradient run through its glyphs', () => {
    const css = runEffectCss({ gradient: 'sunset' });
    expect(css.backgroundImage).toBe('linear-gradient(90deg, #f97316, #db2777)');
    expect(css.WebkitBackgroundClip).toBe('text');
    expect(css.color).toBe('transparent');
    expect(css.WebkitTextFillColor).toBe('transparent');
    expect(css.filter).toBeUndefined();
  });

  it('stacks the gradient over the band when a run has both', () => {
    const css = runEffectCss({ gradient: 'ocean', highlight: '#bbf7d0' });
    expect(css.backgroundImage).toMatch(/^linear-gradient\(90deg.*, linear-gradient\(to bottom/);
    expect(css.backgroundClip).toBe('text, border-box');
  });

  it('trades the inherited text shadow for a drop-shadow on a gradient run', () => {
    const css = runEffectCss({ gradient: 'berry' }, SHADOW);
    expect(css.textShadow).toBe('none');
    expect(css.filter).toBe('drop-shadow(0px 2px 8px rgba(15, 23, 42, 0.18))');
    expect(runEffectCss({ highlight: '#fde68a' }, SHADOW).filter).toBeUndefined();
  });

  it('is part of every run style, with the shadow only from a text element', () => {
    const px: Record<RunSize, number> = { xs: 10, sm: 12, md: 16, lg: 22 };
    const text = {
      id: 't',
      type: 'text',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      shadow: SHADOW,
    } as BoxedElement;
    expect(effectiveRunStyle({ text: 'x', gradient: 'ember' }, text, px).filter).toContain(
      'drop-shadow',
    );
    const shape = { ...text, type: 'shape', shape: 'square' } as BoxedElement;
    expect(effectiveRunStyle({ text: 'x', gradient: 'ember' }, shape, px).filter).toBeUndefined();
  });
});
