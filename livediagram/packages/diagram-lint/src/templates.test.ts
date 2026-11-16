import { describe, expect, it } from 'vitest';
import { buildTemplateTab, TEMPLATES, templateCatalogue } from '@livediagram/templates';
import { THEMES } from '@livediagram/document';
import { lint } from './fixtures/build';

// Templates are the editor's own drawings: none of them should draw an error.
describe('templates', () => {
  it.each(TEMPLATES.map((t) => t.kind))('%s lints with no errors', (kind) => {
    const report = lint(buildTemplateTab('t', 'T', kind));
    expect(report.findings.filter((f) => f.severity === 'error')).toEqual([]);
  });

  // Their text fits its box and never prints over other text: an agent starts from these, and a template that
  // overflows as made reads as the agent's mistake (a sketchnote's heading over its big idea).
  it.each(TEMPLATES.map((t) => t.kind))('%s draws no text over its box or other text', (kind) => {
    const report = lint(buildTemplateTab('t', 'T', kind));
    expect(report.findings.filter((f) => f.code === 'text-overflow')).toEqual([]);
  });

  // Every kind list_templates offers, made as create_document makes it (in a theme an agent may name), lints as the
  // changeset lint does a template (its colours its own): no errors in any theme.
  const catalogue = templateCatalogue().templates.map((t) => t.kind);
  it.each(THEMES.map((t) => t.id))(
    'every listed template lints with no errors in %s',
    (themeId) => {
      const failing = catalogue.flatMap((kind) =>
        lint(buildTemplateTab('t', 'T', kind, themeId), { coloured: new Set() })
          .findings.filter((f) => f.severity === 'error')
          .map((f) => `${kind}: ${f.code}`),
      );
      expect(failing).toEqual([]);
    },
  );

  // What add_tab and create_document lint a template with (its colours its own): no warning at all. The arrow,
  // lifeline, group-frame and crossing warnings went in Work Tracker 1033, the last standing ones (labels past their
  // box, isolated notes and markers, labels over a quadrant) in Work Tracker 1075. A new warning anywhere fails.
  it.each(catalogue)('%s lints with no warning', (kind) => {
    const report = lint(buildTemplateTab('t', 'T', kind), { coloured: new Set() });
    expect(
      report.findings.filter((f) => f.severity === 'warning').map((f) => `${f.code}: ${f.message}`),
    ).toEqual([]);
  });
});
