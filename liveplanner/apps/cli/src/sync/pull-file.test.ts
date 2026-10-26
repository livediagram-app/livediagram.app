import { describe, expect, it } from 'vitest';
import { canonicalJson, type ShapeElement, type Tab } from '@liveplanner/project';
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
  kind: 'liveplanner.project',
  schemaVersion: 1,
  exportedAt: 1,
  project: { id: 'd1', name: 'Shop', tabs },
  liveplannerSync: {
    host: 'https://liveplanner.app',
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

// CLI28: a pull overwrites the file only when nothing in it changed since the last pull.
describe('isLocallyChanged', () => {
  it('reads a tab added or dropped, its elements changed, or its settings changed alone', () => {
    expect(isLocallyChanged(file(), { t1: { hash: 'h', settingsHash: 's' } })).toBe(false);
    expect(isLocallyChanged(file(), {})).toBe(true);
    expect(isLocallyChanged(file(), { t1: { hash: 'x', settingsHash: 's' } })).toBe(true);
    expect(isLocallyChanged(file(), { t1: { hash: 'h', settingsHash: 'renamed' } })).toBe(true);
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
      kind: 'liveplanner.project',
      liveplannerSync: { host: 'https://liveplanner.app' },
    });
    expect(parsePullFile(text)).toEqual({ ok: true, file: file() });
  });

  it('refuses what is not a pull file, naming why', () => {
    expect(parsePullFile('{')).toEqual({ ok: false, message: 'not JSON' });
    expect(parsePullFile('{"kind":"liveplanner.tab"}')).toEqual({
      ok: false,
      message: 'not a liveplanner plan',
    });
    expect(parsePullFile(JSON.stringify({ ...file(), schemaVersion: 9 }))).toEqual({
      ok: false,
      message: 'written by a newer liveplanner',
    });
    expect(parsePullFile(JSON.stringify({ ...file(), project: { id: 'd1' } }))).toEqual({
      ok: false,
      message: 'its plan is malformed',
    });
    const { liveplannerSync: _s, ...exported } = file();
    expect(parsePullFile(JSON.stringify(exported))).toEqual({
      ok: false,
      message: 'not pulled by the CLI (no liveplannerSync)',
    });
    expect(
      parsePullFile(JSON.stringify({ ...file(), liveplannerSync: { host: 1, tabs: {} } })),
    ).toEqual({
      ok: false,
      message: 'not pulled by the CLI (no liveplannerSync)',
    });
    expect(
      parsePullFile(
        JSON.stringify({
          ...file(),
          liveplannerSync: { ...file().liveplannerSync, tabs: { t1: { rev: 'x' } } },
        }),
      ),
    ).toEqual({
      ok: false,
      message: 'not pulled by the CLI (no liveplannerSync)',
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
      liveplannerSync: { ...file().liveplannerSync, pulledAt: 'x' },
    });
    expect(parsePullFile(text)).toEqual({
      ok: false,
      message: 'not pulled by the CLI (no liveplannerSync)',
    });
  });
});
