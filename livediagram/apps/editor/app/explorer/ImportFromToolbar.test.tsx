// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ImportFromToolbar } from './ImportFromToolbar';
import { IMPORT_SOURCES, type ImportSource } from './import-sources';

// docs/specs/013-workspace/folders.md "Import from".
describe('ImportFromToolbar', () => {
  it('is a toolbar named "Import from" with one named button per shipped source', () => {
    const onImport = vi.fn();
    render(<ImportFromToolbar sources={IMPORT_SOURCES} onImport={onImport} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Import from' });
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Import from Microsoft Whiteboard',
      'Import from Excalidraw',
      'Import from draw.io',
    ]);
    expect(toolbar.textContent).toContain('Import from');
    fireEvent.click(buttons[0]!);
    expect(onImport).toHaveBeenCalledWith('microsoft-whiteboard');
    fireEvent.click(buttons[1]!);
    expect(onImport).toHaveBeenCalledWith('excalidraw');
    fireEvent.click(buttons[2]!);
    expect(onImport).toHaveBeenCalledWith('drawio');
  });

  it('moves focus between sources with the arrow keys', () => {
    const sources: ImportSource[] = [
      IMPORT_SOURCES[0]!,
      { ...IMPORT_SOURCES[0]!, name: 'Second tool' },
    ];
    render(<ImportFromToolbar sources={sources} onImport={vi.fn()} />);
    const [first, second] = screen.getAllByRole('button');
    first!.focus();
    fireEvent.keyDown(first!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(first);
  });

  it('renders nothing without sources', () => {
    const { container } = render(<ImportFromToolbar sources={[]} onImport={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });
});
