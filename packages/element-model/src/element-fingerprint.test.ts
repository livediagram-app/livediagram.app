import { describe, expect, it } from 'vitest';
import { canonicalJson, ELEMENT_FINGERPRINT_LENGTH, fingerprintsFor } from './element-fingerprint';

// docs/specs/024-agents/agent-changesets.md "What a changeset is". Each product's own test reads the pair it binds
// over its live fields.
const { canonicalElementJson, elementFingerprint } = fingerprintsFor(['commentThread', 'action']);

describe('canonicalJson', () => {
  it('sorts keys at every depth, keeps array order and drops what JSON drops', () => {
    expect(
      canonicalJson({ b: 1, a: { d: [3, undefined, 1], c: null }, f: () => 1, u: undefined }),
    ).toBe('{"a":{"c":null,"d":[3,null,1]},"b":1}');
    expect(canonicalJson('x')).toBe('"x"');
    expect(canonicalJson(undefined)).toBe('null');
  });
});

describe('fingerprintsFor', () => {
  const el = { id: 'a', type: 'shape', label: 'Hi', x: 1 };

  it('is 16 hex characters, the same for the same content in any key order', () => {
    const fp = elementFingerprint(el);
    expect(fp).toMatch(/^[0-9a-f]+$/);
    expect(fp).toHaveLength(ELEMENT_FINGERPRINT_LENGTH);
    expect(elementFingerprint({ x: 1, label: 'Hi', type: 'shape', id: 'a' })).toBe(fp);
    expect(elementFingerprint({ ...el, label: 'Bye' })).not.toBe(fp);
  });

  it('leaves out the live fields it was given, and checklist ticks', () => {
    const fp = elementFingerprint(el);
    expect(elementFingerprint({ ...el, commentThread: { comments: [], resolved: true } })).toBe(fp);
    expect(elementFingerprint({ ...el, action: { id: 'x' } })).toBe(fp);
    expect(elementFingerprint({ ...el, responses: [1] })).not.toBe(fp);
    const list = (done: boolean) => ({
      ...el,
      checklistItems: [{ id: 'i', text: 'Do', done }, 'odd', null],
    });
    expect(elementFingerprint(list(true))).toBe(elementFingerprint(list(false)));
    expect(canonicalElementJson({ ...el, checklistItems: 'not a list' })).toContain('"not a list"');
  });

  it('binds each product its own live fields', () => {
    const other = fingerprintsFor(['responses']);
    expect(other.elementFingerprint({ ...el, responses: [1] })).toBe(other.elementFingerprint(el));
    expect(other.elementFingerprint({ ...el, action: { id: 'x' } })).not.toBe(
      other.elementFingerprint(el),
    );
  });
});
