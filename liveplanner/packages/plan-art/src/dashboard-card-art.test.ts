import { describe, expect, it } from 'vitest';
import { planPalette } from '@liveplanner/project';
import { cardArt, slotMessageArt } from './dashboard-card-art';
import { NOW } from './test-fixtures';

// docs/specs/026-plan/plan-tabs.md "Export": a written card reads as it does on the page, without its controls.
const input = {
  rect: { x: 0, y: 0, width: 400, height: 300 },
  p: planPalette('light'),
  now: NOW,
  tabName: (id: string) => (id === 't1' ? 'Roadmap' : undefined),
};

describe('a Dashboard card’s picture', () => {
  it('draws a Status in its colour, its line and when it changed', () => {
    const svg = cardArt(
      { type: 'status', state: 'at-risk', text: 'Vendor late', at: NOW.getTime() - 3 * 86_400_000 },
      input,
    );
    expect(svg).toContain('At Risk');
    expect(svg).toContain('Vendor late');
    expect(svg).toContain('Updated 3 days ago');
  });

  it('draws a Checklist’s count and its items, the done ones struck through', () => {
    const svg = cardArt(
      {
        type: 'checklist',
        title: 'Launch',
        items: [
          { id: 'a', text: 'Docs', done: true },
          { id: 'b', text: 'Blog', done: false },
        ],
      },
      input,
    );
    expect(svg).toContain('1 of 2');
    expect(svg).toContain('text-decoration="line-through"');
    expect(svg).toContain('Blog');
    expect(cardArt({ type: 'checklist', title: '', items: [] }, input)).toContain(
      'Nothing on the list yet.',
    );
  });

  it('counts a Key Date down, red once passed', () => {
    expect(cardArt({ type: 'key-date', title: 'Ship', date: '2026-10-22' }, input)).toContain(
      'days to go',
    );
    const past = cardArt({ type: 'key-date', title: 'Ship', date: '2026-10-07' }, input);
    expect(past).toContain('days ago');
    expect(past).toContain('#dc2626');
    expect(cardArt({ type: 'key-date', title: 'Ship', date: '' }, input)).toContain('No date set.');
  });

  it('names each link by its label, its site’s host or its tab', () => {
    const svg = cardArt(
      {
        type: 'links',
        title: 'Links',
        links: [
          { id: 'a', label: '', url: 'https://example.com/x' },
          { id: 'b', label: '', tabId: 't1' },
        ],
      },
      input,
    );
    expect(svg).toContain('example.com');
    expect(svg).toContain('Roadmap');
  });

  it('draws a figure from a Sheet as its name and value, or why it has none', () => {
    const shown = cardArt(
      { type: 'sheet-metric', metric: 'figure', sheetId: 's', cell: { r: 'r', c: 'c' } },
      { ...input, metric: { label: 'Total', hero: '£2,375.00', line: 'Budget · C13' } },
    );
    expect(shown).toContain('£2,375.00');
    expect(shown).toContain('Total');
    expect(
      cardArt(
        { type: 'sheet-metric', metric: 'trend', sheetId: 's' },
        { ...input, metric: 'gone' },
      ),
    ).toContain('This Sheet was deleted.');
    expect(cardArt({ type: 'sheet-metric', metric: 'summary', sheetId: '' }, input)).toContain(
      'Column Summary',
    );
  });

  it('centres a slot’s quiet line', () => {
    expect(slotMessageArt(input.rect, input.p, 'Empty Slot', true)).toContain(
      'text-anchor="middle"',
    );
  });
});
