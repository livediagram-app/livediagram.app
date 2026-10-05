// `pull <doc> [--to <dir>] [--svg]` (docs/specs/015-api/blueprints/cli.md "Pull and push", CLI27): the document and
// every tab with its revision, written as a pull file, each tab kept as a read copy; `--svg` adds a drawing per tab.

import { documentOf, readPlainTab, tabPath, type VerbContext } from '@livediagram/agent-verbs';
import { DOCUMENT_ENVELOPE_KIND, DOCUMENT_SCHEMA_VERSION } from '@livediagram/document';
import type { CliIo } from '../io';
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

export type PullInput = { doc: string; to?: string; svg?: boolean };

const joinPath = (dir: string, name: string) => `${dir.replace(/\/+$/, '')}/${name}`;

// `<slug>.livediagram.json`, or `<slug>-<id8>` when the file there is another document's (CLI27).
async function pullPath(io: CliIo, dir: string, document: { id: string; name: string }) {
  const slug = fileSlug(document.name, document.id);
  const plain = joinPath(dir, `${slug}${PULL_FILE_SUFFIX}`);
  const existing = await io.files.read(plain);
  if (existing === null) return { path: plain, slug };
  const there = parsePullFile(existing);
  if (there.ok && there.file.document.id === document.id) return { path: plain, slug };
  const own = `${slug}-${idSlug(document.id)}`;
  return { path: joinPath(dir, `${own}${PULL_FILE_SUFFIX}`), slug: own };
}

export async function pullDocument(
  io: CliIo,
  ctx: VerbContext,
  input: PullInput,
): Promise<{ paths: string[] }> {
  const document = await documentOf(ctx, input.doc);
  const ordered = [...document.tabs].sort((a, b) => a.orderIndex - b.orderIndex);
  const tabs: PullFile['document']['tabs'] = [];
  const pulled: PullFile['livediagramSync']['tabs'] = {};
  for (const summary of ordered) {
    const copy = await readPlainTab(ctx, document.id, summary.id);
    if (!copy)
      throw new CliError({
        exit: EXIT.failure,
        code: 'no_revision',
        message: `the host named no revision for tab ${JSON.stringify(summary.name)}`,
      });
    await ctx.copies?.record(document.id, summary.id, copy);
    tabs.push({ ...copy.tab, ...(summary.folder ? { folder: summary.folder } : {}) });
    pulled[summary.id] = { rev: copy.rev, ...(await tabHashes(copy.tab)) };
  }
  const dir = input.to ?? io.cwd;
  await io.files.mkdir(dir);
  const { path, slug } = await pullPath(io, dir, document);
  const file: PullFile = {
    kind: DOCUMENT_ENVELOPE_KIND,
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    exportedAt: ctx.now(),
    document: { id: document.id, name: document.name, presentation: document.presentation, tabs },
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
