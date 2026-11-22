import { describe, expect, it } from 'vitest';
import { agentPageIconOf } from './icon';

describe('agentPageIconOf', () => {
  it('names an emoji or a catalogue icon by its kind', () => {
    expect(agentPageIconOf({ emoji: '🚀' })).toEqual({ kind: 'emoji', emoji: '🚀' });
    expect(agentPageIconOf({ iconId: 'rocket' })).toEqual({ kind: 'icon', iconId: 'rocket' });
  });

  it('answers nothing for none, or for an icon that is not one', () => {
    expect(agentPageIconOf(undefined)).toBeUndefined();
    expect(agentPageIconOf({ emoji: 'words' })).toBeUndefined();
  });
});
