import { describe, expect, it, vi } from 'vitest';
import { createUseRoleIndicator, resolveOwnerTeam } from './useRoleIndicator';

describe('createUseRoleIndicator', () => {
  it('shows the role in force, the owner it discloses, and the toggle only when allowed', () => {
    const toggleViewPreview = vi.fn();
    let ctx = { isOwner: true, can: { level: 'edit' }, canToggleRole: true, toggleViewPreview };
    const useRoleIndicator = createUseRoleIndicator({
      useEditorContext: () => ctx,
      resolveOwnerBadge: (c) => (c.isOwner ? { name: 'Olive' } : null),
    });
    expect(useRoleIndicator()).toEqual({
      role: 'edit',
      ownerName: 'Olive',
      isSelf: true,
      team: null,
      onToggle: toggleViewPreview,
    });
    ctx = { isOwner: false, can: { level: 'view' }, canToggleRole: false, toggleViewPreview };
    expect(useRoleIndicator()).toEqual({
      role: 'view',
      ownerName: null,
      isSelf: false,
      team: null,
      onToggle: undefined,
    });
  });

  it('names the owning team where the editor resolves one, leaving isSelf and the toggle alone', () => {
    const toggleViewPreview = vi.fn();
    const ctx = { isOwner: true, can: { level: 'edit' }, canToggleRole: true, toggleViewPreview };
    const useRoleIndicator = createUseRoleIndicator({
      useEditorContext: () => ctx,
      resolveOwnerBadge: () => ({ name: 'Olive' }),
      resolveOwnerTeam: () => ({ name: 'Design' }),
    });
    expect(useRoleIndicator()).toEqual({
      role: 'edit',
      ownerName: 'Olive',
      isSelf: true,
      team: { name: 'Design' },
      onToggle: toggleViewPreview,
    });
  });
});

// A team canvas names its team (Work Tracker 1035).
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
