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

// The tab menu's Import and Export rows (docs/specs/026-plan/plan-tabs.md "Board tab and Sheet tab", "The Import
// dialog"): Import… (the one Import dialog) then Export (the Export dialog), on every tab.

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
  it('are Import… and Export on every tab, a Board or Sheet tab’s included', () => {
    const onExport = vi.fn();
    const onImport = vi.fn();
    render(<PortalMenu {...props({ point: { x: 10, y: 10 }, onExport, onImport })} />);
    // No Import CSV… or Import from Another Tool… beside it: both are rows of the one Import dialog.
    expect(rowLabels()).toEqual(['Import…', 'Export']);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(onExport).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Import…' }));
    expect(onImport).toHaveBeenCalledOnce();
  });

  // docs/specs/026-plan/plan-tabs.md "The Import dialog": dimmed only when the dialog has nothing to press.
  it('dims Import… when the Import dialog would have nothing to press', () => {
    render(<PortalMenu {...props({ point: { x: 10, y: 10 }, canImport: false })} />);
    const row = screen.getByText('Import…').closest('[aria-disabled]');
    expect(row?.getAttribute('aria-disabled')).toBe('true');
    expect(rowLabels()).toEqual(['Export']);
  });

  it('keeps Import… lit on a locked tab when the dialog offers another tool', () => {
    render(<PortalMenu {...props({ point: { x: 10, y: 10 }, locked: true, canImport: true })} />);
    expect(rowLabels()).toEqual(['Import…', 'Export']);
  });

  it('dims Import… on a locked tab by default', () => {
    render(<PortalMenu {...props({ point: { x: 10, y: 10 }, locked: true })} />);
    expect(rowLabels()).toEqual(['Export']);
  });
});
