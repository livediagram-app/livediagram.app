import { describe, expect, it } from 'vitest';
import { isDefaultDesignName, untitledNameForTemplate } from './templates';

// docs/specs/007-editor/new-design-route.md "What `/new` makes": a template picked on a design's first tab names
// it after itself while its name is still a default one.
describe('untitledNameForTemplate', () => {
  it('names a design after its template', () => {
    expect(untitledNameForTemplate('logo-design')).toBe('Untitled Logo Design');
    expect(untitledNameForTemplate('wireframe-mobile-app')).toBe('Untitled Mobile App Wireframe');
    expect(untitledNameForTemplate('blank-wireframe-phone')).toBe('Untitled Phone Wireframe');
    expect(untitledNameForTemplate('blank')).toBe('Untitled design');
  });
});

describe('isDefaultDesignName', () => {
  it("counts every template's untitled name, and the plain and legacy untitled", () => {
    for (const name of [
      'Untitled design',
      'Untitled diagram',
      'Untitled Illustration',
      'Untitled Logo Design',
      'Untitled Mobile App Wireframe',
    ])
      expect(isDefaultDesignName(name)).toBe(true);
  });

  it('never counts a name someone gave it', () => {
    for (const name of [
      'Q3 roadmap',
      'Untitled',
      'untitled logo design',
      'Untitled Logo Design 2',
      // Cut templates' untitled names are no default any more.
      'Untitled Event Poster',
      '',
    ])
      expect(isDefaultDesignName(name)).toBe(false);
  });
});
