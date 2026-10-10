// `link init`'s folder picker (docs/specs/027-repositories/blueprints/repository-link.md "The folder picker"): on a
// terminal, a numbered list on stderr and one typed line at a time in the terminal's own line editing (RL35); a
// number chooses, other text narrows, Enter alone, end of input or Ctrl-C cancels. Never redrawn, so a screen reader
// reads each list once. Where stdin or stdout is not a terminal, the folders as runnable commands instead (RL39).

import type { Libraries } from '@livediagram/agent-verbs';
import type { Folder } from '@livediagram/api-schema';
import type { DebugLog } from '../debug';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import { PICKER_PAGE } from './constants';

export type FolderChoice = { id: string; path: string; library: string };

const byName = (a: { name: string }, b: { name: string }) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

// One library's tree, depth first, siblings by name.
function treeOf(folders: readonly Folder[], library: string): FolderChoice[] {
  const walk = (parentId: string | null, prefix: string): FolderChoice[] =>
    folders
      .filter((f) => f.parentId === parentId)
      .sort(byName)
      .flatMap((f) => {
        const path = `${prefix}${f.name}`;
        return [{ id: f.id, path, library }, ...walk(f.id, `${path}/`)];
      });
  return walk(null, '');
}

// The personal folders, then each joined team's, teams in name order.
export function folderChoices(libraries: Libraries): FolderChoice[] {
  return [
    ...treeOf(libraries.personal.folders, 'personal'),
    ...[...libraries.teams].sort(byName).flatMap((t) => treeOf(t.folders, t.name)),
  ];
}

export const noFoldersError = (host: string) =>
  new CliError({
    exit: EXIT.notFound,
    code: 'no_folders',
    message: `there are no folders in ${host} to link`,
    hint: 'create a folder in livediagram, or link documents: livediagram link init --doc <doc>',
  });

export function folderNeededError(choices: readonly FolderChoice[], level?: string): CliError {
  const command = (id: string) =>
    `livediagram link init --folder ${id}${level ? ` --level ${level}` : ''}`;
  const shown = choices.slice(0, PICKER_PAGE);
  const more = choices.length - shown.length;
  return new CliError({
    exit: EXIT.usage,
    code: 'folder_needed',
    message: 'link init needs --folder or --doc when it is not run in a terminal',
    lines: [
      ...shown.map((c) => `${command(c.id)}  # ${c.path} (${c.library})`),
      ...(more > 0
        ? [`… ${more} more: livediagram link init --folder <name> takes a folder's name too`]
        : []),
    ],
    hint: command(shown[0]!.id),
  });
}

const cancelled = () =>
  new CliError({ exit: EXIT.rejected, code: 'cancelled', message: 'cancelled; nothing written' });

const PROMPT =
  'Link which folder? Type its number, or part of its name to narrow. Enter on its own cancels.';

function listText(heading: string, list: readonly FolderChoice[]): string {
  const shown = list.slice(0, PICKER_PAGE);
  const width = Math.max(...shown.map((c) => c.path.length));
  const more = list.length - shown.length;
  return [
    heading,
    ...shown.map((c, i) => `${String(i + 1).padStart(4)}  ${c.path.padEnd(width)}  ${c.library}`),
    ...(more > 0 ? [`… ${more} more; type part of a name to narrow`] : []),
    PROMPT,
    '',
  ].join('\n');
}

export async function pickFolder(
  io: CliIo,
  choices: readonly FolderChoice[],
  host: string,
  log: DebugLog,
): Promise<FolderChoice> {
  let interrupted!: () => void;
  const interrupt = new Promise<null>((resolve) => (interrupted = () => resolve(null)));
  const stop = io.onInterrupt(() => interrupted());
  try {
    let list = choices;
    const all = `Folders in ${host}`;
    io.stderr(listText(all, list));
    log(`picker shown ${Math.min(list.length, PICKER_PAGE)}`);
    for (;;) {
      const answer = (await Promise.race([io.readLine('folder> '), interrupt]))?.trim();
      if (!answer) {
        log('picker cancelled');
        throw cancelled();
      }
      const shown = Math.min(list.length, PICKER_PAGE);
      if (/^\d+$/.test(answer)) {
        const n = Number(answer);
        if (n >= 1 && n <= shown) {
          const chosen = list[n - 1]!;
          log('picker chosen');
          io.stderr(`linking "${chosen.path}" (${chosen.library})\n`);
          return chosen;
        }
        io.stderr(`no folder ${answer} in this list; type 1 to ${shown}\n`);
        continue;
      }
      const narrowed = choices.filter((c) => c.path.toLowerCase().includes(answer.toLowerCase()));
      if (narrowed.length === 0) {
        io.stderr(`no folder matches "${answer}"\n`);
        list = choices;
        io.stderr(listText(all, list));
        log(`picker shown ${Math.min(list.length, PICKER_PAGE)}`);
        continue;
      }
      list = narrowed;
      io.stderr(listText(`Folders matching "${answer}"`, list));
      log(`picker narrowed ${list.length}`);
    }
  } finally {
    stop();
  }
}
