// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WHITEBOARD_SHAPE_CATALOGUE } from '@/lib/whiteboard-shape-catalogue';
import { dockModel as model, renderDock } from './dock-test-utils';

function openSearch() {
  const opener = screen.getByRole('button', { name: 'More shapes' });
  fireEvent.click(opener);
  return { opener, field: screen.getByRole('combobox', { name: 'Search shapes' }) };
}

const options = () => screen.getAllByRole('option');
const active = () => options().find((o) => o.getAttribute('aria-selected') === 'true');

describe('More shapes', () => {
  it('opens on a press only, with its search field focused at once', () => {
    renderDock();
    const opener = screen.getByRole('button', { name: 'More shapes' });
    fireEvent.pointerEnter(opener, { pointerType: 'mouse' });
    expect(screen.queryByRole('group', { name: 'More shapes' })).toBeNull();
    const { field } = openSearch();
    expect(document.activeElement).toBe(field);
    expect(opener.getAttribute('aria-expanded')).toBe('true');
  });

  it('shows every shape for an empty field, grouped as in the palette', () => {
    renderDock();
    openSearch();
    expect(options()).toHaveLength(WHITEBOARD_SHAPE_CATALOGUE.length);
    const listbox = screen.getByRole('listbox', { name: 'Shapes' });
    const groups = within(listbox)
      .getAllByRole('group')
      .map((g) => g.textContent?.match(/^[A-Z][a-z]+/)?.[0]);
    expect(groups.slice(0, 3)).toEqual(['Shapes', 'Write', 'Draw']);
  });

  it('ranks the named shape first as you type', () => {
    renderDock();
    const { field } = openSearch();
    fireEvent.change(field, { target: { value: 'trap' } });
    expect(options()[0]!.getAttribute('aria-label')).toBe('Trapezoid');
    expect(active()!.getAttribute('aria-label')).toBe('Trapezoid');
    expect(field.getAttribute('aria-activedescendant')).toBe(active()!.id);
  });

  it('moves with the arrow keys and picks with Enter, then closes', () => {
    const { m } = renderDock();
    const { field } = openSearch();
    fireEvent.change(field, { target: { value: 'database' } });
    expect(active()!.getAttribute('aria-label')).toBe('Cylinder');
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.keyDown(field, { key: 'ArrowRight' });
    fireEvent.keyDown(field, { key: 'ArrowRight' });
    expect(active()!.getAttribute('aria-label')).toBe('Diamond');
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(active()!.getAttribute('aria-label')).toBe('Cloud');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(m.pickSearchedShape).toHaveBeenCalledWith('cloud');
    expect(screen.queryByRole('group', { name: 'More shapes' })).toBeNull();
  });

  it('picks with a press', () => {
    const { m } = renderDock();
    const { field } = openSearch();
    fireEvent.change(field, { target: { value: 'cloud' } });
    fireEvent.click(screen.getByRole('option', { name: 'Cloud' }));
    expect(m.pickSearchedShape).toHaveBeenCalledWith('cloud');
  });

  it('says so when nothing matches, and Enter picks nothing', () => {
    const { m } = renderDock();
    const { field } = openSearch();
    fireEvent.change(field, { target: { value: 'zzqx' } });
    expect(screen.getByText('No shapes match')).toBeTruthy();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(m.pickSearchedShape).not.toHaveBeenCalled();
  });

  it('closes on Escape without picking, handing focus back to its button', () => {
    const { m } = renderDock(model('select'));
    const { opener, field } = openSearch();
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'More shapes' })).toBeNull();
    expect(document.activeElement).toBe(opener);
    expect(m.pickSearchedShape).not.toHaveBeenCalled();
  });

  it('draws the previews in the board ink', () => {
    renderDock();
    openSearch();
    const preview = document.querySelector<HTMLElement>(
      '[data-shape-search] [data-shape-preview="hexagon"]',
    )!;
    expect(preview.style.color).toBe('rgb(28, 25, 23)');
  });
});
