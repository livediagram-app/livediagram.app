// @vitest-environment jsdom

// A closed section (docs/specs/007-editor/element-tours.md "Settings"): the Tours' Show Me section (element tours) sits in a closed
// accordion naming how many are on, opened by its heading, or on its own when Settings lands on one of its rows.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
import { SETTINGS_CATEGORIES } from './settings-catalogue';
import { SettingsCategoryPane } from './test-pane';

afterEach(cleanup);
// Landing on a row scrolls it into view, which jsdom does not lay out.
Element.prototype.scrollIntoView = vi.fn();

const TOURS = SETTINGS_CATEGORIES.find((c) => c.id === 'tours')!;
// The section's heading names it Show Me and says how many are on.
const header = () => screen.getByRole('button', { name: /^Show Me/ });

describe('Show Me section (element tours)', () => {
  it('starts closed, saying how many tours are on', () => {
    render(<SettingsCategoryPane category={TOURS} settings={{}} onChange={vi.fn()} />);
    expect(header().getAttribute('aria-expanded')).toBe('false');
    expect(header().textContent).toContain('1 of 1 On');
    // The mode tours stay open above it.
    expect(screen.getByRole('switch', { name: "Receptionist's Welcome" })).toBeTruthy();
  });

  it('opens from its heading onto the Portal switch, with no switch over them all', () => {
    render(<SettingsCategoryPane category={TOURS} settings={{}} onChange={vi.fn()} />);
    fireEvent.click(header());
    expect(header().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Portal' })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Show Me on Every Element' })).toBeNull();
  });

  it('opens on its own when Settings lands on one of its rows', () => {
    render(
      <SettingsCategoryPane
        category={TOURS}
        settings={{}}
        onChange={vi.fn()}
        focusRowKey="elementTour-portal"
      />,
    );
    expect(header().getAttribute('aria-expanded')).toBe('true');
  });

  it('brings what it unfolded into view once it has eased open', () => {
    vi.useFakeTimers();
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    scroll.mockClear();
    render(<SettingsCategoryPane category={TOURS} settings={{}} onChange={vi.fn()} />);
    fireEvent.click(header());
    expect(scroll).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: 'nearest' }));
    vi.useRealTimers();
  });
});
