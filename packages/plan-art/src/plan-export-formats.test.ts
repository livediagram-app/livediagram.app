import { describe, expect, it } from 'vitest';
import { exportFormatsFor, planTabKindOf } from './plan-export-formats';

// docs/specs/026-plan/plan-tabs.md "Export": each kind offers the formats that can carry it.
describe('the formats a tab exports to', () => {
  it('offers a Board tab its picture, its outline and its cards as CSV', () => {
    expect(exportFormatsFor({ kind: 'board' })).toEqual(['png', 'svg', 'pdf', 'markdown', 'csv']);
  });

  it('offers a Sheet tab its picture and its cells as CSV', () => {
    expect(exportFormatsFor({ kind: 'sheet' })).toEqual(['png', 'svg', 'pdf', 'csv']);
  });

  it('offers a Dashboard its picture and the JSON its Import reads back', () => {
    expect(exportFormatsFor({ kind: 'dashboard' })).toEqual(['png', 'svg', 'pdf', 'file']);
  });

  it('offers a Form tab only the JSON, the one format that carries its form', () => {
    expect(exportFormatsFor({ kind: 'form' })).toEqual(['file']);
  });

  it('never offers a Plan tab Mermaid or Excalidraw', () => {
    for (const kind of ['board', 'sheet', 'dashboard'] as const)
      for (const f of ['mermaid', 'excalidraw', 'logo-kit', 'gif'] as const)
        expect(exportFormatsFor({ kind })).not.toContain(f);
  });

  it('leaves any other tab every format', () => {
    expect(exportFormatsFor({})).toBeUndefined();
    expect(exportFormatsFor({ kind: 'event-storming' })).toBeUndefined();
    expect(planTabKindOf({ kind: 'diagram' })).toBeNull();
  });
});
