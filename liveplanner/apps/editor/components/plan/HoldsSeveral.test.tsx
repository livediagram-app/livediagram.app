// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIELD_VALUES_MAX,
  ITEM_TYPES,
  presetSetup,
  projectBoard,
  type Item,
  type ItemPerson,
  type ItemTypeDef,
} from '@liveplanner/items';
import { planPalette } from './plan-palette';
import { PersonPicker } from './PersonPicker';
import { LinkedCardField } from './LinkedCardField';
import { LinkedNumbersPill, PeopleStack, severalNames } from './SeveralValuesPills';
import { CustomFieldForm, HOLDS_SEVERAL_LINES, HoldsSeveralSwitch } from './ItemTypeFieldForms';
import { addedField } from './AddFieldShape';
import { customKindPill } from './CustomKindPill';
import { boardMoveFor } from './plan-board-moves';
import { linkExistingCard } from './link-existing';

// docs/specs/026-plan/item-types.md "Holds Several": one switch, one chip control, one card-face reading and one lane
// rule for Person and Card fields.
const track = vi.hoisted(() => vi.fn());
const announce = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('./PlanContext', () => ({
  usePlan: () => ({ announce, types: ITEM_TYPES, items: new Map(), statusNames: new Map() }),
}));
beforeEach(() => {
  track.mockClear();
  announce.mockClear();
});
afterEach(cleanup);

const SAM: ItemPerson = { id: 'p-sam', name: 'Sam', color: '#2563eb' };
const ANA: ItemPerson = { id: 'p-ana', name: 'Ana', color: '#16a34a' };
const LEE: ItemPerson = { id: 'p-lee', name: 'Lee', color: '#dc2626' };
const BY = { id: 'p', name: 'P', color: '#000000' };
let n = 0;
const card = (fields: Item['fields'], type = 'project', key?: number): Item => {
  n += 1;
  return {
    id: `c${n}`,
    type,
    key: key ?? n,
    rank: 'i',
    fields: { title: `Card ${n}`, ...fields },
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    createdBy: BY,
    updatedBy: BY,
  };
};

describe('a Person field that holds several', () => {
  const picker = (value: unknown, disabled = false) => {
    const onSave = vi.fn();
    render(
      <PersonPicker
        id="rev"
        label="Reviewers"
        value={value as never}
        people={[SAM, ANA, LEE]}
        disabled={disabled}
        onSave={onSave}
        multiple
      />,
    );
    return onSave;
  };

  it('draws a chip per person, a single stored person as one, and No one when empty', () => {
    picker([SAM, ANA]);
    const group = screen.getByRole('group', { name: 'Reviewers' });
    expect(within(group).getByText('Sam')).toBeTruthy();
    expect(within(group).getByText('Ana')).toBeTruthy();
    cleanup();
    picker(SAM);
    expect(screen.getByRole('button', { name: 'Remove Sam from Reviewers' })).toBeTruthy();
    cleanup();
    picker(undefined);
    expect(screen.getByText('No one')).toBeTruthy();
  });

  it('removes a chip, saving the rest, and empties the field with the last', () => {
    const onSave = picker([SAM, ANA]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Sam from Reviewers' }));
    expect(onSave).toHaveBeenLastCalledWith([ANA]);
    expect(announce).toHaveBeenCalledWith('Removed Sam');
    cleanup();
    const last = picker([ANA]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ana from Reviewers' }));
    expect(last).toHaveBeenLastCalledWith(undefined);
  });

  it('adds and removes people from a list that stays open, each held one ticked', () => {
    const onSave = picker([SAM]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Reviewers' }));
    const list = screen.getByRole('listbox', { name: 'Reviewers' });
    expect(list.getAttribute('aria-multiselectable')).toBe('true');
    // No "No one" row: chips empty the field.
    expect(within(list).queryByRole('option', { name: 'No one' })).toBeNull();
    expect(within(list).getByRole('option', { name: 'Sam' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.click(within(list).getByRole('option', { name: 'Ana' }));
    expect(onSave).toHaveBeenLastCalledWith([SAM, ANA]);
    expect(screen.getByRole('listbox', { name: 'Reviewers' })).toBeTruthy();
    fireEvent.click(within(list).getByRole('option', { name: 'Sam' }));
    expect(onSave).toHaveBeenLastCalledWith(undefined);
    // Keys pick too.
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledTimes(3);
  });

  it('opens from the field’s empty room, and adds a custom person to the list', () => {
    const onSave = picker([SAM]);
    fireEvent.click(screen.getByRole('group', { name: 'Reviewers' }));
    fireEvent.click(screen.getByRole('option', { name: '+ Custom Reviewers' }));
    fireEvent.change(screen.getByPlaceholderText('Their name'), { target: { value: 'Jo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onSave).toHaveBeenLastCalledWith([SAM, expect.objectContaining({ name: 'Jo' })]);
  });

  it('shows a Viewer the chips without remove buttons or Add', () => {
    picker([SAM, ANA], true);
    expect(screen.getByText('Sam')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add to Reviewers' })).toBeNull();
  });

  it('is full at the most a field holds', () => {
    const crowd = Array.from({ length: FIELD_VALUES_MAX }, (_, i) => ({ ...SAM, id: `p${i}` }));
    picker(crowd);
    const add = screen.getByRole('button', { name: `Reviewers holds up to ${FIELD_VALUES_MAX}` });
    expect((add as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('group', { name: 'Reviewers' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('reads a stored list as its first person when it holds one', () => {
    render(
      <PersonPicker
        id="o"
        label="Owner"
        value={[ANA, SAM] as never}
        people={[SAM]}
        disabled={false}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Owner: Ana' })).toBeTruthy();
  });
});

describe('a Card field that holds several', () => {
  const a = card({ title: 'Launch' }, 'project', 1);
  const b = card({ title: 'Billing', color: '#ea580c' }, 'project', 2);
  const c = card({ title: 'Search' }, 'project', 3);
  const field = (value: unknown, opts: { onOpen?: boolean; disabled?: boolean } = {}) => {
    const onSave = vi.fn();
    const onOpen = vi.fn();
    const items = new Map([a, b, c].map((x) => [x.id, x]));
    render(
      <LinkedCardField
        id="rel"
        label="Related"
        value={value}
        candidates={[a, b, c]}
        items={items}
        types={ITEM_TYPES}
        disabled={opts.disabled ?? false}
        onSave={onSave}
        {...(opts.onOpen === false ? {} : { onOpen })}
        multiple
      />,
    );
    return { onSave, onOpen };
  };

  it('draws a chip per linked card that opens it, and a missing card', () => {
    const { onOpen } = field([a.id, 'gone']);
    fireEvent.click(screen.getByRole('button', { name: 'Open #1 Launch' }));
    expect(onOpen).toHaveBeenCalledWith(a.id);
    expect(screen.getByText('Missing card')).toBeTruthy();
    cleanup();
    field(b.id, { onOpen: false });
    expect(screen.getByRole('button', { name: 'Remove #2 Billing from Related' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Open/ })).toBeNull();
    cleanup();
    field(undefined);
    expect(screen.getByText('None')).toBeTruthy();
  });

  it('links and unlinks cards from a list that stays open, without a None row', () => {
    const { onSave } = field([a.id]);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Related' }));
    const list = screen.getByRole('listbox', { name: 'Related' });
    expect(within(list).queryByRole('option', { name: 'None' })).toBeNull();
    expect(
      within(list).getByRole('option', { name: '#1 Launch' }).getAttribute('aria-selected'),
    ).toBe('true');
    fireEvent.click(within(list).getByRole('option', { name: '#3 Search' }));
    expect(onSave).toHaveBeenLastCalledWith([a.id, c.id]);
    fireEvent.click(within(list).getByRole('option', { name: '#1 Launch' }));
    expect(onSave).toHaveBeenLastCalledWith(undefined);
  });

  it('removes a chip and says so', () => {
    const { onSave } = field([a.id, b.id, 'gone']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove #2 Billing from Related' }));
    expect(onSave).toHaveBeenLastCalledWith([a.id, 'gone']);
    expect(announce).toHaveBeenLastCalledWith('Removed #2');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Missing card from Related' }));
    expect(announce).toHaveBeenLastCalledWith('Removed Missing card');
  });
});

describe('on the card face', () => {
  const palette = planPalette('light');

  it('names several values, the first three then how many more', () => {
    expect(severalNames(['Sam'])).toBe('Sam');
    expect(severalNames(['Sam', 'Ana'])).toBe('Sam and Ana');
    expect(severalNames(['Sam', 'Ana', 'Lee'])).toBe('Sam, Ana and Lee');
    expect(severalNames(['Sam', 'Ana', 'Lee', 'Jo', 'Al'])).toBe('Sam, Ana, Lee and 2 more');
    expect(severalNames([])).toBe('');
  });

  it('stacks people, three then +N, and draws nothing with none', () => {
    const { container } = render(
      <PeopleStack
        label="Reviewers"
        people={[SAM, ANA, LEE, { ...SAM, id: 'x', name: 'Jo' }]}
        palette={palette}
      />,
    );
    expect(screen.getByRole('img', { name: 'Reviewers: Sam, Ana, Lee and 1 more' })).toBeTruthy();
    expect(container.textContent).toContain('+1');
    cleanup();
    const empty = render(<PeopleStack label="Reviewers" people={[]} palette={palette} />);
    expect(empty.container.innerHTML).toBe('');
  });

  it('draws a Person field that holds several as a stack, and one as its disc', () => {
    const def = { id: 'f-rev', label: 'Reviewers', kind: 'person' as const, multiple: true };
    render(<>{customKindPill(def, [SAM, ANA], palette)}</>);
    expect(screen.getByRole('img', { name: 'Reviewers: Sam and Ana' })).toBeTruthy();
    cleanup();
    render(<>{customKindPill({ ...def, multiple: undefined }, [ANA, SAM], palette)}</>);
    expect(screen.getByLabelText('Reviewers: Ana')).toBeTruthy();
    cleanup();
    expect(customKindPill({ ...def, multiple: undefined }, undefined, palette)).toBeNull();
  });

  it('reads linked cards as their numbers, three then +N', () => {
    const cards = [1, 2, 3, 4, 5].map((k) => card({ title: `T${k}` }, 'project', k));
    const items = new Map(cards.map((x) => [x.id, x]));
    const { container } = render(
      <LinkedNumbersPill
        label="Related"
        ids={[...cards.map((x) => x.id), 'gone']}
        items={items}
        types={ITEM_TYPES}
        palette={palette}
      />,
    );
    expect(container.textContent).toContain('#1 #2 #3 +3');
    expect(screen.getByText(/^Related: #1 T1, #2 T2/).textContent).toContain('Missing card');
    cleanup();
    const coloured = card({ title: 'C', color: '#ea580c' }, 'project', 9);
    const one = render(
      <LinkedNumbersPill
        label="Related"
        ids={['gone', coloured.id]}
        items={new Map([[coloured.id, coloured]])}
        types={ITEM_TYPES}
        palette={palette}
      />,
    );
    expect(one.container.textContent).toContain('? #9');
    cleanup();
    const none = render(
      <LinkedNumbersPill
        label="Related"
        ids={['gone']}
        items={new Map()}
        types={ITEM_TYPES}
        palette={palette}
      />,
    );
    expect(none.container.textContent).toContain('?');
    cleanup();
    const empty = render(
      <LinkedNumbersPill
        label="Related"
        ids={[]}
        items={items}
        types={ITEM_TYPES}
        palette={palette}
      />,
    );
    expect(empty.container.innerHTML).toBe('');
  });
});

describe('the Holds Several switch', () => {
  const holds = () => screen.getByRole('switch', { name: 'Holds Several' });

  it('switches a Person or Card field on and off, saying what it does', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CustomFieldForm field={{ label: 'Reviewers', kind: 'person' }} onChange={onChange} />,
    );
    expect(screen.getByText(HOLDS_SEVERAL_LINES.person!)).toBeTruthy();
    fireEvent.click(holds());
    expect(onChange).toHaveBeenLastCalledWith({ multiple: true });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'FieldHoldsSeveral');
    rerender(
      <CustomFieldForm
        field={{ label: 'Related', kind: 'card', linkType: 'project', multiple: true }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText(HOLDS_SEVERAL_LINES.card!)).toBeTruthy();
    expect(holds().getAttribute('aria-checked')).toBe('true');
    fireEvent.click(holds());
    expect(onChange).toHaveBeenLastCalledWith({ multiple: undefined });
  });

  it('is offered on Person and Card fields alone, and kept by Add Field only there', () => {
    render(<HoldsSeveralSwitch field={{ kind: 'text' }} onChange={vi.fn()} />);
    expect(screen.queryByRole('switch', { name: 'Holds Several' })).toBeNull();
    expect(addedField({ label: 'R', kind: 'person', multiple: true }).multiple).toBe(true);
    expect(addedField({ label: 'A', kind: 'text', multiple: true }).multiple).toBeUndefined();
  });
});

describe('moving a card between rows of a field that holds several', () => {
  const team: ItemTypeDef = {
    ...ITEM_TYPES[1],
    fields: [...ITEM_TYPES[1].fields, 'f-rev'],
    custom: [{ id: 'f-rev', label: 'Reviewers', kind: 'person', multiple: true }],
  };
  const types = [ITEM_TYPES[0], team, ...ITEM_TYPES.slice(2)];
  const setup = {
    ...presetSetup('blank'),
    columns: [{ id: 'todo', status: 'todo', name: 'To do' }],
    swimlaneBy: 'field' as const,
    swimlaneField: 'f-rev',
  };

  it('swaps the value of the row the card was picked up in', () => {
    const s = card({ status: 'todo', 'f-rev': [SAM, ANA] }, team.id);
    const l = card({ status: 'todo', 'f-rev': [LEE] }, team.id);
    const projection = projectBoard(setup, new Map([s, l].map((x) => [x.id, x])), undefined, types);
    const key = (name: string) => projection.lanes.find((x) => x.label === name)!.key;
    const to = (lane: string) => ({ status: 'todo', laneKey: key(lane), beforeId: null });
    expect(boardMoveFor(setup, projection, s, s.id, to('Lee'), key('Sam'))).toMatchObject({
      set: { 'f-rev': [LEE, ANA] },
    });
    expect(boardMoveFor(setup, projection, s, s.id, to('Lee'), key('Ana'))).toMatchObject({
      set: { 'f-rev': [SAM, LEE] },
    });
    // Dropped back where it was picked up: nothing changes.
    expect(boardMoveFor(setup, projection, s, s.id, to('Ana'), key('Ana'))).toBeNull();
  });
});

describe('Link Existing on a field that holds several', () => {
  it('adds the open card to the picked card’s list', async () => {
    const target = card({ title: 'Epic' }, 'project', 1);
    const picked = card({ title: 'Story', 'f-rel': ['other'] }, 'task', 2);
    const patchItem = vi.fn(async () => true);
    const plan = { items: new Map([[picked.id, picked]]), patchItem, announce };
    const group = { fieldId: 'f-rel', label: 'Related', several: true };
    expect(await linkExistingCard(plan, target, group, picked.id, false)).toBe(true);
    expect(patchItem).toHaveBeenCalledWith(picked.id, { set: { 'f-rel': ['other', target.id] } });
  });
});
