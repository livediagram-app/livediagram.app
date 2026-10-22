// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentListItem } from '@/lib/api-client';
import { setDocumentVisibility } from '@/hooks/editor/document-visibility-store';
import { ExplorerCurrentDocument } from './ExplorerCurrentDocument';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/components/panels/DocumentThumbnail', () => ({
  DocumentThumbnail: () => <span data-thumb="" />,
}));

// docs/specs/013-workspace/explorer-structure.md "Layout": the Current Document card.
const doc = {
  id: 'd1',
  name: 'Roadmap',
  ownerId: 'me',
  folderId: null,
  savedAt: Date.now(),
  source: null,
  empty: false,
} as unknown as DocumentListItem;

afterEach(() => {
  act(() => setDocumentVisibility(null));
  cleanup();
});

describe('ExplorerCurrentDocument', () => {
  it('renames on a click of the name: Enter saves, Escape keeps it', () => {
    const onRename = vi.fn();
    render(
      <ExplorerCurrentDocument item={doc} ownerId="me" onOpen={vi.fn()} onRename={onRename} />,
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
    render(<ExplorerCurrentDocument item={doc} ownerId="me" onOpen={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^Rename/ })).toBeNull();
    expect(screen.getByText('Roadmap')).toBeTruthy();
  });

  it("carries the header's visibility badge at its right", () => {
    act(() => setDocumentVisibility({ shareable: false, team: false, offline: true }));
    render(<ExplorerCurrentDocument item={doc} ownerId="me" onOpen={vi.fn()} />);
    expect(screen.getByLabelText('This Browser')).toBeTruthy();
  });
});
