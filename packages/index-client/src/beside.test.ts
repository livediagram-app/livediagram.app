import { describe, expect, it } from 'vitest';
import { BESIDE_OFFERS, besideTitle, isBesideOfferId, readBesideInput } from './beside';
import { TITLE_MAX } from './constants';

describe('a file made beside an item (Work Tracker 1281)', () => {
  it('offers a liveplanner Project Planner named Plan', () => {
    expect(BESIDE_OFFERS.plan).toMatchObject({
      app: 'liveplanner',
      template: 'project-planner',
      name: 'Plan',
    });
    expect(isBesideOfferId('plan')).toBe(true);
    expect(isBesideOfferId('constructor')).toBe(false);
    expect(isBesideOfferId(7)).toBe(false);
  });

  it('names the file after its host, within a title', () => {
    expect(besideTitle('Offline Sync', BESIDE_OFFERS.plan)).toBe('Offline Sync Plan');
    expect(besideTitle('  ', BESIDE_OFFERS.plan)).toBe('Plan');
    const long = besideTitle('x'.repeat(TITLE_MAX), BESIDE_OFFERS.plan);
    expect(long).toHaveLength(TITLE_MAX);
    expect(long.endsWith(' Plan')).toBe(true);
  });

  it('reads exactly its fields, and refuses the malformed', () => {
    expect(
      readBesideInput({ offer: 'plan', tabId: 'tab-1', level: 'view', both: true, x: 1 }),
    ).toEqual({ offer: 'plan', tabId: 'tab-1', level: 'view', both: true });
    expect(readBesideInput({ offer: 'plan', tabId: 'tab-1' })).toEqual({
      offer: 'plan',
      tabId: 'tab-1',
    });
    for (const bad of [
      null,
      [],
      'plan',
      { offer: 'deck', tabId: 'tab-1' },
      { offer: 'plan', tabId: 'a b' },
      { offer: 'plan', tabId: 5 },
      { offer: 'plan', tabId: 'tab-1', level: 'owner' },
      { offer: 'plan', tabId: 'tab-1', both: 'yes' },
    ])
      expect(readBesideInput(bad)).toBeNull();
  });
});
