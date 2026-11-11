// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SegmentedToggle } from './SegmentedToggle';

// A pane header's pressed-state switch (the Image Gallery's All / Unused, under AppScopeToggle too): a named group of
// real buttons, the one shown pressed, telling only a change.
afterEach(cleanup);

function draw(value: 'all' | 'unused', onChange = vi.fn()) {
  render(
    <SegmentedToggle
      label="Show"
      value={value}
      onChange={onChange}
      options={[
        { value: 'all', label: 'All', description: 'Every image' },
        { value: 'unused', label: 'Unused', description: 'Only images nothing places' },
      ]}
      className="extra"
    />,
  );
  const group = screen.getByRole('group', { name: 'Show' });
  const [all, unused] = within(group).getAllByRole('button');
  return { group, all: all!, unused: unused!, onChange };
}

describe('SegmentedToggle', () => {
  it('names the group, marks the segment shown and points at every segment', () => {
    const { group, all, unused } = draw('unused');
    expect(group.className).toContain('extra');
    expect(all.getAttribute('aria-pressed')).toBe('false');
    expect(unused.getAttribute('aria-pressed')).toBe('true');
    expect(all.textContent).toBe('All');
    expect(unused.textContent).toBe('Unused');
    expect(all.className).toContain('cursor-pointer');
    expect(all.getAttribute('type')).toBe('button');
  });

  it('tells a change, and nothing for the segment already shown', () => {
    const { all, unused, onChange } = draw('all');
    fireEvent.click(all);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(unused);
    expect(onChange).toHaveBeenCalledWith('unused');
  });
});
