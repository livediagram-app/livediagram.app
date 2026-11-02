import { describe, expect, it } from 'vitest';
import { resolveTemplate } from './template-tab';
import { isTemplateKind, templateKindOf, TEMPLATES } from './templates';

// The Pages templates moved out to livedocuments with Pages mode, and the device wireframes they had replaced went with
// them. The Plan templates (boards, sheets, dashboards and forms) moved out to liveplanner with Plan mode. A link, an
// agent or a seed naming one is answered as any unknown kind is.
describe('retired templates', () => {
  it.each([
    'slide-deck',
    'article',
    'blank-illustration',
    'wireframe-website',
    'logo-design',
    'mobile-wireframe',
    'browser-wireframe',
    'blank-plan',
    'blank-spreadsheet',
    'kanban',
    'project-planner',
    'bug-triage',
    'team-retro',
    'okrs',
    'invoice',
    'feedback-form',
  ])('%s is no template now', (old) => {
    expect(isTemplateKind(old)).toBe(false);
    expect(TEMPLATES.some((t) => (t.kind as string) === old)).toBe(false);
    expect(templateKindOf(old)).toBeNull();
    expect(resolveTemplate(old)).toBeNull();
  });

  it('passes a live kind through and refuses anything else', () => {
    expect(templateKindOf('flowchart')).toBe('flowchart');
    expect(templateKindOf('not-a-template')).toBeNull();
    expect(templateKindOf(42)).toBeNull();
    expect(templateKindOf('hasOwnProperty')).toBeNull();
  });
});
