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

  // A product's own part, under the rows (livedocuments: an image's Alt Text), stays in the menu while it is used.
  it('draws a product part under the rows, kept open while it is used', () => {
    const onClose = vi.fn();
    render(
      <ReadOnlyElementMenu
        position={{ x: 10, y: 10 }}
        title="Image"
        items={[{ key: 'comment', label: 'Add Comment' }]}
        onRun={vi.fn()}
        onClose={onClose}
      >
        <label>
          Alt Text
          <textarea defaultValue="A cat" />
        </label>
      </ReadOnlyElementMenu>,
    );
    const field = screen.getByRole('textbox', { name: 'Alt Text' });
    fireEvent.change(field, { target: { value: 'A dog' } });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Add Comment' })).toBeTruthy();
  });
});
