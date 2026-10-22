// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectListItem } from '@/lib/api-client';
import { setProjectVisibility } from '@/hooks/editor/project-visibility-store';
import { ExplorerCurrentProject } from './ExplorerCurrentProject';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/components/panels/ProjectThumbnail', () => ({
  ProjectThumbnail: () => <span data-thumb="" />,
}));

// docs/specs/013-workspace/explorer-structure.md "Layout": the Current Project card.
const doc = {
  id: 'd1',
  name: 'Roadmap',
  ownerId: 'me',
  folderId: null,
  savedAt: Date.now(),
  source: null,
  empty: false,
} as unknown as ProjectListItem;

afterEach(() => {
  act(() => setProjectVisibility(null));
  cleanup();
});

describe('ExplorerCurrentProject', () => {
  it('renames on a click of the name: Enter saves, Escape keeps it', () => {
    const onRename = vi.fn();
    render(
      <ExplorerCurrentProject item={doc} ownerId="me" onOpen={vi.fn()} onRename={onRename} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rename Roadmap' }));
    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'Roadmap 2027' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('Roadmap 2027');
    fireEvent.click(screen.getByRole('button', { name: 'Rename Roadmap' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Nope' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onRename).toHaveBeenCalledTimes(1);
  });

  it('shows the name as text for someone who may not rename it', () => {
    render(<ExplorerCurrentProject item={doc} ownerId="me" onOpen={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^Rename/ })).toBeNull();
    expect(screen.getByText('Roadmap')).toBeTruthy();
  });

  it("carries the header's visibility badge at its right", () => {
    act(() => setProjectVisibility({ shareable: false, team: false, offline: true }));
    render(<ExplorerCurrentProject item={doc} ownerId="me" onOpen={vi.fn()} />);
    expect(screen.getByLabelText('This Browser')).toBeTruthy();
  });
});
