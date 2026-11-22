// Send to Plan's reading of the words (liveworkspace/docs/specs/004-index/send-to-plan.md "From the words"), with the
// clock pinned to one local day.
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import { matchPerson, readSendWords, SEND_TITLE_MAX } from './send-words';

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
    // A weekday a week on when it is today, and only after by or on.
    expect(read('Review on Wednesday').due).toBe('2026-11-25');
    expect(read('Wednesday review').due).toBeNull();
    // A day before today is kept as written; a day that is no day is not one.
    expect(read('Was due 1 Jan').due).toBe('2026-01-01');
    expect(read('Launch 2026-02-30').due).toBeNull();
    expect(read('Launch 31 Feb').due).toBeNull();
    expect(read('Room 42 of may').due).toBeNull();
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
