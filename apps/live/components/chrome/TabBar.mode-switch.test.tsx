// @vitest-environment jsdom

// The mode switch's place in the tab bar (docs/specs/007-editor/editor-modes.md
// "The mode switch"): editors only, left end of the bar, empty slot on an
// event-storming board.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ES_BOARD_LAYER_ID, type Tab } from '@livediagram/document';
import { TabBar } from './TabBar';
import { TWO_TABS, tabBarProps } from './TabBar.test-props';

afterEach(cleanup);

const slot = (container: HTMLElement) => container.querySelector('[data-editor-mode-switch]');

describe('TabBar mode switch', () => {
  it('offers an editor the switch as the first control in the bar', () => {
    const { container } = render(<TabBar {...tabBarProps({})} />);
    const bar = container.querySelector('[data-editor-tabbar]')!;
    expect(bar.firstElementChild).toBe(slot(container));
    screen.getByRole('radiogroup', { name: 'Editor mode' });
  });

  it('switches mode when an editor picks Draw', () => {
    render(<TabBar {...tabBarProps({})} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Draw' }));
    expect(screen.getByRole('radio', { name: 'Draw' }).getAttribute('aria-checked')).toBe('true');
  });

  it('offers a view-role visitor no switch and no slot', () => {
    const { container } = render(<TabBar {...tabBarProps({ selfRole: 'view' })} />);
    expect(slot(container)).toBeNull();
  });

  it('keeps an empty slot on an event-storming board', () => {
    const board: Tab = { ...TWO_TABS[0]!, kind: 'event-storming' };
    const { container } = render(
      <TabBar {...tabBarProps({ tabs: [board, TWO_TABS[1]!], activeId: board.id })} />,
    );
    expect(slot(container)?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('recognises a legacy event-storming board by its layer', () => {
    const board: Tab = {
      ...TWO_TABS[0]!,
      layers: [{ id: ES_BOARD_LAYER_ID, name: 'Board', visible: true }],
    };
    render(<TabBar {...tabBarProps({ tabs: [board], activeId: board.id })} />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });
});
