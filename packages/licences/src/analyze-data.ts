import { LicencesError } from './errors.ts';

// One app's shipped modules and emitted files, as the bundler reports them.
export type DecodedBundle = { sources: string[]; assets: string[] };

// The tree root carries a null parent.
type Source = { path: string; parent_source_index?: number | null };
type ChunkPart = { source_index: number; output_file_index: number };
type OutputFile = { filename: string };

const CLIENT_OUTPUT_PREFIX = '[client-fs]/';
const PROJECT_PREFIX = '[project]/';

function fail(why: string): never {
  throw new LicencesError('AnalyzeFormatUnrecognised', why);
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isIndex = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function arrayOf<T>(value: unknown, field: string, ok: (item: unknown) => item is T): T[] {
  if (!Array.isArray(value)) fail(`"${field}" is not an array`);
  for (const item of value) if (!ok(item)) fail(`"${field}" holds an unexpected entry`);
  return value as T[];
}

const isSource = (v: unknown): v is Source =>
  isRecord(v) &&
  typeof v.path === 'string' &&
  (v.parent_source_index == null || isIndex(v.parent_source_index));
const isChunkPart = (v: unknown): v is ChunkPart =>
  isRecord(v) && isIndex(v.source_index) && isIndex(v.output_file_index);
const isOutputFile = (v: unknown): v is OutputFile => isRecord(v) && typeof v.filename === 'string';

function readJson(bytes: Uint8Array): unknown {
  if (bytes.length < 4) fail('shorter than its 4-byte header');
  const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  if (4 + length > bytes.length) fail(`header length ${length} runs past the end`);
  try {
    return JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + length)));
  } catch {
    return fail('body is not JSON');
  }
}

// Decodes one `analyze.data` file written by `next experimental-analyze -o`
// (blueprint "Interfaces and contracts"). Strict: any other shape throws, so a
// change in Next's format fails the build instead of shrinking the page.
export function decodeAnalyzeData(bytes: Uint8Array): DecodedBundle {
  const json = readJson(bytes);
  if (!isRecord(json)) fail('body is not an object');
  const sources = arrayOf(json.sources, 'sources', isSource);
  const parts = arrayOf(json.chunk_parts, 'chunk_parts', isChunkPart);
  const outputs = arrayOf(json.output_files, 'output_files', isOutputFile);

  const paths = new Map<number, string>();
  const fullPath = (index: number): string => {
    const known = paths.get(index);
    if (known !== undefined) return known;
    let path = '';
    let at: number | null | undefined = index;
    for (let hops = 0; at != null; hops += 1) {
      if (hops > sources.length) fail('source parents form a cycle');
      const source: Source | undefined = sources[at];
      if (!source) fail(`source parent ${at} is out of range`);
      path = source.path + path;
      at = source.parent_source_index;
    }
    paths.set(index, path);
    return path;
  };

  const clientOutputs = new Set<number>();
  outputs.forEach((o, i) => {
    if (o.filename.startsWith(CLIENT_OUTPUT_PREFIX)) clientOutputs.add(i);
  });

  const shipped = new Set<string>();
  for (const part of parts) {
    if (part.source_index >= sources.length) fail(`chunk part names source ${part.source_index}`);
    if (part.output_file_index >= outputs.length) {
      fail(`chunk part names output ${part.output_file_index}`);
    }
    if (!clientOutputs.has(part.output_file_index)) continue;
    const path = fullPath(part.source_index);
    if (!path.startsWith(PROJECT_PREFIX)) continue; // bundler runtime
    const rel = path.slice(PROJECT_PREFIX.length);
    if (rel.startsWith('[')) continue; // an emitted asset standing in as a source
    shipped.add(rel);
  }

  const assets = [...clientOutputs].map((i) => outputs[i]!.filename.split('/').at(-1)!);
  return { sources: [...shipped].sort(), assets: [...new Set(assets)].sort() };
}
