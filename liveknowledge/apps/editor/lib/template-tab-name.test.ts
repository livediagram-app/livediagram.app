import { describe, expect, it } from 'vitest';
import { templateTabName } from './template-tab-name';

describe('the name a template gives its tab', () => {
  it('is the template’s title', () => {
    expect(templateTabName('design-doc')).toBe('Design Doc');
    expect(templateTabName('meeting-notes')).toBe('Meeting Notes');
  });

  it('is none for a blank template', () => {
    expect(templateTabName('blank')).toBeNull();
    expect(templateTabName('blank-slide-deck')).toBeNull();
  });
});
