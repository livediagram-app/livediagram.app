// @vitest-environment jsdom
// The Library in an editor (liveworkspace/docs/specs/006-media/libraries.md): nothing fetched until it is needed, Save
// to Library to Personal or a team, the palette's groups and tidy controls by role, the hidden count, and refusals in
// words.
import type { LibraryItemSummary, LibraryListResponse } from '@liveworkspace/media';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LibraryError, type LibraryApi } from '../../lib/library/library-api';
import { LIBRARY_ITEM_DND_MIME, readLibraryItemDrop } from '../../lib/library/library-dnd';
import { LibraryPaletteTab } from './LibraryPaletteTab';
import { LibraryProvider, useLibrary } from './LibraryProvider';
import { SaveToLibraryButton } from './SaveToLibraryButton';
import { useLibraryDrop, type LibraryItemDrop } from './useLibraryDrop';

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

describe('an api that arrives later', () => {
  it('never remounts the editor, and loads on the first need after it arrives', async () => {
    let mounts = 0;
    function Probe() {
      const [n] = useState(() => ++mounts);
      return <p>mount {n}</p>;
    }
    const api = fakeApi();
    const { rerender } = render(
      <LibraryProvider api={null}>
        <Probe />
        <Palette onInsert={vi.fn()} />
      </LibraryProvider>,
    );
    expect(screen.getByText('No Library')).toBeTruthy();
    rerender(
      <LibraryProvider api={api}>
        <Probe />
        <Palette onInsert={vi.fn()} />
      </LibraryProvider>,
    );
    expect(mounts).toBe(1);
    await screen.findByRole('button', { name: 'Insert My Box from Personal' });
    expect(api.list).toHaveBeenCalledTimes(1);
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

describe('dragging onto the canvas', () => {
  it('gives every new item the Library’s drag, carrying its id', async () => {
    render(<Editor api={fakeApi()} />);
    const tile = await screen.findByRole('button', { name: 'Insert Logo from Platform' });
    const setData = vi.fn();
    fireEvent.dragStart(tile, { dataTransfer: { setData, effectAllowed: '' } });
    expect(setData).toHaveBeenCalledWith(LIBRARY_ITEM_DND_MIME, JSON.stringify({ id: 'team-a' }));
    expect(readLibraryItemDrop(setData.mock.calls[0]![1] as string)).toBe('team-a');
  });

  it('reads only a well-formed drop', () => {
    expect(readLibraryItemDrop('')).toBeNull();
    expect(readLibraryItemDrop('not json')).toBeNull();
    expect(readLibraryItemDrop('null')).toBeNull();
    expect(readLibraryItemDrop(JSON.stringify({ id: 3 }))).toBeNull();
    expect(readLibraryItemDrop(JSON.stringify({ id: 'x'.repeat(300) }))).toBeNull();
  });

  // The canvas's drop handler, as an editor mounts it.
  function Dropper({
    insert,
    onReady,
  }: {
    insert: (item: unknown, at: { x: number; y: number }) => boolean;
    onReady: (drop: LibraryItemDrop | null) => void;
  }) {
    const drop = useLibraryDrop(insert);
    onReady(drop);
    return <Palette onInsert={vi.fn()} />;
  }

  it('places a dropped item where it lands once the door answers, counting it', async () => {
    const api = fakeApi();
    const insert = vi.fn(() => true);
    const onPlaced = vi.fn();
    let drop: LibraryItemDrop | null = null;
    render(
      <LibraryProvider api={api} onPlaced={onPlaced}>
        <Dropper insert={insert} onReady={(d) => (drop = d)} />
      </LibraryProvider>,
    );
    await screen.findByText('Logo');
    let landed = false;
    await act(async () => {
      landed = await drop!('team-a', { x: 40, y: 50 });
    });
    expect(landed).toBe(true);
    expect(api.place).toHaveBeenCalledWith('team-a');
    expect(insert).toHaveBeenCalledWith(
      { elements: [{ id: 'p' }], width: 10, height: 10 },
      { x: 40, y: 50 },
    );
    expect(onPlaced).toHaveBeenCalledWith('team');
  });

  it('lands nothing when the fetch fails, says why, and ignores an item it doesn’t hold', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const api = fakeApi({
      place: vi.fn(async () => Promise.reject(new LibraryError('not_found', 404))),
    });
    const insert = vi.fn(() => true);
    const onPlaced = vi.fn();
    let drop: LibraryItemDrop | null = null;
    render(
      <LibraryProvider api={api} onPlaced={onPlaced}>
        <Dropper insert={insert} onReady={(d) => (drop = d)} />
      </LibraryProvider>,
    );
    await screen.findByText('Logo');
    await act(async () => {
      expect(await drop!('team-a', { x: 0, y: 0 })).toBe(false);
      expect(await drop!('nope', { x: 0, y: 0 })).toBe(false);
    });
    expect(insert).not.toHaveBeenCalled();
    expect(onPlaced).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('That item is no longer in the library.');
  });

  it('takes no drop in an editor without the Library', () => {
    let drop: LibraryItemDrop | null | undefined;
    render(
      <LibraryProvider api={null}>
        <Dropper insert={vi.fn()} onReady={(d) => (drop = d)} />
      </LibraryProvider>,
    );
    expect(drop).toBeNull();
  });
});

describe('Save to Library', () => {
  it('counts a save by where it went, and a click’s place by whose it was', async () => {
    const api = fakeApi();
    const onSaved = vi.fn();
    const onPlaced = vi.fn();
    render(
      <LibraryProvider api={api} onSaved={onSaved} onPlaced={onPlaced}>
        <SaveToLibraryButton draft={() => DRAFT} className="btn" />
        <Palette onInsert={vi.fn()} />
      </LibraryProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Insert My Box from Personal' }));
    await waitFor(() => expect(onPlaced).toHaveBeenCalledWith('personal'));
    fireEvent.click(screen.getByRole('button', { name: 'Save to Library' }));
    await screen.findByRole('dialog');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    expect(onSaved).toHaveBeenCalledWith('personal');
  });

  it('asks for its pictures’ copies, and saves without any it can’t make', async () => {
    const api = fakeApi();
    const picture = { id: 'i', type: 'image', imageId: 'img_1', width: 10, height: 10 };
    const release = vi.fn();
    const pictures = { url: vi.fn(async () => 'blob:one'), release };
    render(
      <LibraryProvider api={api} pictures={pictures}>
        <SaveToLibraryButton draft={() => ({ ...DRAFT, elements: [picture] })} className="btn" />
      </LibraryProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save to Library' }));
    await screen.findByRole('dialog');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    // jsdom can't decode the picture, so no copy is made, the URL is still given back, and the save goes on.
    expect(pictures.url).toHaveBeenCalledWith('img_1');
    expect(release).toHaveBeenCalledWith('blob:one');
    expect(api.save).toHaveBeenCalledWith(
      expect.not.objectContaining({ pictures: expect.anything() }),
    );
  });

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

  it('asks for the list again on each opening, so a team joined since offers itself', async () => {
    let teams = LIST.teams;
    const api = fakeApi({ list: vi.fn(async () => ({ ...LIST, teams })) });
    render(<Editor api={api} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save selected elements to Library' }));
    await screen.findByRole('radio', { name: /Brand/ });
    expect(screen.queryByRole('radio', { name: /Design/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const asked = vi.mocked(api.list).mock.calls.length;
    teams = [...LIST.teams, { id: 't3', name: 'Design', role: 'member' }];
    fireEvent.click(screen.getByRole('button', { name: 'Save selected elements to Library' }));
    await screen.findByRole('radio', { name: /Design/ });
    expect(api.list).toHaveBeenCalledTimes(asked + 1);
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

  it('ignores Escape while a save is in flight, then closes on Escape again', async () => {
    let finish: () => void = () => {};
    const api = fakeApi({
      save: vi.fn(
        () =>
          new Promise<LibraryItemSummary>((resolve) => {
            finish = () => resolve(LIST.items[0]!);
          }),
      ),
    });
    render(<Editor api={api} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save selected elements to Library' }));
    await screen.findByRole('dialog');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy();
    await act(async () => finish());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Save selected elements to Library' }));
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
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
