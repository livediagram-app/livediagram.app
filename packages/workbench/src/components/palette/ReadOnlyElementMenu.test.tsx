// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadOnlyElementMenu } from './ReadOnlyElementMenu';

// ContextMenu re-clamps on resize; jsdom has no ResizeObserver.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  },
);

afterEach(cleanup);

describe('ReadOnlyElementMenu', () => {
  it('names the element and lists its rows', () => {
    render(
      <ReadOnlyElementMenu
        position={{ x: 10, y: 10 }}
        title="Square"
        items={[
          { key: 'comment', label: 'Show Comments' },
          { key: 'copy-text', label: 'Copy Text' },
        ]}
        onRun={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Square')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show Comments' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy Text' })).toBeTruthy();
  });

  it('closes, then runs the row pressed', () => {
    const calls: string[] = [];
    render(
      <ReadOnlyElementMenu
        position={{ x: 10, y: 10 }}
        title="Sticky Note"
        items={[
          { key: 'edit-text', label: 'Edit Text' },
          { key: 'open-link', label: 'Open Link' },
          { key: 'note', label: 'View Note' },
        ]}
        onRun={(key) => calls.push(key)}
        onClose={() => calls.push('close')}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'View Note' }));
    expect(calls).toEqual(['close', 'note']);
  });
});
