import { describe, expect, it } from 'vitest';
import { REACTIONS } from '@liveworkspace/model-core/reaction-bursts';
import { AVATAR_REACTIONS } from './reactions';
import { AVATAR_BEHAVIOUR_KEYS, AVATAR_BURST_KEYS, avatarActionForKey } from './action-keys';

// docs/specs/008-canvas/avatar-mode.md "Keyboard actions".
const press = (
  key: string,
  mods: Partial<Record<'meta' | 'ctrl' | 'alt' | 'shift', boolean>> = {},
) =>
  avatarActionForKey({
    key,
    metaKey: !!mods.meta,
    ctrlKey: !!mods.ctrl,
    altKey: !!mods.alt,
    shiftKey: !!mods.shift,
  });

describe('avatarActionForKey', () => {
  it('plays each Behaviour on its initial', () => {
    expect(press('j')).toEqual({ type: 'behaviour', kind: 'jumping-jacks' });
    expect(press('w')).toEqual({ type: 'behaviour', kind: 'wave' });
    expect(press('s')).toEqual({ type: 'behaviour', kind: 'spin' });
    expect(press('c')).toEqual({ type: 'behaviour', kind: 'cheer' });
    expect(press('d')).toEqual({ type: 'behaviour', kind: 'dance' });
    expect(press('h')).toEqual({ type: 'behaviour', kind: 'raise-hand' });
    expect(press('t')).toEqual({ type: 'behaviour', kind: 'thumbs-up' });
    expect(press('p')).toEqual({ type: 'behaviour', kind: 'point' });
  });

  it("plays Clap on K, since C is Cheer's", () => {
    expect(press('k')).toEqual({ type: 'behaviour', kind: 'clap' });
  });

  it('gives every Behaviour its own letter, never E or V (the ways out) or a digit', () => {
    const keys = Object.values(AVATAR_BEHAVIOUR_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((k) => /^[EV0-9]$/.test(k))).toEqual([]);
    expect(Object.keys(AVATAR_BEHAVIOUR_KEYS).sort()).toEqual(
      AVATAR_REACTIONS.map((r) => r.id).sort(),
    );
  });

  it('throws each Reaction on its place in the panel, 1 to 5', () => {
    expect(REACTIONS.map((r) => press(AVATAR_BURST_KEYS[r]))).toEqual(
      REACTIONS.map((reaction) => ({ type: 'burst', reaction })),
    );
    expect(press('1')).toEqual({ type: 'burst', reaction: 'confetti' });
    expect(press('6')).toBeNull();
  });

  it('gives every Behaviour its own key', () => {
    const keys = AVATAR_REACTIONS.map((r) => AVATAR_BEHAVIOUR_KEYS[r.id]);
    expect(new Set(keys).size).toBe(AVATAR_REACTIONS.length);
  });

  it('asks nothing of a modified key, an autorepeat or an unbound key', () => {
    expect(press('d', { shift: true })).toBeNull();
    expect(press('c', { meta: true })).toBeNull();
    expect(press('c', { ctrl: true })).toBeNull();
    expect(press('s', { alt: true })).toBeNull();
    expect(
      avatarActionForKey({
        key: 'w',
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        repeat: true,
      }),
    ).toBeNull();
    expect(press('x')).toBeNull();
  });
});
