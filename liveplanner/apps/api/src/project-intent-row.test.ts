import { describe, expect, it } from 'vitest';
import { readRecordedIntent } from './project-intent-row';

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
    expect(readRecordedIntent(row('plan', 'diagram', 'retrospective'))).toEqual({
      opensIn: 'plan',
      tabKind: 'diagram',
      templateFamily: 'retrospective',
    });
  });

  it('reads a known record with no family', () => {
    expect(readRecordedIntent(row('plan', 'diagram', null))).toEqual({
      opensIn: 'plan',
      tabKind: 'diagram',
      templateFamily: null,
    });
  });

  it.each(['diagram', 'draw', 'workshop', 'pages', 'illustrate', 'infographic', 'facilitate'])(
    'reads a row opening in the retired %s as Plan',
    (retired) => {
      expect(readRecordedIntent(row(retired, 'diagram', 'kanban'))).toEqual({
        opensIn: 'plan',
        tabKind: 'diagram',
        templateFamily: 'kanban',
      });
    },
  );

  it('reads a retired event-storming kind as unknown', () => {
    expect(readRecordedIntent(row('plan', 'event-storming', null)).tabKind).toBeNull();
  });

  it.each([
    ['no record', row(null, null, null)],
    ['an unknown opens-in with stray values', row(null, 'diagram', 'kanban')],
    ['an unknown mode', row('pixel', 'diagram', 'kanban')],
  ])('reads %s as unknown throughout', (_label, stored) => {
    expect(readRecordedIntent(stored)).toEqual({
      opensIn: null,
      tabKind: null,
      templateFamily: null,
    });
  });

  it('reads a retired tab kind or family as null', () => {
    expect(readRecordedIntent(row('plan', 'whiteboard', 'mindmap'))).toEqual({
      opensIn: 'plan',
      tabKind: null,
      templateFamily: null,
    });
  });
});
