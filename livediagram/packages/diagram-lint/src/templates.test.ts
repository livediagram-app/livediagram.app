import { describe, expect, it } from 'vitest';
import { buildTemplateTab, TEMPLATES, templateCatalogue } from '@livediagram/templates';
import { THEMES } from '@livediagram/document';
import type { LintCode } from '@livediagram/api-schema';
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

  // What add_tab and create_document lint a template with (its colours its own): no warning. The arrow, lifeline,
  // group-frame and crossing warnings that once stood on templates that draw correctly are gone (Work Tracker 1033);
  // these are the others still standing (a label estimated to wrap past its box, an isolated key or note, a label
  // over a box), each a template to redraw or a rule to refine. The list may only shrink: a template that no longer
  // warns must leave it, and a new warning anywhere fails.
  const STANDING: Readonly<Record<string, readonly LintCode[]>> = {
    mindmap: ['label-overflow'],
    'mindmap-tree': ['label-overflow'],
    'approval-workflow': ['label-overflow'],
    'milestone-timeline': ['node-isolated'],
    'cloud-architecture': ['label-collision'],
    'uml-class': ['node-isolated'],
    'state-machine': ['label-collision', 'label-overflow'],
    sailboat: ['label-overflow'],
    'incident-postmortem': ['label-overflow'],
    'crazy-eights': ['group-escape'],
    'stakeholder-map': ['label-collision'],
    'risk-matrix': ['label-overflow'],
    'wardley-map': ['label-collision'],
    'service-blueprint': ['node-isolated'],
    'value-proposition-canvas': ['label-overflow'],
    'family-tree': ['node-isolated'],
    'value-stream-map': ['label-overflow'],
    'comic-strip': ['label-overflow'],
    'doodle-warmup': ['label-overflow'],
    'pre-mortem': ['label-overflow'],
    'concept-map': ['label-overflow', 'node-isolated'],
  };
  it.each(catalogue)('%s lints with no warning beyond the standing ones', (kind) => {
    const report = lint(buildTemplateTab('t', 'T', kind), { coloured: new Set() });
    const warned = [
      ...new Set(report.findings.filter((f) => f.severity === 'warning').map((f) => f.code)),
    ].sort();
    expect(warned).toEqual([...(STANDING[kind] ?? [])].sort());
  });

  it('keeps no standing warning for a template that is gone', () => {
    expect(Object.keys(STANDING).filter((kind) => !catalogue.some((k) => k === kind))).toEqual([]);
  });
});
