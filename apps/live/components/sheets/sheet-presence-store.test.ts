// Presence on sheets (docs/specs/029-sheets/sheet.md "Collaboration"): peers' selections heard from the room, this
// person's own said at most every PRESENCE_THROTTLE_MS (the last always sent), silence until something is
// selected, and the last selection said again to a late joiner.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SheetPresenceOp } from '@livediagram/api-schema';
import { PRESENCE_THROTTLE_MS, SheetPresence, sheetPresenceFor } from './sheet-presence-store';
import type { SheetStore } from './sheet-store-client';

const range = (r: string) => ({ r1: r, c1: 'c1', r2: r, c2: 'c1' });
const op = (
  sheetId: string,
  ranges: SheetPresenceOp['ranges'],
  editing = false,
): SheetPresenceOp => ({ kind: 'sheet-presence', tabId: 't1', sheetId, ranges, editing });

describe('hearing peers', () => {
  it('keeps each peer selection by sheet, and clears a peer with nothing selected', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1234);
    const p = new SheetPresence();
    const heard = vi.fn();
    const off = p.subscribe(heard);
    p.receive('ann', op('sheetA', [range('r1')], true));
    p.receive('bob', op('sheetB', [range('r2')]));
    expect(p.on('sheetA')).toEqual([
      ['ann', { tabId: 't1', sheetId: 'sheetA', ranges: [range('r1')], editing: true, at: 1234 }],
    ]);
    expect(p.on('sheetB').map(([id]) => id)).toEqual(['bob']);
    p.receive('ann', op('sheetA', null));
    p.receive('bob', op('sheetB', []));
    expect(p.on('sheetA')).toEqual([]);
    expect(p.on('sheetB')).toEqual([]);
    expect(heard).toHaveBeenCalledTimes(4);
    expect(p.getVersion()).toBe(4);
    off();
    p.receive('ann', op('sheetA', [range('r1')]));
    expect(heard).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });
});

describe('saying this person selection', () => {
  let p: SheetPresence;
  let sent: SheetPresenceOp[];
  beforeEach(() => {
    vi.useFakeTimers();
    p = new SheetPresence();
    sent = [];
    p.connect((o) => sent.push(o));
  });
  afterEach(() => vi.useRealTimers());

  it('stays silent with nothing selected and nothing said yet', () => {
    p.say(op('sheetA', null));
    vi.advanceTimersByTime(PRESENCE_THROTTLE_MS * 2);
    expect(sent).toEqual([]);
  });

  it('says the first at once, then the latest at most every throttle', () => {
    p.say(op('sheetA', [range('r1')]));
    expect(sent).toHaveLength(1);
    p.say(op('sheetA', [range('r2')]));
    p.say(op('sheetA', [range('r3')]));
    expect(sent).toHaveLength(1);
    vi.advanceTimersByTime(PRESENCE_THROTTLE_MS - 1);
    expect(sent).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sent.map((o) => o.ranges![0]!.r1)).toEqual(['r1', 'r3']);
    // The window passed with nothing new pending: the next is said at once.
    vi.advanceTimersByTime(PRESENCE_THROTTLE_MS);
    p.say(op('sheetA', [range('r4')]));
    expect(sent).toHaveLength(3);
  });

  it('does not repeat the same selection', () => {
    p.say(op('sheetA', [range('r1')]));
    vi.advanceTimersByTime(PRESENCE_THROTTLE_MS);
    p.say(op('sheetA', [range('r1')]));
    vi.advanceTimersByTime(PRESENCE_THROTTLE_MS);
    expect(sent).toHaveLength(1);
    // Editing the same cell is news.
    p.say(op('sheetA', [range('r1')], true));
    expect(sent).toHaveLength(2);
  });

  it('says a cleared selection once something was said, then goes quiet again', () => {
    p.say(op('sheetA', [range('r1')]));
    vi.advanceTimersByTime(PRESENCE_THROTTLE_MS);
    p.say(op('sheetA', null));
    expect(sent.map((o) => o.ranges)).toEqual([[range('r1')], null]);
    p.reannounce();
    expect(sent).toHaveLength(2);
  });

  it('says the last selection again on reannounce', () => {
    p.reannounce();
    expect(sent).toEqual([]);
    p.say(op('sheetA', [range('r1')]));
    p.reannounce();
    expect(sent.map((o) => o.ranges![0]!.r1)).toEqual(['r1', 'r1']);
  });

  it('sends nothing before it is connected', () => {
    const q = new SheetPresence();
    q.say(op('sheetA', [range('r1')]));
    q.reannounce();
    vi.advanceTimersByTime(PRESENCE_THROTTLE_MS);
    const out: SheetPresenceOp[] = [];
    q.connect((o) => out.push(o));
    q.reannounce();
    expect(out).toEqual([]);
  });
});

describe('sheetPresenceFor', () => {
  it('keeps one presence per store', () => {
    const a = {} as SheetStore;
    const b = {} as SheetStore;
    expect(sheetPresenceFor(a)).toBe(sheetPresenceFor(a));
    expect(sheetPresenceFor(a)).not.toBe(sheetPresenceFor(b));
  });
});
