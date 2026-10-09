// @vitest-environment jsdom
// The status bar's face (docs/specs/029-sheets/sheet.md "Selection"): each total named and valued, and its menu
// picking which show.
import { act, fireEvent, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  makeSheet,
  renderSheet,
  stubResizeObserver,
  type SheetHarness,
} from './sheet-ui-test-utils';
import { SheetStatusBar } from './SheetStatusBar';
import { resetStatusPick } from './sheet-status-pick';

beforeAll(stubResizeObserver);

describe('the status bar', () => {
  let h: SheetHarness;
  beforeEach(async () => {
    localStorage.clear();
    resetStatusPick();
    h = await makeSheet({ cells: { A1: '2', A2: '4', A3: 'x' } });
  });

  it('shows nothing for one number, and names each total with its value for more', () => {
    renderSheet(h, () => <SheetStatusBar />, {});
    expect(screen.queryByRole('button', { name: 'Selection totals' })).toBeNull();
    act(() => h.select('A1:A3'));
    expect(screen.getAllByRole('status').map((s) => s.textContent)).toEqual([
      'Sum6',
      'Average3',
      'Count3',
    ]);
  });

  it('picks which totals show from its menu, keeping one', () => {
    renderSheet(h, () => <SheetStatusBar />, {});
    act(() => h.select('A1:A3'));
    fireEvent.click(screen.getByRole('button', { name: 'Selection totals' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /^Max/ }));
    expect(screen.getAllByRole('status').map((s) => s.textContent)).toContain('Max4');
    for (const name of ['Sum', 'Average', 'Count'])
      fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(`^${name}`) }));
    expect(screen.getAllByRole('status').map((s) => s.textContent)).toEqual(['Max4']);
    // The last one shown stays.
    expect((screen.getByRole('checkbox', { name: /^Max/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.keyDown(screen.getByRole('group', { name: 'Show in the status bar' }), {
      key: 'Escape',
    });
    expect(screen.queryByRole('group', { name: 'Show in the status bar' })).toBeNull();
    // A press anywhere outside closes it too.
    fireEvent.click(screen.getByRole('button', { name: 'Selection totals' }));
    expect(screen.getByRole('group', { name: 'Show in the status bar' })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('group', { name: 'Show in the status bar' })).toBeNull();
  });
});
