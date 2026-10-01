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
    render(
      <MsWhiteboardImportPanel importScenes={importScenes} onDone={onDone} onBack={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Choose a folder' }));
    const group = await screen.findByRole('group', { name: 'Boards to import' });
    expect(group).toBeTruthy();
    expect(screen.getByText('Roadmap')).toBeTruthy();
    expect(screen.getByText('Untitled board')).toBeTruthy();
    expect(screen.getByText('Edited 12 Mar 2026 · 0 items')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /Untitled board/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 board' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(importScenes).toHaveBeenCalledTimes(1);
  });

  it('disables import with nothing ticked', async () => {
    render(<MsWhiteboardImportPanel importScenes={vi.fn()} onDone={vi.fn()} onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choose a folder' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }));
    expect(
      (screen.getByRole('button', { name: 'Import 0 boards' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
