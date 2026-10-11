// Plan's heavy UI loads only when drawn (docs/specs/026-plan/plan-mode.md "Cost"): the editor's first load never
// carries a Dashboard page, Start Planning or the Sheet templates' designs. A static import of any of them from the
// always-loaded editor files grew the document page's first load by about 400 KiB gzipped once; this keeps it out.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const staticImports = (src: string) =>
  [...src.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]!);

describe('the editor’s first load', () => {
  it('imports the Dashboard page, the board picker and the Sheets host lazily', () => {
    const imports = staticImports(read('app/document/[id]/EditorView.tsx'));
    expect(imports).not.toContain('@/components/plan/dashboard/DashboardPage');
    expect(imports).not.toContain('@/components/plan/PlanBoardPicker');
    expect(imports).not.toContain('@/components/plan/PlanSheetsHost');
  });

  it('names Sheet templates without their designs', () => {
    const catalogue = read('../../packages/sheets/src/sheet-templates/catalogue.ts');
    expect(staticImports(catalogue).filter((p) => /\.\/(money|people|work)$/.test(p))).toEqual([]);
  });

  it('loads the CSV writer from the tab menu only at the press', () => {
    const imports = staticImports(read('components/chrome/tab-data-rows.ts'));
    expect(imports).not.toContain('@/components/sheets/sheet-csv');
  });
});
