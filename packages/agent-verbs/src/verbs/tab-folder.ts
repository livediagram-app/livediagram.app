// The `tab folder` verb (each product's docs/specs/015-api/cli.md "Commands", docs/specs/006-*/tab-folders.md
// "Agents"): the MCP's change_tabs as one command, one change a run: a tab into a folder or out of one, a folder
// renamed or ungrouped. The run is ../tab-folders.ts, so the CLI and the MCP place tabs alike.

import { z } from 'zod';
import { defineVerb, VerbRefusal, type VerbContext } from '../define';
import type { AgentProduct } from '../product';
import {
  changeTabFolders,
  TAB_FOLDER_NAME_MAX,
  TabFolderStop,
  type FolderedTab,
  type TabFolderChange,
} from '../tab-folders';

// `Ctx` is the product's own context, which the catalogue hands every verb it runs.
export type TabFolderVerbBinding<Ctx extends VerbContext> = {
  product: AgentProduct;
  // The file a command names (its share code applied), with its tabs: each product's `documentOf`.
  fileOf: (ctx: Ctx, ref: string) => Promise<{ id: string; tabs: FolderedTab[] }>;
  // The positional that names the file, as the product's other tab verbs call it (liveplanner's `project`).
  fileKey?: string;
};

const folderName = z.string().trim().min(1).max(TAB_FOLDER_NAME_MAX);

export function createTabFolderVerb<Ctx extends VerbContext>({
  product,
  fileOf,
  fileKey = 'doc',
}: TabFolderVerbBinding<Ctx>) {
  const { cli } = product;
  const fields = {
    tab: z.string().optional().describe('The tab to move, by name or id'),
    folder: folderName.optional().describe('With --tab: the folder to put it in'),
    loose: z.boolean().optional().describe('With --tab: take it out of its folder'),
    rename: folderName.optional().describe('A folder to rename (with --to)'),
    to: folderName.optional().describe('With --rename: its new name'),
    ungroup: folderName.optional().describe('A folder to take every tab out of'),
  };
  // Typed by its fields; the file's key is the product's, read back by name.
  const input = z.object({
    [fileKey]: z.string().describe(`A name, id prefix or ${cli} URL`),
    ...fields,
  }) as unknown as z.ZodObject<typeof fields>;
  const usage = (message: string) =>
    new VerbRefusal({
      status: 400,
      code: 'usage',
      message,
      hint: `${cli} tab folder <doc> --tab <tab> --folder <name>, --tab <tab> --loose, --rename <folder> --to <name>, or --ungroup <folder>`,
    });

  // The one change the flags name.
  function changeOf(input: {
    tab?: string;
    folder?: string;
    loose?: boolean;
    rename?: string;
    to?: string;
    ungroup?: string;
  }): TabFolderChange {
    const moves = input.tab !== undefined;
    const picked = [moves, input.rename !== undefined, input.ungroup !== undefined].filter(Boolean);
    if (picked.length !== 1) throw usage('name one change: --tab, --rename or --ungroup');
    if (moves) {
      if ((input.folder === undefined) === !input.loose)
        throw usage('--tab takes --folder <name> or --loose');
      return { op: 'move', tab: input.tab!, folder: input.folder ?? null };
    }
    if (input.rename !== undefined) {
      if (input.to === undefined) throw usage('--rename takes --to <name>');
      return { op: 'rename_folder', folder: input.rename, to: input.to };
    }
    return { op: 'ungroup', folder: input.ungroup! };
  }

  return defineVerb({
    id: 'tab.folder',
    summary: 'Put a tab in a tab folder, or take it out; rename or ungroup a folder',
    description:
      'Organises the tab bar’s folders as the editor’s Organise in Tab Folder does, one change a run: --tab with --folder puts a tab in a folder (an existing name joins it as its last tab, a new name starts one) and with --loose takes it out; --rename with --to renames a folder, every tab in it; --ungroup takes every tab out of a folder. No other tab moves. Needs an Editor.',
    behaviour: 'write',
    input,
    output: z.object({
      applied: z.array(z.string()),
      tabs: z.array(z.object({ id: z.string(), name: z.string(), folder: z.string().optional() })),
    }),
    run: async (ctx, input) => {
      const change = changeOf(input);
      const ref = (input as Record<string, unknown>)[fileKey] as string;
      const file = await fileOf(ctx as Ctx, ref);
      try {
        return await changeTabFolders(ctx.api, product, file.id, [change], file.tabs);
      } catch (err) {
        if (!(err instanceof TabFolderStop)) throw err;
        const denied = err.message.startsWith('Only an Editor');
        throw new VerbRefusal({
          status: denied ? 403 : 404,
          code: denied ? 'forbidden' : 'not-found',
          message: err.message,
          hint: `${cli} tab ls ${JSON.stringify(ref)} lists the tabs and their folders`,
        });
      }
    },
    text: ({ applied }) => applied,
    cli: {
      positionals: [fileKey],
      examples: [
        `${cli} tab folder "Roadmap" --tab Risks --folder Plans`,
        `${cli} tab folder 3f9c --rename Plans --to Planning`,
      ],
      prints:
        'one line per change: ~ tab "<name>" into folder "<folder>", ~ folder "<a>" renamed "<b>"',
    },
  });
}
