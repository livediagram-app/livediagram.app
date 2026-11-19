// A link file's infrastructure `[[sources]]` (docs/specs/027-repositories/diagram-sources.md "Infrastructure sources
// in the link file"; blueprint infrastructure-import.md "The CLI"): each entry binds files to the tab they feed, and
// `link from-code` with nothing named updates every one of those tabs from its files, carrying on past a refusal.

import { posix } from 'node:path';
import type { VerbContext } from '@livediagram/agent-verbs';
import { EXIT } from '@liveworkspace/cli-kit/exit-codes';
import type { DebugLog } from '../debug';
import type { CliIo } from '../io';
import { nearestLink } from '../link/find-links';
import { sameHost, type LinkFile } from '../link/link-file';
import { CliError, formatError, type CliFailure } from '../output/cli-error';
import { failureOf } from '../output/failure-of';
import { updateFromCode } from './from-code-update';

export type LinkSource = { files: string[]; doc: string; tab: string; env?: string };

const ENTRY_KEYS = ['files', 'tab', 'env'];

const wrong = (link: LinkFile, message: string, hint?: string) =>
  new CliError({
    exit: EXIT.usage,
    code: 'wrong_type',
    message: `${link.path}: ${message}`,
    ...(hint ? { hint } : {}),
  });

/** The link's infrastructure entries, each checked; an entry with `path` alone is another bridge's, left unread. */
export function linkSourcesOf(link: LinkFile): LinkSource[] {
  const out: LinkSource[] = [];
  link.sources.forEach((entry, i) => {
    if (entry.files === undefined) return;
    const at = `sources[${i}]`;
    for (const key of Object.keys(entry))
      if (!ENTRY_KEYS.includes(key))
        throw new CliError({
          exit: EXIT.usage,
          code: 'unknown_key',
          message: `${link.path}: unknown key "${at}.${key}"`,
          hint: `the keys of an infrastructure source: ${ENTRY_KEYS.join(', ')}`,
        });
    const { files, tab, env } = entry;
    if (!Array.isArray(files) || files.length === 0 || !files.every((f) => typeof f === 'string'))
      throw wrong(link, `${at}.files must be a non-empty array of strings`);
    for (const file of files) {
      const normal = posix.normalize(file);
      if (posix.isAbsolute(normal) || normal === '..' || normal.startsWith('../'))
        throw new CliError({
          exit: EXIT.rejected,
          code: 'invalid_dir',
          message: `${link.path}: ${at}.files holds "${file}", outside ${link.root}`,
        });
    }
    const slash = typeof tab === 'string' ? tab.indexOf('/') : -1;
    if (typeof tab !== 'string' || slash <= 0 || slash === tab.length - 1)
      throw wrong(link, `${at}.tab must be <document>/<tab>`, 'tab = "doc_3h9x2a/0b34"');
    if (env !== undefined && typeof env !== 'string')
      throw wrong(link, `${at}.env must be a string`);
    out.push({
      files: files.map((f) => posix.normalize(f)),
      doc: tab.slice(0, slash),
      tab: tab.slice(slash + 1),
      ...(env !== undefined ? { env } : {}),
    });
  });
  return out;
}

// The nearest link, or null when there is none here.
async function linkHere(io: CliIo): Promise<LinkFile | null> {
  try {
    return await nearestLink(io, io.cwd);
  } catch (err) {
    if (err instanceof CliError && err.failure.code === 'no_link') return null;
    throw err;
  }
}

/** Every tab the nearest link binds to files, updated; null when no link here binds any (the caller reads this directory). */
// Only a run with no `--dry-run` comes here (blueprint "The CLI": a dry run is offline), so every update is sent.
export async function runLinkSources(io: CliIo, ctx: VerbContext, log: DebugLog) {
  const link = await linkHere(io);
  const entries = link ? linkSourcesOf(link) : [];
  if (!link || entries.length === 0) return null;
  if (link.host !== null && !sameHost(link.host, ctx.host))
    throw new CliError({
      exit: EXIT.usage,
      code: 'host_mismatch',
      message: `${link.path} links ${link.host}; this profile is ${ctx.host}`,
      hint: `livediagram --host ${link.host} link from-code`,
    });
  log(`[from-code] link ${entries.length} sources`);
  // The entries' paths are the link file's, wherever the command runs.
  const atRoot: CliIo = { ...io, cwd: link.root };
  const texts: string[] = [];
  let first: CliFailure | null = null;
  let failed = 0;
  for (const entry of entries) {
    io.stderr(`${entry.doc}/${entry.tab}:\n`);
    try {
      const out = await updateFromCode(
        atRoot,
        ctx,
        {
          files: entry.files,
          doc: entry.doc,
          tab: entry.tab,
          ...(entry.env !== undefined ? { env: entry.env } : {}),
        },
        log,
      );
      texts.push(out.text);
    } catch (err) {
      const failure = failureOf(err, ctx.host);
      io.stderr(formatError(failure, false));
      first ??= failure;
      failed += 1;
    }
  }
  if (first)
    throw new CliError({
      exit: first.exit,
      code: first.code,
      message: `${failed} of ${entries.length} sources in ${link.path} were not updated`,
    });
  return { text: texts.join('\n'), id: null, dryRun: false, graph: null };
}
