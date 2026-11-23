// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SegmentedToggle, segmentsWrapped } from './SegmentedToggle';

// A pane header's pressed-state switch (the Image Gallery's All / Unused, under AppScopeToggle too): a named group of
// real buttons, the one shown pressed, telling only a change.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

// Work Tracker 1384: Live Data's "Sheet Range", "Board Counts" and "Dashboard Metric" broke onto two lines in a
// ~250 px column. jsdom lays nothing out, so each segment's row (offsetTop) is set by the test, and the track's size
// changes are told through a stand-in ResizeObserver.
describe('SegmentedToggle in a narrow, normal and wide place', () => {
  const KINDS = [
    { value: 'sheet', label: 'Sheet Range', description: 'A range of cells' },
    { value: 'board', label: 'Board Counts', description: 'Cards counted on a board' },
    { value: 'metric', label: 'Dashboard Metric', description: 'A Dashboard number' },
  ] as const;
  type Kind = (typeof KINDS)[number]['value'];

  // Each segment's row in the place the test gives the track: [0, 0, 0] fits on one row.
  let rows: number[] = [0, 0, 0];
  let resized: () => void = () => {};
  const disconnect = vi.fn();

  function drawKinds() {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          resized = cb;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    const view = render(
      <SegmentedToggle<Kind> label="Source" value="sheet" onChange={() => {}} options={KINDS} />,
    );
    const group = screen.getByRole('group', { name: 'Source' });
    return { view, group };
  }
  const placeAt = (next: number[]) => {
    rows = next;
    act(() => resized());
  };

  Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
    configurable: true,
    get(this: HTMLElement) {
      const cells = this.parentElement ? Array.from(this.parentElement.children) : [];
      return rows[cells.indexOf(this)] ?? 0;
    },
  });

  it('keeps one row, unchanged, in a wide place', () => {
    rows = [0, 0, 0];
    const { group } = drawKinds();
    expect(group.hasAttribute('data-segments-wrapped')).toBe(false);
  });

  it('wraps whole segments in a narrow place, each label kept on one line', () => {
    rows = [0, 0, 32];
    const { group } = drawKinds();
    expect(group.hasAttribute('data-segments-wrapped')).toBe(true);
    expect(group.className).toContain('flex-wrap');
    expect(group.className).toContain('max-w-full');
    for (const button of within(group).getAllByRole('button')) {
      expect(button.className).toContain('whitespace-nowrap');
      // Equal height, sharing each row, and 44 px to a thumb once wrapped.
      expect(button.className).toContain('h-7');
      expect(button.className).toContain('in-data-segments-wrapped:grow');
      expect(button.className).toContain('pointer-coarse:in-data-segments-wrapped:h-11');
      expect(button.className).toMatch(/\brelative\b.*\btouch-target-y\b/);
      expect(button.parentElement!.className).toContain('in-data-segments-wrapped:grow');
    }
  });

  it('follows its place as it narrows and widens again (a normal width fits)', () => {
    rows = [0, 0, 0];
    const { group, view } = drawKinds();
    placeAt([0, 32, 32]);
    expect(group.hasAttribute('data-segments-wrapped')).toBe(true);
    placeAt([0, 0, 0]);
    expect(group.hasAttribute('data-segments-wrapped')).toBe(false);
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('stays on one row where there is no layout to watch', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    rows = [0, 0, 32];
    render(
      <SegmentedToggle<Kind> label="Source" value="sheet" onChange={() => {}} options={KINDS} />,
    );
    expect(screen.getByRole('group').hasAttribute('data-segments-wrapped')).toBe(false);
  });

  it('never calls one segment wrapped', () => {
    const track = document.createElement('div');
    expect(segmentsWrapped(track)).toBe(false);
    track.append(document.createElement('span'));
    expect(segmentsWrapped(track)).toBe(false);
  });
});
