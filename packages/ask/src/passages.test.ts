import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  ASK_MAX_ID_CHARS,
  ASK_MAX_LABEL_CHARS,
  ASK_MAX_ONE_PASSAGE_CHARS,
  ASK_MAX_PASSAGES,
  ASK_MAX_PASSAGE_CHARS,
} from './limits';
import {
  ASK_MAX_RANK_WORDS,
  choosePassages,
  contentWords,
  readPassages,
  type AskPassage,
} from './passages';

const passage = (id: string, over: Partial<AskPassage> = {}): AskPassage => ({
  id,
  tabId: 'tab-1',
  tabName: 'Checkout Flow',
  elementId: `el-${id}`,
  kind: 'Shape',
  title: `Title ${id}`,
  text: `Text of ${id}.`,
  ...over,
});

describe('the words of a question', () => {
  it('are its content words, each once, lower case, the common ones left out', () => {
    expect(contentWords('What happens when the Payment provider times out? Payment!')).toEqual([
      'happens',
      'payment',
      'provider',
      'times',
    ]);
    expect(contentWords('')).toEqual([]);
    expect(contentWords('a to it')).toEqual([]);
  });

  it('are bounded', () => {
    const many = Array.from({ length: 60 }, (_x, at) => `word${at}`).join(' ');
    expect(contentWords(many)).toHaveLength(ASK_MAX_RANK_WORDS);
    expect(contentWords(many, 3)).toEqual(['word0', 'word1', 'word2']);
  });
});

describe('choosing the passages of a question', () => {
  it('sends a small item whole, in its own order, without the empty ones', () => {
    const chosen = choosePassages('retry', [
      passage('a'),
      passage('blank', { text: '   ' }),
      passage('b', { title: 'Retry Queue' }),
    ]);
    expect(chosen.map((c) => [c.number, c.passage.id])).toEqual([
      [1, 'a'],
      [2, 'b'],
    ]);
  });

  it('cuts one long passage to its bound', () => {
    const [only] = choosePassages('x', [passage('a', { text: 'y'.repeat(5000) })]);
    expect(only!.passage.text).toHaveLength(ASK_MAX_ONE_PASSAGE_CHARS);
  });

  it('ranks a larger item by the question, a title counting most, then the item order', () => {
    const filler = Array.from({ length: ASK_MAX_PASSAGES + 5 }, (_x, at) => passage(`f${at}`));
    const all = [
      ...filler,
      passage('text', { text: 'The retry happens here.' }),
      passage('title', { title: 'Retry Queue' }),
      passage('tab', { tabName: 'Retry Notes' }),
      passage('both', { title: 'Retry', text: 'retry retry' }),
    ];
    const chosen = choosePassages('What does the retry do?', all);
    expect(chosen).toHaveLength(ASK_MAX_PASSAGES);
    expect(chosen.slice(0, 5).map((c) => c.passage.id)).toEqual([
      'both',
      'title',
      'text',
      'tab',
      'f0',
    ]);
    expect(chosen.map((c) => c.number)).toEqual(
      Array.from({ length: ASK_MAX_PASSAGES }, (_x, at) => at + 1),
    );
  });

  it('ranks a follow-up with the earlier questions too, the new one counting more', () => {
    const filler = Array.from({ length: ASK_MAX_PASSAGES + 2 }, (_x, at) => passage(`f${at}`));
    const all = [
      ...filler,
      passage('queue', { title: 'Retry Queue' }),
      passage('owner', { title: 'Owner' }),
    ];
    const chosen = choosePassages('Who is the owner?', all, [
      'What does the retry queue do?',
      'Owner?',
    ]);
    expect(chosen.slice(0, 2).map((c) => c.passage.id)).toEqual(['owner', 'queue']);
  });

  it('with no word to rank by, takes the item in order', () => {
    const all = Array.from({ length: ASK_MAX_PASSAGES + 3 }, (_x, at) => passage(`p${at}`));
    const chosen = choosePassages('??', all);
    expect(chosen[0]!.passage.id).toBe('p0');
    expect(chosen).toHaveLength(ASK_MAX_PASSAGES);
  });

  it('keeps to the character budget, a shorter passage still taken after one that does not fit', () => {
    const big = (id: string) => passage(id, { text: 'x'.repeat(ASK_MAX_ONE_PASSAGE_CHARS) });
    const all = [
      ...Array.from({ length: 11 }, (_x, at) => big(`big${at}`)),
      passage('mid', { text: 'm'.repeat(ASK_MAX_ONE_PASSAGE_CHARS - 100) }),
      big('late'),
      passage('small', { text: 'tiny' }),
    ];
    const chosen = choosePassages('none', all);
    const total = chosen.reduce((sum, c) => sum + c.passage.text.length, 0);
    expect(total).toBeLessThanOrEqual(ASK_MAX_PASSAGE_CHARS);
    expect(chosen.map((c) => c.passage.id)).toContain('small');
    expect(chosen.map((c) => c.passage.id)).not.toContain('late');
  });

  it('stays linear on a very large item', () => {
    const all = Array.from({ length: 20_000 }, (_x, at) =>
      passage(`p${at}`, { text: `Step ${at} hands the order to the next service in the flow.` }),
    );
    const ms = cpuMsOf(() =>
      choosePassages('Which service hands the order on after payment?', all),
    );
    expect(ms).toBeLessThan(cpuBudgetMs(400));
  });
});

describe('the passages a request carries', () => {
  it('are read within their bounds, numbered as sent', () => {
    const read = readPassages([
      {
        id: 'a',
        tabId: 't',
        tabName: 'n'.repeat(500),
        elementId: 'e',
        kind: 'Shape',
        title: 'T',
        text: 'z'.repeat(5000),
        extra: 'ignored',
      },
      { id: 'b', tabId: 't', text: 'ok' },
    ]);
    expect(read).toHaveLength(2);
    expect(read[0]).toEqual({
      number: 1,
      passage: {
        id: 'a',
        tabId: 't',
        tabName: 'n'.repeat(ASK_MAX_LABEL_CHARS),
        elementId: 'e',
        kind: 'Shape',
        title: 'T',
        text: 'z'.repeat(ASK_MAX_ONE_PASSAGE_CHARS),
      },
    });
    expect(read[1]!.passage).toEqual({
      id: 'b',
      tabId: 't',
      tabName: '',
      elementId: null,
      kind: '',
      title: '',
      text: 'ok',
    });
  });

  it('leave out what is not a passage, a repeat, and what passes the bounds', () => {
    expect(readPassages('nope')).toEqual([]);
    expect(readPassages(null)).toEqual([]);
    const read = readPassages([
      null,
      'text',
      { id: '', tabId: 't', text: 'x' },
      { id: 'i'.repeat(ASK_MAX_ID_CHARS + 1), tabId: 't', text: 'x' },
      { id: 'no-tab', text: 'x' },
      { id: 'blank', tabId: 't', text: '  ' },
      { id: 'no-text', tabId: 't' },
      { id: 'a', tabId: 't', text: 'first' },
      { id: 'a', tabId: 't', text: 'again' },
    ]);
    expect(read.map((r) => r.passage.text)).toEqual(['first']);
    const many = Array.from({ length: ASK_MAX_PASSAGES + 10 }, (_x, at) => ({
      id: `p${at}`,
      tabId: 't',
      text: 'x',
    }));
    expect(readPassages(many)).toHaveLength(ASK_MAX_PASSAGES);
    const heavy = Array.from({ length: 20 }, (_x, at) => ({
      id: `h${at}`,
      tabId: 't',
      text: 'x'.repeat(ASK_MAX_ONE_PASSAGE_CHARS),
    }));
    const kept = readPassages([...heavy, { id: 'small', tabId: 't', text: 'fits' }]);
    expect(kept.reduce((sum, r) => sum + r.passage.text.length, 0)).toBeLessThanOrEqual(
      ASK_MAX_PASSAGE_CHARS,
    );
    expect(kept).toHaveLength(ASK_MAX_PASSAGE_CHARS / ASK_MAX_ONE_PASSAGE_CHARS);
  });
});
