// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddPageButton } from './AddPageButton';
import { addAnotherLabel } from '@/lib/add-page-labels';

afterEach(cleanup);

const rect = { x: 0, y: 0, width: 800, height: 840 };
const page = (extra: object = {}) => ({ id: 'p1', rect, ...extra });

// docs/specs/007-editor/pages-mode.md "Adding a page".
describe('AddPageButton', () => {
  it('sits level with the last page’s middle', () => {
    render(<AddPageButton last={page()} zoom={1} onAddLike={vi.fn()} />);
    const holder = screen
      .getByRole('button', { name: 'Add Another Infographic Page' })
      .closest('div[style]') as HTMLElement;
    expect(holder.style.top).toBe('420px');
  });

  it('adds another page like the last with the +, named for what it adds', () => {
    const onAddLike = vi.fn();
    render(
      <AddPageButton
        last={page({ kind: 'slide' })}
        zoom={1}

        onAddLike={onAddLike}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Another Slide' }));
    expect(onAddLike).toHaveBeenCalledWith('p1');
  });

  it('offers no other kind: the tab holds one (One kind a tab)', () => {
    render(<AddPageButton last={page({ kind: 'slide' })} zoom={1} onAddLike={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Add a Page of Any Kind' })).toBeNull();
  });
});

describe('addAnotherLabel', () => {
  it('names each kind', () => {
    expect(addAnotherLabel({ kind: 'slide' })).toBe('Add Another Slide');
    expect(addAnotherLabel({})).toBe('Add Another Infographic Page');
    expect(addAnotherLabel({ kind: 'article' })).toBe('Add Another Article');
  });
});
