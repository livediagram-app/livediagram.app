import { describe, expect, it } from 'vitest';
import { rowToTab, rowToTabSummary, type TabRow } from './tab-row';

// rowToTab + rowToTabSummary translate every D1 tab row into the
// wire-format DTOs the editor consumes. Every tab read in the
// product (open a diagram, switch tabs, copy a tab, share-link
// resolve) flows through one or the other; a regression that
// dropped a field, swapped id with diagramId, or let the JSON blob
// override a real column would corrupt diagrams silently with no
// other surface signal. Pinning the contract here so the next
// reader can see what each invariant is.

// Helper: minimum-viable tab body JSON. The Tab shape requires id /
// name but those come from row columns, not the JSON blob, so the
// stored data is Omit<Tab, 'id' | 'name'>. `elements: []` is the
// canonical empty tab.
function bodyJson(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ elements: [], ...extra });
}

const baseRow = (override: Partial<TabRow> = {}): TabRow => ({
  id: 'tab-1',
  diagram_id: 'diag-1',
  name: 'Untitled',
  order_index: 0,
  data: bodyJson(),
  updated_at: 1_700_000_000_000,
  ...override,
});

describe('rowToTab', () => {
  it('freezes a legacy group out of the stored elements (spec/146)', () => {
    const elements = [
      { id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 40, groupId: 'g' },
      {
        id: 'b',
        type: 'shape',
        shape: 'square',
        x: 0,
        y: 60,
        width: 100,
        height: 40,
        groupId: 'g',
      },
      {
        id: 'arr',
        type: 'arrow',
        from: { kind: 'pinned-group', groupId: 'g', anchor: 'e' },
        to: { kind: 'free', x: 400, y: 50 },
      },
    ];
    const dto = rowToTab(baseRow({ data: bodyJson({ elements }) }));
    expect(dto.elements.some((el) => 'groupId' in el)).toBe(false);
    expect(dto.elements[2]).toMatchObject({ from: { kind: 'free', x: 100, y: 50 } });
  });

  it('reassembles the canonical TabDTO from row columns + parsed data', () => {
    const dto = rowToTab(baseRow());
    expect(dto).toEqual({
      id: 'tab-1',
      diagramId: 'diag-1',
      name: 'Untitled',
      orderIndex: 0,
      updatedAt: 1_700_000_000_000,
      elements: [],
    });
  });

  it('carries any per-tab settings serialised in the data blob through to the DTO', () => {
    // The data blob is the round-trip channel for things like theme,
    // background, locked, etc. that don't have their own row columns.
    // The spread MUST land them on the result unchanged.
    const dto = rowToTab(
      baseRow({
        data: bodyJson({
          theme: 'cobalt',
          background: { pattern: 'grid', color: '#ffffff', patternColor: '#cbd5e1' },
          locked: true,
        }),
      }),
    );
    expect((dto as unknown as { theme: string }).theme).toBe('cobalt');
    expect((dto as unknown as { locked: boolean }).locked).toBe(true);
  });

  it('preserves elements from the parsed body in array order', () => {
    const els = [
      { id: 'el-a', type: 'shape', kind: 'square', x: 0, y: 0, width: 100, height: 80 },
      { id: 'el-b', type: 'text', x: 10, y: 10, width: 50, height: 20, label: 'note' },
    ];
    const dto = rowToTab(baseRow({ data: JSON.stringify({ elements: els }) }));
    expect(dto.elements).toEqual(els);
  });

  it('lets row columns override forged id / name / diagramId in the data blob', () => {
    // Spread order matters: data first, row columns second. So even if
    // an attacker (or stale write) stuffed conflicting id / name /
    // diagramId / orderIndex / updatedAt fields into the JSON blob,
    // the real row columns must win. This is the security-relevant
    // invariant of the mapper, separate from the round-trip contract.
    const forged = JSON.stringify({
      elements: [],
      id: 'attacker-id',
      name: 'attacker name',
      diagramId: 'other-diagram',
      orderIndex: 999,
      updatedAt: 0,
    });
    const dto = rowToTab(baseRow({ data: forged }));
    expect(dto.id).toBe('tab-1');
    expect(dto.name).toBe('Untitled');
    expect(dto.diagramId).toBe('diag-1');
    expect(dto.orderIndex).toBe(0);
    expect(dto.updatedAt).toBe(1_700_000_000_000);
  });

  it('takes folder from the row column and lets it override a forged data-blob folder (spec/30)', () => {
    // folder is per-diagram link metadata read from the diagram_tabs
    // JOIN, never from tabs.data (the client strips it before saving).
    // A folder stuffed into the blob must not win.
    const dto = rowToTab(baseRow({ folder: 'Org', data: bodyJson({ folder: 'Forged' }) }));
    expect(dto.folder).toBe('Org');
  });

  it('maps a NULL / missing folder column to undefined (loose)', () => {
    expect(rowToTab(baseRow({ folder: null })).folder).toBeUndefined();
    expect(rowToTab(baseRow()).folder).toBeUndefined();
  });

  it('throws on invalid JSON in the data column (call sites can decide whether to filter or surface)', () => {
    // Documents the current contract: rowToTab does NOT silently
    // swallow malformed JSON. A regression that wrapped this in a
    // try/catch and returned a partial DTO would mask corruption.
    expect(() => rowToTab(baseRow({ data: '{not json' }))).toThrow();
  });
});

describe('rowToTabSummary', () => {
  it('returns only the columnar fields and never touches the data blob', () => {
    // The summary endpoint skips JSON parsing entirely (the editor's
    // tab list only needs id / name / order to render). The mapper
    // matching that intent means a query that SELECTs an empty
    // string for `data` (which db.ts does for the list endpoint) is
    // free, not a deserialise error.
    const dto = rowToTabSummary(baseRow({ data: 'this is not json and that is fine' }));
    expect(dto).toEqual({
      id: 'tab-1',
      diagramId: 'diag-1',
      name: 'Untitled',
      orderIndex: 0,
      updatedAt: 1_700_000_000_000,
    });
  });

  it('preserves the order_index value verbatim (used to render the tab strip in order)', () => {
    // The tab bar relies on this to render tabs left-to-right in the
    // correct order. A regression that defaulted or clamped it would
    // shuffle the strip after every list call.
    expect(rowToTabSummary(baseRow({ order_index: 7 })).orderIndex).toBe(7);
    expect(rowToTabSummary(baseRow({ order_index: 0 })).orderIndex).toBe(0);
  });

  it('carries the per-diagram folder name, mapping NULL to undefined (spec/30)', () => {
    expect(rowToTabSummary(baseRow({ folder: 'Org' })).folder).toBe('Org');
    expect(rowToTabSummary(baseRow({ folder: null })).folder).toBeUndefined();
  });
});
