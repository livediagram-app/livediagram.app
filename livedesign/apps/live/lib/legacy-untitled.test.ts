import { describe, expect, it } from 'vitest';
import {
  UNTITLED_DESIGN_NAME,
  isUntitledDesignName,
  untitledNameForTemplate,
} from '@livedesign/templates';

// Designs created before the rename are stored as "Untitled diagram"
// (docs/specs/006-design/design-structure.md); they still count as untitled.
describe('untitled design names', () => {
  it('names a new blank design "Untitled design"', () => {
    expect(UNTITLED_DESIGN_NAME).toBe('Untitled design');
    expect(untitledNameForTemplate('blank')).toBe('Untitled design');
    expect(untitledNameForTemplate(null)).toBe('Untitled design');
  });

  it('treats both the current and the pre-rename default as untitled', () => {
    expect(isUntitledDesignName('Untitled design')).toBe(true);
    expect(isUntitledDesignName('Untitled diagram')).toBe(true);
    expect(isUntitledDesignName('Roadmap')).toBe(false);
    expect(isUntitledDesignName('Untitled Tree Mind Map')).toBe(false);
  });
});
