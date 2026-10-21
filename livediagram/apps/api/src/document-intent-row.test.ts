import { describe, expect, it } from 'vitest';
import { readRecordedIntent } from './document-intent-row';

// The recorded creation intent as stored text (docs/specs/013-workspace/default-folders.md "Recorded
// intent"): each value reads as itself only when it is in its list; a null or unreadable opens-in is
// unknown, and then so is everything else.

const row = (opens_in: string | null, tab_kind: string | null, template_family: string | null) => ({
  opens_in,
  tab_kind,
  template_family,
});

describe('readRecordedIntent', () => {
  it('reads a full record', () => {
    expect(readRecordedIntent(row('diagram', 'diagram', 'retrospective'))).toEqual({
      opensIn: 'diagram',
      tabKind: 'diagram',
      templateFamily: 'retrospective',
    });
  });

  it('reads a known record with no family', () => {
    expect(readRecordedIntent(row('draw', 'diagram', null))).toEqual({
      opensIn: 'draw',
      tabKind: 'diagram',
      templateFamily: null,
    });
  });

  it('reads an event-storming board', () => {
    expect(readRecordedIntent(row('diagram', 'event-storming', null)).tabKind).toBe(
      'event-storming',
    );
  });

  it.each([
    ['no record', row(null, null, null)],
    ['an unknown opens-in with stray values', row(null, 'diagram', 'kanban')],
    ['a retired mode', row('pixel', 'diagram', 'kanban')],
  ])('reads %s as unknown throughout', (_label, stored) => {
    expect(readRecordedIntent(stored)).toEqual({
      opensIn: null,
      tabKind: null,
      templateFamily: null,
    });
  });

  it('reads a retired tab kind or family as null', () => {
    expect(readRecordedIntent(row('draw', 'whiteboard', 'mindmap'))).toEqual({
      opensIn: 'draw',
      tabKind: null,
      templateFamily: null,
    });
  });
});
