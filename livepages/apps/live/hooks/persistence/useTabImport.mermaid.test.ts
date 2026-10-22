// @vitest-environment jsdom

// The editor's Mermaid import (docs/specs/020-import-export/mermaid.md "Layout"): laid out as an agent's Mermaid is,
// lines bent round the boxes and labels kept whole; a sequence diagram is still refused here.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MERMAID_UNSUPPORTED_ERROR, type Tab } from '@livepages/document';
import { useTabImport } from './useTabImport';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

function setup() {
  let tabs: Tab[] = [{ id: 't1', name: 'Flow', elements: [] }];
  const deps = {
    tabs,
    ownerId: 'owner-1',
    documentId: 'doc-1',
    createTab: (name: string): Tab => ({ id: crypto.randomUUID(), name, elements: [] }),
    markTabLoaded: vi.fn(),
    activeId: 't1',
    commitTabs: vi.fn((f: (ts: Tab[]) => Tab[]) => void (tabs = f(tabs))),
    setSelectedId: vi.fn(),
    setEditingId: vi.fn(),
    setFormatSourceId: vi.fn(),
    setImportError: vi.fn(),
    requestFit: vi.fn(),
    importScene: vi.fn(),
    importPlanItems: vi.fn(async () => ({ added: 0, skipped: 0, failed: 0 })),
  };
  const { result } = renderHook(() => useTabImport(deps));
  return { api: result.current, deps, landed: () => tabs[0]! };
}

describe('importing Mermaid into a tab', () => {
  it('bends its lines round the boxes and keeps every label as written', async () => {
    const { api, landed } = setup();
    const long = 'Validate the order against the stock levels held by the warehouse service';
    const text = `flowchart TD\n  A[${long}] --> B{Done?}\n  B -- no --> A\n  B -- yes --> C[Ship]`;
    expect(await api.importTextIntoActiveTab('mermaid', text)).toEqual({ status: 'done' });
    const els = landed().elements;
    expect(els.find((e) => e.id === 'A')).toMatchObject({ label: long });
    const arrows = els.filter((e) => e.type === 'arrow');
    expect(arrows).toHaveLength(3);
    // The line back up to A goes round the outside, through bends of its own.
    const back = arrows.find(
      (a) =>
        a.type === 'arrow' &&
        a.from.kind === 'pinned' &&
        a.from.elementId === 'B' &&
        a.label === 'no',
    );
    expect(back).toMatchObject({ arrowStyle: 'angled' });
    expect(back && back.type === 'arrow' ? back.curvePoints?.length : 0).toBeGreaterThan(0);
  });

  it('refuses a sequence diagram as before, leaving the tab as it was', async () => {
    const { api, deps } = setup();
    expect(
      await api.importTextIntoActiveTab('mermaid', 'sequenceDiagram\n  Alice->>Bob: Hi'),
    ).toEqual({ status: 'error', error: MERMAID_UNSUPPORTED_ERROR });
    expect(deps.commitTabs).not.toHaveBeenCalled();
  });
});
