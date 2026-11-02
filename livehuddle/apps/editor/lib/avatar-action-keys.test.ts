import { describe, expect, it } from 'vitest';
import { avatarActionForKey } from '@liveworkspace/avatar/action-keys';
import { VIEW_TOOL_KEYS } from '@/hooks/canvas/editor-shortcut-keys';

// docs/specs/008-canvas/avatar-mode.md "Keyboard actions": the key map is @liveworkspace/avatar's (its own
// tests); this editor's view-tool keys are its own, so the check that the two never collide is here.
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
  it('leaves the ways out of the mode alone: V, H, K, I and Z', () => {
    for (const key of ['v', 'h', 'k', 'i', 'z']) {
      expect(VIEW_TOOL_KEYS[key]).toBeDefined();
      expect(press(key)).toBeNull();
    }
  });
});
