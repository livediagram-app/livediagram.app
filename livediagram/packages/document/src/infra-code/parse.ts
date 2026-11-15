// TOML or YAML to a plain object (blueprint "parseInfraText"). Both through real parsers; the result is walked only
// along known paths, so a YAML alias shared a thousand times costs nothing.

import { load } from 'js-yaml';
import { parse } from 'smol-toml';
import { INFRA_MAX_FILE_BYTES } from './limits';
import type { InfraError, InfraFormat } from './types';

export type Table = Record<string, unknown>;

export const isTable = (v: unknown): v is Table =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const LANGUAGE: Record<InfraFormat, string> = { wrangler: 'TOML', compose: 'YAML' };

// The parser's own message, its first line only (smol-toml appends a code block), and the line it names.
export function parseError(format: InfraFormat, err: unknown): InfraError {
  const e = err as { message?: string; line?: number; reason?: string; mark?: { line?: number } };
  const raw = (format === 'compose' ? e.reason : undefined) ?? e.message ?? String(err);
  const first = raw.split('\n')[0]!.trim();
  const message = first.endsWith('.') || first.endsWith(':') ? first.slice(0, -1) : first;
  const line = format === 'compose' ? (e.mark?.line ?? -1) + 1 : (e.line ?? 0);
  return {
    code: 'parse',
    message: `Couldn't read the ${LANGUAGE[format]}: ${message}${line > 0 ? ` (line ${line})` : ''}.`,
  };
}

export function parseInfraText(
  format: InfraFormat,
  text: string,
): { ok: true; value: Table } | { ok: false; error: InfraError } {
  // The UTF-16 length, known without encoding the text again (I2).
  if (text.length > INFRA_MAX_FILE_BYTES)
    return {
      ok: false,
      error: {
        code: 'too-large',
        message:
          'That file is over 1 MB, larger than any wrangler.toml or Compose file. Pick the file itself.',
      },
    };
  if (text.trim() === '')
    return { ok: false, error: { code: 'empty', message: 'That file is empty.' } };
  let value: unknown;
  try {
    // `json: true`: a key given twice keeps the later value, as Compose reads it (I3).
    value = format === 'wrangler' ? parse(text) : load(text, { json: true });
  } catch (err) {
    return { ok: false, error: parseError(format, err) };
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
