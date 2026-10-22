import { describe, expect, it } from 'vitest';
import { TEMPLATES, templateFamilyOf } from '@liveplanner/templates';

// The template family a template belongs to (docs/specs/013-workspace/default-folders.md "Creation
// intent"): the one map that routes a new retrospective or Kanban board to its default folder.

describe('templateFamilyOf', () => {
  it('reads the Team Retro as a retrospective', () => {
    expect(templateFamilyOf('team-retro')).toBe('retrospective');
  });

  it('reads the Kanban template as a Kanban board', () => {
    expect(templateFamilyOf('kanban')).toBe('kanban');
  });

  it.each(['bug-triage', 'invoice'] as const)('reads %s as no family', (kind) => {
    expect(templateFamilyOf(kind)).toBeNull();
  });

  it('reads no template as no family', () => {
    expect(templateFamilyOf(null)).toBeNull();
  });

  it('gives a family to the retro and the Kanban boards only', () => {
    const members = TEMPLATES.filter((t) => templateFamilyOf(t.kind) !== null).map((t) => t.kind);
    // docs/specs/026-plan/plan-templates.md: the Project Planner runs its sprints on a Kanban board.
    expect(members.sort()).toEqual(['kanban', 'project-planner', 'team-retro']);
  });
});
