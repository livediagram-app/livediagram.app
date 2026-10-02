// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShapeLibrary } from '@livediagram/api-schema';
import type { ShapeLibrariesValue } from '@/components/primitives/ShapeLibraryProvider';
import { ShapeLibrariesPane } from './ShapeLibrariesPane';

// docs/specs/013-workspace/shape-libraries.md "Managing libraries: the Explorer".

vi.mock('@/lib/shape-library-thumbnail', () => ({
  libraryItemThumbnail: vi.fn(async () => 'data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E'),
}));
const confirm = vi.fn();
vi.mock('@/hooks/ui/useConfirm', () => ({ useConfirm: () => confirm }));
let value: ShapeLibrariesValue;
vi.mock('@/components/primitives/ShapeLibraryProvider', () => ({
  useShapeLibraries: () => value,
}));

const item = (id: string, title: string) => ({ id, title, width: 10, height: 10, elements: [] });
const lib = (id: string, name: string, n: number): ShapeLibrary => ({
  id,
  ownerId: 'o',
  name,
  source: 'drawio',
  items: Array.from({ length: n }, (_, i) => item(`${id}-${i}`, i === 0 ? '' : `Shape ${id}${i}`)),
  createdAt: 1,
  updatedAt: 1,
});

beforeEach(() => {
  confirm.mockReset();
  value = {
    libraries: [lib('a', 'Team icons', 10), lib('b', 'UML', 1)],
    status: 'ready',
    reload: vi.fn(async () => {}),
    createLibrary: vi.fn(),
    renameLibrary: vi.fn(async () => ({ ok: true as const, library: lib('a', 'x', 0) })),
    deleteLibrary: vi.fn(async () => {}),
    deleteItem: vi.fn(async () => ({ ok: true as const, library: lib('a', 'x', 0) })),
  };
});
afterEach(cleanup);

const card = (name: string) => screen.getByRole('article', { name });

describe('ShapeLibrariesPane', () => {
  it('lists each library with its count and up to eight thumbnails', () => {
    render(<ShapeLibrariesPane />);
    expect(within(card('Team icons')).getByText('10 shapes')).toBeTruthy();
    expect(within(card('UML')).getByText('1 shape')).toBeTruthy();
    expect(within(card('Team icons')).getAllByTestId('library-preview')).toHaveLength(8);
  });

  it('renames inline: Enter saves, Escape cancels, a refusal stays with its reason', async () => {
    render(<ShapeLibrariesPane />);
    fireEvent.click(within(card('UML')).getByRole('button', { name: 'Rename UML' }));
    const input = screen.getByRole('textbox', { name: 'Library name' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Library name' })).toBeNull();
    expect(value.renameLibrary).not.toHaveBeenCalled();

    value.renameLibrary = vi.fn(async () => ({
      ok: false as const,
      error: 'You already have a library with that name.',
    }));
    fireEvent.click(within(card('UML')).getByRole('button', { name: 'Rename UML' }));
    const again = screen.getByRole('textbox', { name: 'Library name' });
    fireEvent.change(again, { target: { value: '  Team icons ' } });
    fireEvent.keyDown(again, { key: 'Enter' });
    await waitFor(() => expect(value.renameLibrary).toHaveBeenCalledWith('b', 'Team icons'));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'You already have a library with that name.',
    );
    expect(screen.getByRole('textbox', { name: 'Library name' })).toBeTruthy();
  });

  it('saves nothing for an empty or unchanged name', () => {
    render(<ShapeLibrariesPane />);
    for (const next of ['   ', 'UML']) {
      fireEvent.click(within(card('UML')).getByRole('button', { name: 'Rename UML' }));
      const input = screen.getByRole('textbox', { name: 'Library name' });
      fireEvent.change(input, { target: { value: next } });
      fireEvent.keyDown(input, { key: 'Enter' });
    }
    expect(value.renameLibrary).not.toHaveBeenCalled();
  });

  it('deletes a library only once confirmed', async () => {
    confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<ShapeLibrariesPane />);
    const del = within(card('UML')).getByRole('button', { name: 'Delete UML' });
    fireEvent.click(del);
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(value.deleteLibrary).not.toHaveBeenCalled();
    fireEvent.click(del);
    await waitFor(() => expect(value.deleteLibrary).toHaveBeenCalledWith('b'));
    expect(confirm.mock.calls[0]![0]).toMatchObject({
      title: 'Delete this shape library?',
      message: 'Its shapes leave My shapes; documents that use them keep them.',
    });
  });

  it('shows every shape on demand, each deletable by name', async () => {
    render(<ShapeLibrariesPane />);
    fireEvent.click(within(card('Team icons')).getByRole('button', { name: 'Show shapes' }));
    const shapes = within(card('Team icons')).getByRole('list', { name: 'Shapes in Team icons' });
    expect(within(shapes).getAllByRole('listitem')).toHaveLength(10);
    fireEvent.click(within(shapes).getByRole('button', { name: 'Delete Shape 1' }));
    await waitFor(() => expect(value.deleteItem).toHaveBeenCalledWith('a', 'a-0'));
    fireEvent.click(within(card('Team icons')).getByRole('button', { name: 'Hide shapes' }));
    expect(
      within(card('Team icons')).queryByRole('list', { name: 'Shapes in Team icons' }),
    ).toBeNull();
  });

  it('says when there are none, when loading failed, and while loading', () => {
    value = { ...value, libraries: [] };
    const { unmount } = render(<ShapeLibrariesPane />);
    expect(screen.getByText('No shape libraries yet')).toBeTruthy();
    expect(screen.getByText('Import a draw.io library with Import from draw.io.')).toBeTruthy();
    unmount();
    value = { ...value, status: 'error' };
    const failed = render(<ShapeLibrariesPane />);
    expect(screen.getByText("Couldn't load your shape libraries.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(value.reload).toHaveBeenCalled();
    failed.unmount();
    value = { ...value, status: 'loading' };
    render(<ShapeLibrariesPane />);
    expect(screen.getByRole('status', { name: 'Loading shape libraries' })).toBeTruthy();
  });
});
