// `link from-code --update` (docs/specs/020-import-export/infrastructure-import.md "The CLI"; blueprint "The CLI"): a
// tab drawn from files, updated from new versions of them with the editor's merge, so people's layout and edits stay.
// The merged elements and the rewritten record go back as one replace changeset, refused if the tab changed since.

import { posix } from 'node:path';
import {
  readPlainTab,
  submitChangeset,
  tabOf,
  VerbRefusal,
  type VerbContext,
} from '@livediagram/agent-verbs';
import {
  getBuiltInTheme,
  layoutGraph,
  rederiveColorPresetForTheme,
  tabSourcesOf,
  type DiagramSources,
} from '@livediagram/document';
import {
  INFRA_MAX_FILE_BYTES,
  mergeSourceGraph,
  sourceFiles,
  type InfraFile,
} from '@livediagram/document/infra-code';
import { EXIT } from '@liveworkspace/cli-kit/exit-codes';
import type { DebugLog } from '../debug';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';
import { drawFromCode } from './from-code';

export type FromCodeUpdateInput = {
  files?: string[];
  doc: string;
  tab?: string;
  env?: string;
  dryRun?: boolean;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The files the tab remembers, read again by their names from `root`; one missing is named.
async function rememberedFiles(io: CliIo, root: string, record: DiagramSources) {
  const files: InfraFile[] = [];
  for (const { name } of record.files) {
    const text = await io.files.read(posix.isAbsolute(name) ? name : posix.join(root, name));
    if (text === null)
      throw new CliError({
        exit: EXIT.notFound,
        code: 'not_found',
        message: `can't read ${name}, which the tab was drawn from`,
        hint: 'name the files to read: livediagram link from-code <file>... --update',
      });
    if (text.length > INFRA_MAX_FILE_BYTES)
      throw new CliError({
        exit: EXIT.rejected,
        code: 'too_large',
        message: `${name} is over 1 MB, larger than any infrastructure file`,
      });
    files.push({ name, text });
  }
  return files;
}

/** The tab updated from its files, or the counts alone on `--dry-run`. */
export async function updateFromCode(
  io: CliIo,
  ctx: VerbContext,
  input: FromCodeUpdateInput,
  log: DebugLog,
): Promise<{ text: string; id: string | null; dryRun: boolean; graph: unknown }> {
  const { document, tab: summary } = await tabOf(ctx, input.doc, input.tab);
  const read = await readPlainTab(ctx, document.id, summary.id);
  if (!read) throw new Error('the tab read carried no revision');
  const record = tabSourcesOf(read.tab);
  if (!record)
    throw new VerbRefusal({
      status: 422,
      code: 'not_drawn_from_files',
      message: `tab ${JSON.stringify(summary.name)} was not drawn from files`,
      hint: `livediagram link from-code <file>... --doc ${JSON.stringify(input.doc)}`,
    });
  const env = input.env ?? record.env;
  const named = input.files && input.files.length > 0;
  const files = named ? undefined : await rememberedFiles(io, io.cwd, record);
  const { graph, files: read2 } = await drawFromCode(
    io,
    { ...(named ? { files: input.files } : {}), ...(env !== undefined ? { env } : {}) },
    log,
    files,
  );
  const look = getBuiltInTheme(read.tab.theme);
  const fresh = layoutGraph(graph).map((el) =>
    el.type === 'shape' && el.colorPreset ? rederiveColorPresetForTheme(el, look) : el,
  );
  const merged = mergeSourceGraph({ tab: read.tab.elements, record, fresh, graph });
  const c = merged.counts;
  log(`[from-code] update ${summary.id} ${c.added} ${c.removed} ${c.kept} ${c.editsKept}`);
  io.stderr(
    `updated: added ${plural(c.added, 'box', 'boxes')}, removed ${c.removed}, kept ${c.kept}, ${plural(c.editsKept, 'edit')} kept; lines +${c.linesAdded} -${c.linesRemoved}\n`,
  );
  const sources = {
    bridge: 'infra' as const,
    files: sourceFiles(read2),
    ...(env !== undefined ? { env } : {}),
    nodes: merged.nodes,
    edges: merged.edges,
  };
  const response = await submitChangeset(
    ctx,
    { documentId: document.id, tabId: summary.id, tabName: summary.name, doc: input.doc },
    { replace: { elements: merged.elements, layout: 'preserve', sources } },
    // The merge was worked out over this revision: a tab changed since is refused, to be run again.
    { base: read.rev, strict: true, ...(input.dryRun ? { dryRun: true } : {}) },
  );
  return {
    text: response.text,
    id: response.changeset?.id ?? null,
    dryRun: response.dryRun,
    graph,
  };
}
