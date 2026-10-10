// @vitest-environment jsdom
// A Sheet filling its tab (docs/specs/029-sheets/sheet.md "Fill Tab"): set from Sheet Settings' View, asked first when
// the rest of the canvas would be deleted, and put back on the canvas.
import { act, fireEvent, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setPlanCover } from '@/hooks/plan/plan-cover-store';
import {
  makeSheet,
  renderSheet,
  stubResizeObserver,
  type SheetHarness,
} from './sheet-ui-test-utils';
import { SheetHeader } from './SheetHeader';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const confirm = vi.fn(async () => true);
vi.mock('@/hooks/ui/useConfirm', () => ({ useConfirm: () => confirm }));
const plan = { tabOthers: vi.fn(() => ({ count: 2, locked: 0 })), fillTabSheet: vi.fn() };
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));

beforeAll(stubResizeObserver);

describe('Fill Tab on a Sheet', () => {
  let h: SheetHarness;
  beforeEach(async () => {
    vi.clearAllMocks();
    setPlanCover({ fillTabId: null, fillTabKind: null, tabElementCount: 0 });
    h = await makeSheet({ cells: { A1: '1' } });
  });
  const show = () =>
    renderSheet(h, ({ actions }) => (
      <SheetHeader
        elementId="el1"
        bounds={{ x: 0, y: 0, width: 10, height: 10 }}
        actions={actions}
        onImportCsv={vi.fn()}
      />
    ));
  const openView = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Sheet Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sheet Options' }));
  };

  it('fills the tab after asking, when the rest of the canvas would go', async () => {
    show();
    openView();
    expect(screen.getByRole('radio', { name: 'On Canvas' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Fill Tab' }));
    });
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmLabel: 'Delete and Fill Tab' }),
    );
    expect(plan.fillTabSheet).toHaveBeenCalledWith('el1', true);
  });

  it('keeps the canvas when the confirm is cancelled, and fills an empty tab at once', async () => {
    confirm.mockResolvedValueOnce(false);
    show();
    openView();
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Fill Tab' }));
    });
    expect(plan.fillTabSheet).not.toHaveBeenCalled();
    plan.tabOthers.mockReturnValueOnce({ count: 0, locked: 0 });
    openView();
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Fill Tab' }));
    });
    expect(plan.fillTabSheet).toHaveBeenCalledWith('el1', true);
  });

  it('while filling the tab, hides Maximise and Focus and offers On Canvas', () => {
    setPlanCover({ fillTabId: 'el1', fillTabKind: 'Sheet', tabElementCount: 1 });
    show();
    expect(screen.queryByRole('button', { name: 'Maximise Sheet' })).toBeNull();
    openView();
    expect(screen.getByRole('radio', { name: 'Fill Tab' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('radio', { name: 'On Canvas' }));
    expect(plan.fillTabSheet).toHaveBeenCalledWith('el1', false);
    act(() => setPlanCover({ fillTabId: null, fillTabKind: null, tabElementCount: 0 }));
  });
});
