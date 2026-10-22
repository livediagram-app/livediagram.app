import { describe, expect, it } from 'vitest';
import { resolveTemplate } from './template-tab';
import { isTemplateKind, templateKindOf, TEMPLATES } from './templates';

// The retired device wireframes make their wireframe-page replacements.
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
    expect(templateKindOf('logo-design')).toBe('logo-design');
    // Cut with the slide page kind and the infographics.
    expect(templateKindOf('slide-deck')).toBeNull();
    expect(templateKindOf('event-poster')).toBeNull();
    // livediagram's other templates are no kind here.
    expect(templateKindOf('kanban')).toBeNull();
    expect(templateKindOf('not-a-template')).toBeNull();
    expect(templateKindOf(42)).toBeNull();
    expect(templateKindOf('hasOwnProperty')).toBeNull();
  });
});
