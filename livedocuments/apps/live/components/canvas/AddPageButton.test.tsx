// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddPageButton } from './AddPageButton';
import { addAnotherLabel } from '@/lib/add-page-labels';

afterEach(cleanup);

const rect = { x: 0, y: 0, width: 800, height: 840 };
const page = (extra: object = {}) => ({ id: 'p1', rect, ...extra });

// docs/specs/007-editor/pages-mode.md "Adding a page".
describe('AddPageButton', () => {
  it('sits level with the last page’s middle', () => {
    render(<AddPageButton last={page()} zoom={1} onAdd={vi.fn()} onAddLike={vi.fn()} />);
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
        onAdd={vi.fn()}
        onAddLike={onAddLike}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Another Slide' }));
    expect(onAddLike).toHaveBeenCalledWith('p1');
  });

  it('chooses any kind from the list under it', () => {
    const onAdd = vi.fn();
    render(<AddPageButton last={page()} zoom={1} onAdd={onAdd} onAddLike={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a Page of Any Kind' }));
    const rows = within(screen.getByRole('group', { name: 'Add a Page' })).getAllByRole('button');
    expect(rows.map((r) => r.querySelector('span.block')?.textContent)).toEqual([
      'Infographic',
      'Article',
      'Slide',
    ]);
    expect(document.activeElement).toBe(rows[0]);
    fireEvent.keyDown(rows[0]!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rows[2]);
    fireEvent.click(rows[2]!);
    expect(onAdd).toHaveBeenCalledWith('slide');
  });
});

describe('addAnotherLabel', () => {
  it('names each kind', () => {
    expect(addAnotherLabel({ kind: 'slide' })).toBe('Add Another Slide');
    expect(addAnotherLabel({})).toBe('Add Another Infographic Page');
    expect(addAnotherLabel({ kind: 'article' })).toBe('Add Another Article');
  });
});
