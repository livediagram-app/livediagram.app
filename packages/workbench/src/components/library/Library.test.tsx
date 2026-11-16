// @vitest-environment jsdom
// The Library in an editor (liveworkspace/docs/specs/006-media/libraries.md): nothing fetched until it is needed, Save
// to Library to Personal or a team, the palette's groups and tidy controls by role, the hidden count, and refusals in
// words.
import type { LibraryItemSummary, LibraryListResponse } from '@liveworkspace/media';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LibraryError, type LibraryApi } from '../../lib/library/library-api';
import { LibraryPaletteTab } from './LibraryPaletteTab';
import { LibraryProvider, useLibrary } from './LibraryProvider';
import { SaveToLibraryButton } from './SaveToLibraryButton';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const item = (over: Partial<LibraryItemSummary>): LibraryItemSummary => ({
  id: 'x',
  scope: 'personal',
  teamId: null,
  folder: '',
  title: 'Box',
  width: 10,
  height: 10,
  kinds: ['shape'],
  preview: '<svg/>',
  app: 'livediagram.app',
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const LIST: LibraryListResponse = {
  items: [
    item({ id: 'mine', title: 'My Box' }),
    item({ id: 'team-a', scope: 'team', teamId: 't1', title: 'Logo', folder: 'Marks' }),
    item({ id: 'team-b', scope: 'team', teamId: 't2', title: 'Badge' }),
  ],
  teams: [
    { id: 't1', name: 'Platform', role: 'member' },
    { id: 't2', name: 'Brand', role: 'admin' },
  ],
  hidden: 2,
  legacy: { unavailable: [], copied: [], writable: true },
};

const fakeApi = (over: Partial<LibraryApi> = {}): LibraryApi => ({
  list: vi.fn(async () => LIST),
  save: vi.fn(async () => LIST.items[0]!),
  place: vi.fn(async () => ({ elements: [{ id: 'p' }], width: 10, height: 10 })),
  rename: vi.fn(async () => LIST.items[0]!),
  renameFolder: vi.fn(async () => 1),
  remove: vi.fn(async () => {}),
  ...over,
});

const DRAFT = {
  width: 10,
  height: 10,
  elements: [{ id: 'a' }, { id: 'b' }],
  suggestedTitle: 'Payments',
};

function Editor({
  api,
  onInsert = vi.fn(),
}: {
  api: LibraryApi | null;
  onInsert?: (i: unknown) => void;
}) {
  return (
    <LibraryProvider api={api}>
      <SaveToLibraryButton draft={() => DRAFT} className="btn" multiple />
      <Palette onInsert={onInsert} />
    </LibraryProvider>
  );
}

function Palette({ onInsert }: { onInsert: (i: unknown) => void }) {
  const library = useLibrary();
  return library ? <LibraryPaletteTab onInsert={onInsert} /> : <p>No Library</p>;
}

describe('without the Library', () => {
  it('offers neither Save nor the palette', () => {
    render(<Editor api={null} />);
    expect(screen.queryByRole('button', { name: /Save selected elements/ })).toBeNull();
    expect(screen.getByText('No Library')).toBeTruthy();
  });
});

describe('loading', () => {
  it('asks for the list only once something needs it', async () => {
    const api = fakeApi();
    render(
      <LibraryProvider api={api}>
        <SaveToLibraryButton draft={() => DRAFT} className="btn" />
      </LibraryProvider>,
    );
    expect(api.list).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save to Library' }));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(1));
  });

  it('shows a way to try again when the list fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const api = fakeApi({ list: vi.fn(async () => Promise.reject(new Error('down'))) });
    render(<Editor api={api} />);
    await screen.findByText('Couldn’t load your library.');
    (api.list as ReturnType<typeof vi.fn>).mockResolvedValueOnce(LIST);
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await screen.findByText('My Box');
  });

  it('says how to fill an empty library', async () => {
    render(
      <Editor api={fakeApi({ list: vi.fn(async () => ({ ...LIST, items: [], hidden: 0 })) })} />,
    );
    await screen.findByText('Nothing saved yet');
  });
});

describe('the palette', () => {
  it('groups Personal and each team, says how many are hidden, and places a click', async () => {
    const api = fakeApi();
    const onInsert = vi.fn();
    render(<Editor api={api} onInsert={onInsert} />);
    await screen.findByText('My Box');
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Personal',
      'Platform',
      'BrandAdmin',
    ]);
    expect(screen.getByText('2 items from other apps can’t be placed here.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Insert Logo from Platform' }));
    await waitFor(() =>
      expect(onInsert).toHaveBeenCalledWith({ elements: [{ id: 'p' }], width: 10, height: 10 }),
    );
    expect(api.place).toHaveBeenCalledWith('team-a');
  });

  it('gives tidy controls to Personal and a team’s admins, never to a member', async () => {
    render(<Editor api={fakeApi()} />);
    await screen.findByText('My Box');
    expect(screen.getByRole('button', { name: 'More for My Box' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More for Badge' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'More for Logo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rename folder Marks' })).toBeNull();
  });

  it('renames in place and deletes after a confirm', async () => {
    const api = fakeApi();
    render(<Editor api={api} />);
    await screen.findByText('Badge');
    fireEvent.click(screen.getByRole('button', { name: 'More for Badge' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Rename/ }));
    const input = screen.getByRole('textbox', { name: 'Rename Badge' });
    fireEvent.change(input, { target: { value: 'Seal' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(api.rename).toHaveBeenCalledWith('team-b', 'Seal'));

    fireEvent.click(screen.getByRole('button', { name: 'More for Badge' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    expect(screen.getByText(/leaves Brand’s library for everyone/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('team-b'));
  });

  it('shows a refusal in words', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const api = fakeApi({
      remove: vi.fn(async () => Promise.reject(new LibraryError('admin_only', 403))),
    });
    render(<Editor api={api} />);
    await screen.findByText('My Box');
    fireEvent.click(screen.getByRole('button', { name: 'More for My Box' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByText('Only the team’s admins can change its library.');
  });

  it('searches, and offers to clear a search that matches nothing', async () => {
    render(<Editor api={fakeApi()} />);
    await screen.findByText('My Box');
    const search = screen.getByLabelText('Search the library');
    fireEvent.change(search, { target: { value: 'logo' } });
    expect(screen.queryByText('My Box')).toBeNull();
    expect(screen.getByText('Logo')).toBeTruthy();
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getAllByText(/No items match/).length).toBeGreaterThan(0);
  });
});

describe('folders and drags', () => {
  it('renames a Personal folder in place, and Escape leaves it as it was', async () => {
    const api = fakeApi({
      list: vi.fn(async () => ({
        ...LIST,
        items: [...LIST.items, item({ id: 'f', title: 'Lambda', folder: 'AWS' })],
      })),
    });
    render(<Editor api={api} />);
    await screen.findByText('Lambda');
    fireEvent.click(screen.getByRole('button', { name: 'Rename folder AWS' }));
    const input = screen.getByRole('textbox', { name: 'Rename folder AWS' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(api.renameFolder).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Rename folder AWS' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Rename folder AWS' }), {
      target: { value: 'Cloud' },
    });
    fireEvent.blur(screen.getByRole('textbox', { name: 'Rename folder AWS' }));
    await waitFor(() =>
      expect(api.renameFolder).toHaveBeenCalledWith({
        scope: 'personal',
        teamId: null,
        from: 'AWS',
        to: 'Cloud',
      }),
    );
  });

  it('carries the editor’s drag payload, and draws an item with no preview the editor’s way', async () => {
    const api = fakeApi({
      list: vi.fn(async () => ({
        ...LIST,
        items: [item({ id: 'own', title: 'Own', preview: null })],
      })),
    });
    render(
      <LibraryProvider api={api}>
        <LibraryPaletteTab
          onInsert={vi.fn()}
          thumbnailFor={() => <i data-testid="thumb" />}
          dragFor={(i) => ({ mime: 'application/x-test', data: i.id })}
        />
      </LibraryProvider>,
    );
    const tile = await screen.findByRole('button', { name: 'Insert Own from Personal' });
    expect(screen.getByTestId('thumb')).toBeTruthy();
    const setData = vi.fn();
    fireEvent.dragStart(tile, { dataTransfer: { setData, effectAllowed: '' } });
    expect(setData).toHaveBeenCalledWith('application/x-test', 'own');
  });
});

describe('Save to Library', () => {
  it('saves the selection to the team chosen, with its name and folder', async () => {
    const api = fakeApi();
    render(<Editor api={api} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save selected elements to Library' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('these 2 elements');
    expect(screen.getByDisplayValue('Payments')).toBeTruthy();
    await screen.findByRole('radio', { name: /Brand/ });
    fireEvent.click(screen.getByRole('radio', { name: /Platform/ }));
    expect(screen.getByText('Everyone in the team can place it. Admins tidy it.')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Marks|Logos/), { target: { value: ' Marks ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    expect(api.save).toHaveBeenCalledWith({
      scope: 'team',
      teamId: 't1',
      folder: 'Marks',
      title: 'Payments',
      width: 10,
      height: 10,
      elements: DRAFT.elements,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the dialog open with the refusal in words', async () => {
    const api = fakeApi({
      save: vi.fn(async () => Promise.reject(new LibraryError('library_full', 409))),
    });
    render(<Editor api={api} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save selected elements to Library' }));
    await screen.findByRole('dialog');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    expect(screen.getByRole('alert').textContent).toBe(
      'This library is full. Delete something to make room.',
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('won’t save without a name, and cancels', async () => {
    render(<Editor api={fakeApi()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save selected elements to Library' }));
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByDisplayValue('Payments'), { target: { value: '  ' } });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
