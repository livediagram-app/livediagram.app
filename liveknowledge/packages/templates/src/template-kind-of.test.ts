import { describe, expect, it } from 'vitest';
import { templateKindOf } from './templates';

// A kind that arrives as a plain string from outside names a template or nothing.
describe('templateKindOf', () => {
  it('passes a live kind through and refuses anything else', () => {
    expect(templateKindOf('slide-deck')).toBe('slide-deck');
    // livediagram's other templates are no kind here, nor the logo and wireframe ones livedesign makes.
    expect(templateKindOf('kanban')).toBeNull();
    expect(templateKindOf('logo-design')).toBeNull();
    expect(templateKindOf('wireframe-website')).toBeNull();
    expect(templateKindOf('not-a-template')).toBeNull();
    expect(templateKindOf(42)).toBeNull();
    expect(templateKindOf('hasOwnProperty')).toBeNull();
  });
});
