import { describe, expect, it } from 'vitest';
import { canonicalJson, type ShapeElement, type Tab } from '@livedocuments/document';
import {
  fileSlug,
  idSlug,
  isLocallyChanged,
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
  kind: 'livedocuments.document',
  schemaVersion: 1,
  exportedAt: 1,
  document: { id: 'd1', name: 'Shop', presentation: null, tabs },
  livedocumentsSync: {
    host: 'https://livedocuments.app',
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
      kind: 'livedocuments.document',
      livedocumentsSync: { host: 'https://livedocuments.app' },
    });
    expect(parsePullFile(text)).toEqual({ ok: true, file: file() });
  });

  it('refuses what is not a pull file, naming why', () => {
    expect(parsePullFile('{')).toEqual({ ok: false, message: 'not JSON' });
    expect(parsePullFile('{"kind":"livedocuments.tab"}')).toEqual({
      ok: false,
      message: 'not a livedocuments document',
    });
    expect(parsePullFile(JSON.stringify({ ...file(), schemaVersion: 9 }))).toEqual({
      ok: false,
      message: 'written by a newer livedocuments',
    });
    expect(parsePullFile(JSON.stringify({ ...file(), document: { id: 'd1' } }))).toEqual({
      ok: false,
      message: 'its document is malformed',
    });
    const { livedocumentsSync: _s, ...exported } = file();
    expect(parsePullFile(JSON.stringify(exported))).toEqual({
      ok: false,
      message: 'not pulled by the CLI (no livedocumentsSync)',
    });
    expect(
      parsePullFile(JSON.stringify({ ...file(), livedocumentsSync: { host: 1, tabs: {} } })),
    ).toEqual({
      ok: false,
      message: 'not pulled by the CLI (no livedocumentsSync)',
    });
    expect(
      parsePullFile(
        JSON.stringify({
          ...file(),
          livedocumentsSync: { ...file().livedocumentsSync, tabs: { t1: { rev: 'x' } } },
        }),
      ),
    ).toEqual({
      ok: false,
      message: 'not pulled by the CLI (no livedocumentsSync)',
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

describe('a pull file whose pulledAt is not a time', () => {
  it('is not a pull file', () => {
    const text = JSON.stringify({
      ...file(),
      livedocumentsSync: { ...file().livedocumentsSync, pulledAt: 'x' },
    });
    expect(parsePullFile(text)).toEqual({
      ok: false,
      message: 'not pulled by the CLI (no livedocumentsSync)',
    });
  });
});

// What `pull` asks before it would overwrite a file (CLI28): a tab added or dropped, or one hashing other than
// recorded.
describe('isLocallyChanged', () => {
  const same = { t1: { hash: 'h', settingsHash: 's' } };

  it('is unchanged while every tab hashes as recorded', () => {
    expect(isLocallyChanged(file(), same)).toBe(false);
  });

  it('is changed by an edited tab, its elements or its settings', () => {
    expect(isLocallyChanged(file(), { t1: { hash: 'x', settingsHash: 's' } })).toBe(true);
    expect(isLocallyChanged(file(), { t1: { hash: 'h', settingsHash: 'x' } })).toBe(true);
  });

  it('is changed by a tab added or dropped', () => {
    expect(isLocallyChanged(file(), { ...same, t2: { hash: 'h', settingsHash: 's' } })).toBe(true);
    expect(isLocallyChanged(file(), {})).toBe(true);
    expect(isLocallyChanged(file(), { t2: { hash: 'h', settingsHash: 's' } })).toBe(true);
  });
});
