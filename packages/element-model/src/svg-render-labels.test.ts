import { describe, expect, it } from 'vitest';
import { clampExportRunLines, wrapExportRuns, type ExportRun } from './svg-render-labels';

const run = (text: string, extra: Partial<ExportRun> = {}): ExportRun => ({
  text,
  color: '#000000',
  size: 14,
  bold: false,
  italic: false,
  ...extra,
});
const lineText = (lines: ExportRun[][]) => lines.map((l) => l.map((r) => r.text).join(''));

// A rich label exports as the editor lays it out: a space only where the label has one.
describe('wrapExportRuns', () => {
  it('keeps part of a word bolded as one word', () => {
    expect(lineText(wrapExportRuns([run('Re', { bold: true }), run('act')], 400))).toEqual([
      'React',
    ]);
  });

  it('keeps the space at a run boundary, whichever side it is on', () => {
    expect(lineText(wrapExportRuns([run('Hello '), run('world', { bold: true })], 400))).toEqual([
      'Hello world',
    ]);
    expect(lineText(wrapExportRuns([run('Hello'), run(' world', { bold: true })], 400))).toEqual([
      'Hello world',
    ]);
  });

  it('still wraps at spaces', () => {
    const lines = lineText(wrapExportRuns([run('alpha beta gamma delta')], 60));
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe('alpha beta gamma delta');
  });
});

// A formatted lane title in its gutter (docs/specs/009-elements/lane.md "A title wraps in its gutter").
describe('clampExportRunLines', () => {
  const lines = [
    [run('one')],
    [run('two')],
    [run('three '), run('four', { bold: true })],
    [run('five')],
  ];

  it('leaves lines within the limit as they are', () => {
    expect(clampExportRunLines(lines, 4, 400)).toBe(lines);
  });

  it('keeps the first lines, ending the last in an ellipsis in its last fragment\u2019s style', () => {
    const out = clampExportRunLines(lines, 3, 400);
    expect(lineText(out)).toEqual(['one', 'two', 'three four\u2026']);
    expect(out[2]![1]).toMatchObject({ text: 'four\u2026', bold: true });
  });

  it('takes characters off the end, fragment by fragment, until the ellipsis fits', () => {
    // Room for little more than "thr": the bold fragment empties first, then the plain one shortens.
    const out = clampExportRunLines(lines, 3, 30);
    expect(lineText(out)[2]!.endsWith('\u2026')).toBe(true);
    expect(lineText(out)[2]!.length).toBeLessThan('three four\u2026'.length);
  });

  it('leaves a blank last line as it is', () => {
    expect(clampExportRunLines([[run('a')], [], [run('b')]], 2, 400)[1]).toEqual([]);
  });
});
