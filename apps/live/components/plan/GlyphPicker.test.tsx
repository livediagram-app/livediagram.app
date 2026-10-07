// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLAN_GLYPH_IDS } from '@livediagram/items';
import { GlyphPicker } from './GlyphPicker';

// docs/specs/026-plan/item-types.md "Editing a type": the Glyph picker, in categories with a search.
afterEach(cleanup);

const draw = (value = 'task') => {
  const onChange = vi.fn();
  render(<GlyphPicker value={value} colour="#2563eb" onChange={onChange} />);
  return onChange;
};

describe('the glyph picker', () => {
  it('shows every glyph under its category, the chosen one pressed', () => {
    draw('chat');
    expect(screen.getAllByRole('radio')).toHaveLength(PLAN_GLYPH_IDS.length);
    const people = screen.getByRole('region', { name: 'People' });
    expect(within(people).getByRole('radio', { name: 'User Plus glyph' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Chat glyph' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('filters by name or keyword, hides empty categories, and says when nothing matches', () => {
    draw();
    const search = screen.getByRole('searchbox', { name: 'Search glyphs' });
    fireEvent.change(search, { target: { value: 'money' } });
    const names = screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'));
    expect(names).toEqual(expect.arrayContaining(['Coin glyph', 'Wallet glyph']));
    expect(screen.queryByRole('region', { name: 'People' })).toBeNull();
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByText('No glyphs match “zzz”.')).toBeTruthy();
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(screen.getAllByRole('radio')).toHaveLength(PLAN_GLYPH_IDS.length);
  });

  it('picks a glyph', () => {
    const onChange = draw();
    fireEvent.click(screen.getByRole('radio', { name: 'Release glyph' }));
    expect(onChange).toHaveBeenLastCalledWith('release');
  });
});
