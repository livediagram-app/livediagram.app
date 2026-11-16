import { describe, expect, it, vi } from 'vitest';
import { resolveOwnerTeam } from './useRoleIndicator';

vi.mock('./EditorContext', () => ({ useEditorContext: () => ({}) }));
vi.mock('@/lib/presence-rows', () => ({ resolveOwnerBadge: () => null }));

// docs/specs/007-editor/editor-app.md "Role pill": a team canvas names its team (Work Tracker 1035).
describe('resolveOwnerTeam', () => {
  const teams = [
    { id: 't1', name: 'Design' },
    { id: 't2', name: 'Platform' },
  ];

  it('is none on a personal document', () => {
    expect(resolveOwnerTeam({ documentTeamId: null, teams })).toBeNull();
  });

  it('names the team for a member, and none known for a visitor outside it', () => {
    expect(resolveOwnerTeam({ documentTeamId: 't2', teams })).toEqual({ name: 'Platform' });
    expect(resolveOwnerTeam({ documentTeamId: 't9', teams })).toEqual({ name: null });
    expect(resolveOwnerTeam({ documentTeamId: 't1', teams: [] })).toEqual({ name: null });
  });
});
