import { describe, expect, it } from 'vitest';
import { CHANGESET_MAX_OPERATIONS } from '@livediagram/api-schema';
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
    expect(replace({ mermaid: 'graph TD; a-->b', name: 'Flow', theme: 'ocean' })).toEqual({
      kind: 'replace',
      replace: { mermaid: 'graph TD; a-->b' },
      name: 'Flow',
      theme: 'ocean',
    });
    expect(replace({ elements: [], layout: 'auto' })).toEqual({
      kind: 'replace',
      replace: { elements: [], layout: 'auto' },
    });
    expect(replace({ mermaid: 'x', template: 'kanban' })).toBe('invalid_body');
    expect(replace({ elements: {} })).toBe('invalid_body');
    expect(replace({ elements: [], layout: 'sideways' })).toBe('invalid_body');
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
