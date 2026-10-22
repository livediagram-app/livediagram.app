// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { untitledNameForPlanStart, usePlanStartProjectName } from './usePlanStartProjectName';

// docs/specs/007-editor/templates-by-mode.md "The project's name": a Plan start on the first tab names a project
// still on a default name after the title its tab takes.

type Props = {
  firstTab: Pick<Tab, 'id' | 'kind' | 'name'> | undefined;
  firstTabLoaded: boolean;
  projectName: string;
  canEdit: boolean;
};

const blank = { id: 't1', name: 'Tab 1' };
const board = { id: 't1', kind: 'board', name: 'Bug Tracker' } as const;

function setup(initial: Partial<Props> = {}) {
  const nameProject = vi.fn();
  const initialProps: Props = {
    firstTab: blank,
    firstTabLoaded: true,
    projectName: 'Untitled Plan',
    canEdit: true,
    ...initial,
  };
  const hook = renderHook((p: Props) => usePlanStartProjectName({ ...p, nameProject }), {
    initialProps,
  });
  return { nameProject, ...hook };
}

// Lets the lazily imported naming rule answer (loaded once, up front, so a wait never races its first import).
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
beforeAll(async () => {
  await import('@/lib/template-builders');
}, 30_000);

describe('usePlanStartProjectName', () => {
  it('names a still-untitled project after the board its first tab became', async () => {
    const { nameProject, rerender } = setup();
    rerender({
      firstTab: board,
      firstTabLoaded: true,
      projectName: 'Untitled Plan',
      canEdit: true,
    });
    await waitFor(() => expect(nameProject).toHaveBeenCalledWith('Untitled Bug Tracker'), {
      timeout: 15_000,
    });
  });

  it('keeps a name someone gave the project', async () => {
    const { nameProject, rerender } = setup({ projectName: 'Q4 launch' });
    rerender({ firstTab: board, firstTabLoaded: true, projectName: 'Q4 launch', canEdit: true });
    await settle();
    expect(nameProject).not.toHaveBeenCalled();
  });

  it('leaves a name the start gave itself (a template)', async () => {
    const { nameProject, rerender } = setup();
    rerender({
      firstTab: { id: 't1', kind: 'board', name: 'Kanban' },
      firstTabLoaded: true,
      projectName: 'Untitled Kanban Board',
      canEdit: true,
    });
    await settle();
    expect(nameProject).not.toHaveBeenCalled();
  });

  it('does nothing when a project opens on a Plan tab, or its first tab’s content arrives', async () => {
    const opened = setup({ firstTab: board });
    opened.rerender({
      firstTab: board,
      firstTabLoaded: true,
      projectName: 'Untitled Plan',
      canEdit: true,
    });
    const arriving = setup({ firstTabLoaded: false });
    arriving.rerender({
      firstTab: board,
      firstTabLoaded: true,
      projectName: 'Untitled Plan',
      canEdit: true,
    });
    await settle();
    expect(opened.nameProject).not.toHaveBeenCalled();
    expect(arriving.nameProject).not.toHaveBeenCalled();
  });

  it('does nothing for someone who cannot edit, or for a tab that kept a default name', async () => {
    const viewer = setup({ canEdit: false });
    viewer.rerender({
      firstTab: board,
      firstTabLoaded: true,
      projectName: 'Untitled Plan',
      canEdit: false,
    });
    const unnamed = setup();
    unnamed.rerender({
      firstTab: { id: 't1', kind: 'sheet', name: 'Tab 1' },
      firstTabLoaded: true,
      projectName: 'Untitled Plan',
      canEdit: true,
    });
    await settle();
    expect(viewer.nameProject).not.toHaveBeenCalled();
    expect(unnamed.nameProject).not.toHaveBeenCalled();
  });

  it('names after the tab’s title, trimmed', () => {
    expect(untitledNameForPlanStart(' Gantt Chart ')).toBe('Untitled Gantt Chart');
  });
});
