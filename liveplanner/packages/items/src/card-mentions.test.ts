import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { describe, expect, it } from 'vitest';
import { MENTIONS_MAX, MENTION_TEXT_MAX, cardMentions } from './card-mentions';

// Card mentions (docs/specs/026-plan/github-pull-requests.md "How a card names its pull requests").

describe('a card mention', () => {
  it('is the plan name, spaces or none, an optional # and the number', () => {
    expect(cardMentions('Fixes Work Tracker #143', 'Work Tracker')).toEqual([143]);
    expect(cardMentions('work tracker 143', 'Work Tracker')).toEqual([143]);
    expect(cardMentions('(Work Tracker #143)', 'Work Tracker')).toEqual([143]);
    expect(cardMentions('Work   Tracker\n#143.', 'Work  Tracker ')).toEqual([143]);
    expect(cardMentions('WORK TRACKER#9', 'work tracker')).toEqual([9]);
    expect(cardMentions('Planner12', 'Planner')).toEqual([12]);
  });

  it('needs no letter or digit on either side', () => {
    expect(cardMentions('Work Trackers #143', 'Work Tracker')).toEqual([]);
    expect(cardMentions('MyWork Tracker #143', 'Work Tracker')).toEqual([]);
    expect(cardMentions('Work Tracker #143a', 'Work Tracker')).toEqual([]);
    expect(cardMentions('Work Tracker #1430', 'Work Tracker')).toEqual([1430]);
    expect(cardMentions('WorkTracker #143', 'Work Tracker')).toEqual([]);
    expect(cardMentions('Work Tracker #', 'Work Tracker')).toEqual([]);
    expect(cardMentions('Work Tracker #0', 'Work Tracker')).toEqual([]);
    expect(cardMentions('Work Tracker #12345678901', 'Work Tracker')).toEqual([]);
    expect(cardMentions('éTracker #1', 'Tracker')).toEqual([]);
  });

  it('never reads a number into a name that ends in a digit', () => {
    expect(cardMentions('Sprint 412', 'Sprint 4')).toEqual([]);
    expect(cardMentions('Sprint 4 #12 and Sprint 4 13', 'Sprint 4')).toEqual([12, 13]);
  });

  it('lists each card once, in the order met, and keeps going after a near miss', () => {
    expect(
      cardMentions(
        'Work Trackers 1, Work Tracker #2, Work Tracker 3, Work Tracker #2',
        'Work Tracker',
      ),
    ).toEqual([2, 3]);
  });

  it('names nothing with no name or no text', () => {
    expect(cardMentions('Work Tracker #1', '   ')).toEqual([]);
    expect(cardMentions('', 'Work Tracker')).toEqual([]);
  });

  it('reads at most the first 65,536 characters and names at most 20 cards', () => {
    expect(MENTION_TEXT_MAX).toBe(65_536);
    const late = `${'x'.repeat(MENTION_TEXT_MAX)} Plan #1`;
    expect(cardMentions(late, 'Plan')).toEqual([]);
    const many = Array.from({ length: MENTIONS_MAX + 5 }, (_, i) => `Plan #${i + 1}`).join(' ');
    expect(cardMentions(many, 'Plan')).toHaveLength(MENTIONS_MAX);
  });

  it('is read in linear time on a worst-case body', () => {
    const spaces = `work${' '.repeat(MENTION_TEXT_MAX)}`;
    const repeats = 'work work '.repeat(MENTION_TEXT_MAX / 10);
    const digits = `work tracker #${'1'.repeat(MENTION_TEXT_MAX)}`;
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 20; i += 1) {
        cardMentions(spaces, 'Work Tracker');
        cardMentions(repeats, 'Work Work Tracker');
        cardMentions(digits, 'Work Tracker');
      }
    });
    expect(ms).toBeLessThan(cpuBudgetMs(400));
  });
});
