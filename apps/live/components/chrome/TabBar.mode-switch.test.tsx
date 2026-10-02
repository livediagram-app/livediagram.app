// @vitest-environment jsdom

// The mode switch's place in the tab bar (docs/specs/007-editor/editor-modes.md
// "The mode switch"): editors only, left end of the bar, empty slot on an
// event-storming board.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ES_BOARD_LAYER_ID, type Tab } from '@livediagram/document';
import { TabBar } from './TabBar';
import { TWO_TABS, tabBarProps } from './TabBar.test-props';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// The mode store caches per tab id, so every test works on tabs of its own.
let seq = 0;
const freshTabs = (over: Partial<Tab> = {}): Tab[] => {
  seq += 1;
  return [
    { ...TWO_TABS[0]!, id: `m${seq}-1`, ...over },
    { ...TWO_TABS[1]!, id: `m${seq}-2` },
  ];
};
const props = (over: Partial<Tab> = {}, role: 'edit' | 'view' = 'edit', powerUser = false) => {
  const tabs = freshTabs(over);
  return tabBarProps({ tabs, activeId: tabs[0]!.id, selfRole: role, powerUser });
};
const chip = () => screen.getByRole('button', { name: /^Editor mode:/ });

const slot = (container: HTMLElement) => container.querySelector('[data-editor-mode-switch]');

describe('TabBar mode switch', () => {
  it('offers an editor the switch as the first control in the bar', () => {
    const { container } = render(<TabBar {...props()} />);
    const bar = container.querySelector('[data-editor-tabbar]')!;
    expect(bar.firstElementChild).toBe(slot(container));
    expect(chip().getAttribute('aria-label')).toBe('Editor mode: Diagram');
  });

  it('opens the tab in its opening mode', () => {
    render(<TabBar {...props({ opensIn: 'draw' })} />);
    expect(chip().getAttribute('aria-label')).toBe('Editor mode: Draw');
  });

  it('switches mode when an editor picks Draw from the chip', () => {
    render(<TabBar {...props()} />);
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Draw/ }));
    expect(chip().getAttribute('aria-label')).toBe('Editor mode: Draw');
  });

  it('shows power users the icon pill, in the same slot', () => {
    const { container } = render(<TabBar {...props({}, 'edit', true)} />);
    expect(screen.queryByRole('button', { name: /^Editor mode:/ })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Draw' }));
    expect(screen.getByRole('radio', { name: 'Draw' }).getAttribute('aria-checked')).toBe('true');
    const pillSlot = slot(container)!.className;
    cleanup();
    const { container: plain } = render(<TabBar {...props()} />);
    expect(slot(plain)!.className).toBe(pillSlot);
  });

  it('offers a view-role visitor no switch and no slot', () => {
    const { container } = render(<TabBar {...props({}, 'view')} />);
    expect(slot(container)).toBeNull();
  });

  it('keeps an empty slot on an event-storming board', () => {
    const { container } = render(<TabBar {...props({ kind: 'event-storming' })} />);
    expect(slot(container)?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('button', { name: /^Editor mode:/ })).toBeNull();
  });

  it('recognises a legacy event-storming board by its layer', () => {
    const layers = [{ id: ES_BOARD_LAYER_ID, name: 'Board', visible: true }];
    render(<TabBar {...props({ layers })} />);
    expect(screen.queryByRole('button', { name: /^Editor mode:/ })).toBeNull();
  });
});
