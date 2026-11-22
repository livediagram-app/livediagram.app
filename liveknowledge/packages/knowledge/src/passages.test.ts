import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import { bullet, flowOf, para } from './__fixtures__/writing';
import { MAX_HEADING_PATH_CHARS, MAX_PASSAGE_CHARS, pagePassages, passagePieces } from './passages';

const sentence = (n: number) => `Sentence number ${n} says something about the release process.`;
const sentences = (from: number, count: number) =>
  Array.from({ length: count }, (_x, at) => sentence(from + at)).join(' ');

describe('a page in passages', () => {
  it('makes a passage of a heading and the blocks under it, the title left out', () => {
    const passages = pagePassages(
      'tab-1',
      flowOf(
        para('Release Process', 'title'),
        para('Before any heading.'),
        para('Deploys', 'h1'),
        para('We deploy on Fridays.'),
        bullet('Never on a bank holiday.'),
        para('Rollbacks', 'h2'),
        para('Roll back with one command.'),
        para('Details', 'h3'),
        para('The command is `undo`.'),
        para('Support', 'h1'),
        para('Ask in the channel.'),
      ),
    );
    expect(passages.map((p) => [p.headings, p.text])).toEqual([
      [[], 'Before any heading.'],
      [['Deploys'], 'Deploys\nWe deploy on Fridays.\nNever on a bank holiday.'],
      [['Deploys', 'Rollbacks'], 'Rollbacks\nRoll back with one command.'],
      [['Deploys', 'Rollbacks', 'Details'], 'Details\nThe command is `undo`.'],
      [['Support'], 'Support\nAsk in the channel.'],
    ]);
    expect(passages.map((p) => p.ordinal)).toEqual([0, 1, 2, 3, 4]);
    expect(passages.every((p) => p.tab === 'tab-1')).toBe(true);
  });

  it('names the first and last block a passage comes from', () => {
    const flow = flowOf(para('Deploys', 'h1'), para('One.'), para('Two.'));
    const [passage] = pagePassages('tab-1', flow);
    expect(passage!.firstBlock).toBe(flow.blocks[0]!.id);
    expect(passage!.lastBlock).toBe(flow.blocks[2]!.id);
  });

  it('ends a section at an empty heading, and skips blocks without words', () => {
    const passages = pagePassages(
      'tab-1',
      flowOf(para('Deploys', 'h1'), para('One.'), para('', 'h2'), para(''), para('Two.')),
    );
    expect(passages.map((p) => [p.headings, p.text])).toEqual([
      [['Deploys'], 'Deploys\nOne.'],
      [['Deploys'], 'Two.'],
    ]);
  });

  it('cuts a long heading in the heading path', () => {
    const [passage] = pagePassages('tab-1', flowOf(para('H'.repeat(300), 'h1')));
    expect(passage!.headings[0]).toHaveLength(MAX_HEADING_PATH_CHARS);
  });

  it('splits a long section between blocks', () => {
    const blocks = Array.from({ length: 30 }, (_x, at) => para(sentences(at * 3, 3)));
    const passages = pagePassages('tab-1', flowOf(para('Long', 'h1'), ...blocks));
    expect(passages.length).toBeGreaterThan(1);
    for (const p of passages) {
      expect(p.text.length).toBeLessThanOrEqual(MAX_PASSAGE_CHARS);
      expect(p.headings).toEqual(['Long']);
    }
    // No block is cut: every passage ends at a block's end.
    for (const p of passages) expect(p.text.endsWith('release process.')).toBe(true);
    expect(passages.map((p) => p.text).join('\n')).toBe(
      ['Long', ...blocks.map((b) => (b as { runs: { text: string }[] }).runs[0]!.text)].join('\n'),
    );
  });

  it('splits a block longer than a passage at the end of a sentence', () => {
    const long = sentences(0, 60);
    const passages = pagePassages('tab-1', flowOf(para(long)));
    expect(passages.length).toBeGreaterThan(2);
    for (const p of passages) {
      expect(p.text.length).toBeLessThanOrEqual(MAX_PASSAGE_CHARS);
      expect(p.text.endsWith('.')).toBe(true);
      expect(p.text.startsWith('Sentence number')).toBe(true);
    }
    expect(passages.map((p) => p.text).join(' ')).toBe(long);
  });

  it('gives each passage an id that is stable and its own', () => {
    const flow = flowOf(
      para('Deploys', 'h1'),
      para(sentences(0, 60)),
      para('Support', 'h1'),
      para('Ask.'),
    );
    const first = pagePassages('tab-1', flow);
    expect(pagePassages('tab-1', flow).map((p) => p.id)).toEqual(first.map((p) => p.id));
    expect(new Set(first.map((p) => p.id)).size).toBe(first.length);
    expect(pagePassages('tab-2', flow)[0]!.id).not.toBe(first[0]!.id);
  });

  it('keeps the ids under one heading when writing is added under another', () => {
    const support = [para('Support', 'h1'), para('Ask in the channel.')];
    const before = pagePassages('tab-1', flowOf(para('Deploys', 'h1'), para('One.'), ...support));
    const after = pagePassages(
      'tab-1',
      flowOf(para('Deploys', 'h1'), para(sentences(0, 60)), ...support),
    );
    expect(after.at(-1)!.id).toBe(before.at(-1)!.id);
    expect(after.at(-1)!.textHash).toBe(before.at(-1)!.textHash);
    expect(after[0]!.textHash).not.toBe(before[0]!.textHash);
  });

  it('answers no passage for a page without words', () => {
    expect(pagePassages('tab-1', flowOf(para('Only a Title', 'title'), para('')))).toEqual([]);
  });
});

describe('pieces of a long text', () => {
  it('cuts at a line break, then at a space, then at the limit', () => {
    const lines = `${'a'.repeat(700)}\n${'b'.repeat(700)}`;
    expect(passagePieces(lines)).toEqual(['a'.repeat(700), 'b'.repeat(700)]);
    const words = `${'a'.repeat(700)} ${'b'.repeat(700)}`;
    expect(passagePieces(words)).toEqual(['a'.repeat(700), 'b'.repeat(700)]);
    expect(passagePieces('x'.repeat(2500)).map((p) => p.length)).toEqual([1200, 1200, 100]);
  });

  it('never cuts between the halves of a surrogate pair', () => {
    const text = `${'x'.repeat(MAX_PASSAGE_CHARS - 1)}😀${'y'.repeat(50)}`;
    const pieces = passagePieces(text);
    expect(pieces[0]).toBe('x'.repeat(MAX_PASSAGE_CHARS - 1));
    expect(pieces.join('')).toBe(text);
  });

  it('drops a piece that is only space', () => {
    expect(passagePieces(`${' '.repeat(1300)}end`)).toEqual(['end']);
    expect(passagePieces('   ')).toEqual([]);
  });
});

describe('the cost of indexing a save', () => {
  it('splits a 100,000 character page within its CPU budget', () => {
    // docs/specs/030-knowledgebase/search-and-ask.md "Bounds": a 100,000 character page indexes within 50 ms.
    const blocks = [];
    for (let section = 0; section < 22; section++) {
      blocks.push(para(`Section ${section}`, 'h2'));
      // A paragraph far past a passage, then short ones: both kinds of split.
      blocks.push(para(sentences(section * 100, 40)));
      for (let n = 0; n < 12; n++) blocks.push(para(sentences(section * 100 + n, 3)));
    }
    const flow = flowOf(...blocks);
    const chars = blocks.reduce(
      (sum, b) => sum + (b as { runs: { text: string }[] }).runs[0]!.text.length,
      0,
    );
    expect(chars).toBeGreaterThan(100_000);
    pagePassages('warm', flow);
    let passages = 0;
    const spent = cpuMsOf(() => {
      passages = pagePassages('tab-1', flow).length;
    });
    expect(passages).toBeGreaterThan(80);
    expect(spent).toBeLessThan(cpuBudgetMs(50));
  });

  it('stays linear on one unbroken 400,000 character block', () => {
    const flow = flowOf(para('x'.repeat(400_000)));
    const spent = cpuMsOf(() => {
      expect(pagePassages('tab-1', flow)).toHaveLength(Math.ceil(400_000 / MAX_PASSAGE_CHARS));
    });
    expect(spent).toBeLessThan(cpuBudgetMs(100));
  });
});
