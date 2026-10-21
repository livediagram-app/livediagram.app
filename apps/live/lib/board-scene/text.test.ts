import { describe, expect, it } from 'vitest';
import { TEXT_SCALE_MAX, TEXT_SCALE_MIN } from '@livediagram/document';
import { createLandContext, LANDING_RULES } from './context';
import type { SceneText } from './scene';
import { diagramTextSize, labelFields, textBoxFields, textPreset } from './text';

// docs/specs/020-import-export/board-scene.md "Text".
const text = (over: Partial<SceneText> = {}): SceneText => ({
  text: 'Hello',
  fontPx: 22,
  family: 'sans',
  colour: 'ink',
  ...over,
});

describe('textPreset', () => {
  it.each([
    [10, 'sm'],
    [14, 'sm'],
    [17.5, 'sm'],
    [17.6, 'md'],
    [22, 'md'],
    [26.5, 'md'],
    [26.6, 'lg'],
    [63.36, 'lg'],
  ] as const)('%s px is nearest %s', (px, size) => {
    expect(textPreset(px)).toBe(size);
  });
});

describe('textBoxFields', () => {
  it('keeps the size exactly: the nearest preset times a scale', () => {
    const f = textBoxFields(text({ fontPx: 13.08 }), createLandContext());
    expect(f.textSize).toBe('sm');
    expect(14 * f.textScale!).toBeCloseTo(13.08, 6);
    const big = textBoxFields(text({ fontPx: 63.36 }), createLandContext());
    expect(big.textSize).toBe('lg');
    expect(32 * big.textScale!).toBeCloseTo(63.36, 6);
  });

  it('writes no scale for a preset size', () => {
    expect(textBoxFields(text({ fontPx: 22 }), createLandContext()).textScale).toBeUndefined();
    expect(textBoxFields(text({ fontPx: 22.05 }), createLandContext()).textScale).toBeUndefined();
  });

  it('clamps the scale to the text box limits', () => {
    expect(textBoxFields(text({ fontPx: 0.5 }), createLandContext()).textScale).toBe(
      TEXT_SCALE_MIN,
    );
    expect(textBoxFields(text({ fontPx: 5000 }), createLandContext()).textScale).toBe(
      TEXT_SCALE_MAX,
    );
  });

  it('reads a broken font size as Medium', () => {
    for (const fontPx of [0, -4, Number.NaN, Number.POSITIVE_INFINITY]) {
      const f = textBoxFields(text({ fontPx }), createLandContext());
      expect(f.textSize).toBe('md');
      expect(f.textScale).toBeUndefined();
    }
  });

  it('maps families to fonts', () => {
    const font = (family: SceneText['family']) =>
      textBoxFields(text({ family }), createLandContext()).font;
    expect(font('hand')).toBe('caveat');
    expect(font('mono')).toBe('roboto-mono');
    expect(font('serif')).toBe('lora');
    expect(font('sans')).toBeUndefined();
  });

  it('keeps alignment and styles, writing only what is set', () => {
    const f = textBoxFields(
      text({
        alignX: 'center',
        alignY: 'middle',
        bold: true,
        italic: true,
        underline: true,
        strike: true,
      }),
      createLandContext(),
    );
    expect(f).toMatchObject({
      textAlignX: 'center',
      textAlignY: 'middle',
      textBold: true,
      textItalic: true,
      textUnderline: true,
      textStrikethrough: true,
    });
    const plain = textBoxFields(text({ bold: false }), createLandContext());
    expect('textBold' in plain).toBe(false);
    expect('textAlignX' in plain).toBe(false);
  });

  it('normalises line breaks and colours the text', () => {
    const f = textBoxFields(
      text({ text: 'a\r\nb', colour: { hex: '#1971c2' } }),
      createLandContext(),
    );
    expect(f.label).toBe('a\nb');
    expect(f.penTextColour).toBe('blue');
    const custom = textBoxFields(text({ colour: { hex: '#868e96' } }), createLandContext());
    expect(custom.textColor).toBe('#868e96');
    const ink = textBoxFields(text(), createLandContext());
    expect('textColor' in ink || 'penTextColour' in ink).toBe(false);
  });

  it('counts an unreadable colour and inks it', () => {
    const ctx = createLandContext();
    const f = textBoxFields(text({ colour: { hex: 'nope' } }), ctx);
    expect('textColor' in f).toBe(false);
    expect(ctx.notes()).toEqual([
      { rule: LANDING_RULES.unreadableColour, count: 1, kind: 'degraded' },
    ]);
  });
});

describe('labelFields', () => {
  it('takes the nearest preset without a scale', () => {
    const f = labelFields(text({ fontPx: 20 }), createLandContext());
    expect(f.textSize).toBe('md');
    expect('textScale' in f).toBe(false);
  });
});

describe('diagramTextSize', () => {
  it('keeps the diagram buckets', () => {
    expect(diagramTextSize(16)).toBe('sm');
    expect(diagramTextSize(20)).toBe('md');
    expect(diagramTextSize(22)).toBe('md');
    expect(diagramTextSize(28)).toBe('lg');
  });
});
