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
