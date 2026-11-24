// Send to Plan's reading of the words (liveworkspace/docs/specs/004-index/send-to-plan.md "From the words"), with the
// clock pinned to one local day.
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import {
  matchPerson,
  readSendSpan,
  readSendWords,
  readWholeDate,
  SEND_TITLE_MAX,
} from './send-words';

// Wednesday 18 November 2026, local.
const TODAY = new Date(2026, 10, 18);
const read = (text: string) => readSendWords(text, TODAY);

describe('the words read as a card', () => {
  it('takes the first line as the title, the mention and the date words out', () => {
    expect(read('Fix the login @Ben by Friday\nIt fails on Safari')).toEqual({
      title: 'Fix the login',
      mention: 'Ben',
      due: '2026-11-20',
    });
    expect(read('\n\n  Ship it  ')).toEqual({ title: 'Ship it', mention: null, due: null });
  });

  it('reads every way a day is written', () => {
    expect(read('Launch 2026-12-01').due).toBe('2026-12-01');
    expect(read('Launch 1 Dec').due).toBe('2026-12-01');
    expect(read('Launch Dec 1st.').due).toBe('2026-12-01');
    expect(read('Launch on 3rd December').due).toBe('2026-12-03');
    expect(read('Call them today').due).toBe('2026-11-18');
    expect(read('Call them tomorrow').due).toBe('2026-11-19');
    // A weekday a week on when it is today.
    expect(read('Review on Wednesday').due).toBe('2026-11-25');
    expect(read('Send it before Friday').due).toBe('2026-11-20');
    expect(read('Call Sam Monday').due).toBe('2026-11-23');
    expect(read('Wednesday review').due).toBeNull();
    // A day before today is kept as written; a day that is no day is not one.
    expect(read('Was due 1 Jan').due).toBe('2026-01-01');
    expect(read('Launch 2026-02-30').due).toBeNull();
    expect(read('Launch 31 Feb').due).toBeNull();
    expect(read('Room 42 of may').due).toBeNull();
  });

  it('leaves a date in ordinary prose alone: in the title, and no Due', () => {
    for (const prose of [
      'Every return today starts with a check of the stock',
      'Tomorrow we review the stock levels',
      'The 1 Dec release notes need a proofread',
      'Friday drinks are cancelled for the team',
    ])
      expect(read(prose)).toEqual({ title: prose, mention: null, due: null });
    // After a lead word a date is a due date, as the spec reads it.
    expect(read('What we learned on Monday standup was useful')).toEqual({
      title: 'What we learned standup was useful',
      mention: null,
      due: '2026-11-23',
    });
    // A date standing alone at the very end, or on a line of its own, is a due date.
    expect(read('Every return today starts with a check, due 1 Dec')).toEqual({
      title: 'Every return today starts with a check',
      mention: null,
      due: '2026-12-01',
    });
    expect(read('Restock the shelves\ntomorrow').due).toBe('2026-11-19');
  });

  it('takes the first mention and date even on a later line, keeping the title', () => {
    expect(read('Plan the offsite\nAsk @ana.\nby tomorrow')).toEqual({
      title: 'Plan the offsite',
      mention: 'ana',
      due: '2026-11-19',
    });
    expect(read('@ben')).toEqual({ title: '', mention: 'ben', due: null });
  });

  it('cuts a long title at a word', () => {
    const long = `${'word '.repeat(40)}end`;
    const { title } = read(long);
    expect(title.length).toBeLessThanOrEqual(SEND_TITLE_MAX);
    expect(title.endsWith('word')).toBe(true);
    expect(read('x'.repeat(200)).title).toHaveLength(SEND_TITLE_MAX);
  });

  it('matches a mention to the plan’s people by name or first name', () => {
    const people = [{ name: 'Ada Lovelace' }, { name: 'Ben' }];
    expect(matchPerson('ben', people)).toBe('Ben');
    expect(matchPerson('Ada', people)).toBe('Ada Lovelace');
    expect(matchPerson('ada lovelace', people)).toBe('Ada Lovelace');
    expect(matchPerson('Cara', people)).toBeNull();
    expect(matchPerson(' ', people)).toBeNull();
  });

  it('reads a worst-case input within its CPU budget', () => {
    const worst = `${'@a 1 by on '.repeat(5_000)}\n`.repeat(4);
    expect(cpuMsOf(() => read(worst))).toBeLessThan(cpuBudgetMs(50));
    const lines = '\n'.repeat(50_000);
    expect(cpuMsOf(() => read(lines))).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('words that look like a day but are not one', () => {
  it('reads no day from a bare suffix, a dashed word, a month day past its end or an empty mention', () => {
    expect(read('Ask st Dec').due).toBeNull();
    expect(read('Code abcd-ef-gh').due).toBeNull();
    expect(read('Launch Feb 31').due).toBeNull();
    expect(read('Mail @. now').mention).toBeNull();
    expect(read('Mail @@ben now').mention).toBeNull();
    expect(read('Mail @:x now').mention).toBeNull();
  });
});

// Make Plan Cards' spans and timeline marks (livediagram make-plan-cards.md "Dates").
describe('the words read as a span of work', () => {
  const span = (text: string) => readSendSpan(text, TODAY);
  it('takes two dates joined by a range word as Start and Due, the title without them', () => {
    expect(span('Design 1 Dec to 12 Dec')).toEqual({
      title: 'Design',
      start: '2026-12-01',
      due: '2026-12-12',
    });
    expect(span('Build from 2 Dec until 9 Dec carefully')).toEqual({
      title: 'Build carefully',
      start: '2026-12-02',
      due: '2026-12-09',
    });
    expect(span('Test 3 Dec \u2013 4 Dec')).toMatchObject({
      start: '2026-12-03',
      due: '2026-12-04',
    });
    expect(span('Test 3 Dec \u2014 4 Dec')).toMatchObject({
      start: '2026-12-03',
      due: '2026-12-04',
    });
    expect(span('Launch 2026-12-01 \u2192 2026-12-03\nsecond line')).toMatchObject({
      title: 'Launch',
    });
  });

  it('carries a span across the new year', () => {
    expect(span('Holiday 20 Dec to 5 Jan')).toMatchObject({
      start: '2026-12-20',
      due: '2027-01-05',
    });
  });

  it('is null without two dates joined by a range word', () => {
    expect(span('Design by 12 Dec')).toBeNull();
    expect(span('Design 1 Dec and 12 Dec')).toBeNull();
    expect(span('Design 1 Dec to')).toBeNull();
    expect(span('Design 1 Dec to the moon')).toBeNull();
    expect(span('x'.repeat(5000))).toBeNull();
  });
});

describe('the words read as one date alone', () => {
  const whole = (text: string) => readWholeDate(text, TODAY);
  it('reads a label that is only a date', () => {
    expect(whole('1 Dec')).toBe('2026-12-01');
    expect(whole(' 2026-12-08 ')).toBe('2026-12-08');
    expect(whole('Dec 8')).toBe('2026-12-08');
  });

  it('is null for anything more, a weekday, today or tomorrow', () => {
    for (const text of [
      '',
      'Design 1 Dec',
      '1 Dec\n2 Dec',
      'Friday',
      'today',
      'tomorrow',
      'a b c d',
      'x'.repeat(41),
      'Design',
    ])
      expect(whole(text)).toBeNull();
  });
});
