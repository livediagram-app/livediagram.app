import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The root layout smooth-scrolls the page's own anchors. Without `data-scroll-behavior="smooth"` on <html>, Next
// keeps that smooth scroll for a route change too, so a click between pages glides back to the top (and Next warns
// in the console on every navigation).
describe('the root layout', () => {
  const source = readFileSync(new URL('./layout.tsx', import.meta.url), 'utf8');
  it('lets Next jump to the top on a route change when <html> scrolls smoothly', () => {
    expect(source).toMatch(/className="[^"]*\bscroll-smooth\b/);
    expect(source).toContain('data-scroll-behavior="smooth"');
  });
});
