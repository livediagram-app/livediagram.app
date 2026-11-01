// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ITEM_TYPES,
  fromLocalInput,
  localInputValue,
  type CustomFieldDef,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import type { PublicQuestion } from '@liveplanner/forms';
import { CustomFieldEditor } from './CustomFieldEditor';
import { CustomFieldForm, IncludeTimeSwitch } from './ItemTypeFieldForms';
import { CustomFieldPreview, CUSTOM_KIND_ICONS } from './CustomFieldKindParts';
import { addedField } from './AddFieldShape';
import { PlanCardFace } from './PlanCardFace';
import { planPalette } from './plan-palette';
import { QuestionControl } from '../forms/QuestionControl';
import { hasQuestionSettings } from '../forms/builder/QuestionSettings';

// Date and Time, Date Range and Phone (docs/specs/026-plan/item-types.md "Date and Time", "Date Range", "Phone"): the
// card panel's controls for each share role (an Editor and a Participant edit them, a Viewer reads them, its phone
// link still calling), Add Field's Include Time, the card face, and the form questions that ask them.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(cleanup);

const CALL: CustomFieldDef = { id: 'f-call', label: 'Call', kind: 'datetime' };
const TRIP: CustomFieldDef = { id: 'f-trip', label: 'Trip', kind: 'daterange' };
const SLOT: CustomFieldDef = { id: 'f-slot', label: 'Slot', kind: 'daterange', withTime: true };
const PHONE: CustomFieldDef = { id: 'f-phone', label: 'Phone', kind: 'phone' };

// An Editor or a Participant edits a card's fields; a Viewer's panel draws them disabled (ItemFieldEditor).
const ROLES = [
  { role: 'Editor', disabled: false },
  { role: 'Participant', disabled: false },
  { role: 'Viewer', disabled: true },
] as const;

function panel(field: CustomFieldDef, value: unknown, disabled = false) {
  const onSave = vi.fn();
  render(
    <CustomFieldEditor
      id="f"
      field={field}
      value={value as never}
      disabled={disabled}
      onSave={onSave}
    />,
  );
  return onSave;
}

const box = (sel: string) => document.querySelectorAll<HTMLInputElement>(sel);

describe('a Date and Time in the card panel', () => {
  it('shows the moment in the viewer’s zone and saves a whole one with the zone it was set in', () => {
    const onSave = panel(CALL, '2026-10-31T17:00:00Z[Europe/London]');
    const input = box('input[type=datetime-local]')[0]!;
    expect(input.value).toBe(localInputValue('2026-10-31T17:00:00Z'));
    fireEvent.change(input, { target: { value: '2026-11-02T09:30' } });
    expect(onSave).toHaveBeenLastCalledWith(fromLocalInput('2026-11-02T09:30'));
    expect(String(onSave.mock.lastCall?.[0])).toMatch(/Z\[.+\]$/);
  });

  it('names the viewer’s zone under the box, and where it was set when that is another', () => {
    panel(CALL, '2026-10-31T17:00:00Z[Pacific/Kiritimati]');
    expect(screen.getByText(/^Your time, .* · Set as .* in Pacific\/Kiritimati$/)).toBeTruthy();
    cleanup();
    panel(CALL, undefined);
    expect(screen.queryByText(/^Your time/)).toBeNull();
  });

  it('clears when emptied, and puts the saved one back when left', () => {
    const onSave = panel(CALL, '2026-10-31T17:00:00Z');
    const input = box('input[type=datetime-local]')[0]!;
    fireEvent.change(input, { target: { value: '' } });
    expect(onSave).toHaveBeenLastCalledWith(undefined);
    input.value = '2026-12-01T10:00';
    fireEvent.blur(input);
    expect(input.value).toBe(localInputValue('2026-10-31T17:00:00Z'));
  });

  it('does not save the moment it already holds, and saves nothing when empty is emptied', () => {
    const onSave = panel(CALL, undefined);
    const input = box('input[type=datetime-local]')[0]!;
    fireEvent.change(input, { target: { value: '' } });
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('a Date Range in the card panel', () => {
  it('fills both ends from the first one picked, and moves the other along when they cross', () => {
    const onSave = panel(TRIP, undefined);
    const [from, to] = box('input[type=date]');
    expect(screen.getByRole('group', { name: 'Trip' })).toBeTruthy();
    fireEvent.change(to!, { target: { value: '2026-11-02' } });
    expect(onSave).toHaveBeenLastCalledWith(['2026-11-02', '2026-11-02']);
    cleanup();
    const again = panel(TRIP, ['2026-10-31', '2026-11-02']);
    const [from2] = box('input[type=date]');
    fireEvent.change(from2!, { target: { value: '2026-11-05' } });
    expect(again).toHaveBeenLastCalledWith(['2026-11-05', '2026-11-05']);
    expect(from).toBeTruthy();
  });

  it('clears the range when either end is cleared', () => {
    const onSave = panel(TRIP, ['2026-10-31', '2026-11-02']);
    const [, to] = box('input[type=date]');
    fireEvent.change(to!, { target: { value: '' } });
    expect(onSave).toHaveBeenLastCalledWith(undefined);
  });

  it('asks a time at each end with Include Time, and shows a range of the other shape empty', () => {
    const onSave = panel(SLOT, ['2026-10-31', '2026-11-02']);
    const [from, to] = box('input[type=datetime-local]');
    expect(from!.value).toBe('');
    expect(to!.value).toBe('');
    fireEvent.change(from!, { target: { value: '2026-10-31T09:00' } });
    const at = fromLocalInput('2026-10-31T09:00')!;
    expect(onSave).toHaveBeenLastCalledWith([at, at]);
  });
});

describe('a Phone in the card panel', () => {
  it('keeps a number as typed and calls it through its tel: link', () => {
    const onSave = panel(PHONE, '+44 20 7946 0958');
    expect(screen.getByRole('link', { name: 'Call +44 20 7946 0958' }).getAttribute('href')).toBe(
      'tel:+442079460958',
    );
    const input = box('input[type=tel]')[0]!;
    expect(input.inputMode).toBe('tel');
    fireEvent.blur(input, { target: { value: 'call me' } });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.blur(input, { target: { value: ' (020) 7946-0958 ' } });
    expect(onSave).toHaveBeenLastCalledWith('(020) 7946-0958');
    fireEvent.blur(input, { target: { value: '' } });
    expect(onSave).toHaveBeenLastCalledWith(undefined);
  });

  it('has no link without a number', () => {
    panel(PHONE, undefined);
    expect(screen.queryByRole('link')).toBeNull();
    const input = box('input[type=tel]')[0]!;
    fireEvent.blur(input, { target: { value: '' } });
  });
});

describe.each(ROLES)('for a $role', ({ disabled }) => {
  it(disabled ? 'reads every new field, the phone still calling' : 'edits every new field', () => {
    panel(CALL, '2026-10-31T17:00:00Z', disabled);
    panel(SLOT, ['2026-10-31T09:00:00Z', '2026-10-31T17:00:00Z'], disabled);
    panel(PHONE, '+44 20 7946 0958', disabled);
    const inputs = [...box('input')];
    expect(inputs).toHaveLength(4);
    for (const input of inputs) expect(input.disabled).toBe(disabled);
    expect(screen.getByRole('link', { name: 'Call +44 20 7946 0958' })).toBeTruthy();
  });
});

describe('Add Field and the type editor', () => {
  it('sets Include Time when a Date Range is made, and shows it fixed after', () => {
    const onChange = vi.fn();
    render(<IncludeTimeSwitch field={{ kind: 'daterange' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Include Time' }));
    expect(onChange).toHaveBeenLastCalledWith({ withTime: true });
    cleanup();
    render(<IncludeTimeSwitch field={{ kind: 'daterange', withTime: true }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Include Time' }));
    expect(onChange).toHaveBeenLastCalledWith({ withTime: undefined });
    cleanup();
    render(<CustomFieldForm field={SLOT} onChange={vi.fn()} />);
    const fixed = screen.getByRole('switch', { name: 'Include Time' }) as HTMLButtonElement;
    expect(fixed.disabled).toBe(true);
    expect(screen.getByText(/can’t change later/)).toBeTruthy();
  });

  it('offers the switch on a Date Range only, and keeps it only there', () => {
    render(<IncludeTimeSwitch field={{ kind: 'datetime' }} />);
    expect(screen.queryByRole('switch')).toBeNull();
    expect(addedField({ label: ' Slot ', kind: 'daterange', withTime: true })).toMatchObject({
      label: 'Slot',
      withTime: true,
    });
    expect(
      addedField({ label: 'Call', kind: 'datetime', withTime: true }).withTime,
    ).toBeUndefined();
  });

  it('previews each kind with a sample of its own', () => {
    for (const [kind, sample] of [
      ['datetime', 'Fri 31 Oct, 17:00'],
      ['phone', '+44 20 7946 0958'],
    ] as const) {
      render(<CustomFieldPreview label="X" kind={kind} options={[]} />);
      expect(screen.getByText(sample)).toBeTruthy();
      cleanup();
    }
    render(<CustomFieldPreview label="X" kind="daterange" options={[]} />);
    expect(screen.getByText('31 Oct')).toBeTruthy();
    cleanup();
    render(<CustomFieldPreview label="X" kind="daterange" options={[]} withTime />);
    expect(screen.getByText('31 Oct, 09:00')).toBeTruthy();
    expect(CUSTOM_KIND_ICONS.datetime).toBeTruthy();
  });
});

describe('the card face', () => {
  const by = { id: 'p', name: 'Sam', color: '#000000' };
  const event: ItemTypeDef = {
    ...ITEM_TYPES[1],
    id: 'event',
    label: 'Event',
    fields: ['title', 'status', 'f-call', 'f-trip', 'f-phone'],
    custom: [CALL, TRIP, PHONE],
    display: { detailed: { body: ['f-call', 'f-trip', 'f-phone'] } },
  };
  const face = (fields: Item['fields'], muted = false) =>
    render(
      <PlanCardFace
        item={{
          id: 'e',
          type: 'event',
          key: 1,
          rank: 'i',
          fields: { title: 'Launch', ...fields },
          rev: 1,
          createdAt: 0,
          updatedAt: 0,
          createdBy: by,
          updatedBy: by,
        }}
        palette={planPalette('light')}
        fields={[]}
        typeOverride={event}
        muted={muted}
      />,
    );

  it('draws a past moment and a past range as overdue', () => {
    face({
      'f-call': '2020-01-03T17:00:00Z[Europe/London]',
      'f-trip': ['2020-01-01', '2020-01-02'],
    });
    expect(screen.getByText(/^Call: .*, overdue$/)).toBeTruthy();
    expect(screen.getByText(/^Trip: .*, overdue$/)).toBeTruthy();
  });

  it('draws a coming one quietly, never overdue on a done card, and a phone as typed', () => {
    face({ 'f-call': '2999-01-01T09:00:00Z', 'f-phone': '+44 20 7946 0958' });
    expect(screen.getByText(/^Call:/).textContent).not.toContain('overdue');
    expect(screen.getByText('Phone: +44 20 7946 0958')).toBeTruthy();
    cleanup();
    face({ 'f-call': '2020-01-03T17:00:00Z' }, true);
    expect(screen.getByText(/^Call:/).textContent).not.toContain('overdue');
  });
});

describe('the form questions', () => {
  it('gives a Date Range question its settings (Include Time), and Phone and Date and Time none', () => {
    expect(hasQuestionSettings({ id: 'q', type: 'daterange', prompt: 'Q' })).toBe(true);
    expect(hasQuestionSettings({ id: 'q', type: 'datetime', prompt: 'Q' })).toBe(false);
    expect(hasQuestionSettings({ id: 'q', type: 'phone', prompt: 'Q' })).toBe(false);
  });
  const q = (
    type: PublicQuestion['type'],
    extra: Partial<PublicQuestion> = {},
  ): PublicQuestion => ({
    id: 'q',
    type,
    prompt: 'Q',
    ...extra,
  });
  const control = (question: PublicQuestion, value: unknown) => {
    const onChange = vi.fn();
    render(
      <QuestionControl
        question={question}
        value={value}
        other=""
        onChange={onChange}
        onOther={vi.fn()}
        labelledBy="p"
        controlId="c"
      />,
    );
    return onChange;
  };

  it('asks a phone in a tel box with the phone keypad', () => {
    const onChange = control(q('phone'), '');
    const input = box('input[type=tel]')[0]!;
    expect(input.autocomplete).toBe('tel');
    expect(input.placeholder).toBe('+44 20 7946 0958');
    fireEvent.change(input, { target: { value: '+44 20' } });
    expect(onChange).toHaveBeenLastCalledWith('+44 20');
  });

  it('sends a moment as its instant in the respondent’s zone', () => {
    const onChange = control(q('datetime'), '2026-10-31T17:00:00Z');
    const input = box('input[type=datetime-local]')[0]!;
    expect(input.value).toBe(localInputValue('2026-10-31T17:00:00Z'));
    fireEvent.change(input, { target: { value: '2026-11-01T08:15' } });
    expect(onChange).toHaveBeenLastCalledWith(fromLocalInput('2026-11-01T08:15'));
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('sends a range as its two ends, or nothing when both are empty', () => {
    const onChange = control(q('daterange'), ['2026-10-31', '']);
    const [from, to] = box('input[type=date]');
    expect(screen.getByText('From')).toBeTruthy();
    fireEvent.change(to!, { target: { value: '2026-11-02' } });
    expect(onChange).toHaveBeenLastCalledWith(['2026-10-31', '2026-11-02']);
    fireEvent.change(from!, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('sends a timed range’s ends as instants', () => {
    const onChange = control(q('daterange', { withTime: true }), undefined);
    const [from, to] = box('input[type=datetime-local]');
    fireEvent.change(from!, { target: { value: '2026-10-31T09:00' } });
    expect(onChange).toHaveBeenLastCalledWith([fromLocalInput('2026-10-31T09:00'), '']);
    fireEvent.change(to!, { target: { value: '2026-10-31T17:00' } });
    expect(onChange).toHaveBeenLastCalledWith(['', fromLocalInput('2026-10-31T17:00')]);
  });
});
