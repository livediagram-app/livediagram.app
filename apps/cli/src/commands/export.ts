// `export --all --to <dir> [--format json,svg,mermaid,md]` (docs/specs/015-api/blueprints/cli.md "Pull and push",
// CLI29): every document the token can read, written read-only for backups and docs. `json` is the editor's
// `livediagram.document` envelope; the other formats are one file per tab under `<slug>/`. Two documents at a time;
// a rate-limited read waits a minute and tries again, up to three times. A document that fails is reported and the
// rest still go (CLI84).

import {
  EXPORT_FORMATS,
  listAllDocuments,
  tabPath,
  type VerbContext,
} from '@livediagram/agent-verbs';
import { ApiError } from '@livediagram/api-client';
import type { DocumentResponse } from '@livediagram/api-schema';
import {
  documentToEnvelopeText,
  mermaidFromTab,
  tabToMarkdownText,
  type EnvelopeTab,
  type Tab,
} from '@livediagram/document';
import type { CliIo } from '../io';
import { CliError, formatError } from '../output/cli-error';
import { EXIT, type ExitCode } from '../output/exit-codes';
import { failureOf } from '../output/failure-of';
import { fileSlug, idSlug, PULL_FILE_SUFFIX } from '../sync/pull-file';

export const EXPORT_CONCURRENCY = 2;
export const EXPORT_RATE_RETRY_MS = 60_000;
export const EXPORT_RATE_RETRIES = 3;

type ExportFormat = (typeof EXPORT_FORMATS)[number];
export type ExportInput = { all?: boolean; to: string; format: string };

const isFormat = (value: string): value is ExportFormat =>
  EXPORT_FORMATS.some((format) => format === value);

function formatsOf(list: string): ExportFormat[] {
  const asked = list
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  const unknown = asked.filter((f) => !isFormat(f));
  if (unknown.length > 0 || asked.length === 0)
    throw new CliError({
      exit: EXIT.usage,
      code: 'usage',
      message: `unknown format ${unknown[0] ?? '(none)'}`,
      hint: `--format takes ${EXPORT_FORMATS.join(', ')}`,
    });
  return [...new Set(asked.filter(isFormat))];
}

// A read, waiting out the token's rate limit: a 429 is tried again after a minute, at most three times (E24).
async function patiently<T>(ctx: VerbContext, read: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await read();
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 429 || attempt >= EXPORT_RATE_RETRIES)
        throw err;
      ctx.log(`export rate limited, retry ${attempt + 1} in ${EXPORT_RATE_RETRY_MS} ms`);
      await ctx.sleep(EXPORT_RATE_RETRY_MS);
    }
  }
}

// Names unique among their siblings: a name two of them share gets each one's short id after it, or its whole id
// when the short ids are alike too (CLI27).
function uniqueSlugs(items: readonly { id: string; name: string }[]): Map<string, string> {
  const shared = (named: readonly { id: string; slug: string }[]) => {
    const count = new Map<string, number>();
    for (const { slug } of named) count.set(slug, (count.get(slug) ?? 0) + 1);
    return (slug: string) => count.get(slug)! > 1;
  };
  const plain = items.map((item) => ({ id: item.id, slug: fileSlug(item.name, item.id) }));
  const clashes = shared(plain);
  const short = plain.map(({ id, slug }) => ({
    id,
    base: slug,
    slug: clashes(slug) ? `${slug}-${idSlug(id)}` : slug,
  }));
  const stillClashes = shared(short);
  return new Map(
    short.map(({ id, base, slug }) => [id, stillClashes(slug) ? `${base}-${id}` : slug]),
  );
}

const joinPath = (dir: string, name: string) => `${dir.replace(/\/+$/, '')}/${name}`;

const TAB_FILES: Record<Exclude<ExportFormat, 'json'>, string> = {
  svg: 'svg',
  mermaid: 'mmd',
  md: 'md',
};

async function exportDocument(
  io: CliIo,
  ctx: VerbContext,
  documentId: string,
  slug: string,
  dir: string,
  formats: readonly ExportFormat[],
): Promise<string[]> {
  const { document } = await patiently(ctx, () =>
    ctx.api.json<DocumentResponse>(`/documents/${encodeURIComponent(documentId)}`),
  );
  const ordered = [...document.tabs].sort((a, b) => a.orderIndex - b.orderIndex);
  const tabs: EnvelopeTab[] = [];
  for (const summary of ordered) {
    const { tab } = await patiently(ctx, () =>
      ctx.api.json<{ tab: Tab }>(tabPath(document.id, summary.id)),
    );
    tabs.push({ ...tab, ...(summary.folder ? { folder: summary.folder } : {}) });
  }
  const written: string[] = [];
  const write = async (path: string, data: string) => {
    await io.files.write(path, data);
    written.push(path);
  };
  if (formats.includes('json')) {
    const text = documentToEnvelopeText(document, tabs, ctx.now());
    await write(joinPath(dir, `${slug}${PULL_FILE_SUFFIX}`), `${text}\n`);
  }
  const perTab = formats.filter((f): f is Exclude<ExportFormat, 'json'> => f !== 'json');
  if (perTab.length === 0) return written;
  const tabDir = joinPath(dir, slug);
  await io.files.mkdir(tabDir);
  const tabSlugs = uniqueSlugs(tabs);
  for (const tab of tabs) {
    const base = joinPath(tabDir, tabSlugs.get(tab.id)!);
    for (const format of perTab) {
      const path = `${base}.${TAB_FILES[format]}`;
      if (format === 'svg') {
        const { body } = await patiently(ctx, () =>
          ctx.api.text(`${tabPath(document.id, tab.id)}/render.svg`),
        );
        await write(path, body);
      } else if (format === 'mermaid') await write(path, mermaidFromTab(tab));
      else await write(path, tabToMarkdownText(tab));
    }
  }
  return written;
}

export async function exportAll(
  io: CliIo,
  ctx: VerbContext,
  host: string,
  input: ExportInput,
): Promise<{ paths: string[]; documents: number; exit: number }> {
  if (!input.all)
    throw new CliError({
      exit: EXIT.usage,
      code: 'usage',
      message: 'export writes every document: add --all',
      hint: 'one document: livediagram pull <doc>',
    });
  const formats = formatsOf(input.format);
  const documents = await patiently(ctx, () => listAllDocuments(ctx.api));
  const slugs = uniqueSlugs(documents);
  await io.files.mkdir(input.to);
  ctx.log(`export ${documents.length} documents as ${formats.join(',')}`);
  const results: (string[] | null)[] = new Array(documents.length).fill(null);
  let exit: ExitCode = EXIT.done;
  let next = 0;
  const worker = async () => {
    while (next < documents.length) {
      const index = next++;
      const doc = documents[index]!;
      try {
        results[index] = await exportDocument(
          io,
          ctx,
          doc.id,
          slugs.get(doc.id)!,
          input.to,
          formats,
        );
      } catch (err) {
        const failure = failureOf(err, host);
        io.stderr(
          formatError(
            { ...failure, message: `${JSON.stringify(doc.name)}: ${failure.message}` },
            false,
          ),
        );
        if (failure.exit > exit) exit = failure.exit;
      }
    }
  };
  await Promise.all(Array.from({ length: EXPORT_CONCURRENCY }, worker));
  const done = results.filter((r): r is string[] => r !== null);
  return { paths: done.flat(), documents: done.length, exit };
}
