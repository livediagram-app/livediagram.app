import { describe, expect, it } from 'vitest';
import type { Libraries } from '@livediagram/agent-verbs';
import { CliError, type CliFailure } from '../output/cli-error';
import { fakeIo } from '../testing/fake-io';
import { PICKER_PAGE } from './constants';
import { folderChoices, folderNeededError, noFoldersError, pickFolder } from './folder-picker';

// The folder picker (docs/specs/027-repositories/blueprints/repository-link.md "The folder picker"): choose, narrow,
// out of range, cancel three ways, and the refusal where it is not a terminal.

const folder = (id: string, name: string, parentId: string | null = null) => ({
  id,
  name,
  parentId,
  teamId: null,
  ownerId: 'u',
  createdAt: 1,
  updatedAt: 1,
});

const libraries: Libraries = {
  personal: {
    documents: [],
    folders: [
      folder('f-screens', 'Screens', 'f-games'),
      folder('f-games', 'Minigames'),
      folder('f-art', 'Art'),
    ],
  },
  teams: [
    { id: 't2', name: 'Zed', documents: [], folders: [folder('f-z', 'Zone')] },
    { id: 't1', name: 'Platform', documents: [], folders: [folder('f-arch', 'Architecture')] },
  ],
};
const choices = folderChoices(libraries);
const HOST = 'https://livediagram.app';

async function failureOf(run: () => Promise<unknown>): Promise<CliFailure> {
  try {
    await run();
  } catch (err) {
    if (err instanceof CliError) return err.failure;
    throw err;
  }
  throw new Error('expected a CliError');
}

describe('folderChoices', () => {
  it('lists personal folders depth first by name, then each team’s, teams by name', () => {
    expect(choices).toEqual([
      { id: 'f-art', path: 'Art', library: 'personal' },
      { id: 'f-games', path: 'Minigames', library: 'personal' },
      { id: 'f-screens', path: 'Minigames/Screens', library: 'personal' },
      { id: 'f-arch', path: 'Architecture', library: 'Platform' },
      { id: 'f-z', path: 'Zone', library: 'Zed' },
    ]);
  });
});

describe('pickFolder', () => {
  const LIST = [
    'Folders in https://livediagram.app',
    '   1  Art                personal',
    '   2  Minigames          personal',
    '   3  Minigames/Screens  personal',
    '   4  Architecture       Platform',
    '   5  Zone               Zed',
    'Link which folder? Type its number, or part of its name to narrow. Enter on its own cancels.',
    '',
  ].join('\n');

  it('chooses by number from the list it showed', async () => {
    const logs: string[] = [];
    const io = fakeIo({ lines: ['3'] });
    expect(await pickFolder(io, choices, HOST, (l) => logs.push(l))).toEqual(choices[2]);
    expect(io.err()).toBe(`${LIST}folder> linking "Minigames/Screens" (personal)\n`);
    expect(logs).toEqual(['picker shown 5', 'picker chosen']);
  });

  it('narrows by part of a path, numbering from 1, and names a number out of range', async () => {
    const logs: string[] = [];
    const io = fakeIo({ lines: ['games', '7', '2'] });
    expect(await pickFolder(io, choices, HOST, (l) => logs.push(l))).toEqual(choices[2]);
    expect(io.err()).toBe(
      [
        `${LIST}folder> Folders matching "games"`,
        '   1  Minigames          personal',
        '   2  Minigames/Screens  personal',
        'Link which folder? Type its number, or part of its name to narrow. Enter on its own cancels.',
        'folder> no folder 7 in this list; type 1 to 2',
        'folder> linking "Minigames/Screens" (personal)',
        '',
      ].join('\n'),
    );
    expect(logs).toEqual(['picker shown 5', 'picker narrowed 2', 'picker chosen']);
  });

  it('says when nothing matches and shows the whole list again', async () => {
    const io = fakeIo({ lines: ['nothing', '1'] });
    expect(await pickFolder(io, choices, HOST, () => {})).toEqual(choices[0]);
    expect(io.err()).toBe(
      `${LIST}folder> no folder matches "nothing"\n${LIST}folder> linking "Art" (personal)\n`,
    );
  });

  it('cancels on Enter alone, at the end of input, and on Ctrl-C', async () => {
    const cancelled = { exit: 1, code: 'cancelled', message: 'cancelled; nothing written' };
    const logs: string[] = [];
    expect(
      await failureOf(() =>
        pickFolder(fakeIo({ lines: [''] }), choices, HOST, (l) => logs.push(l)),
      ),
    ).toEqual(cancelled);
    expect(logs.at(-1)).toBe('picker cancelled');
    expect(
      await failureOf(() => pickFolder(fakeIo({ lines: [null] }), choices, HOST, () => {})),
    ).toEqual(cancelled);
    const io = fakeIo();
    io.readLine = () => new Promise(() => {});
    const picking = failureOf(() => pickFolder(io, choices, HOST, () => {}));
    await new Promise((resolve) => setTimeout(resolve, 0));
    io.interrupt();
    expect(await picking).toEqual(cancelled);
  });

  it('shows a page at a time, naming how many more', async () => {
    const many = Array.from({ length: PICKER_PAGE + 3 }, (_, i) => ({
      id: `f${i}`,
      path: `Folder ${String(i).padStart(2, '0')}`,
      library: 'personal',
    }));
    const io = fakeIo({ lines: ['21'] });
    await failureOf(() => pickFolder(io, many, HOST, () => {})).catch(() => {});
    expect(io.err()).toContain(
      '  20  Folder 19  personal\n… 3 more; type part of a name to narrow\n',
    );
    expect(io.err()).toContain('no folder 21 in this list; type 1 to 20');
  });
});

describe('folderNeededError', () => {
  it('lists the folders as runnable commands, with the level when given', () => {
    expect(folderNeededError(choices.slice(0, 2), 'files').failure).toEqual({
      exit: 2,
      code: 'folder_needed',
      message: 'link init needs --folder or --doc when it is not run in a terminal',
      lines: [
        'livediagram link init --folder f-art --level files  # Art (personal)',
        'livediagram link init --folder f-games --level files  # Minigames (personal)',
      ],
      hint: 'livediagram link init --folder f-art --level files',
    });
  });

  it('cuts at a page, naming how to reach the rest', () => {
    const many = Array.from({ length: PICKER_PAGE + 2 }, (_, i) => ({
      id: `f${i}`,
      path: `F${i}`,
      library: 'personal',
    }));
    const { lines } = folderNeededError(many).failure;
    expect(lines).toHaveLength(PICKER_PAGE + 1);
    expect(lines!.at(-1)).toBe(
      "… 2 more: livediagram link init --folder <name> takes a folder's name too",
    );
  });
});

describe('noFoldersError', () => {
  it('names the host and the way out', () => {
    expect(noFoldersError(HOST).failure).toEqual({
      exit: 3,
      code: 'no_folders',
      message: 'there are no folders in https://livediagram.app to link',
      hint: 'create a folder in livediagram, or link documents: livediagram link init --doc <doc>',
    });
  });
});

describe('folderChoices of siblings with one name', () => {
  it('keeps them both, in the order the library gave them', () => {
    const twins: Libraries = {
      personal: {
        documents: [],
        folders: [
          folder('c', 'Alpha'),
          folder('z', 'Zeta'),
          folder('b', 'Same'),
          folder('a', 'Same'),
        ],
      },
      teams: [],
    };
    expect(folderChoices(twins).map((c) => c.id)).toEqual(['c', 'b', 'a', 'z']);
  });
});
