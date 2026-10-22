import { describe, expect, it } from 'vitest';
import { CHANGESET_MAX_OPERATIONS, type EditRejection } from '@liveplanner/api-schema';
import { formatOperation } from './format-operation';
import { parseEditOperations } from './parse';
import { formatRejections } from './rejections';
import type { EditLog, EditOperation } from './types';
import { EDIT_LINE_MAX_CHARS, EDIT_MAX_ERRORS } from './vocabulary';

const operationsOf = (text: string): EditOperation[] => {
  const outcome = parseEditOperations(text);
  if ('errors' in outcome) throw new Error(formatRejections(outcome.errors).join('\n'));
  return outcome.operations;
};
const errorsOf = (text: string): EditRejection[] => {
  const outcome = parseEditOperations(text);
  if (!('errors' in outcome)) throw new Error('expected errors');
  return outcome.errors;
};
const one = (text: string) => operationsOf(text)[0];

describe('parseEditOperations: the line form (the vocabulary)', () => {
  it('reads set with selector terms, JSON values, unsets and all', () => {
    expect(
      one(
        'set type:plan-view label~o textSize=lg width=200 locked=true label= planView={"view":"gantt"} all',
      ),
    ).toEqual({
      op: 'set',
      target: 'type:plan-view label~o',
      fields: {
        textSize: 'lg',
        width: 200,
        locked: true,
        label: null,
        planView: { view: 'gantt' },
      },
      all: true,
    });
    expect(one('set "Sprint board" label="200"')).toEqual({
      op: 'set',
      target: '"Sprint board"',
      fields: { label: '200' },
    });
  });

  it('reads an unquoted value that starts with a digit but is not a number as a string (EO19)', () => {
    expect(one('set w1 label=2FA')).toMatchObject({ fields: { label: '2FA' } });
    expect(one('set w1 label=1e3')).toMatchObject({ fields: { label: 1000 } });
  });

  it('reads rm and test', () => {
    expect(one('rm "Due dates" all')).toEqual({ op: 'rm', target: '"Due dates"', all: true });
    expect(one('test w1 label=Workload')).toEqual({
      op: 'test',
      target: 'w1',
      fields: { label: 'Workload' },
    });
  });

  it('reads add as a JSON line, the only form a whole element has', () => {
    const element = { type: 'shape', shape: 'plan-view', planView: { view: 'gantt' } };
    expect(one(JSON.stringify({ op: 'add', element }))).toEqual({ op: 'add', element });
  });

  it('skips comments and blank lines, mixes forms, and numbers operations among them', () => {
    const text = [
      '# rename the workload chart',
      '',
      'set w1 label="Who has what"',
      '  {"op":"rm","target":"m3"}',
      '   # done',
    ].join('\n');
    expect(operationsOf(text)).toEqual([
      { op: 'set', target: 'w1', fields: { label: 'Who has what' } },
      { op: 'rm', target: 'm3' },
    ]);
    expect(errorsOf('# a\nset w1\n{"op":"nope"}')).toMatchObject([
      { code: 'parse_error', operation: 1, line: 2 },
      { code: 'unknown_operation', operation: 2, line: 3 },
    ]);
  });

  it('logs what it parsed and what it refused', () => {
    const calls: [string, Record<string, unknown>][] = [];
    const log: EditLog = (fingerprint, fields) => void calls.push([fingerprint, fields]);
    parseEditOperations('set w1 label=x\n{"op":"rm","target":"m3"}', log);
    parseEditOperations('set w1', log);
    expect(calls).toEqual([
      ['[edit-ops] parsed', { operations: 2, lineForm: 1, jsonForm: 1 }],
      ['[edit-ops] parse-rejected', { code: 'parse_error', errors: 1, line: 1, column: 7 }],
    ]);
  });
});

describe('parseEditOperations: refusals', () => {
  const detail = (text: string) => errorsOf(text)[0]!.details[0];

  it('names the line, the column and what was expected, with a caret', () => {
    const [error] = errorsOf('set w1 label="Sprint board');
    expect(error).toEqual({
      code: 'parse_error',
      operation: 1,
      line: 1,
      column: 14,
      details: [
        'line 1, column 14: expected a closing "',
        'set w1 label="Sprint board',
        '             ^',
      ],
      hint: 'quote values with spaces: label="Sprint board"',
    });
    expect(formatRejections([error!])).toEqual([
      'error parse_error · line 1',
      '  line 1, column 14: expected a closing "',
      '  set w1 label="Sprint board',
      '               ^',
      '  hint: quote values with spaces: label="Sprint board"',
      'nothing was applied',
    ]);
  });

  it('refuses an add in the line form, pointing at the JSON line', () => {
    expect(errorsOf('add plan-view planView={"view":"gantt"}')[0]).toMatchObject({
      code: 'parse_error',
      details: [
        'line 1, column 1: expected a whole element as a JSON line: {"op":"add","element":{"type":"shape","shape":"plan-view",…}}',
        expect.any(String),
        expect.any(String),
      ],
      hint: 'liveplanner schema <kind> shows what an element holds',
    });
  });

  it('refuses what each operation cannot read', () => {
    expect(detail('set')).toBe(
      'line 1, column 4: expected a selector: a ref, a "label" or key:value terms',
    );
    expect(detail('set w1')).toBe('line 1, column 7: expected key=value');
    expect(detail('test w1')).toBe('line 1, column 8: expected key=value');
    expect(detail('rm w1 label=x')).toBe('line 1, column 7: expected no key=value on rm');
    expect(detail('set w1 planView={"view"')).toBe(
      'line 1, column 8: expected a JSON value after planView=',
    );
  });

  it('names a word that is not an operation, and a bad JSON line', () => {
    expect(errorsOf('sett w1')[0]).toMatchObject({
      code: 'unknown_operation',
      line: 1,
      hint: 'did you mean set?',
    });
    expect(errorsOf('connect a -> b')[0]!.details).toEqual([
      '"connect" is not an operation',
      'operations: add set rm test',
    ]);
    expect(errorsOf('  {"op":')[0]!.details[0]).toBe('line 1, column 3: expected one JSON object');
  });

  it('caps the line length, the operation count and the errors reported', () => {
    expect(detail(`set w1 label=${'x'.repeat(EDIT_LINE_MAX_CHARS)}`)).toBe(
      `line 1, column ${EDIT_LINE_MAX_CHARS + 1}: expected at most ${EDIT_LINE_MAX_CHARS} characters a line`,
    );
    const many = Array.from({ length: CHANGESET_MAX_OPERATIONS + 1 }, () => 'rm m1').join('\n');
    expect(errorsOf(many)).toEqual([expect.objectContaining({ code: 'too_large' })]);
    expect(
      errorsOf(Array.from({ length: EDIT_MAX_ERRORS + 3 }, () => 'set').join('\n')),
    ).toHaveLength(EDIT_MAX_ERRORS);
  });
});

describe('formatOperation round trip', () => {
  const lines = [
    'set type:plan-view label~o textSize=lg all',
    'set "Sprint board" label="Sprint 14" planView={"view":"gantt"}',
    'set w1 label=',
    'rm w1',
    'rm type:plan-view all',
    'test w1 label=Workload width=500',
    '{"op":"add","element":{"type":"shape","shape":"plan-view","planView":{"view":"gantt"}}}',
  ];

  it('parses back to the same operations', () => {
    for (const line of lines) {
      const operation = one(line)!;
      expect(one(formatOperation(operation))).toEqual(operation);
    }
  });

  it('prints the canonical line form', () => {
    expect(lines.map((line) => formatOperation(one(line)!))).toEqual(lines);
    expect(formatOperation({ op: 'set', target: 'w1', fields: { label: '2FA', width: 1 } })).toBe(
      'set w1 label="2FA" width=1',
    );
  });
});
