// @vitest-environment jsdom
// A Sheet's settings in its element menu (docs/specs/029-sheets/sheet.md "Sheet Settings"): the cog's sections,
// drawn with the Sheet's own controller, and nothing for a Sheet not drawn.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { makeSheet, renderSheet, stubResizeObserver } from './sheet-ui-test-utils';
import { useSheetController } from './sheet-controller';
import { usePublishSheetSettings } from './sheet-settings-registry';
import { SheetMenuSection } from './SheetMenuSection';
import type { SheetActions } from './useSheetActions';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

function Publisher({ actions }: { actions: SheetActions }) {
  usePublishSheetSettings('el1', {
    controller: useSheetController(),
    actions,
    onImportCsv: vi.fn(),
    onImportCsvFile: vi.fn(),
  });
  return null;
}

const element = (id: string) => ({ id, type: 'shape', shape: 'plan-sheet' }) as never;

beforeAll(stubResizeObserver);

describe('the Sheet’s menu rows', () => {
  it('is nothing for a Sheet not drawn', () => {
    const { container } = render(
      <SheetMenuSection element={element('nope')} flyoutProps={() => ({})} />,
    );
    expect(container.textContent).toBe('');
  });

  // One less click: the cog's sections are rows of the menu itself, with no Sheet parent row.
  it('lists the cog’s sections as its own rows for a drawn Sheet, acting on it', async () => {
    const h = await makeSheet();
    renderSheet(h, ({ actions }) => <Publisher actions={actions} />);
    render(
      <SheetMenuSection
        element={element('el1')}
        flyoutProps={(id) => ({ open: id === 'plan-sheet-view', onToggle: () => {} })}
      />,
    );
    for (const name of [
      'Sheet Setup',
      'Sheet Options',
      'Cells',
      'Freeze',
      'Calculations',
      'Named Ranges',
    ])
      expect(screen.getByRole('button', { name: new RegExp(`^${name}`) })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Sheet$/ })).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: /Gridlines/ }));
    expect(h.ctl().sheet.layout.showGrid).toBe(false);
  });
});
