// `link init`, `link status` and `link ls` (docs/specs/027-repositories/repository-link.md "Commands"; blueprint
// "`link init`", "`link status` and `link ls`"), and finding the links a command acts on, checked against the
// profile's host before any request (RL5).

import { posix } from 'node:path';
import {
  documentRows,
  parseDocumentUrl,
  readLibraries,
  REF_MIN_PREFIX,
  resolveDocument,
  shortestUniquePrefixes,
  type FoundDocument,
  type ListedDocument,
  type StatusRow,
  type VerbContext,
} from '@livediagram/agent-verbs';
import type { ConfigFile } from '../config/config-file';
import type { Profile } from '../config/profiles';
import { debugLog } from '../debug';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import { LINK_FILE_NAME } from '../link/constants';
import { readCoverage } from '../link/coverage';
import { linksBelow, nearestLink } from '../link/find-links';
import {
  folderChoices,
  folderNeededError,
  noFoldersError,
  pickFolder,
  type FolderChoice,
} from '../link/folder-picker';
import { gitRemote } from '../link/git';
import { linkFileText, sameHost, type LinkFile, type MirrorLevel } from '../link/link-file';
import { linkStateDir } from '../link/local-state';
import { readRemoteFacts } from '../link/remote';
import { actionLine } from '../link/sync-lines';
import { surveyLink } from '../link/sync-survey';

export type LinkInitInput = { folder?: string; doc?: string[]; level?: MirrorLevel };

// The profile in config.toml whose host is the link's, for the refusal's hint.
function profileFor(config: ConfigFile, host: string): string | null {
  const found = Object.entries(config.profiles).find(([, p]) => {
    try {
      return p.host !== undefined && sameHost(p.host, host);
    } catch {
      return false;
    }
  });
  return found?.[0] ?? null;
}

// The nearest link, or with --all every one below; a link naming another host than the profile's is refused before
// any request, so a self-host link never reaches livediagram.app (RL5).
export async function linksFor(
  io: CliIo,
  all: boolean,
  profile: Profile,
  config: ConfigFile,
  command: string,
): Promise<LinkFile[]> {
  const links = all ? await linksBelow(io, io.cwd) : [await nearestLink(io, io.cwd)];
  for (const link of links) {
    if (link.host === null || sameHost(link.host, profile.host)) continue;
    const name = profileFor(config, link.host);
    throw new CliError({
      exit: EXIT.usage,
      code: 'host_mismatch',
      message: `${link.path} links ${link.host}; this profile is ${profile.host}`,
      hint: name
        ? `livediagram --profile ${name} ${command}`
        : `livediagram --host ${link.host} ${command}`,
    });
  }
  return links;
}

const syncContext = (io: CliIo, ctx: VerbContext): VerbContext => ({
  ...ctx,
  log: debugLog(io, 'sync'),
});

// A folder by its full id, an id prefix, or its name ignoring case (RL26).
function resolveFolder(choices: readonly FolderChoice[], ref: string): FolderChoice {
  const lower = ref.toLowerCase();
  const matches = choices.filter(
    (c) =>
      c.id === ref ||
      (ref.length >= REF_MIN_PREFIX && c.id.startsWith(ref)) ||
      c.path.split('/').at(-1)!.toLowerCase() === lower,
  );
  if (matches.length === 1) return matches[0]!;
  const refs = shortestUniquePrefixes(choices.map((c) => c.id));
  const listed = (list: readonly FolderChoice[]) =>
    list.map((c) => `${refs.get(c.id)}  ${JSON.stringify(c.path)}  ${c.library}`);
  if (matches.length === 0) {
    const nearest = choices.filter((c) => c.path.toLowerCase().includes(lower)).slice(0, 5);
    throw new CliError({
      exit: EXIT.notFound,
      code: 'not_found',
      message: `no folder matches "${ref}"${nearest.length ? '; the nearest:' : ''}`,
      lines: listed(nearest),
      hint: 'livediagram link init, in a terminal, to pick one',
    });
  }
  throw new CliError({
    exit: EXIT.notFound,
    code: 'ambiguous',
    message: `"${ref}" matches ${matches.length} folders`,
    lines: listed(matches),
    hint: `livediagram link init --folder ${refs.get(matches[0]!.id)}`,
  });
}

export async function linkInit(
  io: CliIo,
  ctx: VerbContext,
  input: LinkInitInput,
): Promise<{ path: string }> {
  const log = debugLog(io, 'link');
  const path = posix.join(io.cwd, LINK_FILE_NAME);
  if ((await io.files.read(path)) !== null)
    throw new CliError({
      exit: EXIT.rejected,
      code: 'link_exists',
      message: `${path} already exists`,
      hint: 'edit it, or run link init in another directory',
    });
  const documents: string[] = [];
  for (const doc of input.doc ?? []) {
    const url = parseDocumentUrl(doc, ctx.host);
    if (url && 'shareCode' in url)
      throw new CliError({
        exit: EXIT.usage,
        code: 'usage',
        message: `${doc} is a share link; a link file holds document ids`,
        hint: 'livediagram document ls',
      });
    documents.push((await resolveDocument(ctx.api, doc, ctx.host, ctx.log)).id);
  }
  let folder: string | null = null;
  if (input.folder !== undefined || documents.length === 0) {
    const choices = folderChoices(await readLibraries(ctx.api));
    if (input.folder !== undefined) folder = resolveFolder(choices, input.folder).id;
    else if (choices.length === 0) throw noFoldersError(ctx.host);
    else if (!io.stdinIsTTY || !io.stdoutIsTTY) {
      log('picker refused-not-tty');
      throw folderNeededError(choices, input.level);
    } else folder = (await pickFolder(io, choices, ctx.host, log)).id;
  }
  await io.files.write(
    path,
    linkFileText({
      host: ctx.host,
      folder,
      documents,
      ...(input.level ? { level: input.level } : {}),
    }),
  );
  const remote = await gitRemote(io, io.cwd);
  log(`remote ${remote}`);
  if (remote === 'yes')
    ctx.notice(
      'this repository has a git remote: its mirror files and INDEX.md are as public as the repository; the ids in livediagram.toml grant nothing',
    );
  return { path };
}

// The refusals that belong to a file, not to a document's state.
const FILE_REFUSALS = ['lowered-changed', 'conflicted', 'invalid', 'foreign-host', 'duplicate'];

type StatusLink = { path: string; rows: StatusRow[]; totals: Record<string, number> };

async function statusOf(io: CliIo, ctx: VerbContext, link: LinkFile): Promise<StatusLink> {
  const sync = syncContext(io, ctx);
  const { plan, scan, coverage } = await surveyLink({
    io,
    ctx: sync,
    link,
    host: ctx.host,
    stateDir: await linkStateDir(io, link),
  });
  const base = posix.join(link.root, link.mirror.dir);
  const pathOf = (rel: string) => posix.relative(io.cwd, posix.join(base, rel));
  const filePath = (id: string) => {
    const file = scan.find((s) => s.class === 'tracked' && s.file.document.id === id);
    return file && link.mirror.level === 'files' ? pathOf(file.path) : null;
  };
  const refs = shortestUniquePrefixes([...new Set([...coverage.reachable, ...plan.states.keys()])]);
  const rows: StatusRow[] = [];
  const lc = { pathOf, level: link.mirror.level, relocate: false, linkHost: ctx.host };
  // One row per document the pass decided, in index order; a transient failure is `?`, its failure on stderr (RL43).
  for (const [id, decided] of plan.states) {
    const own = plan.actions.find(
      (a) =>
        a.documentId === id &&
        (a.kind === 'transient' ||
          a.kind === 'held' ||
          (a.kind === 'refuse' && a.reason === 'gone-changed')),
    );
    if (own?.kind === 'transient') io.stderr(`${actionLine(own, lc)}\n`);
    const state =
      own?.kind === 'transient'
        ? '?'
        : own?.kind === 'refuse'
          ? own.reason
          : own?.kind === 'held'
            ? 'held'
            : decided;
    // A held document is named by the broken file that holds it.
    const path = own?.kind === 'held' ? pathOf(own.path) : filePath(id);
    rows.push({ state, ref: refs.get(id)!, name: plan.names.get(id)!, path });
  }
  // Then each file a sync would refuse, report or remove for its level.
  for (const action of plan.actions) {
    if (action.kind === 'lower')
      rows.push({ state: 'lowered', ref: null, name: null, path: pathOf(action.path) });
    if (action.kind === 'report' && action.reason === 'local-new')
      rows.push({ state: 'local-new', ref: null, name: null, path: pathOf(action.path!) });
    if (action.kind === 'refuse' && FILE_REFUSALS.includes(action.reason))
      rows.push({ state: action.reason, ref: null, name: null, path: pathOf(action.path) });
  }
  const totals: Record<string, number> = {};
  for (const row of rows) totals[row.state] = (totals[row.state] ?? 0) + 1;
  return { path: posix.relative(io.cwd, link.path), rows, totals };
}

export async function linkStatus(
  io: CliIo,
  ctx: VerbContext,
  links: readonly LinkFile[],
  all: boolean,
): Promise<{ all: boolean; links: StatusLink[] }> {
  const result: StatusLink[] = [];
  for (const link of links) result.push(await statusOf(io, ctx, link));
  return { all, links: result };
}

export async function linkLs(
  io: CliIo,
  ctx: VerbContext,
  links: readonly LinkFile[],
  limit: number,
): Promise<{ documents: ListedDocument[]; more: number }> {
  const sync = syncContext(io, ctx);
  const found = new Map<string, FoundDocument>();
  const reachable = new Set<string>();
  for (const link of links) {
    const coverage = await readCoverage(sync, link);
    coverage.reachable.forEach((id) => reachable.add(id));
    const unnamed = coverage.documents.filter((d) => d.name === null).map((d) => d.id);
    const facts = await readRemoteFacts(sync, ctx.host, unnamed, new Set());
    for (const d of coverage.documents) {
      const fact = facts.get(d.id);
      if (fact?.kind === 'trashed') continue;
      if (fact?.kind === 'unreadable') {
        io.stderr(`unreadable: ${d.id}\n`);
        continue;
      }
      if (fact?.kind === 'transient') {
        io.stderr(`${d.id}: ${fact.failure}\n`);
        continue;
      }
      const read = fact?.kind === 'readable' ? fact.overview.document : null;
      found.set(d.id, {
        id: d.id,
        name: read?.name ?? d.name!,
        updatedAt: read?.savedAt ?? d.savedAt!,
        library: d.library,
      });
    }
  }
  const all = [...found.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  const refs = shortestUniquePrefixes([...new Set([...reachable, ...found.keys()])]);
  return {
    documents: documentRows(all.slice(0, limit), refs),
    more: Math.max(0, all.length - limit),
  };
}
