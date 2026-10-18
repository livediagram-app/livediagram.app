import { describe, expect, it } from 'vitest';
import { BAND_FLUSH } from '@/components/chrome/toolbar-surface';
import { BAND_CONTROLS_CLASS, BAND_HEADER_END, bandControlsProps } from './band-controls';

// docs/specs/026-plan/plan-board.md "The header holds the top row": in a header band the menu and the controls sit
// straight on the element's header, with no card of their own.
describe('the header band', () => {
  it('draws no card around the controls', () => {
    expect(BAND_CONTROLS_CLASS).not.toMatch(/border|bg-|shadow|rounded/);
    expect(BAND_CONTROLS_CLASS).toContain(
      '[[data-header-band]_&]:h-[var(--plan-band-card-h,46px)]',
    );
    expect(bandControlsProps()).toEqual({ 'data-band-controls': '' });
  });

  it('nor around the menu box, and ends the header as far in as the menu starts', () => {
    expect(BAND_FLUSH).toContain('[[data-band-blend]_&]:border-transparent!');
    expect(BAND_FLUSH).toContain('[[data-band-blend]_&]:bg-transparent!');
    expect(BAND_HEADER_END).toBe('[[data-header-band]_&]:pr-px');
  });
});
