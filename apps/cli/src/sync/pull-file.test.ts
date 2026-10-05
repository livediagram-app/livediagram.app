import { describe, expect, it } from 'vitest';
import type { ShapeElement, Tab } from '@livediagram/document';
import {
  canonicalJson,
  fileSlug,
  idSlug,
  parsePullFile,
  pullFileText,
  tabHashes,
  type PullFile,
} from './pull-file';

// docs/specs/015-api/blueprints/cli.md "The pull file", CLI27, CLI28.

const square: ShapeElement = {
  id: 'a',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
};
const tab = (over: Partial<Tab> = {}): Tab => ({
  id: 't1',
  name: 'Main',
  elements: [square],
  ...over,
});

const file = (tabs: Tab[] = [tab()]): PullFile => ({
  kind: 'livediagram.document',
  schemaVersion: 1,
  exportedAt: 1,
  document: { id: 'd1', name: 'Shop', presentation: null, tabs },
  livediagramSync: {
    host: 'https://livediagram.app',
    pulledAt: 1,
    tabs: { t1: { rev: 4, hash: 'h', settingsHash: 's' } },
  },
});

describe('canonicalJson', () => {
  it('sorts object keys at every depth, and keeps array order', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 1, c: 2 }, 3] })).toBe('{"a":[{"c":2,"d":1},3],"b":1}');
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

describe('tabHashes', () => {
  it('hashes the elements and the other fields apart, whatever the key order', async () => {
    const one = await tabHashes(tab());
    expect(one.hash).toMatch(/^[0-9a-f]{64}$/);
    const reordered = await tabHashes({ name: 'Main', elements: tab().elements, id: 't1' });
    expect(reordered).toEqual(one);
    const renamed = await tabHashes(tab({ name: 'Other' }));
    expect(renamed.hash).toBe(one.hash);
    expect(renamed.settingsHash).not.toBe(one.settingsHash);
    const moved = await tabHashes(tab({ elements: [{ ...square, x: 5 }] }));
    expect(moved.hash).not.toBe(one.hash);
    expect(moved.settingsHash).toBe(one.settingsHash);
  });
});

describe('fileSlug', () => {
  it('lower-cases to letters, digits and dashes, at most 60, the id when nothing is left', () => {
    expect(fileSlug('Shop: Checkout flow (v2)!', 'abcdef123456')).toBe('shop-checkout-flow-v2');
    expect(fileSlug('Café', 'abcdef123456')).toBe('caf');
    expect(fileSlug('***', 'abcdef123456')).toBe('abcdef12');
    expect(fileSlug('x'.repeat(80), 'id')).toHaveLength(60);
    expect(fileSlug(`${'a'.repeat(59)}-b`, 'id')).toBe('a'.repeat(59));
    expect(idSlug('abcdef123456')).toBe('abcdef12');
  });
});

describe('pullFileText and parsePullFile', () => {
  it('round-trips, keeping the envelope the editor imports', () => {
    const text = pullFileText(file());
    expect(JSON.parse(text)).toMatchObject({
      kind: 'livediagram.document',
      livediagramSync: { host: 'https://livediagram.app' },
    });
    expect(parsePullFile(text)).toEqual({ ok: true, file: file() });
  });

  it('refuses what is not a pull file, naming why', () => {
    expect(parsePullFile('{')).toEqual({ ok: false, message: 'not JSON' });
    expect(parsePullFile('{"kind":"livediagram.tab"}')).toEqual({
      ok: false,
      message: 'not a livediagram document',
    });
    expect(parsePullFile(JSON.stringify({ ...file(), schemaVersion: 9 }))).toEqual({
      ok: false,
      message: 'written by a newer livediagram',
    });
    expect(parsePullFile(JSON.stringify({ ...file(), document: { id: 'd1' } }))).toEqual({
      ok: false,
      message: 'its document is malformed',
    });
    const { livediagramSync: _s, ...exported } = file();
    expect(parsePullFile(JSON.stringify(exported))).toEqual({
      ok: false,
      message: 'not pulled by the CLI (no livediagramSync)',
    });
    expect(
      parsePullFile(JSON.stringify({ ...file(), livediagramSync: { host: 1, tabs: {} } })),
    ).toEqual({
      ok: false,
      message: 'not pulled by the CLI (no livediagramSync)',
    });
    expect(
      parsePullFile(
        JSON.stringify({
          ...file(),
          livediagramSync: { ...file().livediagramSync, tabs: { t1: { rev: 'x' } } },
        }),
      ),
    ).toEqual({
      ok: false,
      message: 'not pulled by the CLI (no livediagramSync)',
    });
  });

  it('names a tab that is no longer a valid tab', () => {
    const broken = JSON.parse(
      pullFileText(file([tab({ name: 'Flow', elements: [{ id: 'a', type: 'shape' }] as never })])),
    ) as unknown;
    expect(parsePullFile(JSON.stringify(broken))).toEqual({
      ok: false,
      message: 'tab "Flow" is not a valid tab',
    });
  });
});
