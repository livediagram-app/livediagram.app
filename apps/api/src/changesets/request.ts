import {
  CHANGESET_MAX_OPERATIONS,
  CHANGESET_SUMMARY_MAX,
  type ChangesetBase,
  type EditRejection,
  type EditRejectionCode,
} from '@livediagram/api-schema';
import {
  formatRejections,
  parseEditOperations,
  validateEditOperations,
  type EditLog,
  type EditOperation,
  type ReplaceBody,
} from '@livediagram/edit-operations';
import { isRecord, ELEMENT_FINGERPRINT_LENGTH, type GraphInput } from '@livediagram/document';

// A changeset request as the route receives it (docs/specs/024-agents/blueprints/agent-changesets.md
// "Interfaces and contracts"), checked member by member before anything is read. Pure.

export type ChangesetBody =
  | { kind: 'operations'; operations: EditOperation[] }
  | { kind: 'replace'; replace: ReplaceBody; theme?: string; name?: string };

export type ParsedChangeset = {
  body: ChangesetBody;
  base?: ChangesetBase;
  strict: boolean;
  summary: string | null;
};

export type Refusal = { status: number; body: Record<string, unknown> };

export type ParseResult = { ok: true; value: ParsedChangeset } | { ok: false; refusal: Refusal };

const REPLACE_SOURCES = ['graph', 'mermaid', 'template', 'elements'] as const;
const FINGERPRINT = new RegExp(`^[0-9a-f]{${ELEMENT_FINGERPRINT_LENGTH}}$`);

const refuse = (status: number, body: Record<string, unknown>): ParseResult => ({
  ok: false,
  refusal: { status, body },
});

// The HTTP status of an engine rejection (CS9).
export function rejectionStatus(code: EditRejectionCode): number {
  if (code === 'parse_error' || code === 'unknown_operation') return 400;
  if (code === 'too_large') return 413;
  return 422;
}

// The refusal for an engine rejection: the first code names the error, the formatter's text says
// why and what to do.
export function engineRefusal(errors: readonly EditRejection[]): Refusal {
  const code = errors[0]?.code ?? 'invalid_result';
  return {
    status: rejectionStatus(code),
    body: { error: code, errors, text: formatRejections(errors).join('\n') },
  };
}

// `log` takes the engine's parse lines (`[edit-ops] parsed`, `[edit-ops] parse-rejected`).
export function parseChangesetRequest(raw: unknown, log: EditLog = () => {}): ParseResult {
  if (!isRecord(raw))
    return refuse(400, { error: 'invalid_body', message: 'expected a JSON object' });
  const hasOps = raw.operations !== undefined;
  const hasReplace = raw.replace !== undefined;
  if (hasOps === hasReplace) {
    return refuse(400, {
      error: 'invalid_body',
      message: 'send exactly one of "operations" or "replace"',
    });
  }
  const strict = raw.strict === true;
  if (raw.strict !== undefined && typeof raw.strict !== 'boolean') {
    return refuse(400, { error: 'invalid_body', message: '"strict" must be a boolean' });
  }
  const summary = parseSummary(raw.summary);
  if (summary === 'too_long') {
    return refuse(422, {
      error: 'invalid_value',
      message: `"summary" holds at most ${CHANGESET_SUMMARY_MAX} characters`,
      cap: CHANGESET_SUMMARY_MAX,
    });
  }
  if (summary === 'invalid') {
    return refuse(400, { error: 'invalid_body', message: '"summary" must be a string' });
  }
  const base = parseBase(raw.base);
  if (base === 'invalid') {
    return refuse(400, {
      error: 'invalid_base',
      message:
        '"base" is { rev: a non-negative integer, elements?: { <element id>: <16 hex fingerprint> } }',
    });
  }
  const body = hasOps ? parseOperations(raw.operations, log) : parseReplace(raw.replace);
  if ('refusal' in body) return { ok: false, refusal: body.refusal };
  return { ok: true, value: { body, ...(base ? { base } : {}), strict, summary } };
}

// The operations in either form: a string of lines (the line form, JSON objects allowed on a line) or
// an array of operation objects.
function parseOperations(raw: unknown, log: EditLog): ChangesetBody | { refusal: Refusal } {
  if (typeof raw === 'string') {
    const parsed = parseEditOperations(raw, log);
    if ('errors' in parsed) return { refusal: engineRefusal(parsed.errors) };
    return { kind: 'operations', operations: parsed.operations };
  }
  if (!Array.isArray(raw)) {
    return {
      refusal: {
        status: 400,
        body: {
          error: 'invalid_body',
          message: '"operations" is an array of operation objects, or the line form as a string',
        },
      },
    };
  }
  if (raw.length > CHANGESET_MAX_OPERATIONS) {
    return {
      refusal: {
        status: 413,
        body: {
          error: 'too_large',
          cap: CHANGESET_MAX_OPERATIONS,
          message: `${raw.length} operations; the cap is ${CHANGESET_MAX_OPERATIONS}`,
        },
      },
    };
  }
  const parsed = validateEditOperations(raw);
  if ('errors' in parsed) return { refusal: engineRefusal(parsed.errors) };
  return { kind: 'operations', operations: parsed.operations };
}

function parseReplace(raw: unknown): ChangesetBody | { refusal: Refusal } {
  const bad = (message: string) => ({
    refusal: { status: 400, body: { error: 'invalid_body', message } },
  });
  if (!isRecord(raw)) return bad('"replace" must be an object');
  const sources = REPLACE_SOURCES.filter((s) => raw[s] !== undefined);
  if (sources.length !== 1)
    return bad('"replace" takes exactly one of graph, mermaid, template or elements');
  if (raw.layout !== undefined && raw.layout !== 'auto' && raw.layout !== 'preserve') {
    return bad('"replace.layout" is "auto" or "preserve"');
  }
  if (raw.theme !== undefined && typeof raw.theme !== 'string')
    return bad('"replace.theme" must be a string');
  if (raw.name !== undefined && typeof raw.name !== 'string')
    return bad('"replace.name" must be a string');
  const layout = raw.layout === 'auto' || raw.layout === 'preserve' ? raw.layout : undefined;
  // The engine checks each source's shape itself (applyReplace), naming what is wrong.
  const replace = replaceBodyOf(sources[0]!, raw, layout);
  if (!replace) return bad(`"replace.${sources[0]}" has the wrong type`);
  return {
    kind: 'replace',
    replace,
    ...(typeof raw.theme === 'string' ? { theme: raw.theme } : {}),
    ...(typeof raw.name === 'string' ? { name: raw.name } : {}),
  };
}

function replaceBodyOf(
  source: (typeof REPLACE_SOURCES)[number],
  raw: Record<string, unknown>,
  layout: 'auto' | 'preserve' | undefined,
): ReplaceBody | null {
  switch (source) {
    case 'graph':
      return isRecord(raw.graph) ? { graph: raw.graph as GraphInput } : null;
    case 'mermaid':
      return typeof raw.mermaid === 'string' ? { mermaid: raw.mermaid } : null;
    case 'template':
      return typeof raw.template === 'string' ? { template: raw.template } : null;
    case 'elements':
      return Array.isArray(raw.elements)
        ? { elements: raw.elements, ...(layout ? { layout } : {}) }
        : null;
  }
}

function parseSummary(raw: unknown): string | null | 'too_long' | 'invalid' {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return 'invalid';
  const clean = withoutControls(raw).trim();
  if (clean === '') return null;
  return [...clean].length > CHANGESET_SUMMARY_MAX ? 'too_long' : clean;
}

function parseBase(raw: unknown): ChangesetBase | undefined | 'invalid' {
  if (raw === undefined || raw === null) return undefined;
  if (!isRecord(raw) || !isRevision(raw.rev)) return 'invalid';
  if (raw.elements === undefined) return { rev: raw.rev };
  if (!isRecord(raw.elements)) return 'invalid';
  const elements: Record<string, string> = {};
  for (const [id, fp] of Object.entries(raw.elements)) {
    if (typeof fp !== 'string' || !FINGERPRINT.test(fp)) return 'invalid';
    elements[id] = fp;
  }
  return { rev: raw.rev, elements };
}

// C0 controls and DEL, removed from a summary (CS10).
function withoutControls(text: string): string {
  return [...text]
    .filter((ch) => {
      const code = ch.codePointAt(0)!;
      return code >= 0x20 && code !== 0x7f;
    })
    .join('');
}

function isRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
