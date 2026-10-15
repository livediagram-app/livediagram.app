import { describe, expect, it } from 'vitest';
import {
  applyTitleCaption,
  createShape,
  runsPlainText,
  svgBoxed,
  type ShapeElement,
  type TextRun,
} from './index';

const lineRuns = (runs: TextRun[], line: number) => {
  // The runs that make up one line of the label.
  const out: TextRun[] = [];
  let at = 0;
  for (const r of runs)
    for (const piece of r.text.split(/(\n)/)) {
      if (piece === '\n') at++;
      else if (piece && at === line) out.push({ ...r, text: piece });
    }
  return out;
};

describe('Title and Caption (docs/specs/009-elements/block-type-picker.md)', () => {
  it('makes the first line a bold title and every later line a small muted caption', () => {
    const out = applyTitleCaption([{ text: 'Payments\nStripe\nEU region' }]);
    expect(runsPlainText(out)).toBe('Payments\nStripe\nEU region');
    for (const r of lineRuns(out, 0)) expect(r).toMatchObject({ bold: true });
    for (const line of [1, 2])
      for (const r of lineRuns(out, line))
        expect(r).toMatchObject({ bold: false, size: 'sm', muted: true });
  });

  it('gives a one-line label a Caption line to type over', () => {
    const out = applyTitleCaption([{ text: 'Payments' }]);
    expect(runsPlainText(out)).toBe('Payments\nCaption');
    expect(lineRuns(out, 1)[0]).toMatchObject({ muted: true });
  });

  it('clears headings and list markers so the result is always the two tiers', () => {
    const out = applyTitleCaption([{ text: 'Title', heading: 1 }, { text: '\n• one' }]);
    expect(runsPlainText(out)).toBe('Title\none');
    expect(out.some((r) => r.heading)).toBe(false);
  });

  it('draws a muted run at reduced opacity in the export', () => {
    const el: ShapeElement = {
      ...(createShape('square', 0, 0) as ShapeElement),
      label: 'Payments\nStripe',
      richText: applyTitleCaption([{ text: 'Payments\nStripe' }]),
    };
    expect(svgBoxed(el)).toContain('fill-opacity="0.65"');
  });
});
