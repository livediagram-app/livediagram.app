import { describe, expect, it, vi } from 'vitest';
import { EDIT_LINE_MAX_CHARS, EDIT_MAX_ERRORS } from './limits';
import { createParseEditOperations } from './parse';

// A two-operation vocabulary, enough to walk every branch; each product's own suite runs its own.
type Op = { op: 'add' | 'rm'; target: string };
type Refusal = {
  code: string;
  operation?: number;
  line?: number;
  column?: number;
  detail?: string;
};
const NAMES = ['add', 'rm'] as const;

const parse = createParseEditOperations<Op, Refusal, (typeof NAMES)[number]>({
  maxOperations: 3,
  isOperationName: (word): word is (typeof NAMES)[number] => NAMES.some((name) => name === word),
  parseOperationWords: (name, head, rest, lineEnd) =>
    rest[0]
      ? { raw: { op: name, target: rest[0].value } }
      : { error: { column: Math.max(lineEnd, head.column), expected: 'a target' } },
  validateEditOperation: (raw, operation) =>
    typeof raw === 'object' && raw !== null && 'target' in raw && typeof raw.target === 'string'
      ? (raw as Op)
      : { code: 'parse_error', operation, detail: 'needs a target' },
  lineParseError: (operation, line, _text, column, expected) => ({
    code: 'parse_error',
    operation,
    line,
    column,
    detail: expected,
  }),
  tooLarge: (count) => ({ code: 'too_large', detail: `${count}` }),
  unknownOperation: (word, operation) => ({ code: 'unknown_operation', operation, detail: word }),
});

describe('createParseEditOperations', () => {
  it('reads line-form and JSON-form lines, skipping blanks and comments', () => {
    const log = vi.fn();
    expect(parse('add n1\n\n# a note\n{"op":"rm","target":"n2"}\r\n', log)).toEqual({
      operations: [
        { op: 'add', target: 'n1' },
        { op: 'rm', target: 'n2' },
      ],
    });
    expect(log).toHaveBeenCalledWith('[edit-ops] parsed', {
      operations: 2,
      lineForm: 1,
      jsonForm: 1,
    });
  });

  it('refuses more operations than the cap, counting only real lines', () => {
    const log = vi.fn();
    expect(parse('add a\nadd b\n# c\nadd d', log)).toHaveProperty('operations');
    expect(parse('add a\nadd b\nadd c\nadd d', log)).toEqual({
      errors: [{ code: 'too_large', detail: '4' }],
    });
    expect(log).toHaveBeenLastCalledWith('[edit-ops] parse-rejected', {
      code: 'too_large',
      errors: 1,
      line: 0,
      column: 0,
    });
  });

  it('reports each malformed line with its line number', () => {
    const log = vi.fn();
    const outcome = parse('paint n1\n\nadd\n{"op":"add"}', log);
    expect(outcome).toEqual({
      errors: [
        { code: 'unknown_operation', operation: 1, line: 1, detail: 'paint' },
        { code: 'parse_error', operation: 2, line: 3, column: 4, detail: 'a target' },
        { code: 'parse_error', operation: 3, line: 4, detail: 'needs a target' },
      ],
    });
    expect(log).toHaveBeenCalledWith('[edit-ops] parse-rejected', {
      code: 'unknown_operation',
      errors: 3,
      line: 1,
      column: 0,
    });
  });

  it('refuses a line that is not JSON, an unclosed quote and an over-long line', () => {
    expect(parse('  {"op": ', () => {})).toEqual({
      errors: [
        { code: 'parse_error', operation: 1, line: 1, column: 3, detail: 'one JSON object' },
      ],
    });
    const unclosed = parse('add "n1', () => {});
    expect(unclosed).toMatchObject({ errors: [{ code: 'parse_error', line: 1 }] });
    const long = parse(`add ${'x'.repeat(EDIT_LINE_MAX_CHARS)}`);
    expect(long).toEqual({
      errors: [
        {
          code: 'parse_error',
          operation: 1,
          line: 1,
          column: EDIT_LINE_MAX_CHARS + 1,
          detail: `at most ${EDIT_LINE_MAX_CHARS} characters a line`,
        },
      ],
    });
  });

  it('stops at EDIT_MAX_ERRORS refusals', () => {
    const many = createParseEditOperations<Op, Refusal, 'add'>({
      maxOperations: 100,
      isOperationName: (word): word is 'add' => word === 'add',
      parseOperationWords: () => ({ raw: {} }),
      validateEditOperation: (_raw, operation) => ({ code: 'parse_error', operation }),
      lineParseError: (operation, line, _text, column) => ({
        code: 'parse_error',
        operation,
        line,
        column,
      }),
      tooLarge: () => ({ code: 'too_large' }),
      unknownOperation: (_word, operation) => ({ code: 'unknown_operation', operation }),
    });
    const outcome = many(Array.from({ length: 20 }, () => 'add').join('\n'));
    expect('errors' in outcome && outcome.errors).toHaveLength(EDIT_MAX_ERRORS);
  });
});
