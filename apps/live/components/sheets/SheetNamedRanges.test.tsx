// @vitest-environment jsdom
// Sheet Settings' Named Ranges (docs/specs/029-sheets/sheet.md "Named ranges").
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SHEET_ID, makeSheet, renderSheet } from './sheet-ui-test-utils';
import { NO_NAMES, SheetNamedRanges } from './SheetNamedRanges';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

describe('the named ranges list', () => {
  it('says how to make one when there are none', async () => {
    const h = await makeSheet();
    renderSheet(h, ({ actions }) => <SheetNamedRanges actions={actions} onClose={vi.fn()} />);
    expect(screen.getByText(NO_NAMES)).toBeTruthy();
  });

  it('lists each name with its range, goes to it, and removes it', async () => {
    const h = await makeSheet();
    const onClose = vi.fn();
    renderSheet(h, ({ actions }) => <SheetNamedRanges actions={actions} onClose={onClose} />);
    const { rows, cols } = h.ctl().sheet.layout;
    act(() =>
      h.ctl().write(
        {
          kind: 'layout',
          changes: [
            {
              k: 'name',
              name: 'Rate',
              range: { r1: rows[1]!, c1: cols[0]!, r2: rows[1]!, c2: cols[0]! },
            },
          ],
        },
        'Name',
      ),
    );
    const list = screen.getByRole('list', { name: 'Named ranges' });
    expect(within(list).getByText('Rate')).toBeTruthy();
    expect(within(list).getByText('A2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Go To Rate' }));
    expect(h.ctl().selection.active).toEqual({ r: 1, c: 0 });
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Rate' }));
    expect(h.ctl().sheet.layout.names).toBeUndefined();
    expect(screen.getByText(NO_NAMES)).toBeTruthy();
  });

  it('shows the names to someone who may only view, without Remove', async () => {
    const h = await makeSheet();
    const { rows, cols } = h.store.sheet(SHEET_ID)!.layout;
    h.store.write(SHEET_ID, {
      kind: 'layout',
      changes: [
        { k: 'name', name: 'X', range: { r1: rows[0]!, c1: cols[0]!, r2: rows[0]!, c2: cols[0]! } },
      ],
    });
    renderSheet(h, ({ actions }) => <SheetNamedRanges actions={actions} onClose={vi.fn()} />, {
      canEdit: false,
    });
    expect(screen.getByText('X')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove X' })).toBeNull();
  });
});
