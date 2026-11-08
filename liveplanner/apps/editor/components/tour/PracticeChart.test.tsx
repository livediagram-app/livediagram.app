// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PracticeChart } from './PracticeChart';

// docs/specs/026-plan/plan-tour.md "Sheets: Five Small Wins": the chart the person made, drawn small in the strip.
describe('PracticeChart', () => {
  it('draws a column per value, named for a screen reader, with a legend for two series', () => {
    render(
      <PracticeChart
        series={{
          names: ['Planned', 'Actual'],
          rows: [
            { label: 'Rent', values: [1200, 1200] },
            { label: 'Groceries', values: [400, 436] },
          ],
        }}
      />,
    );
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toBe(
      'Your chart. Rent: Planned 1200, Actual 1200; Groceries: Planned 400, Actual 436',
    );
    expect(img.querySelectorAll('rect')).toHaveLength(4);
    expect(img.querySelector('title')?.textContent).toBe('Rent, Planned: 1200');
    expect(screen.getByText('Grocer…')).toBeTruthy();
    expect(screen.getByText('Actual')).toBeTruthy();
  });

  it('leaves the legend out for one series, and names a nameless one', () => {
    render(<PracticeChart series={{ names: [''], rows: [{ label: 'A', values: [3] }] }} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Your chart. A: value 3');
    expect(document.querySelector('figcaption')).toBeNull();
    expect(document.querySelector('title')?.textContent).toBe('A: 3');
  });

  it('draws an empty pick without failing', () => {
    render(<PracticeChart series={{ names: [], rows: [] }} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Your chart. ');
  });
});
