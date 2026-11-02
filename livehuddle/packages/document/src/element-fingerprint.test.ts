import { describe, expect, it } from 'vitest';
import {
  canonicalElementJson,
  elementFingerprint,
  ELEMENT_FINGERPRINT_LENGTH,
} from './element-fingerprint';
import type { Element, ShapeElement } from './index';

const square: ShapeElement = {
  id: 'n3',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 200,
  width: 140,
  height: 60,
  label: 'Login',
};

describe('canonicalElementJson', () => {
  it('sorts keys at every depth and keeps array order', () => {
    const el = { b: 1, a: { d: [3, 1, { z: 1, y: 2 }], c: 2 }, id: 'x' } as unknown as Element;
    expect(canonicalElementJson(el)).toBe('{"a":{"c":2,"d":[3,1,{"y":2,"z":1}]},"b":1,"id":"x"}');
  });

  it('drops undefined members', () => {
    const el = { ...square, note: undefined } as Element;
    expect(canonicalElementJson(el)).toBe(canonicalElementJson(square));
  });
});

describe('elementFingerprint', () => {
  it('is 16 lowercase hex characters and stable (golden value shared by api, MCP and CLI)', () => {
    const fp = elementFingerprint(square);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
    expect(fp).toHaveLength(ELEMENT_FINGERPRINT_LENGTH);
    // Cross-checked against an independent BigInt FNV-1a over the canonical JSON.
    expect(canonicalElementJson(square)).toBe(
      '{"height":60,"id":"n3","label":"Login","shape":"square","type":"shape","width":140,"x":0,"y":200}',
    );
    expect(fp).toBe('ccbe82047226af3e');
  });

  it('does not depend on key order', () => {
    const reordered = Object.fromEntries(Object.entries(square).reverse()) as unknown as Element;
    expect(elementFingerprint(reordered)).toBe(elementFingerprint(square));
  });

  it('changes with any authored field', () => {
    expect(elementFingerprint({ ...square, label: 'Sign in' })).not.toBe(
      elementFingerprint(square),
    );
    expect(elementFingerprint({ ...square, x: 1 })).not.toBe(elementFingerprint(square));
  });

  it('ignores live fields and checklist ticks', () => {
    const live: ShapeElement = {
      ...square,
      commentThread: {
        resolved: false,
        comments: [{ id: 'c', text: 'hi', createdAt: 1, authorName: 'Bea', authorColor: '#f00' }],
      },
      responses: [{ participantId: 'p', value: 'done', at: 1 }],
    };
    expect(elementFingerprint(live)).toBe(elementFingerprint(square));
    const list = (done: boolean): ShapeElement => ({
      ...square,
      checklistItems: [{ text: 'Write it', done }],
    });
    expect(elementFingerprint(list(true))).toBe(elementFingerprint(list(false)));
    expect(elementFingerprint(list(false))).not.toBe(elementFingerprint(square));
  });
});
