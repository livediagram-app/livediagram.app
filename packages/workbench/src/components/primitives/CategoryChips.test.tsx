// @vitest-environment jsdom

// The chip row the layout gallery and livedesign's display library share: one chip pressed at a time, each with its
// count, a press choosing its category.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CategoryChips } from './CategoryChips';

afterEach(cleanup);

const chips = [
  { id: 'all', label: 'All', count: 90 },
  { id: 'script', label: 'Script', count: 21 },
];

describe('CategoryChips', () => {
  it('marks the chosen chip pressed and shows each count', () => {
    render(
      <CategoryChips chips={chips} value="script" onChoose={() => {}} ariaLabel="Categories" />,
    );
    expect(screen.getByRole('group', { name: 'Categories' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Script\s*21$/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: /^All\s*90$/ }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('chooses a category on a press', () => {
    const onChoose = vi.fn();
    render(<CategoryChips chips={chips} value="all" onChoose={onChoose} ariaLabel="Categories" />);
    fireEvent.click(screen.getByRole('button', { name: /^Script\s*21$/ }));
    expect(onChoose).toHaveBeenCalledWith('script');
  });
});
