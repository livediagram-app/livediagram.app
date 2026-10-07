// Finding the link (docs/specs/027-repositories/blueprints/repository-link.md "Finding the link"): the nearest
// livediagram.toml at or above the working directory, or with --all every one below it, walked depth first in
// byte order of names, skipping `.git`, `node_modules` and dot-directories, never following a symbolic link (RL4).

import { posix } from 'node:path';
import { debugLog } from '../debug';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import { LINK_FILE_NAME } from './constants';
import { parseLinkFile, type LinkFile } from './link-file';

const noLink = (cwd: string, where: 'above' | 'below') =>
  new CliError({
    exit: EXIT.notFound,
    code: 'no_link',
    message: `no ${LINK_FILE_NAME} in ${cwd} or ${where}`,
    hint: 'livediagram link init --folder <folder>',
  });

const isInside = (root: string, path: string) => path === root || path.startsWith(`${root}/`);

// The real path of the mirror directory, or of its nearest existing ancestor, stays inside the link root (E18).
async function checkMirrorDir(io: CliIo, link: LinkFile): Promise<void> {
  for (let at = posix.join(link.root, link.mirror.dir); ; at = posix.dirname(at)) {
    const real = await io.files.realpath(at);
    if (real === null) continue;
    if (isInside(link.root, real)) return;
    throw new CliError({
      exit: EXIT.rejected,
      code: 'invalid_dir',
      message: `${link.path}: mirror.dir must stay inside ${link.root}, not "${link.mirror.dir}"`,
    });
  }
}

// The link file at `path`, read through its real path; null when there is none.
async function readLink(io: CliIo, path: string): Promise<LinkFile | null> {
  const text = await io.files.read(path);
  if (text === null) return null;
  const link = parseLinkFile(text, (await io.files.realpath(path))!);
  await checkMirrorDir(io, link);
  debugLog(
    io,
    'sync',
  )(`link unread: hooks block ${link.hooks.block}, ${link.sources.length} sources`);
  return link;
}

export async function nearestLink(io: CliIo, cwd: string): Promise<LinkFile> {
  for (let dir = cwd; ; dir = posix.dirname(dir)) {
    const link = await readLink(io, posix.join(dir, LINK_FILE_NAME));
    if (link) return link;
    if (dir === '/') throw noLink(cwd, 'above');
  }
}

const SKIPPED = new Set(['.git', 'node_modules']);
export const isWalked = (name: string) => !SKIPPED.has(name) && !name.startsWith('.');
// Names in one directory differ: they never compare equal.
export const byName = (a: { name: string }, b: { name: string }) => (a.name < b.name ? -1 : 1);

export async function linksBelow(io: CliIo, cwd: string): Promise<LinkFile[]> {
  const found: LinkFile[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = (await io.files.list(dir)) ?? [];
    for (const entry of [...entries].sort(byName)) {
      const path = posix.join(dir, entry.name);
      if (entry.kind === 'file' && entry.name === LINK_FILE_NAME)
        found.push((await readLink(io, path))!);
      else if (entry.kind === 'dir' && isWalked(entry.name)) await walk(path);
    }
  };
  await walk(cwd);
  if (found.length === 0) throw noLink(cwd, 'below');
  return found;
}
