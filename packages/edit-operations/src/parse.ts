// A changeset's operations as text (docs/specs/024-agents/blueprints/edit-operations.md "Line form"):
// one operation a line, in the line form or, for a line starting with `{`, the JSON form. Blank
// lines and lines starting with `#` are skipped and not counted. Every malformed line is reported, up
// to EDIT_MAX_ERRORS, so a batch of typos is fixed in one round.

import { CHANGESET_MAX_OPERATIONS, type EditRejection } from '@livediagram/api-schema';
import { validateEditOperation } from './parse-json';
import { isOperationName, parseOperationWords } from './parse-line';
import { lineParseError, tooLarge, unknownOperation } from './rejections';
import { tokeniseLine } from './tokenise';
import type { EditLog, EditOperation, ParseOutcome } from './types';
import { EDIT_LINE_MAX_CHARS, EDIT_MAX_ERRORS } from './vocabulary';

const silent: EditLog = () => {};

type LineRejection = EditRejection & { line: number };

// One non-comment line, as an operation or its refusal.
function parseLine(text: string, line: number, operation: number): EditOperation | LineRejection {
  if (text.length > EDIT_LINE_MAX_CHARS)
    return lineParseError(
      operation,
      line,
      text.slice(0, 80),
      EDIT_LINE_MAX_CHARS + 1,
      `at most ${EDIT_LINE_MAX_CHARS} characters a line`,
    );
  const trimmed = text.trimStart();
  if (trimmed.startsWith('{')) {
    let raw: unknown;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      return lineParseError(
        operation,
        line,
        text,
        text.length - trimmed.length + 1,
        'one JSON object',
      );
    }
    return withLine(validateEditOperation(raw, operation), line);
  }
  const tokens = tokeniseLine(text);
  if ('error' in tokens)
    return lineParseError(operation, line, text, tokens.error.column, tokens.error.expected);
  const [head, ...rest] = tokens.words;
  if (!isOperationName(head!.value)) return { ...unknownOperation(head!.value, operation), line };
  const parsed = parseOperationWords(head!.value, head!, rest, text.trimEnd().length + 1);
  if ('error' in parsed)
    return lineParseError(operation, line, text, parsed.error.column, parsed.error.expected);
  return withLine(validateEditOperation(parsed.raw, operation), line);
}

function withLine(
  result: EditOperation | EditRejection,
  line: number,
): EditOperation | LineRejection {
  return 'code' in result ? { ...result, line } : result;
}

export function parseEditOperations(text: string, log: EditLog = silent): ParseOutcome {
  const lines = text
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1, trimmed: line.trim() }))
    .filter(({ trimmed }) => trimmed !== '' && !trimmed.startsWith('#'));
  if (lines.length > CHANGESET_MAX_OPERATIONS) {
    log('[edit-ops] parse-rejected', { code: 'too_large', errors: 1, line: 0, column: 0 });
    return { errors: [tooLarge(lines.length)] };
  }
  const operations: EditOperation[] = [];
  const errors: LineRejection[] = [];
  for (const [index, { line, number }] of lines.entries()) {
    const result = parseLine(line, number, index + 1);
    if ('code' in result) errors.push(result);
    else operations.push(result);
    if (errors.length === EDIT_MAX_ERRORS) break;
  }
  if (errors.length) {
    const [first] = errors;
    log('[edit-ops] parse-rejected', {
      code: first!.code,
      errors: errors.length,
      line: first!.line,
      column: first!.column ?? 0,
    });
    return { errors };
  }
  const jsonForm = lines.filter(({ trimmed }) => trimmed.startsWith('{')).length;
  log('[edit-ops] parsed', {
    operations: operations.length,
    lineForm: lines.length - jsonForm,
    jsonForm,
  });
  return { operations };
}
