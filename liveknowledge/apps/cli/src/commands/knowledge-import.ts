// `import <folder|zip>` (docs/specs/024-agents/knowledgebase-for-agents.md "CLI"; docs/specs/020-import-export/
// knowledgebase-import.md): a Markdown folder or a Notion export, planned by the engine the app's Import dialog
// uses (@liveknowledge/knowledge-import) over the files on disk, then written through the api: parents first,
// twenty pages a batch, into a new knowledgebase or an existing one. `--dry-run` prints the plan and writes nothing.
//
// What this door does not do, and says: a Confluence export is HTML, read through an inert DOM the CLI's runtime
// has none of, so it is imported in the app; and the article Markdown the api takes has no picture form, so a
// picture is left as its caption (the app's Import stores them).
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';
import { knowledgePath, resolveDocument, type VerbContext } from '@liveknowledge/agent-verbs';
import { ApiError } from '@liveworkspace/api-client';
import {
  CREATION_INTENT,
  type CreatePageResponse,
  type KnowledgePagesResponse,
} from '@liveknowledge/api-schema';
import {
  MAX_ARCHIVE_BYTES,
  MAX_ARCHIVE_ENTRIES,
  PAGE_LINK_SCHEME,
  PICTURE_SCHEME,
  planImport,
  zipEntries,
  type ArchiveEntry,
  type ImportPlan,
  type PlannedPage,
} from '@liveknowledge/knowledge-import';
import type { CliIo } from '@liveworkspace/cli-kit/io';
import { EXIT } from '@liveworkspace/cli-kit/exit-codes';
import { CliError } from '../output/cli-error';
import { patiently } from './export';
import { openZip } from './zip-reader';

export type KnowledgeImportInput = {
  path: string;
  to?: string;
  into?: string;
  name?: string;
  source: 'markdown' | 'notion' | 'confluence';
  dryRun?: boolean;
};

/** Pages written before the next line of progress, and the next look at the rate limit. */
export const IMPORT_BATCH_PAGES = 20;

const usage = (message: string, hint: string) =>
  new CliError({ exit: EXIT.usage, code: 'usage', message, hint });

// A folder's files as an archive: each listed with its size, read only when the engine asks.
async function folderEntries(root: string): Promise<ArchiveEntry[]> {
  const listed = await readdir(root, { recursive: true, withFileTypes: true });
  const entries: ArchiveEntry[] = [];
  for (const item of listed) {
    if (!item.isFile()) continue;
    const path = join(item.parentPath, item.name);
    entries.push({
      path: relative(root, path).split(sep).join('/'),
      size: (await stat(path)).size,
      read: async () => new Uint8Array(await readFile(path)),
    });
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

async function archiveOf(path: string): Promise<{ entries: ArchiveEntry[]; bytes?: number }> {
  const found = await stat(path).catch(() => null);
  if (!found)
    throw new CliError({
      exit: EXIT.notFound,
      code: 'not_found',
      message: `no folder or file at ${path}`,
      hint: 'liveknowledge import <folder|zip> --dry-run',
    });
  if (found.isDirectory()) return { entries: await folderEntries(path) };
  if (!/\.zip$/i.test(path))
    throw usage(`${path} is neither a folder nor a .zip`, 'liveknowledge import <folder|zip>');
  if (found.size > MAX_ARCHIVE_BYTES) return { entries: [], bytes: found.size };
  try {
    const zip = openZip(new Uint8Array(await readFile(path)), MAX_ARCHIVE_ENTRIES);
    return { entries: zipEntries(zip, MAX_ARCHIVE_BYTES), bytes: found.size };
  } catch (error) {
    throw new CliError({
      exit: EXIT.rejected,
      code: 'invalid_archive',
      message: `${path} could not be read: ${(error as Error).message}`,
      hint: 'unpack it and import the folder',
    });
  }
}

/** A planned page's Markdown as the api takes it: a link to a planned page as `[[its title]]`, a picture as its
 *  caption. */
export function pageMarkdownFor(page: PlannedPage, titleOf: (key: string) => string | undefined) {
  const link = new RegExp(`\\[([^\\]]*)\\]\\(${PAGE_LINK_SCHEME}([^)\\s]+)\\)`, 'g');
  const picture = new RegExp(`!\\[([^\\]]*)\\]\\(${PICTURE_SCHEME}\\d+\\)`, 'g');
  return page.markdown
    .replace(picture, (_all, alt: string) => (alt.trim() ? `*${alt.trim()}*` : ''))
    .replace(link, (_all, text: string, key: string) => {
      const title = titleOf(key);
      return title === undefined ? text : `[[${title}]]`;
    });
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The plan in lines: what would be imported, what is left out and why. */
export function planLines(plan: ImportPlan): string[] {
  const { summary } = plan;
  if (summary.blocked)
    return [
      summary.blocked.reason === 'archive-too-large'
        ? `nothing can be imported: the archive is larger than ${Math.round(summary.blocked.limitBytes / 1_048_576)} MB`
        : `nothing can be imported: ${plural(summary.blocked.found, 'page')} found, and there is room for ${summary.blocked.room}`,
    ];
  const warnings = plan.pages.reduce((n, p) => n + p.warnings.length, 0);
  return [
    `${plural(summary.pages, 'page')} · ${plural(summary.pictures, 'picture')} left as captions · ${plural(summary.attachments, 'attachment')} named · ${plural(summary.ignoredFiles, 'file')} ignored`,
    ...plan.pages.map((p) => `  ${'  '.repeat(depthOf(plan, p))}${p.title}`),
    ...summary.skipped.map((s) => `skipped ${s.path}: ${s.detail}`),
    ...(warnings > 0
      ? [
          `${plural(warnings, 'warning')} on pages (a missing picture, a flattened level, a link left as text)`,
        ]
      : []),
  ];
}

function depthOf(plan: ImportPlan, page: PlannedPage): number {
  const parents = new Map(plan.pages.map((p) => [p.key, p.parentKey]));
  let depth = 0;
  for (let key = page.parentKey; key; key = parents.get(key) ?? null) depth += 1;
  return depth;
}

export async function importKnowledge(
  io: CliIo,
  ctx: VerbContext,
  input: KnowledgeImportInput,
): Promise<{
  lines: string[];
  documentId: string | null;
  imported: number;
  failed: number;
  exit: number;
}> {
  if (input.source === 'confluence')
    throw usage(
      'a Confluence export is HTML, which this command does not read',
      'import it in the app: open the knowledgebase, the page list’s menu, Import',
    );
  if (input.into !== undefined && input.to === undefined)
    throw usage(
      '--into names a page of an existing knowledgebase: add --to <knowledgebase>',
      'liveknowledge import <folder> --to <kb> --into <page>',
    );
  if (input.to !== undefined && input.name !== undefined)
    throw usage(
      '--name names a new knowledgebase: leave it out with --to',
      'liveknowledge import <folder> --to <kb>',
    );

  // Where the pages land, read before the archive is: an existing knowledgebase's room and the parent's depth.
  let documentId: string | null = null;
  let parent: string | undefined;
  let existingPages = 0;
  let parentDepth = 0;
  if (input.to !== undefined) {
    const resolved = await resolveDocument(ctx.api, input.to, ctx.host, ctx.log);
    if (resolved.shareCode) ctx.useShareCode(resolved.shareCode);
    documentId = resolved.id;
    const { pages } = await ctx.api.json<KnowledgePagesResponse>(
      knowledgePath(documentId, 'pages'),
    );
    existingPages = pages.length;
    if (input.into !== undefined) {
      const key = input.into.toLowerCase().replace(/\s+/g, ' ').trim();
      const found = pages.filter(
        (p) => p.tab === input.into || p.title.toLowerCase().replace(/\s+/g, ' ').trim() === key,
      );
      if (found.length !== 1)
        throw new CliError({
          exit: EXIT.notFound,
          code: found.length > 1 ? 'page_ambiguous' : 'page_unknown',
          message:
            found.length > 1
              ? `${found.length} pages are titled "${input.into}": name one by its id`
              : `no page "${input.into}" in that knowledgebase`,
          hint: `liveknowledge pages ${JSON.stringify(input.to)}`,
        });
      parent = found[0]!.tab;
      parentDepth = found[0]!.depth;
    }
  }

  const archive = await archiveOf(input.path);
  const plan = await planImport(
    input.source === 'notion' ? 'notion' : 'markdown-folder',
    archive.entries,
    {
      existingPages,
      parentDepth,
      ...(archive.bytes === undefined ? {} : { archiveBytes: archive.bytes }),
    },
  );
  const lines = planLines(plan);
  if (plan.summary.blocked)
    return { lines, documentId, imported: 0, failed: 0, exit: EXIT.rejected };
  if (plan.pages.length === 0)
    return {
      lines: [...lines, 'nothing to import: no page was found'],
      documentId,
      imported: 0,
      failed: 0,
      exit: EXIT.rejected,
    };
  if (input.dryRun)
    return {
      lines: [...lines, 'dry run: nothing was written'],
      documentId,
      imported: 0,
      failed: 0,
      exit: EXIT.done,
    };

  if (documentId === null) {
    documentId = ctx.newId();
    const name = input.name ?? basename(input.path).replace(/\.zip$/i, '');
    await ctx.api.json('/documents', {
      method: 'POST',
      body: JSON.stringify({
        id: documentId,
        name,
        tabs: [],
        source: 'cli',
        intent: CREATION_INTENT,
      }),
    });
    lines.push(`+ knowledgebase ${JSON.stringify(name)} · ${ctx.host}/document/${documentId}`);
  }

  const target = documentId;
  // Every page's id before the first is written, so a link to a page further down the tree is written once.
  const ids = new Map(plan.pages.map((p) => [p.key, ctx.newId()]));
  const titles = new Map(plan.pages.map((p) => [p.key, p.title]));
  const pageIds: Record<string, string> = {};
  for (const page of plan.pages) pageIds[page.title] ??= ids.get(page.key)!;
  const written = new Set<string>();
  const failures: string[] = [];
  for (let from = 0; from < plan.pages.length; from += IMPORT_BATCH_PAGES) {
    const batch = plan.pages.slice(from, from + IMPORT_BATCH_PAGES);
    for (const page of batch) {
      // The plan is in tree order, so a page's parent came before it: one that failed takes its subpages with it.
      if (page.parentKey !== null && !written.has(page.parentKey)) {
        failures.push(`${page.title}: its parent was not imported`);
        continue;
      }
      const under = page.parentKey === null ? parent : ids.get(page.parentKey);
      try {
        await patiently(ctx, () =>
          ctx.api.json<CreatePageResponse>(knowledgePath(target, 'pages'), {
            method: 'POST',
            body: JSON.stringify({
              id: ids.get(page.key),
              title: page.title,
              markdown: pageMarkdownFor(page, (key) => titles.get(key)),
              ...(under ? { parent: under } : {}),
              pageIds,
            }),
          }),
        );
        written.add(page.key);
      } catch (error) {
        // A refusal of one page (too large, the tree full) leaves the rest to go; anything else stops the import.
        if (
          !(error instanceof ApiError) ||
          error.status >= 500 ||
          [401, 403].includes(error.status)
        )
          throw error;
        failures.push(`${page.title}: ${error.code ?? `HTTP ${error.status}`}`);
      }
    }
    const done = Math.min(from + IMPORT_BATCH_PAGES, plan.pages.length);
    io.stderr(`pages ${from + 1} to ${done} of ${plan.pages.length}\n`);
  }
  lines.push(
    ...failures.map((f) => `not imported: ${f}`),
    `${plural(written.size, 'page')} imported, none verified${failures.length ? ` · ${failures.length} not imported` : ''}`,
  );
  return {
    lines,
    documentId,
    imported: written.size,
    failed: failures.length,
    exit: failures.length > 0 ? EXIT.rejected : EXIT.done,
  };
}
