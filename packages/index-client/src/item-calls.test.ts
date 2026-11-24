import { describe, expect, it } from 'vitest';
import {
  CALL_SPACE_SETTING,
  callFallbackWords,
  callInProgressWords,
  callNames,
  inCallWords,
  ITEM_CALL_INVITES_MAX,
  ITEM_CALL_NAMES_MAX,
  ITEM_CALL_SUMMARY_MAX,
  itemCallTabName,
  itemTabName,
  readCallInviteAsk,
  readCallPeoplePush,
  readCallSpaceSetting,
  readCallSummaryAsk,
  readItemCallAsk,
} from './item-calls';
import { readSourceChange } from './sheet-sources';

describe('callNames', () => {
  it('trims, cuts, drops blanks, repeats and non-strings, and stops at the most', () => {
    expect(callNames([' Ada ', 'Ada', '', 3, 'Ben', 'x'.repeat(200)])).toEqual([
      'Ada',
      'Ben',
      'x'.repeat(80),
    ]);
    const many = Array.from({ length: 80 }, (_, i) => `P${i}`);
    expect(callNames(many)).toHaveLength(ITEM_CALL_NAMES_MAX);
  });
});

describe('readCallPeoplePush', () => {
  it('takes a whole count and names', () => {
    expect(readCallPeoplePush({ people: 2, names: ['Ada', 'Ben', 'Ada'] })).toEqual({
      people: 2,
      names: ['Ada', 'Ben'],
    });
  });
  it.each([
    null,
    [],
    { people: -1, names: [] },
    { people: 1.5, names: [] },
    { people: 20_000, names: [] },
    { people: 1, names: 'Ada' },
    { people: 1, names: Array.from({ length: 201 }, () => 'a') },
  ])('refuses %j', (raw) => {
    expect(readCallPeoplePush(raw)).toBeNull();
  });
});

describe('readCallSummaryAsk', () => {
  it('takes a knowledgebase, a trimmed title and a body', () => {
    expect(readCallSummaryAsk({ knowledgebase: 'kb1', title: ' Retro ', body: 'Notes' })).toEqual({
      knowledgebase: 'kb1',
      title: 'Retro',
      body: 'Notes',
    });
  });
  it.each([
    { knowledgebase: 'a b', title: 'T', body: 'B' },
    { knowledgebase: 'kb', title: '  ', body: 'B' },
    { knowledgebase: 'kb', title: 'x'.repeat(201), body: 'B' },
    { knowledgebase: 'kb', title: 'T', body: ' ' },
    { knowledgebase: 'kb', title: 'T', body: 'x'.repeat(ITEM_CALL_SUMMARY_MAX + 1) },
    { knowledgebase: 'kb', title: 1, body: 'B' },
    'kb',
  ])('refuses %j', (raw) => {
    expect(readCallSummaryAsk(raw)).toBeNull();
  });
});

describe('readCallInviteAsk', () => {
  it('takes people once each', () => {
    expect(readCallInviteAsk({ people: ['user_a', 'user_a', 'user_b'] })).toEqual({
      people: ['user_a', 'user_b'],
    });
  });
  it.each([
    {},
    { people: [] },
    { people: ['bad id'] },
    { people: Array.from({ length: ITEM_CALL_INVITES_MAX + 1 }, (_, i) => `user_${i}`) },
    null,
  ])('refuses %j', (raw) => {
    expect(readCallInviteAsk(raw)).toBeNull();
  });
});

describe('words and tab names', () => {
  it('names the tabs by item', () => {
    expect(itemCallTabName('d1')).toBe('lw-call-d1');
    expect(itemTabName('d1')).toBe('lw-item-d1');
  });
  it('words the pill and its card', () => {
    expect(inCallWords(3)).toBe('3 in Call');
    expect(callInProgressWords({ people: 1, names: [] })).toBe('Call in progress, 1 person');
    expect(callInProgressWords({ people: 1, names: ['Ada'] })).toBe(
      'Call in progress, 1 person: Ada',
    );
    expect(callInProgressWords({ people: 3, names: ['Ada', 'Ben', 'Cy'] })).toBe(
      'Call in progress, 3 people: Ada, Ben and Cy',
    );
    const ten = Array.from({ length: 10 }, (_, i) => `P${i}`);
    expect(callInProgressWords({ people: 10, names: ten })).toBe(
      'Call in progress, 10 people: P0, P1, P2, P3, P4, P5, P6, P7 and 2 more',
    );
  });
});

describe("a call's source change", () => {
  it("is livehuddle's `calls` alone", () => {
    expect(
      readSourceChange({ app: 'livehuddle', itemId: 's1', sheetIds: [], calls: true }),
    ).toEqual({ app: 'livehuddle', itemId: 's1', sheetIds: [], calls: true });
    expect(readSourceChange({ app: 'livehuddle', itemId: 's1', sheetIds: ['a'] })).toBeNull();
    expect(readSourceChange({ app: 'livehuddle', itemId: 'a b', calls: true })).toBeNull();
    expect(readSourceChange(null)).toBeNull();
  });
});

describe('your Calls Space', () => {
  it('reads a start’s body: none, null or an id; anything else is malformed', () => {
    expect(readItemCallAsk(undefined)).toEqual({});
    expect(readItemCallAsk(null)).toEqual({});
    expect(readItemCallAsk({})).toEqual({});
    expect(readItemCallAsk({ space: null })).toEqual({});
    expect(readItemCallAsk({ space: 'lh_room' })).toEqual({ space: 'lh_room' });
    expect(readItemCallAsk({ space: 7 })).toBeNull();
    expect(readItemCallAsk({ space: 'a b' })).toBeNull();
    expect(readItemCallAsk({ space: 'x'.repeat(129) })).toBeNull();
    expect(readItemCallAsk([])).toBeNull();
  });

  it('reads the setting from preferences, Default for anything but an id', () => {
    expect(readCallSpaceSetting(null)).toBeNull();
    expect(readCallSpaceSetting({})).toBeNull();
    expect(readCallSpaceSetting({ [CALL_SPACE_SETTING]: null })).toBeNull();
    expect(readCallSpaceSetting({ [CALL_SPACE_SETTING]: true })).toBeNull();
    expect(readCallSpaceSetting({ callSpace: 'lh_room' })).toBe('lh_room');
  });

  it('says why a start skipped it', () => {
    expect(callFallbackWords('busy')).toMatch(/in another call/);
    expect(callFallbackWords('unavailable')).toMatch(/Settings › Calls/);
  });
});
