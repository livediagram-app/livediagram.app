import { describe, expect, it } from 'vitest';
import { readRecordedIntent } from './document-intent-row';

// The recorded creation intent as stored text (docs/specs/013-workspace/default-folders.md "Recorded
// intent"): each value reads as itself only when it is in its list; a null or unreadable opens-in is
// unknown, and then so is the tab kind.

const row = (opens_in: string | null, tab_kind: string | null) => ({ opens_in, tab_kind });

describe('readRecordedIntent', () => {
  it('reads a full record', () => {
    expect(readRecordedIntent(row('pages', 'diagram'))).toEqual({
      opensIn: 'pages',
      tabKind: 'diagram',
    });
  });

  it('reads a mode livediagram recorded as Pages', () => {
    expect(readRecordedIntent(row('draw', 'diagram')).opensIn).toBe('pages');
  });

  it.each([
    ['no record', row(null, null)],
    ['an unknown opens-in with a stray kind', row(null, 'diagram')],
    ['an unknown mode', row('pixel', 'diagram')],
  ])('reads %s as unknown throughout', (_label, stored) => {
    expect(readRecordedIntent(stored)).toEqual({ opensIn: null, tabKind: null });
  });

  it('reads a retired tab kind as null', () => {
    expect(readRecordedIntent(row('pages', 'whiteboard'))).toEqual({
      opensIn: 'pages',
      tabKind: null,
    });
  });
});
