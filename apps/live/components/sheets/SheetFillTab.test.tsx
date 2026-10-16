// @vitest-environment jsdom
// A Sheet filling its tab (docs/specs/029-sheets/sheet.md "Fill Tab"): a Sheet tab's always does, so Sheet Settings has
// no switch for it, and a filling Sheet has no Maximise.
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
const plan = {};
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));

beforeAll(stubResizeObserver);

describe('Fill Tab on a Sheet', () => {
  let h: SheetHarness;
  beforeEach(async () => {
    vi.clearAllMocks();
    setPlanCover({ fillTabId: null, fillTabKind: null });
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

  it('offers no Fill Tab: a Sheet tab always fills it (docs/specs/026-plan/plan-tabs.md)', () => {
    show();
    openView();
    expect(screen.queryByRole('radio', { name: 'Fill Tab' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'On Canvas' })).toBeNull();
  });

  it('while filling the tab, hides Maximise', () => {
    setPlanCover({ fillTabId: 'el1', fillTabKind: 'Sheet' });
    show();
    expect(screen.queryByRole('button', { name: 'Maximise Sheet' })).toBeNull();
    act(() => setPlanCover({ fillTabId: null, fillTabKind: null }));
  });
});
