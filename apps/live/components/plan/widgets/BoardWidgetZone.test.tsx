// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { planPalette } from '../plan-palette';
import { BoardWidgetZone } from './BoardWidgetZone';

// docs/specs/026-plan/board-widgets.md "Remove": a widget's × shows only while its board is selected,
// on every device.
afterEach(cleanup);

function show(selected: boolean, canEdit = true) {
  const onChange = vi.fn();
  render(
    <BoardWidgetZone
      widgets={['count', 'filter']}
      canEdit={canEdit}
      selected={selected}
      palette={planPalette('light', {})}
      dropAt={null}
      onChange={onChange}
      render={(kind) => <span>{kind}</span>}
    />,
  );
  return onChange;
}

describe('BoardWidgetZone ×', () => {
  it('is hidden while the board is not selected', () => {
    show(false);
    expect(screen.queryByRole('button', { name: 'Remove Item Count' })).toBeNull();
  });

  it('shows on a selected board and takes the widget off', () => {
    const onChange = show(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Item Count' }));
    expect(onChange).toHaveBeenCalledWith(['filter']);
  });

  it('never shows to someone who may not edit', () => {
    show(true, false);
    expect(screen.queryByRole('button', { name: 'Remove Item Count' })).toBeNull();
  });
});

// docs/specs/026-plan/board-widgets.md: an empty zone's hint shows only while the board is selected.
describe('BoardWidgetZone empty hint', () => {
  const empty = (selected: boolean, dropAt: number | null = null, canEdit = true) =>
    render(
      <BoardWidgetZone
        widgets={[]}
        canEdit={canEdit}
        selected={selected}
        palette={planPalette('light', {})}
        dropAt={dropAt}
        onChange={vi.fn()}
        render={(kind) => <span>{kind}</span>}
      />,
    );

  it('shows the hint and its + only on a selected board, to someone who may edit', () => {
    empty(true);
    expect(screen.getByText('Drag Widgets here from the palette')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a widget' })).toBeTruthy();
    cleanup();
    empty(false);
    expect(screen.queryByText('Drag Widgets here from the palette')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add a widget' })).toBeNull();
    cleanup();
    empty(true, null, false);
    expect(screen.queryByText('Drag Widgets here from the palette')).toBeNull();
  });

  it('still shows the drop bar for a palette drag over an unselected board', () => {
    const { container } = empty(false, 0);
    const zone = container.querySelector('[data-widget-zone]') as HTMLElement;
    expect(zone.style.outline).toContain('dashed');
    expect(screen.queryByText('Drag Widgets here from the palette')).toBeNull();
  });
});
