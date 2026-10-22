// `pull <doc> [--to <dir>] [--svg]` (docs/specs/015-api/blueprints/cli.md "Pull and push", CLI27): the document and
// every tab with its revision, written as a pull file, each tab kept as a read copy; `--svg` adds a drawing per tab.

import { resolveDocument, tabPath, type VerbContext } from '@livediagram/agent-verbs';
import { DOCUMENT_ENVELOPE_KIND, DOCUMENT_SCHEMA_VERSION } from '@livediagram/document';
import type { CliIo } from '../io';
import { isLocallyChanged } from '../link/sync-state';
import { CliError } from '../output/cli-error';
import { EXIT } from '../output/exit-codes';
import {
  fileSlug,
  idSlug,
  parsePullFile,
  PULL_FILE_SUFFIX,
  pullFileText,
  tabHashes,
  type PullFile,
} from '../sync/pull-file';
import { readDocumentSnapshot } from './snapshot';

export type PullInput = { doc: string; to?: string; svg?: boolean; force?: boolean };

const joinPath = (dir: string, name: string) => `${dir.replace(/\/+$/, '')}/${name}`;

// `<slug>.livediagram.json`, or `<slug>-<id8>` when the file there is another document's (CLI27); `there` is this
// document's pull file already at that path.
async function pullPath(io: CliIo, dir: string, document: { id: string; name: string }) {
  const slug = fileSlug(document.name, document.id);
  const plain = joinPath(dir, `${slug}${PULL_FILE_SUFFIX}`);
  const existing = await io.files.read(plain);
  if (existing === null) return { path: plain, slug, there: null };
  const there = parsePullFile(existing);
  if (there.ok && there.file.document.id === document.id)
    return { path: plain, slug, there: there.file };
  const own = `${slug}-${idSlug(document.id)}`;
  const path = joinPath(dir, `${own}${PULL_FILE_SUFFIX}`);
  const text = await io.files.read(path);
  const parsed = text === null ? null : parsePullFile(text);
  const mine = parsed?.ok && parsed.file.document.id === document.id ? parsed.file : null;
  return { path, slug: own, there: mine };
}

// A pull never drops edits not yet pushed (CLI27a): the file there, changed since its pull, is refused as `sync`
// refuses an ahead document, unless `--force` says to drop them.
async function refuseUnpushed(path: string, file: PullFile | null, input: PullInput) {
  if (!file || input.force) return;
  const hashes: Record<string, { hash: string; settingsHash: string }> = {};
  for (const tab of file.document.tabs) hashes[tab.id] = await tabHashes(tab);
  if (!isLocallyChanged(file, hashes)) return;
  throw new CliError({
    exit: EXIT.rejected,
    code: 'unpushed_changes',
    message: `${path} changed here and is not pushed; not overwritten`,
    hint: `send it: livediagram push ${path}, or drop it: livediagram pull ${JSON.stringify(input.doc)} --force`,
  });
}

export async function pullDocument(
  io: CliIo,
  ctx: VerbContext,
  input: PullInput,
): Promise<{ paths: string[] }> {
  const resolved = await resolveDocument(ctx.api, input.doc, ctx.host, ctx.log);
  if (resolved.shareCode) ctx.useShareCode(resolved.shareCode);
  const { document, tabs, pulled } = await readDocumentSnapshot(ctx, resolved.id);
  const dir = input.to ?? io.cwd;
  await io.files.mkdir(dir);
  const { path, slug, there } = await pullPath(io, dir, document);
  await refuseUnpushed(path, there, input);
  const file: PullFile = {
    kind: DOCUMENT_ENVELOPE_KIND,
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    exportedAt: ctx.now(),
    document: { ...document, tabs },
    livediagramSync: { host: ctx.host, pulledAt: ctx.now(), tabs: pulled },
  };
  await io.files.write(path, pullFileText(file));
  ctx.log(`pull ${document.id} ${tabs.length} tabs`);
  const paths = [path];
  if (input.svg) {
    const taken = new Set<string>();
    for (const tab of tabs) {
      const name = fileSlug(tab.name, tab.id);
      const tabSlug = taken.has(name) ? `${name}-${idSlug(tab.id)}` : name;
      taken.add(tabSlug);
      const { body } = await ctx.api.text(`${tabPath(document.id, tab.id)}/render.svg`);
      const svgPath = joinPath(dir, `${slug}.${tabSlug}.svg`);
      await io.files.write(svgPath, body);
      paths.push(svgPath);
    }
  }
  return { paths };
}
