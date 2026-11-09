import { describe, expect, it } from 'vitest';
import { coveredKeyRole, EDIT_KEYS, PARTICIPANT_KEYS } from './editor-shortcut-keys';

// docs/specs/013-workspace/share-roles.md: a covered canvas swallows the z-order chords, by key or by code, and an
// empty key (a synthetic event, some IMEs) is no bracket: `'[]{}'.includes('')` was true and swallowed it.
describe('coveredKeyRole', () => {
  const chord = (key: string, code = '') => ({
    key,
    code,
    metaKey: true,
    ctrlKey: false,
    shiftKey: true,
    altKey: false,
  });
  it('swallows the z-order chords by key or code', () => {
    expect(coveredKeyRole(chord('}'))).toBe('swallow');
    expect(coveredKeyRole(chord('', 'BracketLeft'))).toBe('swallow');
  });
  it('leaves an empty key alone rather than reading it as a bracket', () => {
    expect(coveredKeyRole(chord(''))).toBe('ignore');
  });
});

// docs/specs/013-workspace/share-roles.md "The Participant palette": a Participant's add keys are its tiles' (N, T, 9)
// and 8, the number Text has for everyone; no other add key runs.
describe('PARTICIPANT_KEYS', () => {
  it('holds exactly the keys the spec names', () => {
    expect(Object.keys(PARTICIPANT_KEYS).sort()).toEqual(['8', '9', 'n', 't']);
  });

  it('gives 8 the same tool it is for an Editor (Text)', () => {
    const calls: string[] = [];
    const live = { addText: () => calls.push('text') } as never;
    PARTICIPANT_KEYS['8']!(live);
    EDIT_KEYS['8']!(live);
    expect(calls).toEqual(['text', 'text']);
  });
});
