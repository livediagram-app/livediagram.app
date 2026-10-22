// Plan's heavy UI loads only when drawn (docs/specs/026-plan/plan-mode.md "Cost"): the editor's first load never
// carries a Dashboard page, Start Planning or the Sheet templates' designs. A static import of any of them from the
// always-loaded editor files grew the document page's first load by about 400 KiB gzipped once; this keeps it out.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
// A re-export (`export { x } from '…'`) loads its module as surely as an import does.
const staticImports = (src: string) =>
  [...src.matchAll(/^(?:import|export)\s+(?!type\b)[^;]*?from\s+'([^']+)'/gms)].map((m) => m[1]!);

describe('the editor’s first load', () => {
  // The editor view, and the start panels it always mounts.
  const editorImports = () => [
    ...staticImports(read('app/document/[id]/EditorView.tsx')),
    ...staticImports(read('components/start/EditorStartPanels.tsx')),
  ];

  it('imports the Dashboard page, the board picker and the Sheets host lazily', () => {
    const imports = editorImports();
    expect(imports).not.toContain('@/components/plan/dashboard/DashboardPage');
    expect(imports).not.toContain('@/components/plan/PlanBoardPicker');
    expect(imports).not.toContain('@/components/plan/PlanSheetsHost');
  });

  // docs/specs/007-editor/start-diagramming.md: the template starts carry every template's preview.
  it('imports the template starts lazily, and nothing that draws a template preview', () => {
    const imports = editorImports();
    expect(imports).not.toContain('@/components/start/StartFromTemplates');
    for (const always of [
      'components/start/StartAgainTray.tsx',
      'components/start/template-start-mode.ts',
    ])
      expect(staticImports(read(always))).not.toContain('@liveplanner/template-previews');
  });

  // docs/specs/013-workspace/default-folders.md "A template picked after creation": the mover reads the template
  // builders and the folder lists, so it loads only at a start screen's pick.
  it('loads the move to a template default folder only at the pick', () => {
    expect(staticImports(read('components/start/useTemplatePickMove.ts'))).not.toContain(
      '@/lib/placement-defaults/move-on-template-pick',
    );
  });

  // docs/specs/026-plan/plan-templates.md "Example cards": the cards' data loads only when a Plan template is made.
  // A static import from /new or the editor seam once added about 12 KiB gzip to /new's first load.
  it('loads the Plan templates’ example cards only when one is made', () => {
    // /new and a workspace frame's New document make their content in one place (lib/new-document-content.ts).
    for (const always of [
      'app/new/page.tsx',
      'lib/new-document-content.ts',
      'app/embed/workbench/create-in-place.ts',
      'lib/template-builders.ts',
      'lib/seed-author.ts',
    ])
      expect(staticImports(read(always))).not.toContain(
        '@liveplanner/templates/plan-template-seeds',
      );
    expect(read('lib/new-document-content.ts')).toContain(
      "import('@liveplanner/templates/plan-template-seeds')",
    );
    expect(read('app/document/[id]/useTemplateFlow.ts')).toContain(
      "'@liveplanner/templates/plan-template-seeds'",
    );
  });

  it('names Sheet templates without their designs', () => {
    const catalogue = read('../../packages/sheets/src/sheet-templates/catalogue.ts');
    expect(staticImports(catalogue).filter((p) => /\.\/(money|people|work)$/.test(p))).toEqual([]);
  });

  it('loads the CSV writer from the tab menu only at the press', () => {
    const imports = staticImports(read('components/chrome/tab-data-rows.ts'));
    expect(imports).not.toContain('@/components/sheets/sheet-csv');
  });

  it('keeps the untitled name apart from the template catalogue', () => {
    // The untitled name is read on every load: it lives in its own leaf module.
    expect(staticImports(read('../../packages/templates/src/legacy-untitled.ts'))).toEqual([]);
  });

  it('reads a detected sticky’s place without the photo detector', () => {
    expect(staticImports(read('../../packages/sticky-vision/src/normalised.ts'))).toEqual([]);
  });
});
