import { describe, expect, it } from 'vitest';
import { TEMPLATES, boardTypeOfTemplate } from '@livediagram/templates';

// The board type a template makes (docs/specs/013-workspace/default-folders.md "Creation intent"):
// the one map that routes a new retrospective or Kanban board to its default folder.

describe('boardTypeOfTemplate', () => {
  it.each(['retrospective', 'start-stop-continue', 'mad-sad-glad', 'four-ls', 'sailboat'] as const)(
    'reads the %s retro format as a retrospective',
    (kind) => {
      expect(boardTypeOfTemplate(kind)).toBe('retrospective');
    },
  );

  it('reads the Kanban template as a Kanban board', () => {
    expect(boardTypeOfTemplate('kanban')).toBe('kanban');
  });

  it('reads the event-storming template as an event-storming board', () => {
    expect(boardTypeOfTemplate('event-storming')).toBe('event-storming');
  });

  it('reads no template as no board', () => {
    expect(boardTypeOfTemplate(null)).toBeNull();
  });

  it('reads every other template as no board', () => {
    const boards = TEMPLATES.filter((t) => boardTypeOfTemplate(t.kind) !== null).map((t) => t.kind);
    expect(boards.sort()).toEqual(
      [
        'event-storming',
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
