// The MCP's Archived tools (docs/specs/015-api/mcp-server.md "Archived"; the index's
// liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Archived"): archive_<noun> puts a file its owner made
// away, unarchive_<noun> moves it back, and find_<collection>'s `archived` lists what is there. Each product declares
// them from here with its own words and id key, so the four servers describe Archived the same way; the handlers are
// each MCP's, over its api's `POST /api/<collection>/:id/archive` and `/unarchive`.

import { z } from 'zod';
import { wordOf, wordsOf, type AgentProduct } from '../product';
import { mcpTool } from './tool';

export function createArchiveTools<K extends string>(product: AgentProduct, idKey: K) {
  const { cli, noun, collection } = product;
  const word = wordOf(product);
  const words = wordsOf(product);
  const id = z.string().describe(`The ${word} id.`);
  const url = z.string().describe(`Link that opens the ${word} in the ${cli} editor.`);
  const name = z.string().nullable().describe(`The ${word} name, or null if unknown.`);
  const library = z
    .string()
    .describe('Where it is now: "personal", or the name of the team whose library holds it.');

  const archiveInput = {
    [idKey]: z.string().describe(`The ${word} to archive (from find_${collection}).`),
  } as { [P in K]: z.ZodString };

  const unarchiveInput = {
    [idKey]: z
      .string()
      .describe(`The archived ${word} to move out (from find_${collection} with archived true).`),
    folderId: z
      .string()
      .optional()
      .describe(
        'A folder to move it into. A folder in a team library needs that team as teamId too. Without folderId or teamId it goes to the top of the personal library.',
      ),
    teamId: z
      .string()
      .optional()
      .describe('A team the user belongs to, to move it into that team’s library.'),
  } as { [P in K]: z.ZodString } & {
    folderId: z.ZodOptional<z.ZodString>;
    teamId: z.ZodOptional<z.ZodString>;
  };

  const archive = mcpTool(`archive_${noun}`, {
    behaviour: 'destructive',
    title: `Archive a ${word}`,
    description:
      `Move a ${word} the user owns to their Archived. It leaves every list (theirs and their teams'), its ` +
      'share links stop working, and its favourites, Recent and Most Used entries and Inbox threads are removed ' +
      `for everyone. While archived it can't be read or changed; unarchive_${noun} moves it back. Only its owner ` +
      `can archive it, and a ${word} in the Trash is restored first. Confirm with the user first.`,
    inputSchema: archiveInput,
    outputSchema: {
      archived: z.literal(noun).describe(`Always "${noun}".`),
      id,
      name,
    },
  });

  const unarchive = mcpTool(`unarchive_${noun}`, {
    behaviour: 'write',
    title: `Move a ${word} out of Archived`,
    description:
      `Move an archived ${word} back: to the top of the user's personal library, or into the folder or team ` +
      `named. It opens again, starting fresh: the share links, favourites and Recent entries it had are gone. ` +
      `find_${collection} with archived true lists the archived ${words}.`,
    inputSchema: unarchiveInput,
    outputSchema: {
      unarchived: z.literal(noun).describe(`Always "${noun}".`),
      id,
      name,
      library,
      url,
    },
  });

  // What find_<collection> takes and answers besides its own fields.
  const findArchived = z
    .boolean()
    .optional()
    .describe(
      `true: only the user's archived ${words} (archived ones are never listed otherwise). Each can be moved back with unarchive_${noun}.`,
    );
  const foundArchived = z
    .literal(true)
    .optional()
    .describe(`Present when the ${word} is archived: unarchive_${noun} moves it out.`);

  return { archive, unarchive, findArchived, foundArchived };
}
