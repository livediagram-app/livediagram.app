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
    expect(header().textContent).toContain('20 of 20 On');
    // Offer Again stays open beside it.
    expect(screen.getByRole('switch', { name: 'Avatar Tour' })).toBeTruthy();
  });

  it('opens from its heading, the master switch over each element', () => {
    render(<SettingsCategoryPane category={TOURS} settings={{}} onChange={vi.fn()} />);
    fireEvent.click(header());
    expect(header().getAttribute('aria-expanded')).toBe('true');
    const group = screen.getByRole('group', { name: 'Show Me on Every Element settings' });
    expect(group.textContent).toContain('Sankey Diagram');
  });

  it('counts an answered tour as off', () => {
    render(
      <SettingsCategoryPane
        category={TOURS}
        settings={{ elementTourKinds: ['sankey'] }}
        onChange={vi.fn()}
      />,
    );
    expect(header().textContent).toContain('19 of 20 On');
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
    fireEvent.click(screen.getByRole('switch', { name: 'Sankey Diagram' }));
    expect(onChange).toHaveBeenCalledWith({ elementTourKinds: [], elementToursSeen: false });
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

// docs/specs/007-editor/watch-it-built.md "Settings": each mode's Watch It Built rows are a closed section of their own.
describe('Watch It Built sections', () => {
  const workshop = () => screen.getByRole('button', { name: /^Watch It Built in Workshop/ });

  it('start closed, counting the topics on', () => {
    render(<SettingsCategoryPane category={TOURS} settings={{}} onChange={vi.fn()} />);
    expect(workshop().getAttribute('aria-expanded')).toBe('false');
    expect(workshop().textContent).toContain('4 of 4 On');
    expect(
      screen.getByRole('button', { name: /^Watch It Built in Diagram/ }).textContent,
    ).toContain('5 of 5 On');
  });

  it('count a watched topic as off, and open from the heading', () => {
    render(
      <SettingsCategoryPane
        category={TOURS}
        settings={{ watchTopics: ['workshop-run'] }}
        onChange={vi.fn()}
      />,
    );
    expect(workshop().textContent).toContain('3 of 4 On');
    fireEvent.click(workshop());
    expect(workshop().getAttribute('aria-expanded')).toBe('true');
    const group = screen.getByRole('group', { name: 'Watch It Built in Workshop settings' });
    expect(group.textContent).toContain('Run the Room');
  });
});
