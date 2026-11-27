// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item, ItemFieldValue, ItemTypeDef } from '@liveplanner/items';
import { EstimatePill, EstimateStrip, estimateSizes } from './EstimateStrip';
import { PlanningSummary, PlanningTally } from './PlanningTally';
import { capacityWords, commitMakes, noEstimateNote, tallyWords } from './planning-words';

// docs/specs/026-plan/session-tabs.md "Sprint Planning", "Share roles": the tally in its states, the Estimate strip per
// role, a row's estimate pill and the words they say.
afterEach(cleanup);

const feature: ItemTypeDef = {
  id: 'feature',
  label: 'Feature',
  newTitle: 'New feature',
  glyph: 'task',
  color: '#7c3aed',
  fields: ['title', 'status', 'estimate'],
};
const card = (estimate?: ItemFieldValue): Item => ({
  id: 'a',
  type: 'feature',
  key: 1,
  rank: 'a',
  fields: { title: 'Card A', status: 'reviewed', ...(estimate === undefined ? {} : { estimate }) },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'P', color: '#000' },
  updatedBy: { id: 'p', name: 'P', color: '#000' },
});
const tally = (points: number, unestimated = 0) => ({ points, counted: 1, unestimated });
const state = () => document.querySelector('[data-tally-state]')?.getAttribute('data-tally-state');

describe('PlanningTally', () => {
  it('reads normal below 85% of capacity, with what Commit would add', () => {
    render(<PlanningTally tally={tally(13)} capacity={30} adding={3} />);
    expect(state()).toBe('under');
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe('13 of 30 points');
    expect(screen.getByText('13').parentElement?.textContent).toBe('13 of 30 points');
    expect(document.querySelector('[data-tally-adding]')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('turns amber near capacity and red past it, with a capacity mark', () => {
    render(<PlanningTally tally={tally(26)} capacity={30} adding={null} />);
    expect(state()).toBe('near');
    expect(screen.getByRole('status').textContent).toBe('Near capacity');
    cleanup();
    render(<PlanningTally tally={tally(34, 2)} capacity={30} adding={5} />);
    expect(state()).toBe('over');
    expect(screen.getByRole('status').textContent).toBe('Over capacity by 4 points');
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe(
      '34 of 30 points, Over capacity by 4 points',
    );
    expect(screen.getByText('2 committed cards have no estimate, not counted')).toBeTruthy();
  });

  it('with no capacity adds the points up with no meter', () => {
    render(<PlanningTally tally={tally(0)} capacity={undefined} adding={null} />);
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.getByText('No capacity set: the points add up as you commit.')).toBeTruthy();
    cleanup();
    render(<PlanningTally tally={tally(1, 1)} capacity={undefined} adding={null} />);
    expect(screen.getByText('1').parentElement?.textContent).toBe('1 point');
    expect(screen.getByText('1 committed card has no estimate, not counted')).toBeTruthy();
  });

  it('sums up on Session Complete', () => {
    render(<PlanningSummary tally={tally(34, 1)} capacity={30} />);
    expect(screen.getByText(/committed$/, { exact: false }).textContent).toContain(
      '34 of 30 points committed · Over capacity by 4 points',
    );
    cleanup();
    render(<PlanningSummary tally={tally(8)} capacity={undefined} />);
    expect(document.body.textContent).toBe('8 points committed');
  });
});

describe('EstimateStrip', () => {
  it('lets anyone who may edit cards pick an estimate or None, and says what Commit makes it', () => {
    const onSet = vi.fn();
    render(
      <EstimateStrip item={card(3)} type={feature} canEdit preview="16 of 30" onSet={onSet} />,
    );
    const group = screen.getByRole('group', { name: 'Estimate' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['1', '2', '3', '5', '8', '13', '21', 'None']);
    expect(screen.getByRole('button', { name: '3' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(onSet.mock.calls).toEqual([[8], [null]]);
    expect(screen.getByText('16 of 30').parentElement?.textContent).toBe(
      'Commit makes it 16 of 30',
    );
  });

  it('a card with no estimate says Commit counts it apart; a Viewer reads the value', () => {
    render(
      <EstimateStrip item={card()} type={feature} canEdit preview="13 of 30" onSet={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'None' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('No estimate: Commit counts it apart')).toBeTruthy();
    cleanup();
    render(
      <EstimateStrip
        item={card(5)}
        type={feature}
        canEdit={false}
        preview={null}
        onSet={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.querySelector('[data-estimate-strip]')?.textContent).toBe('Estimate5');
    cleanup();
    render(
      <EstimateStrip item={card()} type={feature} canEdit={false} preview={null} onSet={vi.fn()} />,
    );
    expect(document.querySelector('[data-estimate-strip]')?.textContent).toBe('EstimateNone');
  });

  it('uses the type’s own name for the field, and says when the type has none', () => {
    const named = { ...feature, fieldLabels: { estimate: 'Story Points' } };
    render(<EstimateStrip item={card(2)} type={named} canEdit preview={null} onSet={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Story Points' })).toBeTruthy();
    cleanup();
    render(
      <EstimateStrip
        item={card()}
        type={{ ...feature, label: 'Bug', fields: ['title', 'status'] }}
        canEdit
        preview="1 of 2"
        onSet={vi.fn()}
      />,
    );
    expect(
      screen.getByText('Bug has no Estimate field: this card counts as no estimate.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('keeps an odd estimate among the sizes', () => {
    expect(estimateSizes(4)).toEqual([1, 2, 3, 4, 5, 8, 13, 21]);
    expect(estimateSizes(40)).toEqual([1, 2, 3, 5, 8, 13, 21, 40]);
    expect(estimateSizes(null)).toEqual([1, 2, 3, 5, 8, 13, 21]);
  });
});

describe('EstimatePill', () => {
  it('shows the estimate, or a dashed question for none', () => {
    render(<EstimatePill item={card(5)} />);
    expect(document.body.textContent).toBe('5 points');
    cleanup();
    render(<EstimatePill item={card(1)} />);
    expect(document.body.textContent).toBe('1 point');
    cleanup();
    render(<EstimatePill item={card()} />);
    expect(document.body.textContent).toBe('?No estimate');
  });
});

describe('planning words', () => {
  it('says the tally, the capacity state and the no-Estimate note', () => {
    expect([tallyWords(1, undefined), tallyWords(2.5, 10)]).toEqual([
      '1 point',
      '2.5 of 10 points',
    ]);
    expect(capacityWords('under', 5, 10)).toBe('');
    expect(capacityWords('over', 11, 10)).toBe('Over capacity by 1 point');
    expect(capacityWords('over', 11, undefined)).toBe('');
    expect([commitMakes(13, 3, 30), commitMakes(13, 3, undefined)]).toEqual([
      '16 of 30',
      '16 points',
    ]);
    const t = (label: string) => ({ ...feature, label });
    expect(noEstimateNote([])).toBe('');
    expect(noEstimateNote([t('Bug'), t('Spike'), t('Chore')])).toBe(
      'Bug, Spike and Chore have no Estimate field: their cards count as no estimate.',
    );
  });
});
