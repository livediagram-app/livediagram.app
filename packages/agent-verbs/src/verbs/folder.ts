// The folder verbs (docs/specs/015-api/cli.md "Commands": `folder ls`, `folder create`; blueprint CLI86, CLI87): the
// person's folders as paths with their ids, and a new folder, at the top of My Documents or inside another. A
// workbench names a project's folder by these ids (`workbench open --workspace --folder <f>`).

import { z } from 'zod';
import type { Folder } from '@liveplanner/api-schema';
import { defineVerb } from '../define';
import { readLibraries } from '../find-documents';
import { folderChoices, resolveFolderRef } from '../folders';
import { columns } from './shared';

const folderRow = z.object({ id: z.string(), path: z.string(), library: z.string() });

// The longest a folder name may be: the api's own cap (MAX_NAME_LEN, apps/api/src/limits.ts), refused here first.
const FOLDER_NAME_MAX_LENGTH = 500;

export const folderLs = defineVerb({
  id: 'folder.ls',
  summary: 'The folders, as paths with their ids',
  description:
    'Lists your folders as paths: My Documents first, then each team you joined, depth first. Each line is the folder’s id, its path and its library; workbench open --workspace --folder and folder create --in take the id.',
  behaviour: 'read',
  input: z.object({}),
  output: z.object({ folders: z.array(folderRow) }),
  listKey: 'folders',
  run: async (ctx) => {
    const choices = folderChoices(await readLibraries(ctx.api));
    ctx.log(`folder ls ${choices.length} folders`);
    return { folders: choices.map(({ id, path, library }) => ({ id, path, library })) };
  },
  text: ({ folders }) =>
    folders.length
      ? columns(folders.map((f) => [f.id, JSON.stringify(f.path), f.library]))
      : ['no folders yet: liveplanner folder create <name>'],
  cli: {
    positionals: [],
    examples: ['liveplanner folder ls', 'liveplanner folder ls --json'],
    prints: '<id>  "<path>"  <library> per folder; --json [{ id, path, library }]',
  },
});

export const folderCreate = defineVerb({
  id: 'folder.create',
  summary: 'A new folder',
  description:
    'Makes a folder named <name> at the top of My Documents, or inside the folder --in names (its id, id prefix or name); inside a team’s folder it is the team’s. Prints its id and path.',
  behaviour: 'write',
  input: z.object({
    name: z.string().trim().min(1).max(FOLDER_NAME_MAX_LENGTH).describe('The new folder’s name'),
    in: z.string().optional().describe('A folder to make it in: its id, id prefix or name'),
  }),
  output: z.object({ id: z.string(), path: z.string() }),
  run: async (ctx, input) => {
    const parent =
      input.in === undefined
        ? null
        : resolveFolderRef(folderChoices(await readLibraries(ctx.api)), input.in, '--in');
    const id = crypto.randomUUID();
    await ctx.api.json<{ folder: Folder }>('/folders', {
      method: 'POST',
      body: JSON.stringify({
        id,
        name: input.name,
        parentId: parent?.id ?? null,
        ...(parent?.teamId ? { teamId: parent.teamId } : {}),
      }),
    });
    const path = parent ? `${parent.path}/${input.name}` : input.name;
    ctx.log(`folder create ${parent ? 'in a folder' : 'at the top'}`);
    return { id, path };
  },
  text: ({ id, path }) => [`+ folder ${id} ${JSON.stringify(path)}`],
  cli: {
    positionals: ['name'],
    examples: [
      'liveplanner folder create "Minigames" --json',
      'liveplanner folder create "Screens" --in Minigames',
    ],
    prints: '+ folder <id> "<path>"; --json { id, path }',
  },
});
