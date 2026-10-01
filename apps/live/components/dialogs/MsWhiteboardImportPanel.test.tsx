// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { boardFiles } from '@/lib/ms-whiteboard/ms-whiteboard-fixtures';
import { MsWhiteboardImportPanel } from './MsWhiteboardImportPanel';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.spyOn(console, 'info').mockImplementation(() => {});

const picked = {
  kind: 'files' as const,
  files: [
    ...boardFiles({ title: 'Roadmap', modified: '2026-03-12T10:00:00Z' }, 'x/a'),
    ...boardFiles({ title: null }, 'x/b'),
  ].map(([path, bytes]) => ({ path, file: new Blob([new Uint8Array(bytes)]) })),
};
vi.mock('@/lib/pick-folder', () => ({
  pickExport: vi.fn(async () => picked),
  readDrop: vi.fn(async () => null),
}));

// docs/specs/020-import-export/blueprints/ms-whiteboard-import.md "Presentation and UX".
describe('MsWhiteboardImportPanel', () => {
  it('lists the boards in a labelled group, all ticked, and imports the ticked ones', async () => {
    const importScenes = vi.fn(async () => ({ status: 'done' as const }));
    const onDone = vi.fn();
    render(<MsWhiteboardImportPanel importScenes={importScenes} onClose={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose a folder' }));
    const group = await screen.findByRole('group', { name: 'Boards to import' });
    expect(group).toBeTruthy();
    expect(screen.getByText('Roadmap')).toBeTruthy();
    expect(screen.getByText('Whiteboard, 1 Jan 2026')).toBeTruthy();
    expect(screen.getByText('Edited 12 Mar 2026 · 0 items')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /Whiteboard, 1 Jan 2026/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 board' }));
    // The panel shows its own report; Done hands back to the host.
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(importScenes).toHaveBeenCalledTimes(1);
  });

  it('disables import with nothing ticked', async () => {
    render(<MsWhiteboardImportPanel importScenes={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose a folder' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }));
    expect(
      (screen.getByRole('button', { name: 'Import 0 boards' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('shows a way back only when its host gives one', () => {
    const back = vi.fn();
    const { unmount } = render(
      <MsWhiteboardImportPanel importScenes={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /All formats/ })).toBeNull();
    unmount();
    render(
      <MsWhiteboardImportPanel
        importScenes={vi.fn()}
        onClose={vi.fn()}
        onBack={{ label: 'All formats', onClick: back }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /All formats/ }));
    expect(back).toHaveBeenCalled();
  });
});
