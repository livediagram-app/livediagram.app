// One infrastructure file, read and drawn (blueprint "filePart and infraGraph" steps 2 and 3): its format detected, its
// text parsed by that format's reader, then drawn as its part. Split in two so infraGraph can see every file's
// Wrangler environments before it draws any.

import { composePart } from './compose';
import { detectInfraFormat } from './detect';
import { parseHcl, type HclBlock } from './hcl';
import { kubernetesPart } from './kubernetes';
import { isTable, parseInfraText, parseKubernetesText, type Table } from './parse';
import { terraformPart } from './terraform';
import type { InfraError, InfraFile, InfraFormat, InfraPart } from './types';
import { wranglerPart } from './wrangler';

export type ParsedFile =
  | { format: 'wrangler' | 'compose'; fallback: string; value: Table }
  | { format: 'kubernetes'; fallback: string; docs: unknown[] }
  | { format: 'terraform'; fallback: string; body: HclBlock };

// The word a file is named by when its folder does not name it.
const FORMAT_WORD: Record<InfraFormat, string> = {
  wrangler: 'Worker',
  compose: 'Compose',
  terraform: 'Terraform',
  kubernetes: 'Kubernetes',
};

// The folder a file sits in (`apps/api/wrangler.toml` is `api`), naming a drawing that has no name of its own.
function folderOf(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const parts = name.split(/[/\\]/).filter((p) => p !== '' && p !== '.');
  return parts.length >= 2 ? parts[parts.length - 2] : undefined;
}

const named = (error: InfraError, file: InfraFile): InfraError => ({
  ...error,
  ...(file.name ? { file: file.name } : {}),
});

/** A file parsed by its format's reader, or the error naming it. */
export function readInfraFile(
  file: InfraFile,
): { ok: true; parsed: ParsedFile } | { ok: false; error: InfraError } {
  const format = detectInfraFormat(file.name, file.text);
  const fallback = folderOf(file.name) ?? FORMAT_WORD[format];
  if (format === 'terraform') {
    const read = parseHcl(file.text);
    return read.ok
      ? { ok: true, parsed: { format, fallback, body: read.body } }
      : { ok: false, error: named(read.error, file) };
  }
  if (format === 'kubernetes') {
    const read = parseKubernetesText(file.text);
    return read.ok
      ? { ok: true, parsed: { format, fallback, docs: read.docs } }
      : { ok: false, error: named(read.error, file) };
  }
  const read = parseInfraText(format, file.text);
  return read.ok
    ? { ok: true, parsed: { format, fallback, value: read.value } }
    : { ok: false, error: named(read.error, file) };
}

/** Whether a parsed file is a wrangler.toml holding environment `env`. */
export function hasEnv(parsed: ParsedFile, env: string): boolean {
  return (
    parsed.format === 'wrangler' && isTable(parsed.value.env) && isTable(parsed.value.env[env])
  );
}

/** The Wrangler environments a parsed file names (none for the other formats). */
export function envsOf(parsed: ParsedFile): string[] {
  return parsed.format === 'wrangler' && isTable(parsed.value.env)
    ? Object.keys(parsed.value.env).filter((e) => isTable((parsed.value.env as Table)[e]))
    : [];
}

/** A parsed file drawn as its part; `env` is passed only to a wrangler.toml that holds it, or to force its error. */
export function partOf(
  parsed: ParsedFile,
  file: InfraFile,
  env?: string,
): { ok: true; part: InfraPart } | { ok: false; error: InfraError } {
  const built =
    parsed.format === 'terraform'
      ? terraformPart(parsed.body, parsed.fallback)
      : parsed.format === 'kubernetes'
        ? kubernetesPart(parsed.docs, parsed.fallback)
        : parsed.format === 'wrangler'
          ? wranglerPart(parsed.value, parsed.fallback, env)
          : composePart(parsed.value, parsed.fallback);
  return built.ok ? built : { ok: false, error: named(built.error, file) };
}
