// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { ITEM_TYPES, type Item, type ItemFieldValue, type ItemTypeDef } from '@liveplanner/items';
import { PlanCardFace } from '../PlanCardFace';
import { planPalette } from '../plan-palette';
import { DurationInput } from './DurationInput';
import { TimeSpentField, entryWhen } from './TimeSpentField';
import { Elapsed, RunningTimerPill } from './TimerReadouts';
import { tickingReadouts } from './use-now-seconds';

// docs/specs/026-plan/item-types.md "Duration" and "Time Spent": the panel's box, the Time Spent field by role, the
// card face's running pill, and the one shared clock that ticks only the readouts.

const SAM = { id: 'p-sam', name: 'Sam', color: '#2563eb' };
const ANA = { id: 'p-ana', name: 'Ana', color: '#16a34a' };
const T0 = new Date(2026, 9, 31, 14, 0).getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const timeValue = (v: {
  entries?: { id: string; by: string; minutes: number; at: number }[];
  running?: { id: string; by: string; start: number }[];
}) =>
  ({
    people: {
      [SAM.id]: { name: SAM.name, color: SAM.color },
      [ANA.id]: { name: ANA.name, color: ANA.color },
    },
    entries: v.entries ?? [],
    running: v.running ?? [],
  }) as unknown as ItemFieldValue;

describe('DurationInput', () => {
  const box = (minutes: number | undefined, disabled = false) => {
    const onSave = vi.fn();
    render(
      <DurationInput
        id="d"
        label="Planned"
        minutes={minutes}
        disabled={disabled}
        onSave={onSave}
      />,
    );
    return { onSave, input: screen.getByRole<HTMLInputElement>('textbox') };
  };

  it('shows the value as it reads, and saves what is typed on Enter or leaving', () => {
    const { onSave, input } = box(150);
    expect(input.value).toBe('2h 30m');
    fireEvent.change(input, { target: { value: '1.5h' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith(90);
    expect(input.value).toBe('1h 30m');
    fireEvent.change(input, { target: { value: '45' } });
    fireEvent.blur(input);
    expect(onSave).toHaveBeenLastCalledWith(45);
  });

  it('clears when emptied, puts back on Escape, and says what it takes', () => {
    const { onSave, input } = box(150);
    fireEvent.change(input, { target: { value: 'soon' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).toBe(
      'Planned: Write a duration like 2h 30m, 90m or 1.5h.',
    );
    expect(input.value).toBe('2h 30m');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(input, { target: { value: '3h' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('2h 30m');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(onSave).toHaveBeenCalledWith(undefined);
    // The same value saves nothing.
    onSave.mockClear();
    cleanup();
    const again = box(90);
    fireEvent.change(again.input, { target: { value: '90m' } });
    fireEvent.blur(again.input);
    expect(again.onSave).not.toHaveBeenCalled();
    fireEvent.change(again.input, { target: { value: '' } });
    cleanup();
    const empty = box(undefined);
    fireEvent.blur(empty.input);
    expect(empty.onSave).not.toHaveBeenCalled();
  });
});

describe('TimeSpentField', () => {
  const field = (
    value: ItemFieldValue | undefined,
    role: 'editor' | 'participant' | 'viewer',
    self = SAM,
  ) => {
    const onTime = vi.fn(async () => true);
    const announce = vi.fn();
    render(
      <TimeSpentField
        id="ts"
        label="Time Spent"
        value={value}
        self={self}
        canTrack={role !== 'viewer'}
        canEditAll={role === 'editor'}
        onTime={onTime}
        announce={announce}
      />,
    );
    return { onTime, announce };
  };

  it('starts a timer, and shows the total with no time yet', () => {
    const { onTime } = field(undefined, 'participant');
    expect(screen.getByText('No time yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start Timer' }));
    expect(onTime).toHaveBeenCalledWith({ op: 'start', timer: expect.any(String) });
  });

  it('ticks the viewer’s own timer, and stops or discards it', async () => {
    const value = timeValue({ running: [{ id: 'timer001', by: SAM.id, start: T0 - 65_000 }] });
    const { onTime, announce } = field(value, 'participant');
    expect(screen.getByText('1:05')).toBeTruthy();
    act(() => void vi.advanceTimersByTime(2_000));
    expect(screen.getByText('1:07')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    });
    expect(onTime).toHaveBeenCalledWith({
      op: 'stop',
      timer: 'timer001',
      entry: expect.any(String),
    });
    expect(announce).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Discard timer' }));
    expect(onTime).toHaveBeenLastCalledWith({ op: 'remove', entry: 'timer001' });
  });

  it('says nothing was recorded for a timer stopped under half a minute', async () => {
    const value = timeValue({ running: [{ id: 'timer001', by: SAM.id, start: T0 - 10_000 }] });
    const { announce } = field(value, 'participant');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    });
    expect(announce).toHaveBeenCalledWith('Under a minute: nothing recorded');
  });

  const shared = timeValue({
    entries: [
      { id: 'entry001', by: SAM.id, minutes: 90, at: T0 - 60_000 },
      { id: 'entry002', by: ANA.id, minutes: 30, at: T0 - 86_400_000 },
    ],
    running: [{ id: 'timer002', by: ANA.id, start: T0 - 120_000 }],
  });

  it('lets a Participant remove only their own entries and stop no one else’s timer', () => {
    field(shared, 'participant');
    expect(screen.getByText('2h')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove 1h 30m by Sam' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove 30m by Ana' })).toBeNull();
    expect(screen.queryByRole('button', { name: "Stop Ana's timer" })).toBeNull();
    expect(screen.getByRole('list', { name: 'Timers running' }).textContent).toContain('Ana');
  });

  it('lets an Editor stop and remove anyone’s', () => {
    const { onTime } = field(shared, 'editor');
    fireEvent.click(screen.getByRole('button', { name: "Stop Ana's timer" }));
    expect(onTime).toHaveBeenCalledWith({
      op: 'stop',
      timer: 'timer002',
      entry: expect.any(String),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove 30m by Ana' }));
    expect(onTime).toHaveBeenLastCalledWith({ op: 'remove', entry: 'entry002' });
  });

  it('lets a Viewer read it all and change nothing', () => {
    field(shared, 'viewer');
    expect(screen.getByText('2h')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toEqual([]);
  });

  it('adds time typed in, refusing what is no duration', async () => {
    const { onTime, announce } = field(undefined, 'participant');
    fireEvent.click(screen.getByRole('button', { name: 'Add Time' }));
    const input = screen.getByRole('textbox', { name: 'Time to add' });
    fireEvent.change(input, { target: { value: 'soon' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).toBe(
      'Write a duration like 2h 30m, 90m or 1.5h.',
    );
    fireEvent.change(input, { target: { value: '1h 15m' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    });
    expect(onTime).toHaveBeenCalledWith({ op: 'add', entry: expect.any(String), minutes: 75 });
    expect(announce).toHaveBeenCalledWith('Added 1h 15m to Time Spent');
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Time' }));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Time' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('shows five entries, newest first, then Show All', () => {
    const entries = Array.from({ length: 7 }, (_, i) => ({
      id: `entry00${i}`,
      by: SAM.id,
      minutes: i + 1,
      at: T0 - (7 - i) * 60_000,
    }));
    field(timeValue({ entries }), 'participant');
    const rows = () => screen.getByRole('list', { name: 'Entries' }).querySelectorAll('li');
    expect(rows()).toHaveLength(5);
    expect(rows()[0]!.textContent).toContain('7m');
    fireEvent.click(screen.getByRole('button', { name: 'Show All 7 Entries' }));
    expect(rows()).toHaveLength(7);
  });

  it('holds no more once full', () => {
    const entries = Array.from({ length: 100 }, (_, i) => ({
      id: `entry${String(i).padStart(3, '0')}`,
      by: SAM.id,
      minutes: 1,
      at: i,
    }));
    field(timeValue({ entries }), 'participant');
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Start Timer: This card holds the most time entries it can',
      }).disabled,
    ).toBe(true);
  });

  it('says when an entry was made', () => {
    expect(entryWhen(T0 - 60_000, T0)).toBe('Today, 13:59');
    expect(entryWhen(T0 - 86_400_000, T0)).toBe('Yesterday, 14:00');
    expect(entryWhen(new Date(2026, 9, 3, 16, 45).getTime(), T0)).toMatch(/16:45$/);
  });
});

describe('the card face', () => {
  const task = ITEM_TYPES.find((t) => t.id === 'task')!;
  const timed: ItemTypeDef = {
    ...task,
    fields: [...task.fields, 'f-spent'],
    custom: [
      ...(task.custom ?? []),
      { id: 'f-spent', label: 'Time Spent', kind: 'duration', timeSpent: true },
    ],
  };
  const card = (value?: ItemFieldValue): Item => ({
    id: 'c1',
    type: 'task',
    key: 1,
    rank: 'i',
    fields: { title: 'Login', ...(value ? { 'f-spent': value } : {}) },
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    createdBy: SAM,
    updatedBy: SAM,
  });
  const face = (item: Item, size?: 'minimal' | 'detailed') =>
    render(
      <PlanCardFace
        item={item}
        palette={planPalette('light')}
        fields={[]}
        typeOverride={timed}
        size={size}
      />,
    );

  it('shows who has a timer running, at every size', () => {
    const value = timeValue({
      running: [
        { id: 'timer001', by: SAM.id, start: T0 - 12 * 60_000 },
        { id: 'timer002', by: ANA.id, start: T0 - 60_000 },
      ],
    });
    for (const size of ['minimal', 'detailed'] as const) {
      face(card(value), size);
      expect(
        screen.getByRole('img', { name: 'Timer running: Sam and Ana, 12 minutes' }),
      ).toBeTruthy();
      cleanup();
    }
    face(card());
    expect(screen.queryByRole('img', { name: /Timer running/ })).toBeNull();
  });

  it('shows three discs, then +N', () => {
    const people = [SAM, ANA, { ...SAM, id: 'c' }, { ...SAM, id: 'd' }, { ...SAM, id: 'e' }];
    render(<RunningTimerPill people={people} start={T0} border="#ccc" />);
    expect(screen.getByText('+2')).toBeTruthy();
    cleanup();
    const { container } = render(<RunningTimerPill people={[]} start={T0} border="#ccc" />);
    expect(container.innerHTML).toBe('');
  });
});

// One clock for the page: a tick redraws the elapsed text alone, never the card around it, and stops when the last
// readout goes.
describe('the shared clock', () => {
  it('ticks only the readouts, and stops with none drawn', () => {
    const cardRendered = vi.fn();
    const Card = ({ children }: { children: ReactNode }) => {
      cardRendered();
      return <div>{children}</div>;
    };
    const many = Array.from({ length: 200 }, (_, i) => (
      <Card key={i}>
        <span>Card {i}</span>
        <Elapsed start={T0 - i * 1000} />
      </Card>
    ));
    const view = render(<>{many}</>);
    expect(tickingReadouts()).toBe(200);
    expect(vi.getTimerCount()).toBe(1);
    const ms = cpuMsOf(() => {
      for (let s = 0; s < 10; s += 1) act(() => void vi.advanceTimersByTime(1_000));
    });
    // The cards drew once, when mounted: ten ticks redrew only the elapsed text inside them.
    expect(cardRendered).toHaveBeenCalledTimes(200);
    expect(screen.getAllByText('0:10')).toHaveLength(1);
    // Ten ticks of 200 readouts stay well inside a frame each.
    expect(ms).toBeLessThan(cpuBudgetMs(400));
    view.unmount();
    expect(tickingReadouts()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
