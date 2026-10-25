// A changeset's operations as text (docs/specs/024-agents/blueprints/edit-operations.md "Line form"):
// one operation a line, in the line form or, for a line starting with `{`, the JSON form. Blank
// lines and lines starting with `#` are skipped and not counted. Every malformed line is reported, up
// to EDIT_MAX_ERRORS, so a batch of typos is fixed in one round.
//
// The walk is the same in every product; what an operation is, how its words read and how a refusal
// is worded are the product's, handed in once with `createParseEditOperations`.

import { EDIT_LINE_MAX_CHARS, EDIT_MAX_ERRORS } from './limits';
import { tokeniseLine, type Word } from './tokenise';

export type EditLog = (
  fingerprint: string,
  fields: Readonly<Record<string, string | number | boolean>>,
) => void;

// A refusal as far as the walk reads it: its code, and the column of a parse error.
type Rejection = { code: string; column?: number };

export type ParseConfig<Op extends object, R extends Rejection, Name extends string> = {
  // The changeset's cap on operations (CHANGESET_MAX_OPERATIONS in the product's api-schema).
  maxOperations: number;
  isOperationName: (word: string) => word is Name;
  // A line's words, after its operation's name, as the JSON form's object, or where they stop reading.
  parseOperationWords: (
    name: Name,
    head: Word,
    rest: readonly Word[],
    lineEnd: number,
  ) => { raw: Record<string, unknown> } | { error: { column: number; expected: string } };
  validateEditOperation: (raw: unknown, operation: number) => Op | R;
  lineParseError: (
    operation: number,
    line: number,
    text: string,
    column: number,
    expected: string,
  ) => R & { line: number };
  tooLarge: (count: number) => R;
  unknownOperation: (word: string, operation: number) => R;
};

const silent: EditLog = () => {};

export function createParseEditOperations<
  Op extends object,
  R extends Rejection,
  Name extends string,
>(config: ParseConfig<Op, R, Name>) {
  type LineRejection = R & { line: number };
  const {
    isOperationName,
    lineParseError,
    maxOperations,
    parseOperationWords,
    tooLarge,
    unknownOperation,
    validateEditOperation,
  } = config;
  const isRejection = (result: Op | R): result is R => 'code' in result;

  function withLine(result: Op | R, line: number): Op | LineRejection {
    return isRejection(result) ? { ...result, line } : result;
  }

  // One non-comment line, as an operation or its refusal.
  function parseLine(text: string, line: number, operation: number): Op | LineRejection {
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

  return function parseEditOperations(
    text: string,
    log: EditLog = silent,
  ): { operations: Op[] } | { errors: R[] } {
    const lines = text
      .split(/\r?\n/)
      .map((line, index) => ({ line, number: index + 1, trimmed: line.trim() }))
      .filter(({ trimmed }) => trimmed !== '' && !trimmed.startsWith('#'));
    if (lines.length > maxOperations) {
      log('[edit-ops] parse-rejected', { code: 'too_large', errors: 1, line: 0, column: 0 });
      return { errors: [tooLarge(lines.length)] };
    }
    const operations: Op[] = [];
    const errors: LineRejection[] = [];
    for (const [index, { line, number }] of lines.entries()) {
      const result = parseLine(line, number, index + 1);
      if (isRejection(result)) errors.push(result);
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
  };
}
