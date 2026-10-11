// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanBoardPicker } from './PlanBoardPicker';

let plan: { items: Map<string, unknown> } | null = null;
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));

// docs/specs/026-plan/plan-mode.md "Starting a board": one panel, a rail of categories beside a grid of cards, and a
// search across them.
afterEach(cleanup);

const rail = (name: RegExp) =>
  within(screen.getByRole('navigation', { name: 'Categories' })).getByRole('button', { name });
const card = (name: RegExp) => screen.getByRole('button', { name });

function show(over: Partial<Parameters<typeof PlanBoardPicker>[0]> = {}) {
  const props = {
    onPick: vi.fn(),
    onPickSheet: vi.fn(),
    onDashboard: vi.fn(),
    onQuickStart: vi.fn(),
  };
  render(<PlanBoardPicker {...props} {...over} />);
  return props;
}

describe('Start Planning', () => {
  it('opens on Recommended: boards, a dashboard and sheets, each named with its kind', () => {
    show();
    expect(screen.getByRole('heading', { name: 'Start Planning' })).toBeTruthy();
    expect(rail(/^Recommended/).getAttribute('aria-current')).toBe('true');
    const grid = screen.getByRole('region', { name: 'Recommended' });
    expect(
      within(grid)
        .getAllByRole('button')
        .map((b) => b.getAttribute('data-start-card')),
    ).toEqual([
      'board:roadmap',
      'board:kanban',
      'board:todo',
      'dashboard:overview',
      'sheet:blank',
      'sheet:budget',
    ]);
    expect(card(/^Kanban Board:/)).toBeTruthy();
  });

  it('places a board picked from Boards, with its card types shown', () => {
    const p = show();
    fireEvent.click(rail(/^Boards/));
    expect(screen.getByRole('region', { name: 'Boards' })).toBeTruthy();
    expect(screen.queryByText('Archive')).toBeNull();
    fireEvent.click(card(/^Bug Triage:/));
    expect(p.onPick).toHaveBeenCalledWith('bug-triage');
  });

  it('places an Empty Sheet, or a start, from Spreadsheets; a Card Table only with cards', () => {
    const p = show();
    fireEvent.click(rail(/^Spreadsheets/));
    expect(screen.queryByRole('button', { name: /^Card Table/ })).toBeNull();
    fireEvent.click(card(/^Empty Sheet:/));
    fireEvent.click(card(/^Budget:/));
    expect(p.onPickSheet.mock.calls).toEqual([[undefined], ['budget']]);
    cleanup();
    plan = { items: new Map([['i1', {}]]) };
    const q = show();
    fireEvent.click(rail(/^Spreadsheets/));
    fireEvent.click(card(/^Card Table:/));
    expect(q.onPickSheet).toHaveBeenLastCalledWith('cards');
    plan = null;
  });

  it('makes a Dashboard of the layout picked', () => {
    const p = show();
    fireEvent.click(rail(/^Dashboards/));
    fireEvent.click(card(/^Report:/));
    expect(p.onDashboard).toHaveBeenCalledWith('report');
  });

  it('opens the Quick Start from Something Else, and leaves out what it cannot offer', () => {
    const p = show();
    fireEvent.click(rail(/^Something Else/));
    expect(p.onQuickStart).toHaveBeenCalledTimes(1);
    cleanup();
    show({ onQuickStart: undefined, onDashboard: undefined, onPickSheet: undefined });
    expect(screen.queryByRole('button', { name: /^Something Else/ })).toBeNull();
    const nav = screen.getByRole('navigation', { name: 'Categories' });
    expect(within(nav).queryByRole('button', { name: /^Dashboards/ })).toBeNull();
    expect(within(nav).queryByRole('button', { name: /^Spreadsheets/ })).toBeNull();
  });

  it('searches every kind, grouped, says when nothing matches, and Escape clears it', () => {
    show();
    const field = screen.getByRole('textbox', { name: 'Find a board, sheet or layout' });
    fireEvent.change(field, { target: { value: 'votes' } });
    expect(screen.getByRole('region', { name: 'Boards' })).toBeTruthy();
    expect(card(/^Retro:/)).toBeTruthy();
    fireEvent.change(field, { target: { value: 'zzz' } });
    expect(screen.getByText('No boards, sheets or layouts match “zzz”')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Browse More Templates' })).toBeTruthy();
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.getByRole('region', { name: 'Recommended' })).toBeTruthy();
  });

  it('moves along the rail with the arrow keys, its cards cascading in from the first paint', () => {
    show();
    expect(
      document.querySelector('[data-start-card]')!.parentElement!.parentElement!.className,
    ).toMatch(/lvd-cascade/);
    fireEvent.keyDown(rail(/^Recommended/), { key: 'ArrowDown' });
    expect(rail(/^Boards/).getAttribute('aria-current')).toBe('true');
    expect(document.querySelector('.lvd-cascade')).not.toBeNull();
    fireEvent.keyDown(rail(/^Boards/), { key: 'ArrowUp' });
    expect(rail(/^Recommended/).getAttribute('aria-current')).toBe('true');
  });
});

describe('Start Planning’s Inspiration', () => {
  it('applies the Plan template picked, and is left out without a way to apply one', () => {
    const onTemplate = vi.fn();
    show({ onTemplate });
    fireEvent.click(rail(/^Inspiration/));
    fireEvent.click(card(/^Hiring Pipeline:/));
    expect(onTemplate).toHaveBeenCalledWith('hiring-pipeline');
    cleanup();
    show();
    expect(
      within(screen.getByRole('navigation', { name: 'Categories' })).queryByRole('button', {
        name: /^Inspiration/,
      }),
    ).toBeNull();
  });
});

describe('Start Planning’s Visualisations', () => {
  it('sits above Dashboards, and makes the tab the chart picked', () => {
    const onVisualisation = vi.fn();
    show({ onVisualisation });
    const names = within(screen.getByRole('navigation', { name: 'Categories' }))
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names.findIndex((n) => n?.startsWith('Visualisations'))).toBeLessThan(
      names.findIndex((n) => n?.startsWith('Dashboards')),
    );
    fireEvent.click(rail(/^Visualisations/));
    fireEvent.click(card(/^Gantt Chart:/));
    expect(onVisualisation).toHaveBeenCalledWith('gantt', 'Gantt Chart');
  });
});
