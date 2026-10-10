import { describe, expect, it } from 'vitest';
import { CHANGESET_MAX_OPERATIONS, type EditRejection } from '@livediagram/api-schema';
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
  it('reads add with a kind, an id, fields and a placement', () => {
    expect(one('add square id=verify label="Verify email" text=sm below:n3 gap:40')).toEqual({
      op: 'add',
      kind: 'square',
      id: 'verify',
      fields: { label: 'Verify email', text: 'sm' },
      place: { rel: 'below', ref: 'n3', gap: 40 },
    });
    expect(one('add text label=Note at:0,-20')).toEqual({
      op: 'add',
      kind: 'text',
      fields: { label: 'Note' },
      place: { rel: 'at', x: 0, y: -20 },
    });
    expect(one('add sticky right-of:"Orders service"')).toEqual({
      op: 'add',
      kind: 'sticky',
      place: { rel: 'right-of', ref: '"Orders service"' },
    });
    expect(one('add square RIGHT-OF:n3')).toMatchObject({ place: { rel: 'right-of', ref: 'n3' } });
  });

  it('reads set with selector terms, JSON values, unsets and all', () => {
    expect(
      one('set type:sticky in:f2 fill=green width=200 locked=true note= tags=["a","b"] all'),
    ).toEqual({
      op: 'set',
      target: 'type:sticky in:f2',
      fields: { fill: 'green', width: 200, locked: true, note: null, tags: ['a', 'b'] },
      all: true,
    });
    expect(one('set "Orders service" label="200" fill=#ff0000')).toEqual({
      op: 'set',
      target: '"Orders service"',
      fields: { label: '200', fill: '#ff0000' },
    });
  });

  it('reads an unquoted value that starts with a digit but is not a number as a string (EO19)', () => {
    expect(one('set n1 label=2FA')).toMatchObject({ fields: { label: '2FA' } });
    expect(one('set n1 label=3D note=1st')).toMatchObject({ fields: { label: '3D', note: '1st' } });
    expect(one('set n1 label=1.2.3 width=-12.5e1')).toMatchObject({
      fields: { label: '1.2.3', width: -125 },
    });
    expect(one('set n1 label=truer locked=false')).toMatchObject({
      fields: { label: 'truer', locked: false },
    });
  });

  it('reads quoted labels on either side of a joined -> (rm, connect)', () => {
    expect(one('rm "Login"->"Address"')).toEqual({ op: 'rm', target: '"Login"->"Address"' });
    expect(one('connect "Sign in"->"Pay" label=a->b')).toEqual({
      op: 'connect',
      from: '"Sign in"',
      to: '"Pay"',
      fields: { label: 'a->b' },
    });
    expect(one("connect n1->'Pay now'")).toMatchObject({ from: 'n1', to: "'Pay now'" });
  });

  it('refuses a connect with more than two ends rather than dropping one', () => {
    for (const line of ['connect a->b->c', 'connect a -> b -> c', 'connect a->b -> c']) {
      const [error] = errorsOf(line);
      expect(error!.code).toBe('parse_error');
      expect(error!.details.join(' ')).toContain('one -> in connect: <a> -> <b>');
    }
  });

  it('reads rm, move, connect and rewire', () => {
    expect(one('rm n7 all keep-arrows')).toEqual({
      op: 'rm',
      target: 'n7',
      all: true,
      keepArrows: true,
    });
    expect(one('move n4 inside:f2')).toEqual({
      op: 'move',
      target: 'n4',
      place: { rel: 'inside', ref: 'f2' },
    });
    expect(one('move type:sticky by=10,-5 all')).toEqual({
      op: 'move',
      target: 'type:sticky',
      by: [10, -5],
      all: true,
    });
    expect(one('connect n3 -> verify id=a9 label=ok line=angled again')).toEqual({
      op: 'connect',
      from: 'n3',
      to: 'verify',
      id: 'a9',
      fields: { label: 'ok', line: 'angled' },
      again: true,
    });
    expect(one('connect n3->n4')).toEqual({ op: 'connect', from: 'n3', to: 'n4' });
    expect(one('connect "Web app" -> "API gateway"')).toEqual({
      op: 'connect',
      from: '"Web app"',
      to: '"API gateway"',
    });
    expect(one('rewire a3 to=verify')).toEqual({ op: 'rewire', target: 'a3', to: 'verify' });
  });

  it('reads insert, wrap, unwrap, order, layout and test', () => {
    expect(one('insert diamond id=valid label=Valid? between n3 n4')).toEqual({
      op: 'insert',
      kind: 'diamond',
      id: 'valid',
      fields: { label: 'Valid?' },
      between: ['n3', 'n4'],
    });
    expect(
      one('wrap n3 "Orders DB" type:sticky in:f2 in lane id=svc label=Services tidy make-room'),
    ).toEqual({
      op: 'wrap',
      targets: ['n3', '"Orders DB"', 'type:sticky in:f2'],
      in: 'lane',
      id: 'svc',
      fields: { label: 'Services' },
      tidy: true,
      makeRoom: true,
    });
    expect(one('unwrap f2')).toEqual({ op: 'unwrap', target: 'f2' });
    expect(one('order n3 front')).toEqual({ op: 'order', target: 'n3', to: 'front' });
    expect(one('order n3 above=n4')).toEqual({ op: 'order', target: 'n3', above: 'n4' });
    expect(one('layout in:f2 style=tree direction=right')).toEqual({
      op: 'layout',
      target: 'in:f2',
      style: 'tree',
      direction: 'right',
    });
    expect(one('test n3 label=Login')).toEqual({
      op: 'test',
      target: 'n3',
      fields: { label: 'Login' },
    });
  });

  it('keeps members that name one element apart, and takes the rest together', () => {
    expect(one('wrap n3 n4 in frame')).toEqual({ op: 'wrap', targets: ['n3', 'n4'], in: 'frame' });
    expect(one('wrap selected label~"to do" in frame')).toEqual({
      op: 'wrap',
      targets: ['selected label~"to do"'],
      in: 'frame',
    });
  });

  it('skips comments and blank lines, mixes forms, and numbers operations among them', () => {
    const text = [
      '# rename the login step',
      '',
      'set n3 label="Sign in"',
      '  {"op":"rm","target":"n7"}',
      '   # done',
    ].join('\n');
    expect(operationsOf(text)).toEqual([
      { op: 'set', target: 'n3', fields: { label: 'Sign in' } },
      { op: 'rm', target: 'n7' },
    ]);
    expect(errorsOf('# a\nset n3\n{"op":"nope"}')).toMatchObject([
      { code: 'parse_error', operation: 1, line: 2 },
      { code: 'unknown_operation', operation: 2, line: 3 },
    ]);
  });

  it('logs what it parsed and what it refused', () => {
    const calls: [string, Record<string, unknown>][] = [];
    const log: EditLog = (fingerprint, fields) => void calls.push([fingerprint, fields]);
    parseEditOperations('set n3 label=x\n{"op":"rm","target":"n7"}', log);
    parseEditOperations('set n3', log);
    expect(calls).toEqual([
      ['[edit-ops] parsed', { operations: 2, lineForm: 1, jsonForm: 1 }],
      ['[edit-ops] parse-rejected', { code: 'parse_error', errors: 1, line: 1, column: 7 }],
    ]);
  });
});

describe('parseEditOperations: refusals', () => {
  const detail = (text: string) => errorsOf(text)[0]!.details[0];

  it('names the line, the column and what was expected, with a caret', () => {
    const [error] = errorsOf('set n3 label="Sign in');
    expect(error).toEqual({
      code: 'parse_error',
      operation: 1,
      line: 1,
      column: 14,
      details: [
        'line 1, column 14: expected a closing "',
        'set n3 label="Sign in',
        '             ^',
      ],
      hint: 'quote values with spaces: label="Sign in"',
    });
    expect(formatRejections([error!])).toEqual([
      'error parse_error · line 1',
      '  line 1, column 14: expected a closing "',
      '  set n3 label="Sign in',
      '               ^',
      '  hint: quote values with spaces: label="Sign in"',
      'nothing was applied',
    ]);
  });

  it('refuses what each operation cannot read', () => {
    expect(
      [
        'add',
        'add "square"',
        'add square n3',
        'add square below:n3 above:n4',
        'add square at:1',
        'add square gap:10',
        'add square at:1,2 gap:10',
        'insert square between n3',
        'connect n3 n4',
        'connect -> n4',
        'connect n3 ->',
        'wrap n3 n4',
        'wrap in frame',
        'wrap n3 in frame label=x n4',
        'set',
        'set n3',
        'rm n3 label=x',
        'move n3 by=1',
        'move n3 by=a,1',
        'connect n3 -> n4 tags=[1,',
        'wrap n3 in frame tags=[1,',
        'set n3 tags=[1,',
      ].map(detail),
    ).toEqual([
      'line 1, column 4: expected a kind: square, text, sticky, …',
      'line 1, column 5: expected a kind: square, text, sticky, …',
      'line 1, column 12: expected key=value or a placement',
      'line 1, column 21: expected one placement',
      'line 1, column 12: expected at:x,y with two numbers',
      'line 1, column 12: expected gap: with a side, after or align placement',
      'line 1, column 19: expected gap: with a side, after or align placement',
      'line 1, column 25: expected between <a> <b>',
      'line 1, column 9: expected connect <a> -> <b>',
      'line 1, column 9: expected connect <a> -> <b>',
      'line 1, column 12: expected a selector after ->',
      'line 1, column 9: expected in frame or in lane',
      'line 1, column 6: expected the members to wrap',
      'line 1, column 26: expected key=value or tidy, absorb, make-room',
      'line 1, column 4: expected a selector: a ref, a "label" or key:value terms',
      'line 1, column 7: expected key=value',
      'line 1, column 7: expected no key=value on rm',
      'line 1, column 9: expected by=dx,dy with two numbers',
      'line 1, column 9: expected by=dx,dy with two numbers',
      'line 1, column 18: expected a JSON value after tags=',
      'line 1, column 18: expected a JSON value after tags=',
      'line 1, column 8: expected a JSON value after tags=',
    ]);
  });

  it('places a missing gap placement at the gap word', () => {
    expect(errorsOf('add square label=x GAP:10')[0]).toMatchObject({ column: 20 });
  });

  it('checks a line form operation as the JSON form is checked', () => {
    expect(errorsOf('add square below:n3 gap:99999')[0]).toMatchObject({
      code: 'parse_error',
      line: 1,
      details: ['member "place": expected "gap" a whole number from 0 to 2000'],
    });
  });

  it('names a word that is not an operation, and a bad JSON line', () => {
    expect(errorsOf('sett n3')[0]).toMatchObject({
      code: 'unknown_operation',
      line: 1,
      hint: 'did you mean set?',
    });
    expect(errorsOf('  {"op":')[0]!.details[0]).toBe('line 1, column 3: expected one JSON object');
  });

  it('caps the line length, the operation count and the errors reported', () => {
    expect(detail(`set n3 label=${'x'.repeat(EDIT_LINE_MAX_CHARS)}`)).toBe(
      `line 1, column ${EDIT_LINE_MAX_CHARS + 1}: expected at most ${EDIT_LINE_MAX_CHARS} characters a line`,
    );
    const many = Array.from({ length: CHANGESET_MAX_OPERATIONS + 1 }, () => 'rm n1').join('\n');
    expect(errorsOf(many)).toEqual([expect.objectContaining({ code: 'too_large' })]);
    expect(
      errorsOf(Array.from({ length: EDIT_MAX_ERRORS + 3 }, () => 'set').join('\n')),
    ).toHaveLength(EDIT_MAX_ERRORS);
  });
});

describe('formatOperation round trip', () => {
  const lines = [
    'add square id=verify label="Verify email" text=sm below:n3 gap:40',
    'add text label=Note at:0,-20',
    'set type:sticky in:f2 fill=green width=200 locked=true note= tags=["a","b"] all',
    'set "Orders service" label="200" title="a: b" text="#tag" value="" data={"x":"a b"}',
    'rm n7 all keep-arrows',
    'move n4 right-of:"Orders service"',
    'move type:sticky by=10,-5 all',
    'connect n3 -> verify id=a9 label=ok again',
    'rewire a3 from=n1',
    'rewire a3 to="Orders DB"',
    'insert diamond label=Valid? between n3 "Orders DB"',
    'wrap n3 type:sticky in frame label=Services absorb',
    'unwrap f2',
    'order n3 back',
    'order n3 above=n4',
    'order n3 below="Orders DB"',
    'layout in:f2 style=tree direction=right',
    'layout n3',
    'test n3 label=Login',
    '{"op":"add","element":{"id":"x","type":"text","label":"a b"}}',
  ];

  it('parses back to the same operations', () => {
    const operations = operationsOf(lines.join('\n'));
    const printed = operations.map(formatOperation);
    expect(operationsOf(printed.join('\n'))).toEqual(operations);
  });

  it('prints the canonical line form', () => {
    expect(operationsOf(lines.join('\n')).map(formatOperation)).toEqual([
      'add square id=verify label="Verify email" text=sm below:n3 gap:40',
      'add text label=Note at:0,-20',
      'set type:sticky in:f2 fill=green width=200 locked=true note= tags=["a","b"] all',
      'set "Orders service" label="200" title="a: b" text="#tag" value="" data={"x":"a b"}',
      'rm n7 all keep-arrows',
      'move n4 right-of:"Orders service"',
      'move type:sticky by=10,-5 all',
      'connect n3 -> verify id=a9 label=ok again',
      'rewire a3 from=n1',
      'rewire a3 to="Orders DB"',
      'insert diamond label=Valid? between n3 "Orders DB"',
      'wrap n3 type:sticky in frame label=Services absorb',
      'unwrap f2',
      'order n3 back',
      'order n3 above=n4',
      'order n3 below="Orders DB"',
      'layout in:f2 style=tree direction=right',
      'layout n3',
      'test n3 label=Login',
      '{"op":"add","element":{"id":"x","type":"text","label":"a b"}}',
    ]);
  });

  it('prints an add with no fields and no placement', () => {
    expect(formatOperation({ op: 'add', kind: 'square' })).toBe('add square');
  });

  it('quotes selectors from the JSON form that hold spaces', () => {
    expect(
      formatOperation({ op: 'move', target: 'n1', place: { rel: 'below', ref: 'Orders service' } }),
    ).toBe('move n1 below:"Orders service"');
    expect(formatOperation({ op: 'set', target: 'n1', fields: { label: 'x y' } })).toBe(
      'set n1 label="x y"',
    );
  });
});
