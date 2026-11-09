// The Archived verbs (docs/specs/015-api/cli.md "Commands": `<noun> archive`, `<noun> unarchive`; the index's
// liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Archived"): the CLI's twins of the MCP's
// archive_<noun> and unarchive_<noun>. Archiving puts a file its owner made away, out of every list and every way
// anyone else had in; unarchiving moves it back, to the top of My Work or to the folder or team named. An archived
// file reads as missing to the live sweep, so `unarchive` names it from the Archived list, as `restore` names one
// from the Trash.

import { z } from 'zod';
import type { ApiClient } from '@liveworkspace/api-client';
import { defineVerb, VerbRefusal } from '../define';
import type { FoundFile, SearchOptions } from '../find';
import { createFolderRefs, folderChoices, type FolderLibraries } from '../folders';
import { wordOf, wordsOf, type AgentProduct } from '../product';
import { REF_MIN_PREFIX, shortestUniquePrefixes } from '../refs';

// The most the Archived list is read for a name: one page at the index (LIST_LIMIT_MAX).
export const ARCHIVED_READ_MAX = 200;

// What a file ref prints as: eight characters of its id, as every lifecycle line does.
const REF_LENGTH = 8;

export type ArchiveVerbsBinding = {
  product: AgentProduct;
  // The input key the file's positional takes (`doc`, `project`), as the product's other lifecycle verbs name it.
  arg: string;
  // The product's addressing (./addressing `resolveFile`): a name, id prefix or link of a live file.
  resolveFile: (
    api: ApiClient,
    input: string,
    host: string,
    log: (line: string) => void,
  ) => Promise<{ id: string; name: string }>;
  // The product's search (./find `searchFiles`), asked for the Archived alone.
  searchFiles: (
    api: ApiClient,
    query: string | undefined,
    limit: number,
    options?: SearchOptions,
  ) => Promise<FoundFile[]>;
  // The product's library sweep (./find `readLibraries`), for `--folder` and `--team`.
  readLibraries: (api: ApiClient) => Promise<FolderLibraries>;
};

const lineOutput = z.object({ text: z.string(), id: z.string() });
const lineText = ({ text }: { text: string }) => [text];
const quietId = ({ id }: { id: string }) => [id];

export function createArchiveVerbs({
  product,
  arg,
  resolveFile,
  searchFiles,
  readLibraries,
}: ArchiveVerbsBinding) {
  const { cli, noun, collection } = product;
  const word = wordOf(product);
  const resolveFolderRef = createFolderRefs(product);
  const refOf = (id: string) => id.slice(0, REF_LENGTH);
  const door = (id: string, to: 'archive' | 'unarchive') =>
    `/${collection}/${encodeURIComponent(id)}/${to}`;
  const refOfInput = (input: Record<string, unknown>) => input[arg] as string;

  // The one archived file a reference names: its id, an id prefix, or its whole name ignoring case.
  async function archivedFileOf(api: ApiClient, ref: string): Promise<FoundFile> {
    const archived = await searchFiles(api, undefined, ARCHIVED_READ_MAX, { archived: true });
    const lower = ref.toLowerCase();
    const matches = archived.filter(
      (f) =>
        f.id === ref ||
        (ref.length >= REF_MIN_PREFIX && f.id.startsWith(ref)) ||
        f.name.toLowerCase() === lower,
    );
    if (matches.length === 1) return matches[0]!;
    const refs = shortestUniquePrefixes(archived.map((f) => f.id));
    throw new VerbRefusal({
      status: 404,
      code: matches.length ? 'ambiguous' : 'not_found',
      message: matches.length
        ? `"${ref}" matches ${matches.length} ${wordsOf(product)} in Archived`
        : `nothing in Archived matches "${ref}"`,
      lines: (matches.length ? matches : archived.slice(0, 5)).map(
        (f) => `${refs.get(f.id)}  ${JSON.stringify(f.name)}  ${f.library}`,
      ),
      hint: `${cli} ${noun} ls --archived`,
    });
  }

  // Where an unarchive goes: a folder (its team's, when it is a team's), a team's top, or the top of My Work.
  async function destinationOf(
    api: ApiClient,
    input: { folder?: string; team?: string },
  ): Promise<{ folderId: string | null; teamId: string | null; where: string }> {
    if (input.folder === undefined && input.team === undefined)
      return { folderId: null, teamId: null, where: 'My Work' };
    const libraries = await readLibraries(api);
    if (input.folder !== undefined) {
      const folder = resolveFolderRef(folderChoices(libraries), input.folder, '--folder');
      if (input.team !== undefined && folder.teamId === null)
        throw new VerbRefusal({
          status: 400,
          code: 'usage',
          message: `the folder "${folder.path}" is in My Work, not a team`,
          hint: `${cli} ${noun} unarchive <${arg}> --folder ${refOf(folder.id)}`,
        });
      return { folderId: folder.id, teamId: folder.teamId, where: folder.path };
    }
    const lower = input.team!.toLowerCase();
    const team = libraries.teams.find((t) => t.id === input.team || t.name.toLowerCase() === lower);
    if (!team)
      throw new VerbRefusal({
        status: 404,
        code: 'not_found',
        message: `you are in no team "${input.team}"`,
        lines: libraries.teams.map((t) => `${t.id}  ${JSON.stringify(t.name)}`),
        hint: `${cli} folder ls`,
      });
    return { folderId: null, teamId: team.id, where: team.name };
  }

  const archive = defineVerb({
    id: `${noun}.archive`,
    summary: `Put a ${word} away in Archived`,
    description: `Moves a ${word} you own to your Archived: out of every list, its share links ended and its favourites, Recent and Inbox entries gone for everyone. It can't be opened or changed there until ${noun} unarchive moves it out.`,
    behaviour: 'destructive',
    input: z.object({ [arg]: z.string().describe(`A name, id prefix or link of a ${word}`) }),
    output: lineOutput,
    run: async (ctx, input) => {
      const file = await resolveFile(ctx.api, refOfInput(input), ctx.host, ctx.log);
      await ctx.api.json(door(file.id, 'archive'), { method: 'POST' });
      return {
        id: file.id,
        text: `- ${noun} ${refOf(file.id)} ${JSON.stringify(file.name)} · in Archived · unarchive: ${cli} ${noun} unarchive ${file.id}`,
      };
    },
    text: lineText,
    quiet: quietId,
    cli: {
      positionals: [arg],
      examples: [`${cli} ${noun} archive "Old plan"`, `${cli} ${noun} archive 3f9c`],
      prints: `- ${noun} <ref> "<name>" · in Archived · the unarchive command`,
    },
  });

  const unarchive = defineVerb({
    id: `${noun}.unarchive`,
    summary: `Move a ${word} out of Archived`,
    description: `Moves a ${word} out of your Archived, to the top of My Work, or into the folder --folder names (a team's folder files it in that team) or the top of the team --team names. It opens again, with no share links, favourites or Recent entries from before.`,
    behaviour: 'write',
    input: z.object({
      [arg]: z.string().describe(`A name or id prefix of a ${word} in Archived`),
      folder: z.string().optional().describe('A folder to move it into: its id, id prefix or name'),
      team: z.string().optional().describe('A team to move it into: its id or name'),
    }),
    output: lineOutput,
    run: async (ctx, input) => {
      const file = await archivedFileOf(ctx.api, refOfInput(input));
      const to = await destinationOf(ctx.api, input);
      await ctx.api.json(door(file.id, 'unarchive'), {
        method: 'POST',
        body: JSON.stringify({ folderId: to.folderId, teamId: to.teamId }),
      });
      return {
        id: file.id,
        text: `+ ${noun} ${refOf(file.id)} ${JSON.stringify(file.name)} out of Archived · in ${to.where}`,
      };
    },
    text: lineText,
    quiet: quietId,
    cli: {
      positionals: [arg],
      examples: [
        `${cli} ${noun} unarchive "Old plan"`,
        `${cli} ${noun} unarchive 3f9c2a71 --folder Projects`,
      ],
      prints: `+ ${noun} <ref> "<name>" out of Archived · in <where>`,
    },
  });

  return { archive, unarchive, archivedFileOf };
}
