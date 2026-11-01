// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { excalidrawBuilder, excalidrawText } from '@/lib/excalidraw-fixtures';
import { EXCALIDRAW_NOT_A_SCENE } from '@/lib/excalidraw-board-file';
import { EXCALIDRAW_FILE_ACCEPT, ExcalidrawImportPanel } from './ExcalidrawImportPanel';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.spyOn(console, 'info').mockImplementation(() => {});

// docs/specs/020-import-export/blueprints/excalidraw-import.md "Explorer entry and dialog".
const saved = (name: string) =>
  new File([excalidrawText([excalidrawBuilder().rectangle()], { type: 'excalidraw' })], name);

describe('ExcalidrawImportPanel', () => {
  it('takes several files, imports them, and ends on the report', async () => {
    const importScenes = vi.fn(async () => ({
      status: 'done' as const,
      documents: [{ id: 'd1', name: 'Plan' }],
    }));
    const onClose = vi.fn();
    render(<ExcalidrawImportPanel importScenes={importScenes} onClose={onClose} />);
    const input = screen.getByTestId('excalidraw-file-input') as HTMLInputElement;
    expect(input.multiple).toBe(true);
    expect(input.accept).toBe(EXCALIDRAW_FILE_ACCEPT);
    fireEvent.change(input, { target: { files: [saved('Plan.excalidraw')] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(importScenes).toHaveBeenCalledTimes(1);
  });

  it('says why when no file holds a scene, and stays on the pick step', async () => {
    const importScenes = vi.fn();
    render(<ExcalidrawImportPanel importScenes={importScenes} onClose={vi.fn()} />);
    const drop = screen.getByRole('button', {
      name: 'Drop .excalidraw files here, or choose files',
    });
    fireEvent.drop(drop, {
      dataTransfer: { files: [new File(['hello'], 'notes.txt', { type: 'text/plain' })] },
    });
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', EXCALIDRAW_NOT_A_SCENE);
    expect(importScenes).not.toHaveBeenCalled();
  });
});
