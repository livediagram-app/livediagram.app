// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { CardSearchFilter } from '@liveplanner/items';
import { planPalette } from '../plan-palette';
import { CompactBoardFilter, compactFilterName, filterNarrowings } from './CompactBoardFilter';

// docs/specs/026-plan/board-widgets.md "The header" (Work Tracker 880): the Filter as one button in a narrow zone.
afterEach(cleanup);
const palette = planPalette('light', {});
const chip = { field: 'type', value: 'bug' } as unknown as CardSearchFilter;

describe('the compact Filter', () => {
  it('counts its words and chips, and names them', () => {
    expect(filterNarrowings({})).toBe(0);
    expect(filterNarrowings({ text: 'login', filters: [chip, chip] })).toBe(3);
    // A person or Only Mine is another widget's press, not the Filter's.
    expect(filterNarrowings({ mine: 'me', person: 'p1' })).toBe(0);
    expect(compactFilterName(0)).toBe('Filter');
    expect(compactFilterName(2)).toBe('Filter, 2 on');
  });

  it('reads pressed while it narrows the board, and opens the whole Filter in a panel', () => {
    render(
      <CompactBoardFilter quick={{ text: 'login' }} palette={palette}>
        <input aria-label="Filter cards" />
      </CompactBoardFilter>,
    );
    const button = screen.getByRole('button', { name: 'Filter, 1 on' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.textContent).toContain('1');
    expect(screen.queryByLabelText('Filter cards')).toBeNull();
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByLabelText('Filter cards')).toBeTruthy();
    expect(document.querySelector('[data-compact-filter-panel]')).toBeTruthy();
    fireEvent.click(button);
    expect(screen.queryByLabelText('Filter cards')).toBeNull();
  });

  it('is a plain glyph button with nothing on', () => {
    render(
      <CompactBoardFilter quick={{}} palette={palette}>
        <span>whole</span>
      </CompactBoardFilter>,
    );
    const button = screen.getByRole('button', { name: 'Filter' });
    expect(button.textContent).toBe('');
    expect(button.style.backgroundColor).toBe('');
  });
});
