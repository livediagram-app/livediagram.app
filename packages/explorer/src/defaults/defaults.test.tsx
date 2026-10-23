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
    ).toContain('move to “Work”');
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
    fireEvent.click(await screen.findByRole('button', { name: 'Menu for Boards' }));
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

  it('warns before deleting a default folder, and forgets the default with it', async () => {
    const index = createFakeIndex({
      folders: [folder('Boards')],
      defaults: { liveplanner: 'Boards' },
    });
    page(index);
    await screen.findAllByText('Default folder for new plans', { selector: '.sr-only' });
    fireEvent.click(await screen.findByRole('button', { name: 'Menu for Boards' }));
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
      intent: 'plan:kanban',
      noun: () => 'Kanban plans',
    });
    expect(message).toBe('Moved to Boards, your default folder for Kanban plans.');
    expect(index.items[0]!.folderId).toBe('Boards');

    const chosen = await moveOnTemplatePick(index.client, {
      app: 'liveplanner',
      itemId: 'item-1',
      handoff: { itemId: 'item-1', tabId: 't1', placementChosen: true },
      intent: 'plan:kanban',
      noun: () => 'Kanban plans',
    });
    expect(chosen).toBeNull();
  });
});
