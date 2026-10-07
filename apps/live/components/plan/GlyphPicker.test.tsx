// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLAN_GLYPH_CATEGORIES } from '@livediagram/items';
import { GlyphPicker } from './GlyphPicker';

// docs/specs/026-plan/item-types.md "Editing a type": the Glyph button and its popover of categories and a search.
afterEach(cleanup);

const draw = (value = 'task') => {
  const onChange = vi.fn();
  render(<GlyphPicker value={value} colour="#2563eb" onChange={onChange} />);
  return onChange;
};
const open = (name = 'Task') =>
  fireEvent.click(screen.getByRole('button', { name: `Glyph: ${name}` }));
const category = (id: string) => PLAN_GLYPH_CATEGORIES.find((c) => c.id === id)!;

describe('the glyph picker', () => {
  it('shows only the chosen glyph until opened', () => {
    draw('chat');
    expect(screen.getByRole('button', { name: 'Glyph: Chat' })).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('opens on the chosen glyph’s category, the search focused, the chosen one pressed', () => {
    draw('chat');
    open('Chat');
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search glyphs' }));
    const communication = category('communication');
    expect(screen.getAllByRole('radio')).toHaveLength(communication.glyphs.length);
    expect(screen.getByRole('radio', { name: 'Chat glyph' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect((screen.getByLabelText('Glyph category') as HTMLSelectElement).value).toBe(
      'communication',
    );
  });

  it('switches category from its menu, or shows every glyph for All', () => {
    draw();
    open();
    const menu = screen.getByLabelText('Glyph category');
    fireEvent.change(menu, { target: { value: 'people' } });
    expect(screen.getAllByRole('radio')).toHaveLength(category('people').glyphs.length);
    expect(screen.getByRole('radio', { name: 'User Plus glyph' })).toBeTruthy();
    fireEvent.change(menu, { target: { value: 'all' } });
    expect(screen.getAllByRole('radio')).toHaveLength(
      PLAN_GLYPH_CATEGORIES.reduce((n, c) => n + c.glyphs.length, 0),
    );
  });

  it('searches every category by name or keyword, and says when nothing matches', () => {
    draw();
    open();
    const search = screen.getByRole('searchbox', { name: 'Search glyphs' });
    fireEvent.change(search, { target: { value: 'money' } });
    const names = screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'));
    expect(names).toEqual(expect.arrayContaining(['Coin glyph', 'Wallet glyph']));
    expect((screen.getByLabelText('Glyph category') as HTMLSelectElement).value).toBe('all');
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByText('No glyphs match “zzz”.')).toBeTruthy();
  });

  it('picks a glyph, closes and hands focus back', () => {
    const onChange = draw();
    open();
    fireEvent.click(screen.getByRole('radio', { name: 'Release glyph' }));
    expect(onChange).toHaveBeenLastCalledWith('release');
    expect(screen.queryByRole('dialog', { name: 'Glyph' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Glyph: Task' }));
  });

  it('closes on Escape without picking', () => {
    const onChange = draw();
    open();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Glyph' })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
