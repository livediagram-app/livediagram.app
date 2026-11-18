import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  clearTabExamples,
  clearTemplateExamples,
  keepTabExamples,
  exampleValuesOf,
  hasUntouchedExamples,
  isSampleCopy,
  isUntouchedExample,
  keepTemplateExamples,
  markTemplateExamples,
  sampleCopyNamed,
  TEMPLATE_EXAMPLE_FIELD,
  untouchedExampleCount,
} from './template-example';

type El = Record<string, unknown> & { id: string; type: string };

const sticky = (label: string, extra: Partial<El> = {}): El => ({
  id: 's',
  type: 'sticky',
  x: 10,
  y: 20,
  width: 120,
  height: 120,
  fillColor: '#fde68a',
  label,
  ...extra,
});
const checklist = (rows: { text: string; done: boolean }[]): El => ({
  id: 'c',
  type: 'shape',
  shape: 'checklist',
  checklistItems: rows,
});
const table = (cells: string[][], extra: Partial<El> = {}): El => ({
  id: 't',
  type: 'table',
  cells,
  ...extra,
});
const chart = (extra: Partial<El>): El => ({
  id: 'g',
  type: 'shape',
  shape: 'bar-chart',
  ...extra,
});

describe('exampleValuesOf', () => {
  it("reads a sticky, a text's words, a checklist, a table body and a chart, and nothing else", () => {
    expect(exampleValuesOf(sticky('Ship it'))).toContain('Ship it');
    expect(exampleValuesOf(sticky('  '))).toBeNull();
    expect(exampleValuesOf({ id: 's', type: 'sticky' })).toBeNull();
    expect(exampleValuesOf(checklist([{ text: 'Book room', done: true }]))).toContain('Book room');
    expect(exampleValuesOf(checklist([{ text: '', done: true }]))).not.toBeNull();
    expect(exampleValuesOf(checklist([{ text: ' ', done: false }]))).toBeNull();
    expect(exampleValuesOf(table([['Head'], ['Body']], { headerRow: true }))).toContain('Body');
    expect(exampleValuesOf(table([['Head'], ['']], { headerRow: true }))).toBeNull();
    expect(exampleValuesOf({ id: 't', type: 'table' })).toBeNull();
    expect(exampleValuesOf(chart({ pieSlices: [{ label: 'A', value: 3 }] }))).not.toBeNull();
    expect(exampleValuesOf(chart({ lineSeries: [{ name: 'S', values: [0, 4] }] }))).not.toBeNull();
    expect(exampleValuesOf(chart({ pieSlices: [{ label: 'A', value: 0 }] }))).toBeNull();
    expect(exampleValuesOf(chart({ lineSeries: [{ name: 'S', values: [0] }] }))).toBeNull();
    expect(exampleValuesOf({ id: 'b', type: 'shape', shape: 'rectangle', label: 'Do' })).toBeNull();
    expect(exampleValuesOf({ id: 'x', type: 'text', label: 'Some words' })).toContain('Some words');
    expect(exampleValuesOf({ id: 'x', type: 'text', label: ' ' })).toBeNull();
    expect(exampleValuesOf({ id: 'a', type: 'arrow', label: 'yes' })).toBeNull();
  });

  it("leaves a table's header row and header column out", () => {
    const t = table(
      [
        ['', 'Urgent'],
        ['Important', 'Call Sam'],
      ],
      { headerRow: true, headerColumn: true },
    );
    expect(exampleValuesOf(t)).toBe('t["Call Sam"]');
  });
});

const text = (label: string, extra: Partial<El> = {}): El => ({
  id: 'x',
  type: 'text',
  x: 0,
  y: 0,
  width: 300,
  height: 40,
  label,
  ...extra,
});

describe('isSampleCopy', () => {
  it('is body copy: plain words at a body size, two or more of them', () => {
    expect(isSampleCopy(text('Sign in to Harbour'))).toBe(true);
    expect(isSampleCopy(text('8 min · Saved by 940 people'))).toBe(true);
    expect(isSampleCopy(text('Line one\nline two'))).toBe(true);
    expect(isSampleCopy(text('Café olé'))).toBe(true);
    expect(isSampleCopy(text('A body line', { textSize: 22, textScale: 1.5 }))).toBe(true);
    expect(isSampleCopy(text('A body line', { textSize: 48 }))).toBe(true);
  });

  it('is never a title, a heading, a wordmark, display type or a lone word or figure', () => {
    expect(isSampleCopy(text('Our Year in Review', { textBold: true }))).toBe(false);
    expect(isSampleCopy(text('Our Year in Review', { fontWeight: 700 }))).toBe(false);
    expect(isSampleCopy(text('Light for spaces', { fontWeight: 500 }))).toBe(false);
    expect(
      isSampleCopy(
        text('Two runs', {
          richText: [
            { text: 'Two ', bold: true },
            { text: 'runs', bold: true },
          ],
        }),
      ),
    ).toBe(false);
    expect(
      isSampleCopy(
        text('Two runs', { richText: [{ text: 'Two ', bold: true }, { text: 'runs' }] }),
      ),
    ).toBe(true);
    expect(isSampleCopy(text('Light for spaces', { letterSpacing: 0.1 }))).toBe(false);
    expect(isSampleCopy(text('Light for spaces', { textCase: 'upper' }))).toBe(false);
    expect(isSampleCopy(text('Light for spaces', { textArc: 90 }))).toBe(false);
    expect(isSampleCopy(text('Night Market tonight', { textSize: 48, textScale: 2.4 }))).toBe(
      false,
    );
    expect(isSampleCopy(text('Night Market tonight', { textSize: 'lg', textScale: 3 }))).toBe(
      false,
    );
    expect(isSampleCopy(text('Pricing'))).toBe(false);
    expect(isSampleCopy(text('2 / 6'))).toBe(false);
    expect(isSampleCopy(text('$48.00'))).toBe(false);
    expect(isSampleCopy(text('Word 42'))).toBe(false);
    expect(isSampleCopy(text(''))).toBe(false);
    const unlabelled: El = { id: 'x', type: 'text' };
    expect(isSampleCopy(unlabelled)).toBe(false);
    expect(isSampleCopy(sticky('Two words'))).toBe(false);
  });

  it('reads a very long label in one pass, within budget', () => {
    const spaces = `a${' '.repeat(50_000)}`;
    const digits = '1 '.repeat(50_000);
    expect(cpuMsOf(() => isSampleCopy(text(spaces)))).toBeLessThan(100);
    expect(cpuMsOf(() => isSampleCopy(text(digits)))).toBeLessThan(100);
    expect(isSampleCopy(text(`${spaces}b`))).toBe(true);
  });
});

describe('marking a large page of body copy', () => {
  it('reads and marks 5,000 texts within budget', () => {
    const texts = Array.from({ length: 5000 }, (_, i) =>
      text(`Sample sentence number ${i} for a page`, { id: `t${i}`, textSize: 22 }),
    );
    expect(cpuMsOf(() => markTemplateExamples(texts, isSampleCopy))).toBeLessThan(400);
  });
});

describe('sampleCopyNamed', () => {
  it('names the texts holding one of its words, and nothing else', () => {
    const rule = sampleCopyNamed(['Peak days run understaffed']);
    expect(rule(text('Peak days run understaffed'))).toBe(true);
    expect(rule(text('The problem'))).toBe(false);
    expect(rule(sticky('Peak days run understaffed'))).toBe(false);
    expect(rule({ type: 'text' })).toBe(false);
  });
});

describe('markTemplateExamples', () => {
  it('marks only what holds example values, and keeps the rest the same objects', () => {
    const title = { id: 'x', type: 'text', label: 'Title' };
    const [marked, plain] = markTemplateExamples<El>([sticky('Ship it'), title]);
    expect(typeof marked![TEMPLATE_EXAMPLE_FIELD]).toBe('string');
    expect(plain).toBe(title);
  });

  it("marks a free text only where the template's rule names it", () => {
    const body = text('Sweet tomatoes and creamy beans');
    const heading = text('How to make it', { id: 'h', textBold: true });
    const blank = text('', { id: 'b' });
    const [b, h, e] = markTemplateExamples<El>([body, heading, blank], isSampleCopy);
    expect(typeof b![TEMPLATE_EXAMPLE_FIELD]).toBe('string');
    expect(h).toBe(heading);
    expect(e).toBe(blank);
    expect(markTemplateExamples<El>([body])[0]).toBe(body);
  });
});

describe('isUntouchedExample', () => {
  it('holds while the values are the ones marked, and breaks on any change to them', () => {
    const [el] = markTemplateExamples<El>([sticky('Ship it')]);
    expect(isUntouchedExample(el!)).toBe(true);
    // Moved and restyled: still untouched, as only the values count.
    expect(isUntouchedExample({ ...el!, x: 400, fillColor: '#bbf7d0' })).toBe(true);
    expect(isUntouchedExample({ ...el!, label: 'My own words' })).toBe(false);
    expect(isUntouchedExample({ ...el!, label: '' })).toBe(false);
    expect(isUntouchedExample(sticky('Ship it'))).toBe(false);
  });

  it('breaks on a tick', () => {
    const [el] = markTemplateExamples<El>([checklist([{ text: 'Book room', done: false }])]);
    expect(
      isUntouchedExample({ ...el!, checklistItems: [{ text: 'Book room', done: true }] }),
    ).toBe(false);
  });
});

describe('clearTemplateExamples', () => {
  it("empties every untouched example, keeping its place, look and a table's headers", () => {
    const els = markTemplateExamples<El>([
      sticky('Ship it', { richText: [{ text: 'Ship it' }] }),
      checklist([
        { text: 'Book room', done: true },
        { text: 'Send notes', done: false },
      ]),
      table(
        [
          ['', 'Urgent'],
          ['Important', 'Call Sam'],
        ],
        { headerRow: true, headerColumn: true },
      ),
      chart({
        pieSlices: [{ label: 'A', value: 3 }],
        lineSeries: [{ name: 'S', values: [1, 2] }],
      }),
      chart({ id: 'g2', lineSeries: [{ name: 'S', values: [5] }] }),
      chart({ id: 'g3', pieSlices: [{ label: 'B', value: 2 }] }),
    ]);
    const { elements, cleared } = clearTemplateExamples(els);
    expect(cleared).toBe(6);
    const [s, c, t, g, g2, g3] = elements;
    expect(s).toEqual({
      id: 's',
      type: 'sticky',
      x: 10,
      y: 20,
      width: 120,
      height: 120,
      fillColor: '#fde68a',
      label: '',
    });
    expect(c!.checklistItems).toEqual([
      { text: '', done: false },
      { text: '', done: false },
    ]);
    expect(t!.cells).toEqual([
      ['', 'Urgent'],
      ['Important', ''],
    ]);
    expect(g!.pieSlices).toEqual([{ label: 'A', value: 0 }]);
    expect(g!.lineSeries).toEqual([{ name: 'S', values: [0, 0] }]);
    expect(g2!.lineSeries).toEqual([{ name: 'S', values: [0] }]);
    expect('pieSlices' in g2!).toBe(false);
    expect(g3!.pieSlices).toEqual([{ label: 'B', value: 0 }]);
    expect('lineSeries' in g3!).toBe(false);
    for (const el of elements) expect(TEMPLATE_EXAMPLE_FIELD in el).toBe(false);
    expect(untouchedExampleCount(elements)).toBe(0);
  });

  it('empties a whole table without headers', () => {
    const [el] = markTemplateExamples<El>([table([['a', 'b']])]);
    expect(clearTemplateExamples([el!]).elements[0]!.cells).toEqual([['', '']]);
  });

  it('never clears what a person changed or locked, and drops their marks', () => {
    const [typed, locked, kept] = markTemplateExamples<El>([
      sticky('Ship it'),
      sticky('Locked', { id: 'l', locked: true }),
      sticky('Example'),
    ]);
    const changed = { ...typed!, label: 'My own words' };
    const plain = { id: 'p', type: 'sticky', label: 'Mine' };
    const { elements, cleared } = clearTemplateExamples([changed, locked!, kept!, plain]);
    expect(cleared).toBe(1);
    expect(elements[0]).toEqual(sticky('My own words'));
    expect(elements[1]).toEqual(sticky('Locked', { id: 'l', locked: true }));
    expect(elements[2]!.label).toBe('');
    expect(elements[3]).toBe(plain);
  });

  it('runs over a large tab within budget', () => {
    const many = markTemplateExamples<El>(
      Array.from({ length: 5000 }, (_, i) =>
        sticky(`Example note ${i}`.repeat(10), { id: `s${i}` }),
      ),
    );
    expect(cpuMsOf(() => untouchedExampleCount(many))).toBeLessThan(200);
    expect(cpuMsOf(() => clearTemplateExamples(many))).toBeLessThan(400);
  });
});

describe('clearing sample copy', () => {
  it("empties a marked text's words and runs, keeping its box, size and look", () => {
    const body = text('Sweet tomatoes and creamy beans', {
      textSize: 26,
      textColor: '#334155',
      richText: [{ text: 'Sweet tomatoes and creamy beans', italic: true }],
    });
    const [marked] = markTemplateExamples<El>([body], () => true);
    expect(isUntouchedExample(marked!)).toBe(true);
    const { elements, cleared } = clearTemplateExamples([marked!]);
    expect(cleared).toBe(1);
    const { richText: _runs, ...rest } = body;
    expect(elements[0]).toEqual({ ...rest, label: '' });
  });

  it('never clears a text a person retyped, and leaves an old, unmarked text the same object', () => {
    const [marked] = markTemplateExamples<El>([text('Sample words here')], () => true);
    const retyped = { ...marked!, label: 'Our real words' };
    const old = text('Words from before templates marked text');
    const { elements, cleared } = clearTemplateExamples([retyped, old]);
    expect(cleared).toBe(0);
    expect(elements[0]!.label).toBe('Our real words');
    expect(TEMPLATE_EXAMPLE_FIELD in elements[0]!).toBe(false);
    expect(elements[1]).toBe(old);
    expect(hasUntouchedExamples([old])).toBe(false);
  });
});

describe('keepTemplateExamples', () => {
  it('drops every mark and keeps the values', () => {
    const plain = { id: 'p', type: 'sticky', label: 'Mine' };
    const [el, same] = keepTemplateExamples([
      ...markTemplateExamples<El>([sticky('Ship it')]),
      plain,
    ]);
    expect(el).toEqual(sticky('Ship it'));
    expect(same).toBe(plain);
  });
});

describe('clearTabExamples and keepTabExamples', () => {
  it('change only the named tab, and leave a tab without marks the same object', () => {
    const marked = { id: 'a', elements: markTemplateExamples<El>([sticky('Ship it')]) };
    const other = { id: 'b', elements: markTemplateExamples<El>([sticky('Other')]) };
    const plain = { id: 'c', elements: [sticky('Mine')] };
    const cleared = clearTabExamples([marked, other, plain], 'a');
    expect(cleared[0]!.elements[0]!.label).toBe('');
    expect(cleared[1]).toBe(other);
    expect(clearTabExamples([marked, other, plain], 'c')[2]).toBe(plain);
    const kept = keepTabExamples([marked, other], 'a');
    expect(kept[0]!.elements[0]).toEqual(sticky('Ship it'));
    expect(kept[1]).toBe(other);
  });
});

describe('hasUntouchedExamples', () => {
  it('answers per elements array, and again for a new one', () => {
    const els = markTemplateExamples<El>([sticky('a')]);
    expect(hasUntouchedExamples(els)).toBe(true);
    expect(hasUntouchedExamples(els)).toBe(true);
    expect(hasUntouchedExamples([{ ...els[0]!, label: 'mine' }])).toBe(false);
    expect(hasUntouchedExamples([])).toBe(false);
  });

  it('fingerprints a changed example once, not on every commit after it', () => {
    let reads = 0;
    const changed = Object.defineProperty(
      { ...markTemplateExamples<El>([sticky('Ship it')])[0]! },
      'label',
      {
        get: () => {
          reads++;
          return 'My own words';
        },
        enumerable: true,
      },
    );
    expect(hasUntouchedExamples([changed])).toBe(false);
    const afterFirst = reads;
    expect(afterFirst).toBeGreaterThan(0);
    // A later commit: a new elements array holding the same changed element.
    expect(hasUntouchedExamples([changed, sticky('Mine')])).toBe(false);
    expect(reads).toBe(afterFirst);
    // Clear Example Content still re-checks it and leaves the person's words.
    expect(clearTemplateExamples([changed]).cleared).toBe(0);
  });

  it('rescans a tab of changed examples cheaply on each new commit', () => {
    const changed = markTemplateExamples<El>(
      Array.from({ length: 5000 }, (_, i) =>
        sticky(`Example note ${i}`.repeat(10), { id: `s${i}` }),
      ),
    ).map((el) => ({ ...el, label: `${el.label as string}!` }));
    hasUntouchedExamples(changed);
    expect(cpuMsOf(() => hasUntouchedExamples([...changed]))).toBeLessThan(50);
  });
});

describe('untouchedExampleCount', () => {
  it('counts the elements Clear Example Content would empty', () => {
    const els = markTemplateExamples<El>([sticky('a'), sticky('b'), sticky('')]);
    expect(untouchedExampleCount(els)).toBe(2);
    expect(untouchedExampleCount([{ ...els[0]!, label: 'changed' }, els[1]!])).toBe(1);
  });
});
