import { describe, expect, it } from 'vitest';
import { CHANGESET_MAX_OPERATIONS, type EditRejection } from '@livehuddle/api-schema';
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
    expect(one('add sticky id=verify label="Verify email" text=sm below:n3 gap:40')).toEqual({
      op: 'add',
      kind: 'sticky',
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
    expect(one('add sticky RIGHT-OF:n3')).toMatchObject({ place: { rel: 'right-of', ref: 'n3' } });
  });

  it('reads set with selector terms, JSON values, unsets and all', () => {
    expect(
      one('set type:sticky in:f2 fill=green width=200 textBold=true note= tags=["a","b"] all'),
    ).toEqual({
      op: 'set',
      target: 'type:sticky in:f2',
      fields: { fill: 'green', width: 200, textBold: true, note: null, tags: ['a', 'b'] },
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
    expect(one('set n1 label=truer textBold=false')).toMatchObject({
      fields: { label: 'truer', textBold: false },
    });
  });

  it('reads quoted labels on either side of a joined -> as one selector term', () => {
    expect(one('rm "Login"->"Address"')).toEqual({ op: 'rm', target: '"Login"->"Address"' });
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4: no arrow is made or rewired, so
  // `connect`, `rewire` and `insert` are no operations.
  it('reads connect, rewire and insert as words that are not operations', () => {
    for (const line of [
      'connect n3 -> n4',
      'connect a->b->c',
      'rewire a3 to=n4',
      'insert sticky between n3 n4',
    ]) {
      const [error] = errorsOf(line);
      expect(error, line).toMatchObject({ code: 'unknown_operation', line: 1 });
    }
  });

  it('reads rm and move', () => {
    expect(one('rm n7 all')).toEqual({ op: 'rm', target: 'n7', all: true });
    expect(one('move n4 align:f2')).toEqual({
      op: 'move',
      target: 'n4',
      place: { rel: 'align', ref: 'f2' },
    });
    expect(one('move type:sticky by=10,-5 all')).toEqual({
      op: 'move',
      target: 'type:sticky',
      by: [10, -5],
      all: true,
    });
  });

  it('reads order, layout and test', () => {
    expect(one('order n3 front')).toEqual({ op: 'order', target: 'n3', to: 'front' });
    expect(one('order n3 above=n4')).toEqual({ op: 'order', target: 'n3', above: 'n4' });
    expect(one('layout type:sticky')).toEqual({ op: 'layout', target: 'type:sticky' });
    // The layered layout went with the arrows (part 4): `layout` takes no style or direction.
    expect(errorsOf('layout type:sticky style=tree')[0]!.details[0]).toBe(
      'line 1, column 20: expected no key=value on layout',
    );
    expect(one('test n3 label=Login')).toEqual({
      op: 'test',
      target: 'n3',
      fields: { label: 'Login' },
    });
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3: nothing holds any more.
  it('reads wrap and unwrap as words that are not operations, and inside: as no placement', () => {
    for (const line of ['wrap n3 n4 in boundary', 'unwrap f2']) {
      const [error] = errorsOf(line);
      expect(error, line).toMatchObject({ code: 'unknown_operation', line: 1 });
    }
    expect(errorsOf('move n4 inside:f2')[0]!.details[0]).toMatch(
      /takes exactly one of "place", "by"/,
    );
    expect(errorsOf('add sticky inside:f2')[0]!.details[0]).toMatch(
      /expected a placement: .* or align:<ref>$/,
    );
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

  // A word that reads as a placement but is not one (right: for right-of:) is told which placements there are.
  it('names the placements for a word that is not one', () => {
    const [error] = errorsOf('add sticky label=x right:n3');
    expect(error!.details[0]).toBe(
      'line 1, column 20: expected a placement: right-of:<ref>, left-of:<ref>, above:<ref>, below:<ref> or align:<ref>',
    );
    expect(error!.hint).toBe(
      'write a placement: right-of:<ref>, left-of:<ref>, above:<ref>, below:<ref> or align:<ref>',
    );
  });

  // `after:` named arrows' flow and left with the diagram vocabulary (not-in-livehuddle.md "The element engine",
  // part 5, D33): it reads as a word that is no placement.
  it('reads after: as no placement', () => {
    const [error] = errorsOf('add sticky label=x after:n3');
    expect(error!.details[0]).toMatch(/^line 1, column 20: expected a placement: right-of:<ref>/);
    expect(errorsOf('move n3 after:n4')[0]!.code).toBe('parse_error');
  });

  it('refuses what each operation cannot read', () => {
    expect(
      [
        'add',
        'add "sticky"',
        'add sticky n3',
        'add sticky below:n3 above:n4',
        'add sticky at:1',
        'add sticky gap:10',
        'add sticky at:1,2 gap:10',
        'set',
        'set n3',
        'rm n3 label=x',
        'move n3 by=1',
        'move n3 by=a,1',
        'set n3 tags=[1,',
      ].map(detail),
    ).toEqual([
      'line 1, column 4: expected a kind: sticky, text, room, …',
      'line 1, column 5: expected a kind: sticky, text, room, …',
      'line 1, column 12: expected key=value or a placement',
      'line 1, column 21: expected one placement (or align: with a side)',
      'line 1, column 12: expected at:x,y with two numbers',
      'line 1, column 12: expected gap: with a side or align placement',
      'line 1, column 19: expected gap: with a side or align placement',
      'line 1, column 4: expected a selector: a ref, a "label" or key:value terms',
      'line 1, column 7: expected key=value',
      'line 1, column 7: expected no key=value on rm',
      'line 1, column 9: expected by=dx,dy with two numbers',
      'line 1, column 9: expected by=dx,dy with two numbers',
      'line 1, column 8: expected a JSON value after tags=',
    ]);
  });

  it('places a missing gap placement at the gap word', () => {
    expect(errorsOf('add sticky label=x GAP:10')[0]).toMatchObject({ column: 20 });
  });

  it('checks a line form operation as the JSON form is checked', () => {
    expect(errorsOf('add sticky below:n3 gap:99999')[0]).toMatchObject({
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
    'add sticky id=verify label="Verify email" text=sm below:n3 gap:40',
    'add text label=Note at:0,-20',
    'set type:sticky fill=green width=200 textBold=true note= tags=["a","b"] all',
    'set "Orders service" label="200" title="a: b" text="#tag" value="" data={"x":"a b"}',
    'rm n7 all',
    'move n4 right-of:"Orders service"',
    'move type:sticky by=10,-5 all',
    'order n3 back',
    'order n3 above=n4',
    'order n3 below="Orders DB"',
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
      'add sticky id=verify label="Verify email" text=sm below:n3 gap:40',
      'add text label=Note at:0,-20',
      'set type:sticky fill=green width=200 textBold=true note= tags=["a","b"] all',
      'set "Orders service" label="200" title="a: b" text="#tag" value="" data={"x":"a b"}',
      'rm n7 all',
      'move n4 right-of:"Orders service"',
      'move type:sticky by=10,-5 all',
      'order n3 back',
      'order n3 above=n4',
      'order n3 below="Orders DB"',
      'layout n3',
      'test n3 label=Login',
      '{"op":"add","element":{"id":"x","type":"text","label":"a b"}}',
    ]);
  });

  it('refuses gap: with no number rather than reading 0', () => {
    for (const line of ['add sticky below:n3 gap:', 'add sticky below:n3 gap:wide']) {
      const [error] = errorsOf(line);
      expect(error!.details.join(' ')).toContain('a number after gap:');
    }
  });

  it('prints an add with no fields and no placement', () => {
    expect(formatOperation({ op: 'add', kind: 'sticky' })).toBe('add sticky');
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
