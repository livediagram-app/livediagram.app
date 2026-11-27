import { describe, expect, it } from 'vitest';
import { CHANGESET_MAX_OPERATIONS, CHANGESET_SUMMARY_MAX } from '@liveplanner/api-schema';
import { parseChangesetRequest, rejectionStatus } from './request';

// docs/specs/024-agents/blueprints/agent-changesets.md "Interfaces and contracts", CS8 to CS10.
const ops = [{ op: 'rm', target: 'a' }];

describe('parseChangesetRequest', () => {
  it('cleans the summary: trimmed, controls removed, empty is none', () => {
    const value = (summary: unknown) => {
      const out = parseChangesetRequest({ operations: ops, summary });
      return out.ok ? out.value.summary : out.refusal;
    };
    expect(value('  add\u0007 payment\tservice  ')).toBe('add paymentservice');
    expect(value('   ')).toBeNull();
    expect(value(undefined)).toBeNull();
  });

  it('keeps a summary that reads like a refusal, and refuses only what is one', () => {
    const value = (summary: unknown) => {
      const out = parseChangesetRequest({ operations: ops, summary });
      return out.ok ? out.value.summary : out.refusal.body.error;
    };
    expect(value('invalid')).toBe('invalid');
    expect(value('too_long')).toBe('too_long');
    expect(value(42)).toBe('invalid_body');
    expect(value('x'.repeat(CHANGESET_SUMMARY_MAX + 1))).toBe('invalid_value');
  });

  it('takes a base of a revision and 16-hex fingerprints, and nothing else', () => {
    const ok = parseChangesetRequest({
      operations: ops,
      base: { rev: 4, elements: { a: '0123456789abcdef' } },
    });
    expect(ok.ok && ok.value.base).toEqual({ rev: 4, elements: { a: '0123456789abcdef' } });
    for (const base of [
      { rev: -1 },
      { rev: 1.5 },
      { rev: 1, elements: { a: 'nope' } },
      { rev: 1, elements: [] },
    ]) {
      const out = parseChangesetRequest({ operations: ops, base });
      expect(out.ok ? null : out.refusal.body.error).toBe('invalid_base');
    }
  });

  it('takes exactly one replace source of the right type', () => {
    const replace = (r: unknown) => {
      const out = parseChangesetRequest({ replace: r });
      return out.ok ? out.value.body : out.refusal.body.error;
    };
    expect(replace({ template: 'kanban', name: 'Flow', theme: 'ocean' })).toEqual({
      kind: 'replace',
      replace: { template: 'kanban' },
      name: 'Flow',
      theme: 'ocean',
    });
    expect(replace({ elements: [] })).toEqual({ kind: 'replace', replace: { elements: [] } });
    expect(replace({ elements: [], layout: 'auto' })).toBe('invalid_body');
    expect(replace({ elements: [], template: 'kanban' })).toBe('invalid_body');
    expect(replace({ elements: {} })).toBe('invalid_body');
    expect(replace({ elements: [], finish: 'sketch' })).toEqual({
      kind: 'replace',
      replace: { elements: [] },
      finish: 'sketch',
    });
    expect(replace({ elements: [], finish: 'glossy' })).toBe('invalid_body');
  });

  it('reads the line form from a string, logging the parse', () => {
    const logged: string[] = [];
    const out = parseChangesetRequest(
      { operations: '# rename\nset n3 label="Sign in"\n{"op":"rm","target":"n7"}' },
      (fingerprint) => logged.push(fingerprint),
    );
    expect(out.ok && out.value.body).toEqual({
      kind: 'operations',
      operations: [
        { op: 'set', target: 'n3', fields: { label: 'Sign in' } },
        { op: 'rm', target: 'n7' },
      ],
    });
    expect(logged).toEqual(['[edit-ops] parsed']);
  });

  it('refuses a line that does not read with where and why, and too many lines as too_large', () => {
    const bad = parseChangesetRequest({ operations: 'set n3 label="Sign in' });
    expect(bad.ok ? null : bad.refusal).toMatchObject({
      status: 400,
      body: { error: 'parse_error' },
    });
    expect(bad.ok ? '' : String(bad.refusal.body.text)).toContain('line 1');
    const many = parseChangesetRequest({
      operations: 'rm a\n'.repeat(CHANGESET_MAX_OPERATIONS + 1),
    });
    expect(many.ok ? null : many.refusal).toMatchObject({
      status: 413,
      body: { error: 'too_large' },
    });
  });

  it('refuses operations that are neither an array nor a string', () => {
    const out = parseChangesetRequest({ operations: { op: 'rm' } });
    expect(out.ok ? null : out.refusal.body.error).toBe('invalid_body');
  });

  it('maps engine codes to statuses (CS9)', () => {
    expect(rejectionStatus('parse_error')).toBe(400);
    expect(rejectionStatus('unknown_operation')).toBe(400);
    expect(rejectionStatus('too_large')).toBe(413);
    expect(rejectionStatus('target_not_found')).toBe(422);
  });
});

// docs/specs/024-agents/agent-changesets.md "Style".
describe('a style body', () => {
  const parsed = (style: unknown) => parseChangesetRequest({ style });
  const error = (style: unknown) => {
    const out = parsed(style);
    return out.ok ? null : { status: out.refusal.status, error: out.refusal.body.error };
  };

  it('takes a theme, a finish and a font, each one the catalogues hold', () => {
    const out = parsed({ theme: 'office', finish: 'sketch', font: 'inter' });
    expect(out.ok && out.value.body).toEqual({
      kind: 'style',
      style: { theme: 'office', finish: 'sketch', font: 'inter' },
    });
    const one = parsed({ font: 'oswald' });
    expect(one.ok && one.value.body).toEqual({ kind: 'style', style: { font: 'oswald' } });
  });

  it('refuses an empty style, a part that is no id and a key it does not take', () => {
    expect(error({})).toEqual({ status: 400, error: 'invalid_body' });
    expect(error('forest')).toEqual({ status: 400, error: 'invalid_body' });
    expect(error({ theme: ' ' })).toEqual({ status: 400, error: 'invalid_body' });
    expect(error({ theme: 7 })).toEqual({ status: 400, error: 'invalid_body' });
    expect(error({ colour: 'red' })).toEqual({ status: 400, error: 'invalid_body' });
  });

  it('refuses an unknown id, naming the valid ones', () => {
    for (const style of [{ theme: 'nope' }, { finish: 'crayon' }, { font: 'permanent-marker' }]) {
      const out = parsed(style);
      expect(out.ok).toBe(false);
      if (out.ok) continue;
      expect(out.refusal).toMatchObject({ status: 422, body: { error: 'invalid_value' } });
      expect((out.refusal.body.valid as string[]).length).toBeGreaterThan(2);
    }
    const theme = parsed({ theme: 'nope' });
    expect(theme.ok ? [] : theme.refusal.body.valid).toContain('forest');
  });

  it('is sent alone, never with operations or a replace', () => {
    const out = parseChangesetRequest({ style: { theme: 'forest' }, operations: ops });
    expect(out.ok ? null : out.refusal.body.error).toBe('invalid_body');
  });
});
