// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Page } from '@livedesign/design';
import { AddPageButton } from './AddPageButton';
import { addAnotherLabel } from '@/lib/add-page-labels';

afterEach(cleanup);

const rect = { x: 0, y: 0, width: 800, height: 840 };
const last = { rect };
const like = (extra: Partial<Page> = {}) => ({ id: 'p1', kind: 'logo' as const, ...extra });

// docs/specs/007-editor/pages-mode.md "Adding a page", "One kind a tab".
describe('AddPageButton', () => {
  it('sits level with the last page’s middle', () => {
    render(<AddPageButton last={last} like={like()} zoom={1} onAddLike={vi.fn()} />);
    const holder = screen
      .getByRole('button', { name: 'Add Another Logo Page' })
      .closest('div[style]') as HTMLElement;
    expect(holder.style.top).toBe('420px');
  });

  it('adds another page like the last of the tab’s kind with the +, named for what it adds', () => {
    const onAddLike = vi.fn();
    render(
      <AddPageButton
        last={last}
        like={like({ id: 'p0', kind: 'wireframe', device: 'ipad' })}
        zoom={1}
        onAddLike={onAddLike}
        onAddDevice={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Another iPad Screen' }));
    expect(onAddLike).toHaveBeenCalledWith('p0');
  });

  it('offers no other kind: the tab holds one (One kind a tab)', () => {
    render(
      <AddPageButton
        last={last}
        like={like()}
        zoom={1}
        onAddLike={vi.fn()}
        onAddDevice={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Add a Page of Any Kind' })).toBeNull();
  });

  it('adds a screen of another device on a wireframe tab, its devices alone', () => {
    const onAddDevice = vi.fn();
    render(
      <AddPageButton
        last={last}
        like={like({ kind: 'wireframe', device: 'iphone' })}
        zoom={1}
        onAddLike={vi.fn()}
        onAddDevice={onAddDevice}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a Screen of Another Device' }));
    const rows = within(screen.getByRole('group', { name: 'Choose a Device' })).getAllByRole(
      'button',
    );
    expect(rows.length).toBeGreaterThan(3);
    expect(document.querySelector('[data-add-kind]')).toBeNull();
    fireEvent.keyDown(rows[0]!, { key: 'End' });
    fireEvent.click(document.querySelector('[data-device-row="watch"]')!);
    expect(onAddDevice).toHaveBeenLastCalledWith('watch');
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
