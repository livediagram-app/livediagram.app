// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item, ItemFieldValue, RepeatRule } from '@liveplanner/items';
import { ItemPanelMenu } from './ItemPanelMenu';
import { ItemRepeatLine, browserTimeZone, useItemRepeat } from './ItemRepeatLine';

// docs/specs/026-plan/items.md "Repeating cards": the Details line names the rule and its next day; an Editor edits
// and stops it there or from the ⋯ menu; a plan in This Browser says it makes none.
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
let offline = false;
vi.mock('@/hooks/persistence/useIsOfflineProject', () => ({ useIsOfflineProject: () => offline }));

const NOW = Date.parse('2026-11-02T10:00:00Z'); // Monday 2 November, London
const RULE: RepeatRule = {
  every: 'week',
  days: [1, 4],
  from: '2026-11-02',
  timeZone: 'Europe/London',
};
const PERSON = { id: 'p', name: 'Sam', color: '#2563eb' };
const card = (fields: Item['fields']): Item => ({
  id: 'c1',
  type: 'task',
  key: 7,
  rank: 'i',
  fields: { title: 'Report', ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  offline = false;
  track.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ItemRepeatLine', () => {
  it('names the rule and the next day, without this year', () => {
    render(<ItemRepeatLine rule={RULE} now={NOW} offline={false} />);
    expect(screen.getByText('Repeats every week on Mon and Thu')).toBeTruthy();
    expect(screen.getByText('Next Thu 5 Nov')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('names next year, an ended rule and a plan in This Browser', () => {
    render(
      <ItemRepeatLine
        rule={{ every: 'month', date: 31, from: '2026-12-31', timeZone: 'Europe/London' }}
        now={Date.parse('2026-12-31T12:00:00Z')}
        offline={false}
      />,
    );
    expect(screen.getByText('Next Sun 31 Jan 2027')).toBeTruthy();
    cleanup();
    render(<ItemRepeatLine rule={{ ...RULE, until: '2026-11-03' }} now={NOW} offline={false} />);
    expect(screen.getByText('Ended')).toBeTruthy();
    cleanup();
    render(<ItemRepeatLine rule={RULE} now={NOW} offline />);
    expect(screen.getByText('Repeats only in plans saved to your account')).toBeTruthy();
  });
});

function Harness({
  item,
  canSet,
  onSave,
}: {
  item: Item;
  canSet: boolean;
  onSave: (field: string, value: ItemFieldValue | undefined) => void;
}) {
  const repeat = useItemRepeat({
    item,
    statuses: [{ status: 'doing', name: 'Doing' }],
    canSet,
    now: NOW,
    onSave,
  });
  return (
    <>
      <ItemPanelMenu
        itemKey={7}
        canEdit
        canRetire={canSet}
        archived={false}
        flagged={false}
        onDuplicate={vi.fn()}
        onFlag={vi.fn()}
        onArchive={vi.fn()}
        onTrash={vi.fn()}
        repeat={repeat.menu}
      />
      {repeat.line}
      {repeat.dialog}
    </>
  );
}

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'More for #7' }));

describe('useItemRepeat', () => {
  it('lets an Editor set a repeat from the menu, stamped with their day and zone', () => {
    const onSave = vi.fn();
    render(<Harness item={card({})} canSet onSave={onSave} />);
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Repeat' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Weekday' }));
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Repeat' }));
    });
    expect(onSave).toHaveBeenCalledWith('repeat', {
      every: 'weekday',
      from: '2026-11-02',
      timeZone: browserTimeZone(),
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Toggled', 'RepeatOn');
    expect(screen.queryByRole('dialog', { name: 'Repeat' })).toBeNull();
  });

  it('lets an Editor edit and stop it from the line and the dialog', () => {
    const onSave = vi.fn();
    render(<Harness item={card({ repeat: { ...RULE } })} canSet onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenLastCalledWith(
      'repeat',
      expect.objectContaining({ every: 'week', days: [1, 4] }),
    );
    // An edit is not a new repeat.
    expect(track).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop Repeating' }));
    expect(onSave).toHaveBeenLastCalledWith('repeat', undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(track).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenCalledWith('Plan', 'Toggled', 'RepeatOff');
  });

  it('shows a Participant or Viewer the line alone', () => {
    render(<Harness item={card({ repeat: { ...RULE } })} canSet={false} onSave={vi.fn()} />);
    expect(screen.getByText('Repeats every week on Mon and Thu')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    openMenu();
    expect(screen.queryByRole('menuitem', { name: /Repeat/ })).toBeNull();
  });

  it('offers no Repeat in This Browser, and says a rule from before makes none', () => {
    offline = true;
    render(<Harness item={card({ repeat: { ...RULE } })} canSet onSave={vi.fn()} />);
    expect(screen.getByText('Repeats only in plans saved to your account')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    openMenu();
    expect(screen.queryByRole('menuitem', { name: /Repeat/ })).toBeNull();
  });
});
