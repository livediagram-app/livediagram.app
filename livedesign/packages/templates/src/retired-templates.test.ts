import { describe, expect, it } from 'vitest';
import { resolveTemplate } from './template-tab';
import { isTemplateKind, templateKindOf, TEMPLATES } from './templates';

// docs/specs/007-editor/templates-by-mode.md "Design templates": the retired device wireframes make
// their wireframe-page replacements.
describe('retired templates', () => {
  it.each([
    ['mobile-wireframe', 'wireframe-mobile-app'],
    ['laptop-wireframe', 'wireframe-dashboard'],
    ['browser-wireframe', 'wireframe-website'],
  ] as const)('%s makes %s', (old, now) => {
    expect(isTemplateKind(old)).toBe(false);
    expect(TEMPLATES.some((t) => (t.kind as string) === old)).toBe(false);
    expect(templateKindOf(old)).toBe(now);
    expect(resolveTemplate(old)).toBe(now);
  });

  it('passes a live kind through and refuses anything else', () => {
    expect(templateKindOf('kanban')).toBe('kanban');
    expect(templateKindOf('not-a-template')).toBeNull();
    expect(templateKindOf(42)).toBeNull();
    expect(templateKindOf('hasOwnProperty')).toBeNull();
  });
});
