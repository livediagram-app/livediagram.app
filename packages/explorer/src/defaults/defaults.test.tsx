// Default folders: the entries' words, Use as Default for… from a folder's menu, the marker it leaves, Default
// Folders with its picker, the delete confirmation's warning, and the template-pick move.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Folder } from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { Explorer } from '../explorer/Explorer';
import { kindWords } from '../words';
import { DefaultFoldersSettings } from './DefaultFolders';
import {
  defaultEntries,
  defaultFolderDescription,
  folderDeleteConfirmation,
  joinNouns,
} from './entries';
import { handTemplatePick, moveOnTemplatePick, takeTemplatePick } from './template-pick';

const TEMPLATES = [
  { value: 'retrospective', label: 'Retrospective' },
  { value: 'kanban', label: 'Kanban' },
];

const folder = (id: string, over: Partial<Folder> = {}): Folder => ({
  id,
  name: id,
  parentId: null,
  teamId: null,
  ownerId: 'user_me',
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

function page(index: ReturnType<typeof createFakeIndex>) {
  render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'all' }}
      onNavigate={vi.fn()}
      itemHref={(i) => `/p/${i.id}`}
      onCreate={vi.fn()}
      lensTemplates={TEMPLATES}
      heroHidden
    />,
  );
}

describe('the entries', () => {
  it('are the app’s kind, then each template family, keyed per app', () => {
    const entries = defaultEntries('liveplanner', kindWords('liveplanner'), TEMPLATES);
    expect(entries).toEqual([
      { key: 'liveplanner', label: 'Plans', noun: 'plans' },
      {
        key: 'liveplanner:template:retrospective',
        label: 'Retrospective plans',
        noun: 'Retrospective plans',
      },
      { key: 'liveplanner:template:kanban', label: 'Kanban plans', noun: 'Kanban plans' },
    ]);
    expect(joinNouns(['a', 'b', 'c'])).toBe('a, b and c');
    expect(defaultFolderDescription(entries.slice(0, 2))).toBe(
      'Default folder for new plans and Retrospective plans',
    );
  });

  it('put the host’s modes and kinds between the app’s entry and its templates', () => {
    const entries = defaultEntries('livediagram', kindWords('livediagram'), TEMPLATES, [
      { dimension: 'mode', value: 'draw', label: 'Whiteboards', noun: 'whiteboards' },
      {
        dimension: 'kind',
        value: 'event-storming',
        label: 'Event Storming boards',
        noun: 'Event Storming boards',
      },
    ]);
    expect(entries.map((e) => e.key)).toEqual([
      'livediagram',
      'livediagram:mode:draw',
      'livediagram:kind:event-storming',
      'livediagram:template:retrospective',
      'livediagram:template:kanban',
    ]);
    expect(defaultFolderDescription(entries.slice(1, 3))).toBe(
      'Default folder for new whiteboards and Event Storming boards',
    );
  });

  it('name where a deleted folder’s contents go, and warn about a default', () => {
    const kind = kindWords('liveplanner');
    expect(
      folderDeleteConfirmation({ name: 'Q3', parentName: null, teamName: null, kind, held: [] })
        .message,
    ).toBe('Its plans and subfolders move to My Work. Nothing in it is deleted.');
    expect(
      folderDeleteConfirmation({
        name: 'Q3',
        parentName: 'Work',
        teamName: null,
        kind,
        held: [],
      }).message,
    ).toContain('move to “\u2068Work\u2069”');
    const team = folderDeleteConfirmation({
      name: 'Q3',
      parentName: null,
      teamName: 'Design',
      kind,
      held: defaultEntries('liveplanner', kind, TEMPLATES).slice(2),
    });
    expect(team.message).toContain('move to the top of Design');
    expect(team.message).toContain('New Kanban plans are saved here by default.');
  });
});

describe('in the Explorer', () => {
  beforeEach(() => localStorage.clear());

  it('sets a default from a folder’s menu, and marks the folder', async () => {
    const index = createFakeIndex({ folders: [folder('Boards')] });
    page(index);
    // The pane's row (the sidebar's row has its own ⋯ too).
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Menu for Boards' })).find(
        (b) => !b.closest('nav'),
      )!,
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Use as Default for…' }));
    const dialog = await screen.findByRole('dialog');
    const kanban = within(dialog).getByRole('checkbox', { name: 'Kanban plans' });
    await waitFor(() => expect((kanban as HTMLInputElement).disabled).toBe(false));
    fireEvent.click(kanban);
    await waitFor(() =>
      expect(index.placementDefaults.get('liveplanner:template:kanban')).toBe('Boards'),
    );
    expect((kanban as HTMLInputElement).checked).toBe(true);
    expect(
      screen.getAllByText('Default folder for new Kanban plans', { selector: '.sr-only' }).length,
    ).toBeGreaterThan(0);
    // Unchecking clears it.
    fireEvent.click(kanban);
    await waitFor(() =>
      expect(index.placementDefaults.has('liveplanner:template:kanban')).toBe(false),
    );
  });

  it('sends an entry back to the root of My Work from My Work’s own menu', async () => {
    const index = createFakeIndex({
      folders: [folder('Boards')],
      // Kanban files into Boards; Retrospective's folder is gone, so it already lands at the root.
      defaults: {
        'liveplanner:template:kanban': 'Boards',
        'liveplanner:template:retrospective': 'gone',
      },
    });
    page(index);
    fireEvent.click(await screen.findByRole('button', { name: 'Menu for My Work' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Use as Default for…' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Use “\u2068My Work\u2069” as Default for',
    });
    const plans = within(dialog).getByRole('checkbox', { name: 'Plans' }) as HTMLInputElement;
    const retro = within(dialog).getByRole('checkbox', {
      name: 'Retrospective plans',
    }) as HTMLInputElement;
    const kanban = within(dialog).getByRole('checkbox', {
      name: 'Kanban plans',
    }) as HTMLInputElement;
    await waitFor(() => expect(kanban.disabled).toBe(false));
    // Already the root's: checked, and nothing to undo.
    expect([plans.checked, plans.disabled, retro.checked, retro.disabled]).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(kanban.checked).toBe(false);
    fireEvent.click(kanban);
    await waitFor(() =>
      expect(index.placementDefaults.has('liveplanner:template:kanban')).toBe(false),
    );
    expect(kanban.checked).toBe(true);
  });

  it('warns before deleting a default folder, and forgets the default with it', async () => {
    const index = createFakeIndex({
      folders: [folder('Boards')],
      defaults: { liveplanner: 'Boards' },
    });
    page(index);
    await screen.findAllByText('Default folder for new plans', { selector: '.sr-only' });
    // The pane's row (the sidebar's row has its own ⋯ too).
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Menu for Boards' })).find(
        (b) => !b.closest('nav'),
      )!,
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete Folder' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Its plans and subfolders move to My Work.');
    expect(dialog.textContent).toContain('New plans are saved here by default.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Folder' }));
    await waitFor(() => expect(index.count('deleteFolder')).toBe(1));
    await waitFor(() =>
      expect(
        screen.queryAllByText('Default folder for new plans', { selector: '.sr-only' }),
      ).toEqual([]),
    );
  });
});

describe('Default Folders for a host’s Settings', () => {
  it('says where each entry’s new items go, and changes and clears them', async () => {
    const index = createFakeIndex({
      folders: [folder('Plans'), folder('Boards')],
      defaults: { liveplanner: 'Plans' },
    });
    render(
      <DefaultFoldersSettings client={index.client} app="liveplanner" templates={TEMPLATES} />,
    );
    const row = (key: string) =>
      document.querySelector<HTMLElement>(`[data-default-entry="${key}"]`)!;
    await waitFor(() =>
      expect(row('liveplanner').querySelector('[data-default-destination]')!.textContent).toBe(
        'Plans',
      ),
    );
    expect(row('liveplanner:template:kanban').textContent).toContain('My Work');

    fireEvent.click(screen.getByRole('button', { name: 'Change default folder for Kanban plans' }));
    const picker = await screen.findByRole('dialog', {
      name: 'Default folder for new Kanban plans',
    });
    fireEvent.click(within(picker).getByText('Boards'));
    fireEvent.click(within(picker).getByRole('button', { name: 'Use This Folder' }));
    await waitFor(() =>
      expect(index.placementDefaults.get('liveplanner:template:kanban')).toBe('Boards'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear default folder for plans' }));
    await waitFor(() => expect(index.placementDefaults.has('liveplanner')).toBe(false));
    expect(row('liveplanner').textContent).toContain('My Work');
  });
});

describe('a template picked after creation', () => {
  beforeEach(() => sessionStorage.clear());

  it('moves the item to the template’s default folder once, unless its place was chosen', async () => {
    const index = createFakeIndex({
      items: [makeItem(1)],
      folders: [folder('Boards')],
      defaults: { 'liveplanner:template:kanban': 'Boards' },
    });
    handTemplatePick({ itemId: 'item-1', tabId: 't1', placementChosen: false });
    const handoff = takeTemplatePick('item-1', 't1');
    expect(handoff).not.toBeNull();
    expect(takeTemplatePick('item-1', 't1')).toBeNull();
    const message = await moveOnTemplatePick(index.client, {
      app: 'liveplanner',
      itemId: 'item-1',
      handoff: handoff!,
      intent: 'plan:board:kanban',
      noun: () => 'Kanban plans',
    });
    expect(message).toBe('Moved to Boards, your default folder for Kanban plans.');
    expect(index.items[0]!.folderId).toBe('Boards');

    const chosen = await moveOnTemplatePick(index.client, {
      app: 'liveplanner',
      itemId: 'item-1',
      handoff: { itemId: 'item-1', tabId: 't1', placementChosen: true },
      intent: 'plan:board:kanban',
      noun: () => 'Kanban plans',
    });
    expect(chosen).toBeNull();
  });
});

// One read per page: Home, then other views, share the Explorer's one copy (the second request a dev server shows is
// React StrictMode running effects twice; a production build asks once).
describe('the defaults read', () => {
  it('is one request from Home on, however many views follow', async () => {
    const index = createFakeIndex({ items: [makeItem(1)] });
    const props = {
      app: 'liveplanner' as const,
      client: index.client,
      onNavigate: vi.fn(),
      itemHref: (i: { id: string }) => `/p/${i.id}`,
      onCreate: vi.fn(),
      lensTemplates: TEMPLATES,
    };
    const { rerender } = render(<Explorer {...props} view={{ kind: 'home' }} />);
    await waitFor(() => expect(index.count('listPlacementDefaults')).toBe(1));
    for (const view of [{ kind: 'all' }, { kind: 'recent' }, { kind: 'home' }] as const) {
      rerender(<Explorer {...props} view={view} />);
      await screen.findAllByRole('navigation');
    }
    expect(index.count('listPlacementDefaults')).toBe(1);
  });
});
