import { describe, expect, it } from 'vitest';
import { templatePickerTabAction } from './useTemplateFlow';

// The Quick Start picker is scoped to the tab it opened on (spec/14).
// Applying a template REPLACES that tab's elements, so a picker that
// outlives its tab is a data-loss bug: add Tab 2 (picker opens), switch
// back to Tab 1, confirm a template, and Tab 1's work is gone.
describe('templatePickerTabAction', () => {
  it('forgets the remembered tab whenever the picker is not open', () => {
    expect(templatePickerTabAction('welcome', 'tab-1', 'tab-1')).toBe('reset');
    expect(templatePickerTabAction('identity', 'tab-1', 'tab-2')).toBe('reset');
    // Already forgotten stays forgotten.
    expect(templatePickerTabAction('welcome', null, 'tab-1')).toBe('reset');
  });

  it('records the tab on the render the picker opens', () => {
    expect(templatePickerTabAction('templates', null, 'tab-2')).toBe('record');
  });

  it('leaves the picker alone while it is still on its own tab', () => {
    expect(templatePickerTabAction('templates', 'tab-2', 'tab-2')).toBe('keep');
  });

  it('closes the picker once the user switches away', () => {
    expect(templatePickerTabAction('templates', 'tab-2', 'tab-1')).toBe('close');
  });

  it('addTab opens the picker and switches tab in one commit without closing it', () => {
    // The exact sequence a naive "activeId changed" effect got wrong: the
    // open and the tab switch land together, so the first observation must
    // RECORD the new tab rather than read as a switch away from the old one.
    expect(templatePickerTabAction('templates', null, 'tab-2')).toBe('record');
    expect(templatePickerTabAction('templates', 'tab-2', 'tab-2')).toBe('keep');
  });
});
