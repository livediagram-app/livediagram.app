// The folder verbs (docs/specs/015-api/cli.md "Commands": `folder ls`, `folder create`; blueprint CLI86, CLI87): the
// person's folders as paths with their ids, and a new folder, at the top of My Work or inside another. A
// workbench names a project's folder by these ids (`workbench open --workspace --folder <f>`).

import { z } from 'zod';
import type { ApiClient } from '@liveworkspace/api-client';
import { defineVerb } from '../define';
import { createFolderRefs, folderChoices, type FolderLibraries } from '../folders';
import { columns } from '../listing';
import type { AgentProduct } from '../product';

const folderRow = z.object({ id: z.string(), path: z.string(), library: z.string() });

// The longest a folder name may be: the api's own cap (MAX_NAME_LEN, apps/api/src/limits.ts), refused here first.
const FOLDER_NAME_MAX_LENGTH = 500;

export type FolderVerbsBinding = {
  product: Pick<AgentProduct, 'cli'>;
  // The product's library sweep (./find `readLibraries`).
  readLibraries: (api: ApiClient) => Promise<FolderLibraries>;
};

export function createFolderVerbs({ product, readLibraries }: FolderVerbsBinding) {
  const { cli } = product;
  const resolveFolderRef = createFolderRefs(product);

  const folderLs = defineVerb({
    id: 'folder.ls',
    summary: 'The folders, as paths with their ids',
    description:
      'Lists your folders as paths: My Work first, then each team you joined, depth first. Each line is the folder’s id, its path and its library; workbench open --workspace --folder and folder create --in take the id.',
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
        : [`no folders yet: ${cli} folder create <name>`],
    cli: {
      positionals: [],
      examples: [`${cli} folder ls`, `${cli} folder ls --json`],
      prints: '<id>  "<path>"  <library> per folder; --json [{ id, path, library }]',
    },
  });

  const folderCreate = defineVerb({
    id: 'folder.create',
    summary: 'A new folder',
    description:
      'Makes a folder named <name> at the top of My Work, or inside the folder --in names (its id, id prefix or name); inside a team’s folder it is the team’s. Prints its id and path.',
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
      await ctx.api.json<{ folder: unknown }>('/folders', {
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
        `${cli} folder create "Minigames" --json`,
        `${cli} folder create "Screens" --in Minigames`,
      ],
      prints: '+ folder <id> "<path>"; --json { id, path }',
    },
  });

  return { folderLs, folderCreate };
}
