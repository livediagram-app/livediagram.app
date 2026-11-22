import { describe, expect, it } from 'vitest';
import { savedToast } from './useEditorPageEditing';

// editing.md "The buttons" (owner 2026-11-21): the save toast names the page.
describe('savedToast', () => {
  it('names the page, cuts a long title, and falls back with none', () => {
    expect(savedToast('Release Process')).toBe('Release Process Saved');
    expect(savedToast('')).toBe('Page Saved');
    const long = savedToast('x'.repeat(80));
    expect(long).toBe(`${'x'.repeat(59)}… Saved`);
  });
});
