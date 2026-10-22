import { describe, expect, it } from 'vitest';
import { buildTemplateTab, TEMPLATES } from '@livepages/templates';
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
});
