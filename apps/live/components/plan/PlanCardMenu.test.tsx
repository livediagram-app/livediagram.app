// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanCardMenu } from './PlanCardMenu';

// docs/specs/026-plan/items.md "Trash": a card's menu trashes it, never deletes it for good.
afterEach(cleanup);

// jsdom has no ResizeObserver; the menu measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

describe('PlanCardMenu', () => {
  it('offers Trash, not Delete, and moves the card there', () => {
    const onTrash = vi.fn();
    render(
      <PlanCardMenu
        at={{ x: 10, y: 10 }}
        title="Ship"
        canEdit
        columns={[]}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onMove={vi.fn()}
        onTrash={onTrash}
        onArchive={vi.fn()}
        onFlag={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Trash' }));
    expect(onTrash).toHaveBeenCalledOnce();
  });
});
