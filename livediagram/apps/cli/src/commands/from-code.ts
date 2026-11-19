// `link from-code` (docs/specs/020-import-export/infrastructure-import.md "The CLI"; blueprint "The CLI"):
// wrangler.toml, Compose, Terraform and Kubernetes files read from the repository, drawn by the shared graph builder, and sent as a new
// document or a new tab through `document create` / `tab add` themselves, so their requests, refusals and printed
// line are the ones every other write has.

import { posix } from 'node:path';
import { verbById, type VerbContext } from '@livediagram/agent-verbs';
import {
  INFRA_MAX_FILE_BYTES,
  INFRA_MAX_NODES,
  infraGraph,
  skippedLine,
  type InfraFile,
  type InfraFormat,
} from '@livediagram/document/infra-code';
import { EXIT } from '@liveworkspace/cli-kit/exit-codes';
import type { DebugLog } from '../debug';
import type { CliIo } from '../io';
import { CliError } from '../output/cli-error';

/** The names read from the working directory when no file is given, in this order. */
export const STANDARD_INFRA_FILES = [
  'wrangler.toml',
  'docker-compose.yml',
  'docker-compose.yaml',
  'compose.yml',
  'compose.yaml',
] as const;

export type FromCodeInput = {
  files?: string[];
  doc?: string;
  name?: string;
  env?: string;
  dryRun?: boolean;
};

// How each format is named on the `read` line.
const FORMAT_WORD: Record<InfraFormat, string> = {
  wrangler: 'wrangler.toml',
  compose: 'Compose',
  terraform: 'Terraform',
  kubernetes: 'Kubernetes',
};

type FromCodeOutput = { text: string; id: string | null; dryRun: boolean; graph: unknown };

const HINT = 'livediagram link from-code --help';

// The files to read: the named ones (each must exist), else the standard names found here.
async function readFiles(io: CliIo, named: readonly string[] | undefined): Promise<InfraFile[]> {
  const at = (f: string) => (posix.isAbsolute(f) ? f : posix.join(io.cwd, f));
  const tooBig = (name: string) =>
    new CliError({
      exit: EXIT.rejected,
      code: 'too_large',
      message: `${name} is over 1 MB, larger than any infrastructure file`,
      hint: HINT,
    });
  if (named && named.length > 0) {
    const files: InfraFile[] = [];
    for (const name of named) {
      const text = await io.files.read(at(name));
      if (text === null)
        throw new CliError({
          exit: EXIT.notFound,
          code: 'not_found',
          message: `can't read ${name}`,
          hint: HINT,
        });
      if (text.length > INFRA_MAX_FILE_BYTES) throw tooBig(name);
      files.push({ name, text });
    }
    return files;
  }
  const found: InfraFile[] = [];
  // The standard names, then every .tf file here in name order: a Terraform module is the folder's .tf files.
  const listed = (await io.files.list(io.cwd)) ?? [];
  const terraform = listed
    .filter((e) => e.kind === 'file' && e.name.endsWith('.tf'))
    .map((e) => e.name)
    .sort();
  for (const name of [...STANDARD_INFRA_FILES, ...terraform]) {
    const text = await io.files.read(at(name));
    if (text === null) continue;
    if (text.length > INFRA_MAX_FILE_BYTES) throw tooBig(name);
    found.push({ name, text });
  }
  if (found.length === 0)
    throw new CliError({
      exit: EXIT.usage,
      code: 'usage',
      message: `no ${STANDARD_INFRA_FILES.join(', ')} or .tf file in ${io.cwd}`,
      hint: 'livediagram link from-code <file>...',
    });
  return found;
}

/** The files read, drawn as one graph, with the summary on stderr. Throws a CliError naming the file at fault. */
export async function drawFromCode(io: CliIo, input: FromCodeInput, log: DebugLog) {
  const files = await readFiles(io, input.files);
  const result = infraGraph(files, input.env !== undefined ? { env: input.env } : {});
  if (!result.ok) {
    const { code, message, file } = result.error;
    const usage = code === 'too-many-files' || code === 'unknown-env';
    throw new CliError({
      exit: usage ? EXIT.usage : EXIT.rejected,
      code: usage ? 'usage' : 'invalid_value',
      message: file ? `${file}: ${message}` : message,
      hint: HINT,
    });
  }
  for (const f of result.files) {
    log(`[from-code] read ${f.name} ${f.format}`);
    io.stderr(
      `read ${f.name}: ${FORMAT_WORD[f.format]}, ${f.boxes} box${f.boxes === 1 ? '' : 'es'}\n`,
    );
  }
  if (result.skipped.length > 0) {
    log(`[from-code] skipped ${result.skipped.length}`);
    io.stderr(`skipped keys: ${skippedLine(result.skipped)}\n`);
  }
  if (result.leftOut > 0) {
    log(`[from-code] capped ${result.leftOut}`);
    io.stderr(
      `left out: ${result.leftOut} boxes past the first ${INFRA_MAX_NODES - 1}, listed in the last box\n`,
    );
  }
  if (result.linesLeftOut > 0)
    io.stderr(
      `left out: ${result.linesLeftOut} lines past the first ${result.graph.edges.length}\n`,
    );
  return result.graph;
}

/** `link from-code`: the graph printed (`--dry-run`, no `ctx`), or sent as a new document or a tab on `--doc`. */
export async function linkFromCode(
  io: CliIo,
  ctx: VerbContext | null,
  input: FromCodeInput,
  log: DebugLog,
): Promise<FromCodeOutput> {
  const graph = await drawFromCode(io, input, log);
  // No context is `--dry-run`, run offline (main.ts).
  if (ctx === null) return { text: JSON.stringify(graph, null, 2), id: null, dryRun: true, graph };
  // The drawing's title names what is made unless --name does (I5); infraGraph always titles it.
  const name = input.name ?? String(graph.title);
  // The graph handed to the write verbs as the file they read, so the request is theirs.
  const withGraph: VerbContext = { ...ctx, readInput: async () => JSON.stringify(graph) };
  // Each through its own schema, so its defaults (the write flags) are set as on its command line.
  if (input.doc === undefined) {
    const verb = verbById('document.create')!;
    const out = (await verb.run!(withGraph, verb.input.parse({ name, file: 'infra' }))) as {
      text: string;
      id: string;
    };
    return { text: out.text, id: out.id, dryRun: false, graph };
  }
  const verb = verbById('tab.add')!;
  const out = (await verb.run!(
    withGraph,
    verb.input.parse({ doc: input.doc, name, file: 'infra' }),
  )) as { text: string; changeset: { id: string } };
  return { text: out.text, id: out.changeset.id, dryRun: false, graph };
}
