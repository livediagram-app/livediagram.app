// Who the mini view shows, and in what order (docs/specs/008-canvas/avatar-mode.md "The mini view"; blueprint:
// space-mini-view.md "The people").
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { peerAvatarConfig } from '@livehuddle/avatar/config';
import type { AvatarPresence } from '@livehuddle/api-schema';
import {
  keyedMiniPeople,
  MINI_SELF_ID,
  MINI_SELF_NAME,
  miniPeopleKey,
  miniViewPeople,
  type MiniPeopleInput,
} from './mini-view-people';

const config = peerAvatarConfig(undefined);
const self = { name: 'Me', color: '#0ea5e9', config, status: null };

function row(id: string, name: string, extra: Partial<AvatarPresence> = {}) {
  return {
    id,
    name,
    color: '#f43f5e',
    avatar: {
      x: 10,
      y: 20,
      facing: 'down',
      walking: false,
      stepFrame: 0,
      ...extra,
    } as AvatarPresence,
  };
}

const ids = (r: ReturnType<typeof miniViewPeople>) =>
  r.groups.map((g) => [g.id, g.people.map((p) => p.id)] as const);

describe('miniViewPeople', () => {
  it('puts you first, then everyone by name, in one group while nobody is heard', () => {
    const r = miniViewPeople({
      self,
      rows: [row('b', 'zoe'), row('c', 'amir'), row('a', 'Amir')],
      heard: new Set(),
    });
    expect(r.count).toBe(4);
    // Letters before case, then the id.
    expect(ids(r)).toEqual([['space', [MINI_SELF_ID, 'a', 'c', 'b']]]);
    const you = r.groups[0]!.people[0]!;
    expect(you).toMatchObject({ name: MINI_SELF_NAME, self: true, color: self.color });
  });

  it('leads with the people you hear under Near You, you among them', () => {
    const r = miniViewPeople({
      self,
      rows: [row('a', 'Ann'), row('b', 'Bea'), row('c', 'Cal')],
      heard: new Set(['c']),
    });
    expect(ids(r)).toEqual([
      ['near', [MINI_SELF_ID, 'c']],
      ['space', ['a', 'b']],
    ]);
  });

  it('leaves out an empty group when everyone is heard', () => {
    const r = miniViewPeople({ self, rows: [row('a', 'Ann')], heard: new Set(['a']) });
    expect(ids(r)).toEqual([['near', [MINI_SELF_ID, 'a']]]);
  });

  it('parses a peer status and costume, not trusting the wire', () => {
    const r = miniViewPeople({
      self,
      rows: [row('a', 'Ann', { status: 'focus' }), row('b', 'Bo', { status: 'nonsense' as never })],
      heard: new Set(),
    });
    const [, ann, bo] = r.groups[0]!.people;
    expect(ann!.status).toBe('focus');
    expect(bo!.status).toBeNull();
    expect(ann!.config).toBe(config);
  });
});

describe('miniPeopleKey', () => {
  const base: MiniPeopleInput = { self, rows: [row('a', 'Ann')], heard: new Set() };

  it('stays the same when someone only moves', () => {
    const moved = { ...base, rows: [row('a', 'Ann', { x: 400, y: 900, walking: true })] };
    expect(miniPeopleKey(moved)).toBe(miniPeopleKey(base));
  });

  it('changes with a name, a status, a heard id, or your own look', () => {
    const k = miniPeopleKey(base);
    expect(miniPeopleKey({ ...base, rows: [row('a', 'Anna')] })).not.toBe(k);
    expect(miniPeopleKey({ ...base, rows: [row('a', 'Ann', { status: 'away' })] })).not.toBe(k);
    expect(miniPeopleKey({ ...base, heard: new Set(['a']) })).not.toBe(k);
    expect(miniPeopleKey({ ...base, self: { ...self, status: 'dnd' } })).not.toBe(k);
  });

  it('keyedMiniPeople hands back the same result until a fact changes', () => {
    const of = keyedMiniPeople();
    const first = of(base);
    expect(of({ ...base, rows: [row('a', 'Ann', { x: 99 })] })).toBe(first);
    expect(of({ ...base, rows: [row('a', 'Anna')] })).not.toBe(first);
  });

  // Performance and limits: the key runs per coarse change (10 a second while someone walks) over a full room.
  it('keys a room of 200 people a thousand times within budget', () => {
    const rows = Array.from({ length: 200 }, (_, i) =>
      row(`p${i}`, `Person ${i}`, { status: 'focus' }),
    );
    const input = { self, rows, heard: new Set(rows.slice(0, 20).map((r) => r.id)) };
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 1000; i++) miniPeopleKey(input);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(400));
  });
});
