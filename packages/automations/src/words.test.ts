import { describe, expect, it } from 'vitest';
import { Failed, allHold, fail, personNamed } from './failed';
import {
  AUTOMATION_NOTIFY_NAMES,
  automationDayWords,
  notifyChip,
  sentenceOrList,
  waitWords,
} from './words';

describe('a failed step', () => {
  it('carries its reason and what the item lacks', () => {
    const gone = { kind: 'tab', id: 't1' };
    expect(() => fail('The tab is gone', gone)).toThrow(Failed);
    try {
      fail('The tab is gone', gone);
    } catch (error) {
      expect((error as Failed).message).toBe('The tab is gone');
      expect((error as Failed).gone).toEqual(gone);
    }
    expect(new Failed('Why').gone).toBeUndefined();
  });

  it('finds a person by id, or by name in any case', () => {
    const people = [
      { id: 'u1', name: 'Ana Costa' },
      { id: 'u2', name: 'Priya Shah' },
    ];
    expect(personNamed(people, 'u2')?.name).toBe('Priya Shah');
    expect(personNamed(people, 'ana costa')?.id).toBe('u1');
    expect(personNamed(people, 'nobody')).toBeUndefined();
  });

  it('holds every condition by the app’s own check', () => {
    const holds = (n: number) => ({ ok: n > 0, text: String(n) });
    expect(allHold([1, 2], holds)).toEqual({
      ok: true,
      lines: [
        { ok: true, text: '1' },
        { ok: true, text: '2' },
      ],
    });
    expect(allHold([1, 0], holds).ok).toBe(false);
    expect(allHold([], holds)).toEqual({ ok: true, lines: [] });
  });
});

describe('a rule in words', () => {
  it('says a day', () => {
    expect(automationDayWords({ day: '2026-11-11' })).toBe('11 Nov 2026');
    expect(automationDayWords({ day: 'x' }, () => 'the app’s own')).toBe('the app’s own');
    expect(automationDayWords({ today: 0 })).toBe('Today');
    expect(automationDayWords({ today: 1 })).toBe('Today + 1 day');
    expect(automationDayWords({ today: -3 })).toBe('Today - 3 days');
  });

  it('lists names with or', () => {
    expect(sentenceOrList([])).toBe('');
    expect(sentenceOrList(['A'])).toBe('A');
    expect(sentenceOrList(['A', 'B', 'C'])).toBe('A, B or C');
  });

  it('says a Wait in days and hours', () => {
    expect(waitWords(3)).toBe('Wait 3 Hours');
    expect(waitWords(1)).toBe('Wait 1 Hour');
    expect(waitWords(48)).toBe('Wait 2 Days');
    expect(waitWords(28)).toBe('Wait 1 Day 4 Hours');
  });

  it('says where a message goes: the connection’s current name, its kept one, or its kind alone', () => {
    const step = { kind: 'notify', via: 'slack', webhook: 'wh_1', name: 'Old', text: 'x' } as const;
    expect(notifyChip(step, { webhooks: new Map([['wh_1', 'Launch']]) })).toBe(
      'Post to Slack Launch',
    );
    expect(notifyChip(step, {})).toBe('Post to Slack Old');
    expect(notifyChip({ ...step, name: undefined, via: 'teams' })).toBe(
      AUTOMATION_NOTIFY_NAMES.teams,
    );
  });
});
