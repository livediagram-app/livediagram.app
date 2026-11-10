import { describe, expect, it } from 'vitest';
import { wrapExportRuns, type ExportRun } from './svg-render-labels';

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
