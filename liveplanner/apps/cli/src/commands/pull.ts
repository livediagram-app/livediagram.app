// `pull <project> [--to <dir>] [--svg]` (docs/specs/015-api/blueprints/cli.md "Pull and push", CLI27): the project and
// every tab with its revision, written as a pull file, each tab kept as a read copy; `--svg` adds a drawing per tab.

import { resolveProject, tabPath, type VerbContext } from '@liveplanner/agent-verbs';
import { PROJECT_ENVELOPE_KIND, PROJECT_SCHEMA_VERSION } from '@liveplanner/project';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import {
  fileSlug,
  idSlug,
  isLocallyChanged,
  parsePullFile,
  PULL_FILE_SUFFIX,
  pullFileText,
  tabHashes,
  type PullFile,
} from '../sync/pull-file';
import { readProjectSnapshot } from './snapshot';

export type PullInput = { project: string; to?: string; svg?: boolean; force?: boolean };

const joinPath = (dir: string, name: string) => `${dir.replace(/\/+$/, '')}/${name}`;

// `<slug>.liveplanner.json`, or `<slug>-<id8>` when the file there is another project's (CLI27); `there` is this
// project's pull file already at that path.
async function pullPath(io: CliIo, dir: string, project: { id: string; name: string }) {
  const slug = fileSlug(project.name, project.id);
  const plain = joinPath(dir, `${slug}${PULL_FILE_SUFFIX}`);
  const existing = await io.files.read(plain);
  if (existing === null) return { path: plain, slug, there: null };
  const there = parsePullFile(existing);
  if (there.ok && there.file.project.id === project.id)
    return { path: plain, slug, there: there.file };
  const own = `${slug}-${idSlug(project.id)}`;
  const path = joinPath(dir, `${own}${PULL_FILE_SUFFIX}`);
  const text = await io.files.read(path);
  const parsed = text === null ? null : parsePullFile(text);
  const mine = parsed?.ok && parsed.file.project.id === project.id ? parsed.file : null;
  return { path, slug: own, there: mine };
}

// A pull never drops edits not yet pushed (CLI27a): the file there, changed since its pull, is refused unless
// `--force` says to drop them.
async function refuseUnpushed(path: string, file: PullFile | null, input: PullInput) {
  if (!file || input.force) return;
  const hashes: Record<string, { hash: string; settingsHash: string }> = {};
  for (const tab of file.project.tabs) hashes[tab.id] = await tabHashes(tab);
  if (!isLocallyChanged(file, hashes)) return;
  throw new CliError({
    exit: EXIT.rejected,
    code: 'unpushed_changes',
    message: `${path} changed here and is not pushed; not overwritten`,
    hint: `send it: liveplanner push ${path}, or drop it: liveplanner pull ${JSON.stringify(input.project)} --force`,
  });
}

export async function pullProject(
  io: CliIo,
  ctx: VerbContext,
  input: PullInput,
): Promise<{ paths: string[] }> {
  const resolved = await resolveProject(ctx.api, input.project, ctx.host, ctx.log);
  if (resolved.shareCode) ctx.useShareCode(resolved.shareCode);
  const { project, tabs, pulled } = await readProjectSnapshot(ctx, resolved.id);
  const dir = input.to ?? io.cwd;
  await io.files.mkdir(dir);
  const { path, slug, there } = await pullPath(io, dir, project);
  await refuseUnpushed(path, there, input);
  const file: PullFile = {
    kind: PROJECT_ENVELOPE_KIND,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    exportedAt: ctx.now(),
    project: { ...project, tabs },
    liveplannerSync: { host: ctx.host, pulledAt: ctx.now(), tabs: pulled },
  };
  await io.files.write(path, pullFileText(file));
  ctx.log(`pull ${project.id} ${tabs.length} tabs`);
  const paths = [path];
  if (input.svg) {
    const taken = new Set<string>();
    for (const tab of tabs) {
      const name = fileSlug(tab.name, tab.id);
      const tabSlug = taken.has(name) ? `${name}-${idSlug(tab.id)}` : name;
      taken.add(tabSlug);
      const { body } = await ctx.api.text(`${tabPath(project.id, tab.id)}/render.svg`);
      const svgPath = joinPath(dir, `${slug}.${tabSlug}.svg`);
      await io.files.write(svgPath, body);
      paths.push(svgPath);
    }
  }
  return { paths };
}
