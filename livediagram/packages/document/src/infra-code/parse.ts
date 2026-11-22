// TOML or YAML to plain values (blueprint "checkInfraText, parseInfraText, parseKubernetesText"). Both through real
// parsers; the result is walked only along known paths, so a YAML alias shared a thousand times costs nothing.
// Terraform's HCL has its own reader (hcl.ts), which meets the same size and empty checks first.

import {
  binaryTag,
  CORE_SCHEMA,
  load,
  loadAll,
  mergeTag,
  omapTag,
  pairsTag,
  setTag,
  timestampTag,
} from 'js-yaml';
import { parse } from 'smol-toml';
import { INFRA_MAX_FILE_BYTES } from './limits';
import type { InfraError, InfraFormat } from './types';

export type Table = Record<string, unknown>;

export const isTable = (v: unknown): v is Table =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const LANGUAGE: Record<InfraFormat, string> = {
  wrangler: 'TOML',
  compose: 'YAML',
  kubernetes: 'YAML',
  terraform: 'HCL',
};

// js-yaml 4's default schema: the YAML 1.2 core schema plus merge keys (`<<: *base`, common in Compose), timestamps
// and the binary, omap, pairs and set tags. js-yaml 5's default is the bare core schema, which reads `<<` as a key.
export const YAML_SCHEMA = CORE_SCHEMA.withTags(
  mergeTag,
  timestampTag,
  binaryTag,
  omapTag,
  pairsTag,
  setTag,
);

const isYaml = (format: InfraFormat) => format === 'compose' || format === 'kubernetes';

// The parser's own message, its first line only (smol-toml appends a code block), and the line it names. js-yaml
// reads an unclosed flow collection to a line past the last, so the line is held to the text's own `lines`.
export function parseError(format: InfraFormat, err: unknown, lines = Infinity): InfraError {
  const e = err as { message?: string; line?: number; reason?: string; mark?: { line?: number } };
  const raw = (isYaml(format) ? e.reason : undefined) ?? e.message ?? String(err);
  const first = raw.split('\n')[0]!.trim();
  const message = first.endsWith('.') || first.endsWith(':') ? first.slice(0, -1) : first;
  const line = Math.min(isYaml(format) ? (e.mark?.line ?? -1) + 1 : (e.line ?? 0), lines);
  return {
    code: 'parse',
    message: `Couldn't read the ${LANGUAGE[format]}: ${message}${line > 0 ? ` (line ${line})` : ''}.`,
  };
}

/** The checks every format meets before it is parsed: the size cap, then an empty file. */
export function checkInfraText(text: string): InfraError | null {
  // The UTF-16 length, known without encoding the text again (I2).
  if (text.length > INFRA_MAX_FILE_BYTES)
    return {
      code: 'too-large',
      message: 'That file is over 1 MB, larger than any infrastructure file. Pick the file itself.',
    };
  if (text.trim() === '') return { code: 'empty', message: 'That file is empty.' };
  return null;
}

// How many lines the text has, holding a parser's line to it.
const lineCount = (text: string) => text.trimEnd().split('\n').length;

export function parseInfraText(
  format: 'wrangler' | 'compose',
  text: string,
): { ok: true; value: Table } | { ok: false; error: InfraError } {
  const refused = checkInfraText(text);
  if (refused) return { ok: false, error: refused };
  let value: unknown;
  try {
    // `json: true`: a key given twice keeps the later value, as Compose reads it (I3).
    value = format === 'wrangler' ? parse(text) : load(text, { json: true, schema: YAML_SCHEMA });
  } catch (err) {
    return { ok: false, error: parseError(format, err, lineCount(text)) };
  }
  if (!isTable(value))
    return {
      ok: false,
      error: {
        code: 'not-a-table',
        message: "That isn't a wrangler.toml or Compose file: its top level holds no keys.",
      },
    };
  return { ok: true, value };
}

/** A Kubernetes file's documents, as given (`null` for an empty one between `---` lines). */
export function parseKubernetesText(
  text: string,
): { ok: true; docs: unknown[] } | { ok: false; error: InfraError } {
  const refused = checkInfraText(text);
  if (refused) return { ok: false, error: refused };
  try {
    return { ok: true, docs: loadAll(text, { json: true, schema: YAML_SCHEMA }) };
  } catch (err) {
    return { ok: false, error: parseError('kubernetes', err, lineCount(text)) };
  }
}
