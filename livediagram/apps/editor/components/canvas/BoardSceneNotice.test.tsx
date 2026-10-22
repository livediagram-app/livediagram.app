// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoardSceneNotice } from './BoardSceneNotice';

// docs/specs/020-import-export/board-scene.md "In the editor": the paste notice's copy and role.
afterEach(cleanup);

describe('BoardSceneNotice', () => {
  it('renders nothing without a notice', () => {
    const { container } = render(<BoardSceneNotice notice={null} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('says what changed, count first, as a polite status', () => {
    render(
      <BoardSceneNotice
        notice={{
          kind: 'report',
          source: 'excalidraw',
          report: {
            landed: { shape: 3 },
            degraded: [{ rule: 'Groups were dropped', count: 2 }],
            skipped: [{ rule: 'Embeds were skipped', count: 1 }],
          },
          images: { imported: 0, deduped: 0, placeholders: { 'missing-bytes': 1 } },
        }}
        onClose={() => {}}
      />,
    );
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('Pasted from Excalidraw with some changes');
    expect(status.textContent).toContain('2 · Groups were dropped');
    expect(status.textContent).toContain('1 · Embeds were skipped');
    expect(status.textContent).toContain("The file didn't include the image data.");
    expect(status.textContent).toContain('Double-click a placeholder to add its image.');
    // What landed is not repeated in the notice.
    expect(status.textContent).not.toContain('3 shapes');
  });

  it('shows image progress', () => {
    render(
      <BoardSceneNotice
        notice={{ kind: 'progress', source: 'microsoft-whiteboard', done: 3, total: 12 }}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('status').textContent).toBe('Pasting images 3 of 12…');
  });

  it('closes with its button and with Escape inside it', () => {
    const onClose = vi.fn();
    render(
      <BoardSceneNotice
        notice={{ kind: 'refused', source: 'excalidraw', message: 'Too big.' }}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain("Couldn't paste from Excalidraw");
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
