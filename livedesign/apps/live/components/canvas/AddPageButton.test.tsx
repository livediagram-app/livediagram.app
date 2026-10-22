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
      .getByRole('button', { name: 'Add Another Page' })
      .closest('div[style]') as HTMLElement;
    expect(holder.style.top).toBe('420px');
  });

  it('adds another page like the last with the +, named for what it adds', () => {
    const onAddLike = vi.fn();
    render(
      <AddPageButton
        last={page({ kind: 'wireframe', device: 'ipad' })}
        zoom={1}
        onAdd={vi.fn()}
        onAddLike={onAddLike}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Another iPad Screen' }));
    expect(onAddLike).toHaveBeenCalledWith('p1');
  });

  it('chooses any kind from the list under it, a wireframe by its device', () => {
    const onAdd = vi.fn();
    render(<AddPageButton last={page()} zoom={1} onAdd={onAdd} onAddLike={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a Page of Any Kind' }));
    const rows = within(screen.getByRole('group', { name: 'Add a Page' })).getAllByRole('button');
    expect(rows.map((r) => r.querySelector('span.block')?.textContent)).toEqual([
      'Logo',
      'Wireframe',
    ]);
    expect(document.activeElement).toBe(rows[0]);
    fireEvent.keyDown(rows[0]!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rows[1]);
    fireEvent.click(rows[0]!);
    expect(onAdd).toHaveBeenCalledWith('logo');

    fireEvent.click(screen.getByRole('button', { name: 'Add a Page of Any Kind' }));
    fireEvent.click(document.querySelector('[data-add-kind="wireframe"]')!);
    expect(screen.getByRole('group', { name: 'Choose a Device' })).toBeTruthy();
    fireEvent.click(document.querySelector('[data-device-row="watch"]')!);
    expect(onAdd).toHaveBeenLastCalledWith('wireframe', 'watch');
  });
});

describe('addAnotherLabel', () => {
  it('names each kind, a wireframe by its device', () => {
    expect(addAnotherLabel({})).toBe('Add Another Page');
    expect(addAnotherLabel({ kind: 'logo' })).toBe('Add Another Logo Page');
    expect(addAnotherLabel({ kind: 'wireframe', device: 'iphone-duo' })).toBe(
      'Add Another iPhone Duo Screen',
    );
    expect(addAnotherLabel({ kind: 'wireframe', device: 'browser' })).toBe(
      'Add Another Browser Page',
    );
    expect(addAnotherLabel({ kind: 'wireframe', device: 'watch' })).toBe('Add Another Watch Face');
  });
});
