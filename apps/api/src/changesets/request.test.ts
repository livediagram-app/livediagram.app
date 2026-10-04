import { describe, expect, it } from 'vitest';
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

  it('maps engine codes to statuses (CS9)', () => {
    expect(rejectionStatus('parse_error')).toBe(400);
    expect(rejectionStatus('unknown_operation')).toBe(400);
    expect(rejectionStatus('too_large')).toBe(413);
    expect(rejectionStatus('target_not_found')).toBe(422);
  });
});
