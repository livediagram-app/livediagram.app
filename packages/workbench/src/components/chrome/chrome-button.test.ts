import { describe, expect, it } from 'vitest';
import { CHROME_BTN } from './chrome-button';
import { TAB_BAR_CLASS } from './tab-shape';

// The footer's labelled buttons (Search, Settings, System) sit on the tab bar's slate-100. Their 12px labels take
// the button's colour, so it must read at WCAG AA there: slate-500 on slate-100 is 4.3:1, under 4.5.
describe('chrome button labels on the tab bar', () => {
  it('use a text colour that reads at AA on the bar', () => {
    expect(TAB_BAR_CLASS.split(' ')).toContain('bg-slate-100');
    const light = CHROME_BTN.split(' ').filter((c) => /^text-slate-\d+$/.test(c));
    expect(light).toEqual(['text-slate-600']);
  });
});
