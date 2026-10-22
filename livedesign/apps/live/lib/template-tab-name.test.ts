import { describe, expect, it } from 'vitest';
import { templateTabName } from './template-tab-name';

describe('the name a template gives its tab', () => {
  it('is the template’s title', () => {
    expect(templateTabName('wireframe-mobile-app')).toBe('Mobile App Wireframe');
    expect(templateTabName('logo-design')).toBe('Logo Design');
  });

  it('is none for a blank template', () => {
    expect(templateTabName('blank')).toBeNull();
    expect(templateTabName('blank-wireframe-phone')).toBeNull();
  });
});
