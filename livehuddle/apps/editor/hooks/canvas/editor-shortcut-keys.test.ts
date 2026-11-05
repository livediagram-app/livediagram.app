import { describe, expect, it } from 'vitest';
import * as keys from './editor-shortcut-keys';

// docs/specs/013-workspace/share-roles.md "A Participant walks": a Participant has no add keys of its own any more.
describe('the key maps', () => {
  it('hold no Participant map', () => {
    expect(Object.keys(keys)).not.toContain('PARTICIPANT_KEYS');
  });

  it('keep 8 as Text for an Editor', () => {
    const calls: string[] = [];
    keys.EDIT_KEYS['8']!({ addText: () => calls.push('text') } as never);
    expect(calls).toEqual(['text']);
  });
});
