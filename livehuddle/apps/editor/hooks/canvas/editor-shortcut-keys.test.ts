import { describe, expect, it } from 'vitest';
import * as keys from './editor-shortcut-keys';

// docs/specs/013-workspace/share-roles.md "A Participant walks": a Participant has no add keys of its own any more.
describe('the key maps', () => {
  it('hold no Participant map', () => {
    expect(Object.keys(keys)).not.toContain('PARTICIPANT_KEYS');
  });

  // not-in-livehuddle.md "The Write category": T, 8 and N went with it.
  it('add no text or note from a key', () => {
    for (const k of ['t', '8', 'n']) expect(keys.EDIT_KEYS[k], k).toBeUndefined();
  });
});

// A covered board's keys. The bracket chords were Bring to Front and Send to Back, which left livehuddle
// (not-in-livehuddle.md "Element looks, layers, opacity and rotation"): they are the browser's again.
describe('coveredKeyRole', () => {
  const press = (key: string, code = '') => ({
    key,
    code,
    metaKey: false,
    ctrlKey: true,
    shiftKey: true,
    altKey: false,
  });
  it('leaves Ctrl+Shift+bracket and an empty key to the browser', () => {
    expect(keys.coveredKeyRole(press('{'))).toBe('ignore');
    expect(keys.coveredKeyRole(press('?', 'BracketRight'))).toBe('ignore');
    expect(keys.coveredKeyRole(press(''))).toBe('ignore');
  });
});
