import { describe, expect, it } from 'vitest';
import { TEMPLATES, templateFamilyOf } from '@livediagram/templates';

// The template family a template belongs to (docs/specs/013-workspace/default-folders.md "Creation
// intent"): the one map that routes a new retrospective or Kanban board to its default folder.

describe('templateFamilyOf', () => {
  it.each(['retrospective', 'start-stop-continue', 'mad-sad-glad', 'four-ls', 'sailboat'] as const)(
    'reads the %s retro format as a retrospective',
    (kind) => {
      expect(templateFamilyOf(kind)).toBe('retrospective');
    },
  );

  it('reads the Kanban template as a Kanban board', () => {
    expect(templateFamilyOf('kanban')).toBe('kanban');
  });

  it.each(['event-storming', 'incident-postmortem', 'lean-coffee'] as const)(
    'reads %s as no family',
    (kind) => {
      expect(templateFamilyOf(kind)).toBeNull();
    },
  );

  it('reads no template as no family', () => {
    expect(templateFamilyOf(null)).toBeNull();
  });

  it('gives a family to the retro formats and Kanban only', () => {
    const members = TEMPLATES.filter((t) => templateFamilyOf(t.kind) !== null).map((t) => t.kind);
    expect(members.sort()).toEqual(
      [
        'four-ls',
        'kanban',
        'mad-sad-glad',
        'retrospective',
        'sailboat',
        'start-stop-continue',
      ].sort(),
    );
  });
});
