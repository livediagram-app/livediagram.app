// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { runsPlainText, type TextRun } from '@liveworkspace/model-core/rich-text';
import { dataAttrsForRun, readRunsFromDom, reconcileTrailingNewline } from './rich-text-dom';
import { LINE_ATTR, linesStillApart, paintRunLines, runsByLine } from './rich-text-lines';

// Mixed-direction text painted a line at a time (liveworkspace/docs/specs/011-workbench/blueprints/label-editor.md
// "Mixed-direction lines").

const spanFor = (run: TextRun): HTMLElement => {
  const span = document.createElement('span');
  for (const [k, v] of Object.entries(dataAttrsForRun(run))) span.setAttribute(k, v);
  span.textContent = run.text;
  return span;
};

function painted(runs: TextRun[]): HTMLElement {
  const editor = document.createElement('div');
  paintRunLines(editor, runs, spanFor);
  reconcileTrailingNewline(editor);
  return editor;
}

const RUNS: TextRun[] = [
  { text: 'مرحبا ' },
  { text: 'بالعالم!\nHello', bold: true },
  { text: '\n\nשלום' },
];

describe('runsByLine', () => {
  it('splits the runs into lines, each newline a run with the attributes of the run it was in', () => {
    expect(runsByLine(RUNS)).toEqual([
      {
        runs: [{ text: 'مرحبا ' }, { text: 'بالعالم!', bold: true }],
        newline: { text: '\n', bold: true },
      },
      { runs: [{ text: 'Hello', bold: true }], newline: { text: '\n' } },
      { runs: [], newline: { text: '\n' } },
      { runs: [{ text: 'שלום' }], newline: null },
    ]);
  });

  it('ends with an empty line after a trailing newline', () => {
    expect(runsByLine([{ text: 'a\n' }])).toEqual([
      { runs: [{ text: 'a' }], newline: { text: '\n' } },
      { runs: [], newline: null },
    ]);
  });
});

describe('paintRunLines', () => {
  it('puts each line with text in a dir="auto" isolate and each newline outside them', () => {
    const editor = painted(RUNS);
    const lines = [...editor.querySelectorAll<HTMLElement>(`[${LINE_ATTR}]`)];
    expect(lines.map((line) => line.textContent)).toEqual(['مرحبا بالعالم!', 'Hello', 'שלום']);
    expect(lines.every((line) => line.dir === 'auto' && line.style.unicodeBidi === 'isolate')).toBe(
      true,
    );
    expect([...editor.children].map((child) => child.textContent)).toEqual([
      'مرحبا بالعالم!',
      '\n',
      'Hello',
      '\n',
      '\n',
      'שלום',
    ]);
  });

  it('reads back exactly the runs it painted', () => {
    expect(readRunsFromDom(painted(RUNS))).toEqual(RUNS);
    expect(readRunsFromDom(painted([{ text: 'א\nb\n', italic: true }]))).toEqual([
      { text: 'א\nb\n', italic: true },
    ]);
  });

  it('paints an empty text as nothing', () => {
    expect(painted([]).childNodes).toHaveLength(0);
  });
});

describe('linesStillApart', () => {
  const text = runsPlainText(RUNS);

  it('holds for a fresh paint, with or without the trailing newline', () => {
    expect(linesStillApart(painted(RUNS), text)).toBe(true);
    const trailing: TextRun[] = [{ text: 'א\nb\n' }];
    expect(linesStillApart(painted(trailing), 'א\nb\n')).toBe(true);
  });

  it('holds when a character is typed inside a line', () => {
    const editor = painted(RUNS);
    const hello = editor.querySelectorAll(`[${LINE_ATTR}]`)[1]!.firstChild!.firstChild as Text;
    hello.appendData('!');
    expect(linesStillApart(editor, `${text.slice(0, 20)}!${text.slice(20)}`)).toBe(true);
  });

  it('fails for a newline typed inside a line', () => {
    const editor = painted(RUNS);
    const hello = editor.querySelectorAll(`[${LINE_ATTR}]`)[1]!.firstChild!.firstChild as Text;
    hello.insertData(2, '\n');
    expect(linesStillApart(editor, editor.textContent ?? '')).toBe(false);
  });

  it('fails for a character typed into a newline', () => {
    const editor = painted(RUNS);
    const newline = editor.children[1]!.firstChild as Text;
    newline.appendData('x');
    expect(linesStillApart(editor, editor.textContent ?? '')).toBe(false);
  });

  it('fails for two lines run together and for an emptied newline', () => {
    const editor = painted([{ text: 'א\nb' }]);
    editor.children[1]!.firstChild!.textContent = '';
    expect(linesStillApart(editor, 'אb')).toBe(false);
    const other = painted([{ text: 'א\nb' }]);
    other.children[1]!.remove();
    expect(linesStillApart(other, 'אb')).toBe(false);
  });

  it('fails for bare text or a stray break at the top', () => {
    const editor = painted(RUNS);
    editor.append('x');
    expect(linesStillApart(editor, `${text}x`)).toBe(false);
    const broken = painted(RUNS);
    broken.insertBefore(document.createElement('br'), broken.firstChild);
    expect(linesStillApart(broken, text)).toBe(false);
  });

  it('checks 100,000 characters over 1,000 lines inside its budget', () => {
    const runs: TextRun[] = [
      { text: Array.from({ length: 1_000 }, () => 'א'.repeat(99)).join('\n') },
    ];
    const editor = painted(runs);
    const all = runsPlainText(runs);
    let best = Infinity;
    for (let i = 0; i < 5; i++)
      best = Math.min(
        best,
        cpuMsOf(() => linesStillApart(editor, all)),
      );
    expect(linesStillApart(editor, all)).toBe(true);
    expect(best).toBeLessThan(cpuBudgetMs(5));
  });
});
