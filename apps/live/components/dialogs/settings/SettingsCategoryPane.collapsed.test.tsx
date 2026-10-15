// @vitest-environment jsdom

// A closed section (docs/specs/007-editor/element-tours.md "Settings"): the Tours' Element Tours sit in a closed
// accordion naming how many are on, opened by its heading, or on its own when Settings lands on one of its rows.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
import { SETTINGS_CATEGORIES } from './settings-catalogue';
import { SettingsCategoryPane } from './SettingsCategoryPane';

afterEach(cleanup);
// Landing on a row scrolls it into view, which jsdom does not lay out.
Element.prototype.scrollIntoView = vi.fn();

const TOURS = SETTINGS_CATEGORIES.find((c) => c.id === 'tours')!;
const header = () => screen.getByRole('button', { name: /Element Tours/ });

describe('Element Tours section', () => {
  it('starts closed, saying how many tours are on', () => {
    render(<SettingsCategoryPane category={TOURS} settings={{}} onChange={vi.fn()} />);
    expect(header().getAttribute('aria-expanded')).toBe('false');
    expect(header().textContent).toContain('1 of 1 On');
    // The mode tours stay open above it.
    expect(screen.getByRole('switch', { name: 'Draw Tour' })).toBeTruthy();
  });

  it('opens from its heading, the master switch over each element', () => {
    render(<SettingsCategoryPane category={TOURS} settings={{}} onChange={vi.fn()} />);
    fireEvent.click(header());
    expect(header().getAttribute('aria-expanded')).toBe('true');
    const group = screen.getByRole('group', { name: 'Element Tours settings' });
    expect(group.textContent).toContain('Sankey Diagram Tour');
  });

  it('counts an answered tour as off', () => {
    render(
      <SettingsCategoryPane
        category={TOURS}
        settings={{ elementTourKinds: ['sankey'] }}
        onChange={vi.fn()}
      />,
    );
    expect(header().textContent).toContain('0 of 1 On');
  });

  it('opens on its own when Settings lands on one of its rows', () => {
    render(
      <SettingsCategoryPane
        category={TOURS}
        settings={{}}
        onChange={vi.fn()}
        focusRowKey="elementTour-sankey"
      />,
    );
    expect(header().getAttribute('aria-expanded')).toBe('true');
  });

  it('offers the Sankey tour again when its switch is turned on', () => {
    const onChange = vi.fn();
    render(
      <SettingsCategoryPane
        category={TOURS}
        settings={{ elementTourKinds: ['sankey'] }}
        onChange={onChange}
        focusRowKey="elementTour-sankey"
      />,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Sankey Diagram Tour' }));
    expect(onChange).toHaveBeenCalledWith({ elementTourKinds: [], elementToursSeen: false });
  });

  it('brings what it unfolded into view once it has eased open', () => {
    vi.useFakeTimers();
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    scroll.mockClear();
    render(<SettingsCategoryPane category={TOURS} settings={{}} onChange={vi.fn()} />);
    fireEvent.click(header());
    expect(scroll).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(200));
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: 'nearest' }));
    vi.useRealTimers();
  });
});
