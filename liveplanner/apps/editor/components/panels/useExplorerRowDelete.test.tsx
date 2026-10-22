// @vitest-environment jsdom

// The Explorer's row delete (docs/specs/013-workspace/folders.md, trash.md "Deleting"): asked nothing, a deleted row
// slides out and its id is dropped once the list no longer has it; a team row hides at once, is forgotten once the
// library sweep drops it, and comes back on Undo.

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectListItem } from '@/lib/api-client';
import type { TeamProjectRow } from '@/hooks/persistence/useTeamLibrariesSweep';
import { useExplorerRowDelete } from './useExplorerRowDelete';

const row = (id: string) => ({ id, name: id }) as ProjectListItem;
const teamRow = (id: string): TeamProjectRow => ({
  ...row(id),
  team: { id: 'team', name: 'Team' },
});

type Lists = { projects: ProjectListItem[]; teamProjects: TeamProjectRow[] };

function hook(initial: Lists) {
  // The parent's delete: animate out first, then (in the real app) drop the row from the list.
  const onDeleteProject = vi.fn(
    (
      _id: string,
      beforeRemove?: () => void | Promise<void>,
      _opts?: { onRestored?: () => void },
    ) => {
      void beforeRemove?.();
    },
  );
  const view = renderHook((lists: Lists) => useExplorerRowDelete({ ...lists, onDeleteProject }), {
    initialProps: initial,
  });
  return { ...view, onDeleteProject };
}

const deleteRow = (result: { current: ReturnType<typeof useExplorerRowDelete> }, id: string) =>
  act(() => result.current.deleteRow?.(id));

describe('useExplorerRowDelete', () => {
  it('keeps a personal row sliding out until the list drops it', async () => {
    const a = row('a');
    const b = row('b');
    const { result, rerender } = hook({ projects: [a, b], teamProjects: [] });
    deleteRow(result, 'a');
    expect(result.current.exitingProjectIds.has('a')).toBe(true);
    rerender({ projects: [a, b], teamProjects: [] });
    expect(result.current.exitingProjectIds.has('a')).toBe(true);
    rerender({ projects: [b], teamProjects: [] });
    expect(result.current.exitingProjectIds.has('a')).toBe(false);
  });

  it('hides a team row until the sweep drops it', async () => {
    const t = teamRow('t');
    const { result, rerender } = hook({ projects: [], teamProjects: [t] });
    deleteRow(result, 't');
    expect(result.current.deletedTeamIds.has('t')).toBe(true);
    rerender({ projects: [], teamProjects: [t] });
    expect(result.current.deletedTeamIds.has('t')).toBe(true);
    rerender({ projects: [], teamProjects: [] });
    expect(result.current.deletedTeamIds.has('t')).toBe(false);
  });

  it('brings a hidden team row back on Undo', () => {
    const t = teamRow('t');
    const { result, onDeleteProject } = hook({ projects: [], teamProjects: [t] });
    deleteRow(result, 't');
    expect(result.current.deletedTeamIds.has('t')).toBe(true);
    act(() => onDeleteProject.mock.calls[0]![2]!.onRestored!());
    expect(result.current.deletedTeamIds.has('t')).toBe(false);
  });
});
