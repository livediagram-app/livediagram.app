// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/document';
import { untitledNameForPlanStart, usePlanStartDocumentName } from './usePlanStartDocumentName';

// docs/specs/007-editor/templates-by-mode.md "The document's name": a Plan start on the first tab names a document
// still on a default name after the title its tab takes.

type Props = {
  firstTab: Pick<Tab, 'id' | 'kind' | 'name'> | undefined;
  firstTabLoaded: boolean;
  documentName: string;
  canEdit: boolean;
};

const blank = { id: 't1', name: 'Tab 1' };
const board = { id: 't1', kind: 'board', name: 'Bug Tracker' } as const;

function setup(initial: Partial<Props> = {}) {
  const nameDocument = vi.fn();
  const initialProps: Props = {
    firstTab: blank,
    firstTabLoaded: true,
    documentName: 'Untitled Plan',
    canEdit: true,
    ...initial,
  };
  const hook = renderHook((p: Props) => usePlanStartDocumentName({ ...p, nameDocument }), {
    initialProps,
  });
  return { nameDocument, ...hook };
}

// Lets the lazily imported naming rule answer (loaded once, up front, so a wait never races its first import).
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
beforeAll(async () => {
  await import('@/lib/template-builders');
}, 30_000);

describe('usePlanStartDocumentName', () => {
  it('names a still-untitled document after the board its first tab became', async () => {
    const { nameDocument, rerender } = setup();
    rerender({
      firstTab: board,
      firstTabLoaded: true,
      documentName: 'Untitled Plan',
      canEdit: true,
    });
    await waitFor(() => expect(nameDocument).toHaveBeenCalledWith('Untitled Bug Tracker'), {
      timeout: 15_000,
    });
  });

  it('keeps a name someone gave the document', async () => {
    const { nameDocument, rerender } = setup({ documentName: 'Q4 launch' });
    rerender({ firstTab: board, firstTabLoaded: true, documentName: 'Q4 launch', canEdit: true });
    await settle();
    expect(nameDocument).not.toHaveBeenCalled();
  });

  it('leaves a name the start gave itself (a template)', async () => {
    const { nameDocument, rerender } = setup();
    rerender({
      firstTab: { id: 't1', kind: 'board', name: 'Kanban' },
      firstTabLoaded: true,
      documentName: 'Untitled Kanban Board',
      canEdit: true,
    });
    await settle();
    expect(nameDocument).not.toHaveBeenCalled();
  });

  it('does nothing when a document opens on a Plan tab, or its first tab’s content arrives', async () => {
    const opened = setup({ firstTab: board });
    opened.rerender({
      firstTab: board,
      firstTabLoaded: true,
      documentName: 'Untitled Plan',
      canEdit: true,
    });
    const arriving = setup({ firstTabLoaded: false });
    arriving.rerender({
      firstTab: board,
      firstTabLoaded: true,
      documentName: 'Untitled Plan',
      canEdit: true,
    });
    await settle();
    expect(opened.nameDocument).not.toHaveBeenCalled();
    expect(arriving.nameDocument).not.toHaveBeenCalled();
  });

  it('does nothing for someone who cannot edit, or for a tab that kept a default name', async () => {
    const viewer = setup({ canEdit: false });
    viewer.rerender({
      firstTab: board,
      firstTabLoaded: true,
      documentName: 'Untitled Plan',
      canEdit: false,
    });
    const unnamed = setup();
    unnamed.rerender({
      firstTab: { id: 't1', kind: 'sheet', name: 'Tab 1' },
      firstTabLoaded: true,
      documentName: 'Untitled Plan',
      canEdit: true,
    });
    await settle();
    expect(viewer.nameDocument).not.toHaveBeenCalled();
    expect(unnamed.nameDocument).not.toHaveBeenCalled();
  });

  it('names after the tab’s title, trimmed', () => {
    expect(untitledNameForPlanStart(' Gantt Chart ')).toBe('Untitled Gantt Chart');
  });
});
