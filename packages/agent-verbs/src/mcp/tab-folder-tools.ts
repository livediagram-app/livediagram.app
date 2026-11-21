// The MCP's tab folder words (each product's docs/specs/006-*/tab-folders.md "Agents", docs/specs/015-api/mcp-server.md
// "Tab folders"): change_tabs moves tabs into and out of folders, renames and ungroups folders; add_tab's `folder` and
// read_document's `tabs[].folder` are its fields. Each product declares them from here in its own words and id key,
// so the four servers describe tab folders the same way; the run is ../tab-folders.ts over each api's tab-order write.

import { z } from 'zod';
import { wordOf, type AgentProduct } from '../product';
import { TAB_FOLDER_CHANGES_MAX, TAB_FOLDER_NAME_MAX } from '../tab-folders';
import { mcpTool } from './tool';

export function createTabFolderTools<K extends string>(product: AgentProduct, idKey: K) {
  const { cli, collection, noun } = product;
  const word = wordOf(product);
  const folderName = z.string().min(1).max(TAB_FOLDER_NAME_MAX);
  const tab = z
    .string()
    .describe(`The tab, by its id or a name one tab alone has (read_${noun} lists them).`);

  const change = z.discriminatedUnion('op', [
    z.strictObject({
      op: z.literal('move'),
      tab,
      folder: folderName
        .nullable()
        .describe(
          'The folder to put it in: an existing name joins that folder as its last tab, a new name starts one where the tab stands. null takes it out of its folder.',
        ),
    }),
    z.strictObject({
      op: z.literal('rename_folder'),
      folder: folderName.describe('The folder to rename.'),
      to: folderName.describe(
        'Its new name, for every tab in it. A name another folder has joins the two.',
      ),
    }),
    z.strictObject({
      op: z.literal('ungroup'),
      folder: folderName.describe(
        'The folder to empty: every tab in it stays where it is, in no folder.',
      ),
    }),
  ]);

  const changeInput = {
    [idKey]: z.string().describe(`The ${word} (from find_${collection}).`),
    changes: z
      .array(change)
      .min(1)
      .max(TAB_FOLDER_CHANGES_MAX)
      .describe(
        `Up to ${TAB_FOLDER_CHANGES_MAX} changes, applied in order, each seeing the ones before it.`,
      ),
  } as { [P in K]: z.ZodString } & { changes: z.ZodArray<typeof change> };

  // A tab as read_<noun> and change_tabs list it.
  const listedTab = z.object({
    id: z.string().describe('The tab id.'),
    name: z.string().describe('The tab name.'),
    folder: z.string().optional().describe('The tab folder it is in; absent when it is in none.'),
  });

  const changeTabs = mcpTool('change_tabs', {
    behaviour: 'write',
    title: 'Organise tabs in tab folders',
    description:
      `Put a ${word}'s tabs in tab folders (named groups on its tab bar), as the editor's Organise in Tab Folder does: ` +
      'move a tab into a folder (an existing name joins it, a new name starts one) or out of its folder, rename a ' +
      `folder, or ungroup one. read_${noun} shows each tab's folder. No other tab changes place, and everyone with the ` +
      `${word} open sees the change. Only an Editor can change folders.`,
    inputSchema: changeInput,
    outputSchema: {
      applied: z.array(z.string()).describe('One line per change, in order.'),
      tabs: z.array(listedTab).describe(`Every tab of the ${word} after the changes, in order.`),
      url: z.string().describe(`Link that opens the ${word} in the ${cli} editor.`),
    },
  });

  // add_tab's input and output fields.
  const addTabFolder = folderName
    .optional()
    .describe(
      'A tab folder to put the new tab in: an existing name adds it as the folder’s last tab, a new name starts a folder. Without it the tab goes at the end, in no folder.',
    );
  const addedTabFolder = z
    .string()
    .optional()
    .describe('The tab folder the new tab is in, when folder was given.');

  return { changeTabs, addTabFolder, addedTabFolder, listedTab };
}
