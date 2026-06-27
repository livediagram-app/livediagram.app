import type { BoxedElement, RunSize, TextRun } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import { effectiveRunStyle, labelTextStyleCss } from './label-style';

const RUN_PX: Record<RunSize, number> = { sm: 12, md: 16, lg: 22 };

describe('labelTextStyleCss', () => {
  it('maps bold and italic to weight/style', () => {
    expect(labelTextStyleCss({ bold: true, italic: true })).toMatchObject({
      fontWeight: 700,
      fontStyle: 'italic',
    });
  });

  it('combines underline + strikethrough into one text-decoration', () => {
    expect(labelTextStyleCss({ underline: true, strikethrough: true }).textDecoration).toBe(
      'underline line-through',
    );
    expect(labelTextStyleCss({ underline: true }).textDecoration).toBe('underline');
    expect(labelTextStyleCss({ strikethrough: true }).textDecoration).toBe('line-through');
  });

  it('passes fontFamily through and leaves unset props undefined', () => {
    const css = labelTextStyleCss({ fontFamily: 'Inter' });
    expect(css.fontFamily).toBe('Inter');
    expect(css.fontWeight).toBeUndefined();
    expect(css.fontStyle).toBeUndefined();
    expect(css.textDecoration).toBeUndefined();
  });
});

describe('effectiveRunStyle', () => {
  const run = (over: Partial<TextRun> = {}): TextRun => ({ text: 'x', ...over }) as TextRun;
  const el = (over: Record<string, unknown> = {}): BoxedElement =>
    ({
      id: 'e',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      ...over,
    }) as BoxedElement;

  it('lets a run override the element default', () => {
    expect(effectiveRunStyle(run({ bold: true }), el({ textBold: false }), RUN_PX).fontWeight).toBe(
      700,
    );
  });

  it('inherits the element default when the run leaves an attr unset', () => {
    expect(effectiveRunStyle(run(), el({ textBold: true }), RUN_PX).fontWeight).toBe(700);
    expect(effectiveRunStyle(run(), el({ textItalic: true }), RUN_PX).fontStyle).toBe('italic');
  });

  it('emits colour and size only when the run overrides them', () => {
    const overridden = effectiveRunStyle(run({ color: '#f00', size: 'md' }), el(), RUN_PX);
    expect(overridden.color).toBe('#f00');
    expect(overridden.fontSize).toBe('16px'); // RUN_PX.md

    const inherited = effectiveRunStyle(run(), el(), RUN_PX);
    expect(inherited.color).toBeUndefined();
    expect(inherited.fontSize).toBeUndefined();
  });
});
