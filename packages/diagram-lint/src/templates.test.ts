import { describe, expect, it } from 'vitest';
import { buildTemplateTab, TEMPLATES } from '@livediagram/templates';
import { lint } from './fixtures/build';

// Templates are the editor's own drawings: none of them should draw an error.
describe('templates', () => {
  it.each(TEMPLATES.map((t) => t.kind))('%s lints with no errors', (kind) => {
    const report = lint(buildTemplateTab('t', 'T', kind));
    expect(report.findings.filter((f) => f.severity === 'error')).toEqual([]);
  });
});
