import { describe, expect, it } from 'vitest';
import { REACTIONS } from '@livepages/document';
import { AVATAR_REACTIONS } from './avatar-reactions';
import { AVATAR_BEHAVIOUR_KEYS, AVATAR_BURST_KEYS, avatarActionForKey } from './avatar-action-keys';
import { VIEW_TOOL_KEYS } from '@/hooks/canvas/editor-shortcut-keys';

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

  it('leaves the ways out of the mode alone: V, H, K, I and Z', () => {
    for (const key of ['v', 'h', 'k', 'i', 'z']) {
      expect(VIEW_TOOL_KEYS[key]).toBeDefined();
      expect(press(key)).toBeNull();
    }
  });
});
