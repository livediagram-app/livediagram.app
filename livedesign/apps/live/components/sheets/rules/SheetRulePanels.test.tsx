// @vitest-environment jsdom
// The rule panels and settings (docs/specs/029-sheets/data-validation.md "Making and changing rules",
// conditional-formatting.md "Making and changing rules", sheet.md "Formatting" Custom): the Data Validation editor,
// the Conditional Formatting popover, the Custom Number Format popover, the Sheet Settings sections, and who may.
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { posRangeOf, formatRange } from '@livepages/sheets';
import { SheetRuleLayer } from './SheetRuleLayer';
import {
  NO_FORMAT_RULES,
  NO_FORMAT_RULES_READ,
  NO_VALIDATION_RULES,
  NO_VALIDATION_RULES_READ,
  SheetFormatRuleList,
  SheetValidationRules,
  validationRuleShortLine,
} from './SheetRuleSettings';
import { settingsOf } from './SheetValidationEditor';
import {
  makeSheet,
  renderSheet,
  stubResizeObserver,
  type SheetHarness,
} from '../sheet-ui-test-utils';

beforeAll(() => stubResizeObserver());
afterEach(cleanup);

const rules = (h: SheetHarness) => h.store.sheet('sheet0001')!.layout.rules ?? [];
const fRules = (h: SheetHarness) => h.store.sheet('sheet0001')!.layout.formatRules ?? [];
const rangeOf = (h: SheetHarness, r: Parameters<typeof posRangeOf>[1]) =>
  formatRange(posRangeOf(h.store.sheet('sheet0001')!.layout, r)!);

async function open(cells: Record<string, string> = {}, opts: { canShape?: boolean } = {}) {
  const h = await makeSheet({ rows: 12, cols: 5, cells });
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  let acts: Parameters<Parameters<typeof renderSheet>[1]>[0]['actions'] | null = null;
  renderSheet(
    h,
    ({ actions }) => {
      acts = actions;
      return (
        <>
          <SheetRuleLayer actions={actions} />
          <SheetValidationRules actions={actions} onClose={() => {}} />
          <SheetFormatRuleList actions={actions} onClose={() => {}} />
        </>
      );
    },
    opts,
  );
  return { h, anchor, actions: () => acts! };
}

describe('the Data Validation editor', () => {
  it('starts a dropdown from the values in the selection and writes it on Done', async () => {
    const { h, anchor, actions } = await open({ A2: 'Red', A3: 'Green', A4: 'red' });
    act(() => h.select('A2:A6'));
    act(() => actions().openValidation(anchor, { start: 'list' }));
    const dialog = await screen.findByRole('dialog', { name: 'Data Validation' });
    expect(within(dialog).getByLabelText<HTMLInputElement>('Option 1').value).toBe('Red');
    expect(within(dialog).getByLabelText<HTMLInputElement>('Option 2').value).toBe('Green');
    expect(within(dialog).queryByLabelText('Option 3')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Another Option' }));
    fireEvent.change(within(dialog).getByLabelText('Option 3'), { target: { value: 'Blue' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(rules(h)).toHaveLength(1);
    expect(rules(h)[0]).toMatchObject({
      is: 'list',
      opts: [{ v: 'Red' }, { v: 'Green' }, { v: 'Blue' }],
    });
    expect(rangeOf(h, rules(h)[0]!)).toBe('A2:A6');
    // Each option takes a colour of its own.
    const colours = rules(h)[0]!.opts!.map((o) => o.c);
    expect(new Set(colours).size).toBe(3);
  });
  it('says why a rule cannot be made, and edits and removes the rule at the active cell', async () => {
    const { h, anchor, actions } = await open();
    act(() => h.select('B2:B4'));
    act(() => actions().openValidation(anchor, { start: 'list' }));
    let dialog = await screen.findByRole('dialog', { name: 'Data Validation' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('Add at least one option');
    fireEvent.change(within(dialog).getByLabelText('Apply to Range'), {
      target: { value: 'nope' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(within(dialog).getByRole('alert').textContent).toBe('Type a range like B2:B20');
    fireEvent.change(within(dialog).getByLabelText('Apply to Range'), {
      target: { value: 'B2:B4' },
    });
    fireEvent.change(within(dialog).getByLabelText('Criteria'), { target: { value: 'num' } });
    fireEvent.change(within(dialog).getByLabelText('From'), { target: { value: '1' } });
    fireEvent.change(within(dialog).getByLabelText('To'), { target: { value: '10' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Advanced/ }));
    fireEvent.click(within(dialog).getByText('Show a Warning'));
    fireEvent.change(within(dialog).getByLabelText('Help Text'), {
      target: { value: 'One to ten' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(rules(h)[0]).toMatchObject({
      is: 'num',
      op: 'between',
      a: 1,
      b: 10,
      warn: true,
      help: 'One to ten',
    });
    act(() => h.select('B3'));
    act(() => actions().openValidation(anchor));
    dialog = await screen.findByRole('dialog', { name: 'Data Validation' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove Rule' }));
    expect(rules(h)).toEqual([]);
  });
});

describe('a rule draft as settings', () => {
  const ids = () => ({ r1: 'r1', c1: 'c1', r2: 'r1', c2: 'c1' });
  const d = {
    range: 'A1',
    is: 'list' as const,
    opts: [],
    show: 'chip' as const,
    src: '',
    op: '',
    a: '',
    b: '',
    warn: false,
    help: '',
  };
  it('reads each kind, and refuses what cannot be one', () => {
    expect(settingsOf({ ...d, is: 'check' }, 'en-GB', ids)).toEqual({
      ok: true,
      settings: { is: 'check' },
    });
    expect(
      settingsOf(
        {
          ...d,
          opts: [
            { key: 1, v: 'A' },
            { key: 2, v: 'a' },
          ],
        },
        'en-GB',
        ids,
      ),
    ).toEqual({ ok: false, why: 'Each option must be different' });
    expect(
      settingsOf({ ...d, opts: [{ key: 1, v: 'A', c: '#ff0000' }], show: 'arrow' }, 'en-GB', ids),
    ).toEqual({
      ok: true,
      settings: { is: 'list', opts: [{ v: 'A', c: '#ff0000' }], show: 'arrow' },
    });
    expect(settingsOf({ ...d, is: 'range', src: 'A1:A3' }, 'en-GB', ids)).toMatchObject({
      ok: true,
      settings: { is: 'range' },
    });
    expect(settingsOf({ ...d, is: 'range', src: '' }, 'en-GB', () => null)).toMatchObject({
      ok: false,
    });
    expect(
      settingsOf({ ...d, is: 'date', op: 'after', a: '2026-10-01' }, 'en-GB', ids),
    ).toMatchObject({ ok: true, settings: { is: 'date', op: 'after' } });
    expect(settingsOf({ ...d, is: 'date', op: 'after', a: '' }, 'en-GB', ids)).toEqual({
      ok: false,
      why: 'Enter a date',
    });
    expect(settingsOf({ ...d, is: 'date', op: 'valid' }, 'en-GB', ids)).toEqual({
      ok: true,
      settings: { is: 'date', op: 'valid' },
    });
    expect(settingsOf({ ...d, is: 'num', op: 'gt', a: 'x' }, 'en-GB', ids)).toEqual({
      ok: false,
      why: 'Enter a number',
    });
    expect(settingsOf({ ...d, is: 'text', op: 'email' }, 'en-GB', ids)).toEqual({
      ok: true,
      settings: { is: 'text', op: 'email' },
    });
    expect(settingsOf({ ...d, is: 'text', op: 'contains', a: ' ' }, 'en-GB', ids)).toEqual({
      ok: false,
      why: 'Enter a value',
    });
    expect(
      settingsOf(
        { ...d, is: 'text', op: 'contains', a: 'ref', help: ' Say ', warn: true },
        'en-GB',
        ids,
      ),
    ).toEqual({
      ok: true,
      settings: { is: 'text', op: 'contains', a: 'ref', warn: true, help: 'Say' },
    });
  });
});

describe('the Conditional Formatting popover', () => {
  it('adds a rule (drawn as a preview while it is edited), reorders and deletes', async () => {
    const { h, anchor, actions } = await open({ C2: '5', C3: '50' });
    act(() => h.select('C2:C6'));
    act(() => actions().openFormatRules(anchor));
    let dialog = await screen.findByRole('dialog', { name: 'Conditional Formatting' });
    expect(within(dialog).getByText('No format rules on these cells yet.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Another Rule' }));
    fireEvent.change(within(dialog).getByLabelText('Condition'), { target: { value: 'gt' } });
    fireEvent.change(within(dialog).getByLabelText('Value'), { target: { value: '10' } });
    await waitFor(() => expect(h.ctl().rules.formatPreview).toMatchObject({ op: 'gt', a: '10' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Red Fill' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bold' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(fRules(h)).toHaveLength(1);
    expect(fRules(h)[0]).toMatchObject({
      op: 'gt',
      a: '10',
      style: { bg: '#f4c7c3', fc: '#a50e0e', b: true },
    });
    // A colour scale, last.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Another Rule' }));
    fireEvent.click(within(dialog).getByText('Colour Scale'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Green, Yellow, Red' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(fRules(h).map((r) => r.is)).toEqual(['when', 'scale']);
    expect(fRules(h)[1]).toMatchObject({
      min: { c: '#57bb8a' },
      mid: { c: '#ffd666' },
      max: { c: '#e67c73' },
    });
    dialog = screen.getByRole('dialog', { name: 'Conditional Formatting' });
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Move Up' })[1]!);
    expect(fRules(h).map((r) => r.is)).toEqual(['scale', 'when']);
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Delete Rule' })[0]!);
    expect(fRules(h).map((r) => r.is)).toEqual(['when']);
  });
  it('takes a custom formula, refusing one that cannot be read', async () => {
    const { h, anchor, actions } = await open();
    act(() => h.select('A2:D6'));
    act(() => actions().openFormatRules(anchor));
    const dialog = await screen.findByRole('dialog', { name: 'Conditional Formatting' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Another Rule' }));
    fireEvent.change(within(dialog).getByLabelText('Condition'), { target: { value: 'formula' } });
    fireEvent.change(within(dialog).getByLabelText('Custom Formula'), {
      target: { value: '=$C2>(' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(within(dialog).getByRole('alert').textContent).toBe("That formula can't be read");
    fireEvent.change(within(dialog).getByLabelText('Custom Formula'), {
      target: { value: '=$C2>100' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(fRules(h)[0]).toMatchObject({ op: 'formula' });
  });
});

describe('the Custom Number Format popover', () => {
  it('previews a code, refuses one that cannot be read, and applies it', async () => {
    const { h, anchor, actions } = await open({ B2: '1234.5' });
    act(() => h.select('B2'));
    act(() => actions().openCustomFormat(anchor));
    const dialog = await screen.findByRole('dialog', { name: 'Custom Number Format' });
    const field = within(dialog).getByDisplayValue('#,##0.00');
    expect(within(dialog).getByText('1,234.50')).toBeTruthy();
    fireEvent.change(field, { target: { value: '"open' } });
    expect(within(dialog).getByText("That format code can't be read")).toBeTruthy();
    expect(within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Apply' }).disabled).toBe(
      true,
    );
    fireEvent.change(field, { target: { value: '0.0 "h"' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(h.cell('B2')?.format).toMatchObject({ nf: 'custom', nc: '0.0 "h"' });
    act(() => actions().numberFormat('number'));
    expect(h.cell('B2')?.format?.nc).toBeUndefined();
  });
});

describe('the Sheet Settings sections', () => {
  it('list every rule with Go To, Edit and Remove', async () => {
    const { h, actions } = await open();
    act(() => h.select('A2:A4'));
    act(() => actions().addCheckbox());
    act(() => {
      actions().setFormatRule({
        id: actions().newFormatRuleId(),
        ...actions().rangeIds({ r1: 1, c1: 1, r2: 3, c2: 1 })!,
        is: 'when',
        op: 'empty',
        style: { b: true },
      });
    });
    const vRows = screen.getByRole('list', { name: 'Validation rules' });
    expect(within(vRows).getByText('Checkbox')).toBeTruthy();
    expect(within(vRows).getByText('A2:A4')).toBeTruthy();
    fireEvent.click(within(vRows).getByRole('button', { name: 'Edit Checkbox' }));
    expect(h.ctl().rules.panel).toMatchObject({ kind: 'validation', anchor: 'cell' });
    fireEvent.click(within(vRows).getByRole('button', { name: 'Remove Checkbox' }));
    expect(rules(h)).toEqual([]);
    const fRows = screen.getByRole('list', { name: 'Format rules' });
    fireEvent.click(within(fRows).getByRole('button', { name: 'Go To Is Empty' }));
    expect(h.ctl().selection.ranges[0]).toEqual({ r1: 1, c1: 1, r2: 3, c2: 1 });
    fireEvent.click(within(fRows).getByRole('button', { name: 'Remove Is Empty' }));
    expect(fRules(h)).toEqual([]);
    expect(screen.getByText(/No validation rules yet/)).toBeTruthy();
  });
  it('words each kind of rule', async () => {
    const { h } = await open();
    const c = h.ctl();
    const base = { id: 'x', r1: '', c1: '', r2: '', c2: '' };
    expect(
      validationRuleShortLine({ ...base, is: 'list', opts: [{ v: 'A' }, { v: 'B' }] }, c),
    ).toBe('Dropdown: A, B');
    expect(validationRuleShortLine({ ...base, is: 'num', op: 'between', a: 1, b: 10 }, c)).toBe(
      'Number between 1 and 10',
    );
    expect(validationRuleShortLine({ ...base, is: 'text', op: 'email' }, c)).toBe('Email address');
    expect(validationRuleShortLine({ ...base, is: 'range' }, c)).toBe(
      'Dropdown: Choose one of the listed values',
    );
  });
});

describe('who may (docs/specs/013-workspace/share-roles.md)', () => {
  it('a Participant ticks a box but never makes or removes a rule', async () => {
    const { h, actions } = await open({}, { canShape: false });
    act(() => h.select('A2:A4'));
    act(() => actions().addCheckbox());
    expect(rules(h)).toEqual([]);
    expect(h.toast).toHaveBeenCalledWith(
      "Only an editor can change a Sheet's rows, columns or settings.",
    );
    // An Editor makes the rule; the Participant then ticks.
    const ruled = await open({}, {});
    act(() => ruled.h.select('A2:A4'));
    act(() => ruled.actions().addCheckbox());
    expect(rules(ruled.h)).toHaveLength(1);
    act(() => {
      ruled.actions().toggleCheckboxes();
    });
    expect(ruled.h.cell('A2')?.input).toEqual({ b: true });
  });

  // Empty states describe instead of instructing someone with no toolbar to follow.
  it('tells an Editor how to make a rule, and a Participant only that there is none', async () => {
    await open({}, { canShape: false });
    expect(screen.getByText(NO_VALIDATION_RULES_READ)).toBeTruthy();
    expect(screen.getByText(NO_FORMAT_RULES_READ)).toBeTruthy();
    cleanup();
    await open();
    expect(screen.getByText(NO_VALIDATION_RULES)).toBeTruthy();
    expect(screen.getByText(NO_FORMAT_RULES)).toBeTruthy();
  });
});
