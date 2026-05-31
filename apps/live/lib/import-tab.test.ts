import { describe, expect, it } from 'vitest';
import type { Tab } from '@livediagram/diagram';
import { parseImportedTab } from './import-tab';
import { TAB_SCHEMA_VERSION, type ExportedTabEnvelope } from './export-tab';

// A minimal but valid tab payload.
const validTab: Tab = { id: 'tab-1', name: 'Imported', elements: [] };

// Build a well-formed envelope, overridable per test.
const envelope = (overrides: Partial<ExportedTabEnvelope> = {}): ExportedTabEnvelope => ({
  kind: 'livediagram.tab',
  schemaVersion: TAB_SCHEMA_VERSION,
  exportedAt: 0,
  tab: validTab,
  ...overrides,
});

const parse = (value: unknown) => parseImportedTab(JSON.stringify(value));

describe('parseImportedTab — happy path', () => {
  it('accepts a well-formed envelope and returns the tab', () => {
    const result = parse(envelope());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tab).toEqual(validTab);
  });

  it('accepts an envelope below the current schema version', () => {
    // Only meaningful once TAB_SCHEMA_VERSION climbs above 1; guarded so
    // the test stays valid at v1 (older-than-1 is not expressible).
    const older = Math.max(1, TAB_SCHEMA_VERSION - 1);
    const result = parse(envelope({ schemaVersion: older }));
    expect(result.ok).toBe(true);
  });
});

describe('parseImportedTab — rejections (never throws)', () => {
  it('rejects non-JSON text', () => {
    const result = parseImportedTab('{not json');
    expect(result).toEqual({ ok: false, error: "File isn't valid JSON." });
  });

  it('rejects JSON that is not an object', () => {
    expect(parseImportedTab('42').ok).toBe(false);
    expect(parseImportedTab('null').ok).toBe(false);
    expect(parseImportedTab('"a string"').ok).toBe(false);
  });

  it('rejects an object without the magic kind field', () => {
    const result = parse({ schemaVersion: 1, tab: validTab });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/isn't a livediagram tab export/);
  });

  it('rejects a wrong kind value', () => {
    const result = parse(envelope({ kind: 'something.else' as never }));
    expect(result.ok).toBe(false);
  });

  it('rejects a missing or non-numeric schemaVersion', () => {
    const result = parse({ kind: 'livediagram.tab', tab: validTab });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Missing schemaVersion/);
  });

  it('refuses an envelope newer than this editor understands', () => {
    const result = parse(envelope({ schemaVersion: TAB_SCHEMA_VERSION + 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/schema v/);
  });

  it('rejects an envelope missing the tab payload', () => {
    const result = parse({
      kind: 'livediagram.tab',
      schemaVersion: TAB_SCHEMA_VERSION,
      exportedAt: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/missing the tab payload/);
  });

  it('rejects a tab payload missing required fields', () => {
    const result = parse(envelope({ tab: { id: 'x', name: 'no elements' } as Tab }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/missing required fields/);
  });

  it('rejects when id/name are the wrong type', () => {
    const result = parse(envelope({ tab: { id: 1, name: 2, elements: [] } as unknown as Tab }));
    expect(result.ok).toBe(false);
  });
});
