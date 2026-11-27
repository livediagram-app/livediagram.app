import { describe, expect, it } from 'vitest';
import { CHANGESET_MAX_OPERATIONS, CHANGESET_SUMMARY_MAX } from '@livediagram/api-schema';
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
    expect(replace({ elements: [], finish: 'sketch' })).toEqual({
      kind: 'replace',
      replace: { elements: [] },
      finish: 'sketch',
    });
    expect(replace({ elements: [], finish: 'glossy' })).toBe('invalid_body');
  });

  // agent-changesets.md "A style restyles an existing tab".
  it('takes a style of at least one known theme, finish or font', () => {
    const style = (s: unknown) => {
      const out = parseChangesetRequest({ style: s });
      return out.ok ? out.value.body : out.refusal;
    };
    expect(style({ theme: 'forest', finish: 'sketch', font: 'inter' })).toEqual({
      kind: 'style',
      style: { theme: 'forest', finish: 'sketch', font: 'inter' },
    });
    expect(style({ finish: 'marker' })).toEqual({ kind: 'style', style: { finish: 'marker' } });
    for (const empty of [{}, 'forest', null]) {
      expect(style(empty)).toMatchObject({ status: 400, body: { error: 'invalid_body' } });
    }
    expect(style({ theme: 3 })).toMatchObject({
      body: { message: '"style.theme" must be a string' },
    });
    const unknown = style({ theme: 'forest', font: 'comic' }) as {
      status: number;
      body: Record<string, unknown>;
    };
    expect(unknown.status).toBe(422);
    expect(unknown.body).toMatchObject({ error: 'invalid_value', field: 'font' });
    expect(unknown.body.valid).toContain('inter');
    expect(unknown.body.message).toMatch(/^"style.font" "comic" is not one of: inter, /);
    expect(style({ theme: 'nope' })).toMatchObject({ body: { field: 'theme' } });
    expect(style({ finish: 'glossy' })).toMatchObject({
      body: { field: 'finish', valid: ['flexible', 'professional', 'sketch', 'marker'] },
    });
  });

  it('takes exactly one of operations, replace and style', () => {
    const error = (raw: Record<string, unknown>) => {
      const out = parseChangesetRequest(raw);
      return out.ok ? null : out.refusal.body.error;
    };
    expect(error({ operations: ops, style: { theme: 'forest' } })).toBe('invalid_body');
    expect(error({ replace: { elements: [] }, style: { theme: 'forest' } })).toBe('invalid_body');
    expect(error({})).toBe('invalid_body');
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
