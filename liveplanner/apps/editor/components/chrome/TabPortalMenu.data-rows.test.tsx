// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { PortalMenu } from './TabPortalMenu';

// jsdom lays nothing out, so the keep-on-screen clamp would chase a box that
// never moves. Where the menu sits is not what this file is about.
vi.mock('@liveworkspace/workbench/lib/clamp-to-viewport', () => ({
  clampToViewport: () => ({ x: 0, y: 0 }),
}));

// A Board or Sheet tab's Import and Export rows (docs/specs/026-plan/plan-tabs.md "Board tab and Sheet tab"):
// Import CSV…, then Export (the Export dialog, as on every tab), then Download CSV.

type Props = ComponentProps<typeof PortalMenu>;

function props(over: Partial<Props> = {}): Props {
  const noop = () => {};
  return {
    onClose: noop,
    onRename: noop,
    onDuplicate: noop,
    onClearContent: noop,
    onImport: noop,
    onExport: noop,
    onCopyTo: noop,
    onToggleLock: noop,
    locked: false,
    selfId: 'me',
    otherProjects: [],
    folderNames: [],
    currentFolder: null,
    onMoveToFolder: noop,
    onRemoveFromFolder: noop,
    onDelete: noop,
    canDelete: true,
    canClearContent: true,
    ...over,
  };
}

const rowLabels = () =>
  screen
    .getAllByRole('button')
    .map((b) => b.textContent?.trim())
    .filter((t) => /Import|Export|Download/.test(t ?? ''));

afterEach(() => cleanup());

describe('the tab menu’s Import and Export rows', () => {
  it('are Import and Export on any other tab', () => {
    const onExport = vi.fn();
    render(<PortalMenu {...props({ point: { x: 10, y: 10 }, onExport })} />);
    expect(rowLabels()).toEqual(['Import', 'Export']);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('are Import CSV…, Export and Download CSV on a Board or Sheet tab', () => {
    const onExport = vi.fn();
    const onImport = vi.fn();
    const onClose = vi.fn();
    render(
      <PortalMenu
        {...props({
          point: { x: 10, y: 10 },
          onExport,
          onClose,
          dataRows: {
            importLabel: 'Import CSV…',
            onImport,
          },
        })}
      />,
    );
    // No Download CSV row: CSV is one of the Export dialog's formats on a Board or Sheet tab.
    expect(rowLabels()).toEqual(['Import CSV…', 'Export']);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(onExport).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Import CSV…' }));
    expect(onImport).toHaveBeenCalledOnce();
  });

  it('dims Import CSV… for someone who may not import', () => {
    render(
      <PortalMenu
        {...props({
          point: { x: 10, y: 10 },
          dataRows: {
            importLabel: 'Import CSV…',
          },
        })}
      />,
    );
    const row = screen.getByText('Import CSV…').closest('[aria-disabled]');
    expect(row?.getAttribute('aria-disabled')).toBe('true');
    expect(rowLabels()).toEqual(['Export']);
  });
});
