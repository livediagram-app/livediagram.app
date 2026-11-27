// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item, ItemTypeDef } from '@liveplanner/items';
import { SESSION_TIMEBOX_MAX_MS, type SessionSetup } from '@liveplanner/project';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { SessionSetupDialog } from './SessionSetupDialog';
import { SessionStartHost } from './SessionStartHost';

// docs/specs/026-plan/session-tabs.md "Making one": Set Up Refinement's parts, its live preview, Start Session and
// Session Settings' Save.
afterEach(cleanup);

const type = (id: string, statuses: string[]): ItemTypeDef => ({
  id,
  label: id[0]!.toUpperCase() + id.slice(1),
  newTitle: `New ${id}`,
  glyph: 'task',
  color: '#7c3aed',
  fields: ['title', 'status', 'priority'],
  statuses,
});
let n = 0;
const card = (t: string, status: string): Item => ({
  id: `c${++n}`,
  type: t,
  key: n,
  rank: `r${n}`,
  fields: { title: `Card ${n}`, status },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'P', color: '#000' },
  updatedBy: { id: 'p', name: 'P', color: '#000' },
});
const TYPES = [type('task', ['backlog', 'ready', 'done']), type('bug', ['triage', 'done'])];
const NAMES = new Map([
  ['backlog', 'Backlog'],
  ['ready', 'Ready'],
  ['triage', 'Triage'],
  ['done', 'Done'],
]);
const plan = (types = TYPES) =>
  ({
    items: new Map(
      [card('task', 'backlog'), card('task', 'backlog'), card('bug', 'triage')].map((i) => [
        i.id,
        i,
      ]),
    ),
    types,
    statusNames: NAMES,
  }) as unknown as PlanContextValue;

function open(initial: SessionSetup, settings = false, types = TYPES) {
  const onDone = vi.fn<(setup: SessionSetup) => void>();
  const onClose = vi.fn();
  render(
    <SessionSetupDialog
      sessionKind="refinement"
      initial={initial}
      plan={plan(types)}
      settings={settings}
      onDone={onDone}
      onClose={onClose}
    />,
  );
  return { onDone, onClose };
}
const pill = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const preview = () => screen.getByRole('status').textContent;

describe('SessionSetupDialog', () => {
  it('starts empty, asks for a type and a stage, then previews the queue and starts', () => {
    const { onDone } = open({ typeIds: [], statuses: [] });
    expect(screen.getByRole('heading', { name: 'Set Up Refinement' })).toBeTruthy();
    expect(screen.getByText('Pick a card type to see its stages.')).toBeTruthy();
    expect(preview()).toBe('Pick at least one card type and one stage');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Start Session' }).disabled).toBe(
      true,
    );
    fireEvent.click(pill('Task'));
    // The stage pill counts its cards.
    expect(pill('Backlog').textContent).toBe('Backlog2');
    fireEvent.click(pill('Backlog'));
    expect(preview()).toBe('2 cards, in board order');
    fireEvent.click(screen.getByRole('button', { name: 'Start Session' }));
    expect(onDone).toHaveBeenCalledWith({ typeIds: ['task'], statuses: ['backlog'] });
  });

  it('a type dropped takes its stages with it', () => {
    const { onDone } = open({ typeIds: ['task', 'bug'], statuses: ['backlog', 'triage'] });
    fireEvent.click(pill('Bug'));
    fireEvent.click(screen.getByRole('button', { name: 'Start Session' }));
    expect(onDone).toHaveBeenCalledWith({ typeIds: ['task'], statuses: ['backlog'] });
  });

  it('sorts by a field then another, each way, and back to board order', () => {
    const { onDone } = open({ typeIds: ['task'], statuses: ['backlog'] });
    expect(screen.queryByLabelText('Then By')).toBeNull();
    fireEvent.change(screen.getByLabelText('Sort By'), { target: { value: 'priority' } });
    expect(preview()).toMatch(/^2 cards, Priority /);
    fireEvent.change(screen.getByLabelText('Sort By direction'), { target: { value: 'asc' } });
    fireEvent.change(screen.getByLabelText('Then By'), { target: { value: 'createdAt' } });
    fireEvent.change(screen.getByLabelText('Then By direction'), { target: { value: 'desc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start Session' }));
    expect(onDone.mock.calls[0]![0].sortBy).toEqual([
      expect.objectContaining({ field: 'priority', dir: 'asc' }),
      expect.objectContaining({ field: 'createdAt', dir: 'desc' }),
    ]);
    fireEvent.change(screen.getByLabelText('Sort By'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start Session' }));
    expect(onDone.mock.calls[1]![0]).not.toHaveProperty('sortBy');
  });

  it('names a stage Refined takes each type to, or the next one', () => {
    const { onDone } = open({ typeIds: ['task'], statuses: ['backlog'] });
    const to = screen.getByLabelText('Task cards move to');
    fireEvent.change(to, { target: { value: 'done' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start Session' }));
    expect(onDone.mock.calls[0]![0].targets).toEqual({ task: 'done' });
    fireEvent.change(to, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start Session' }));
    expect(onDone.mock.calls[1]![0]).not.toHaveProperty('targets');
  });

  it('a timebox from a chip or typed, kept within its bounds, and Off', () => {
    const { onDone } = open({ typeIds: ['task'], statuses: ['backlog'], timeboxMs: 180_000 });
    expect(pill('3 min').getAttribute('aria-pressed')).toBe('true');
    const typed = screen.getByPlaceholderText('Other');
    fireEvent.change(typed, { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start Session' }));
    expect(onDone.mock.calls[0]![0].timeboxMs).toBe(SESSION_TIMEBOX_MAX_MS);
    fireEvent.click(pill('Off'));
    fireEvent.click(screen.getByRole('button', { name: 'Start Session' }));
    expect(onDone.mock.calls[1]![0]).not.toHaveProperty('timeboxMs');
    fireEvent.click(pill('5 min'));
    fireEvent.click(screen.getByRole('button', { name: 'Start Session' }));
    expect(onDone.mock.calls[2]![0].timeboxMs).toBe(300_000);
  });

  it('opened from Session Settings saves in place; a plan with no types says what to do first', () => {
    open({ typeIds: ['task'], statuses: ['backlog'] }, true);
    expect(screen.getByRole('heading', { name: 'Session Settings' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    cleanup();
    open({ typeIds: [], statuses: [] }, false, []);
    expect(screen.getByText(/no card types yet/)).toBeTruthy();
  });

  it('a stage the plan has no name for shows its id', () => {
    open(
      { typeIds: ['odd'], statuses: ['limbo'], sortBy: [{ field: 'gone', dir: 'asc' }] },
      false,
      [type('odd', ['limbo'])],
    );
    expect(pill('limbo').textContent).toBe('limbo0');
    // A sort on a field the types no longer have still reads.
    expect(preview()).toMatch(/^0 cards, gone /);
  });
});

describe('SessionSetupDialog, a long backlog', () => {
  it('says the preview is the first cards when the queue is capped', () => {
    const many = Array.from({ length: 501 }, () => card('task', 'backlog'));
    render(
      <SessionSetupDialog
        sessionKind="refinement"
        initial={{ typeIds: ['task'], statuses: ['backlog'] }}
        plan={{ ...plan(), items: new Map(many.map((i) => [i.id, i])) }}
        settings={false}
        onDone={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(preview()).toMatch(/ \(the first ones\), in board order$/);
  });
});

describe('SessionStartHost', () => {
  it('opens Set Up Refinement on its first picks and hands Start Session on', () => {
    const onStart = vi.fn();
    render(<SessionStartHost plan={plan()} onStart={onStart} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Session' }));
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ typeIds: expect.any(Array) }));
  });
});
