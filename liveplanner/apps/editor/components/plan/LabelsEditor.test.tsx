// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ITEM_LABELS_MAX, type LabelUse } from '@liveplanner/items';
import { LabelsEditor } from './LabelsEditor';

// docs/specs/026-plan/plan-board.md "Working on a board": the Labels field and its label menu.
afterEach(cleanup);

const USES: LabelUse[] = [
  { label: 'frontend', count: 5 },
  { label: 'Bug', count: 3 },
  { label: 'storefront', count: 1 },
];

function labels(value: string[] = [], uses: readonly LabelUse[] = USES, onSave = vi.fn()) {
  render(
    <LabelsEditor id="labels" value={value} disabled={false} suggestions={uses} onSave={onSave} />,
  );
  const input = screen.getByRole('combobox');
  return { input, onSave };
}
const menu = () => screen.getByRole('listbox', { name: 'Labels on this plan' });
const options = () => within(menu()).getAllByRole('option');
const active = () => options().find((o) => o.getAttribute('aria-selected') === 'true');

describe('LabelsEditor', () => {
  it('opens the plan’s labels on focus, most used first, with how many cards carry each', () => {
    const { input } = labels(['Bug']);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    fireEvent.focus(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(options().map((o) => o.getAttribute('aria-label'))).toEqual([
      'frontend, on 5 cards',
      'storefront, on 1 card',
    ]);
    expect(active()).toBeUndefined();
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
  });

  it('narrows as it is typed and Enter adds the label it completes to', () => {
    const { input, onSave } = labels();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'fro' } });
    expect(options().map((o) => o.textContent)).toEqual([
      'frontend5',
      'storefront1',
      'Create “fro”',
    ]);
    expect(active()?.textContent).toBe('frontend5');
    expect(input.getAttribute('aria-activedescendant')).toBe(active()?.id);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith(['frontend']);
    expect((input as HTMLInputElement).value).toBe('');
    expect(menu()).toBeTruthy();
  });

  it('highlights Create when no label starts with the text, and the arrows move and wrap', () => {
    const { input, onSave } = labels();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'ront' } });
    expect(active()?.textContent).toBe('Create “ront”');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(active()?.textContent).toBe('frontend5');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(active()?.textContent).toBe('storefront1');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith(['storefront']);
  });

  it('starts the arrows at either end when nothing is highlighted', () => {
    const { input } = labels();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(active()?.textContent).toBe('storefront1');
    cleanup();
    const second = labels();
    fireEvent.focus(second.input);
    fireEvent.keyDown(second.input, { key: 'ArrowDown' });
    expect(active()?.textContent).toBe('frontend5');
  });

  it('creates a new label from Create, by click, keeping focus in the field', () => {
    const { input, onSave } = labels();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '#perf' } });
    const create = screen.getByRole('option', { name: 'Create label perf' });
    const press = fireEvent.pointerDown(create);
    expect(press).toBe(false);
    fireEvent.pointerMove(create);
    fireEvent.click(create);
    expect(onSave).toHaveBeenCalledWith(['perf']);
  });

  it('adds a label by click after the pointer highlights it, and a press outside closes', () => {
    const { input, onSave } = labels();
    fireEvent.focus(input);
    const store = screen.getByRole('option', { name: 'storefront, on 1 card' });
    fireEvent.pointerMove(store);
    expect(active()).toBe(store);
    fireEvent.pointerMove(store);
    fireEvent.click(store);
    expect(onSave).toHaveBeenCalledWith(['storefront']);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('takes the plan’s spelling of a label typed in another case', () => {
    const { input, onSave } = labels();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'bug,' } });
    expect(onSave).toHaveBeenCalledWith(['Bug']);
  });

  it('adds what is typed when focus leaves, and closes', () => {
    const { input, onSave } = labels();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'later' } });
    fireEvent.blur(input);
    expect(onSave).toHaveBeenCalledWith(['later']);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on Tab and reopens on the arrows', () => {
    const { input } = labels();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(menu()).toBeTruthy();
  });

  it('says when a plan has no labels yet, when the card has them all, and when it is full', () => {
    const first = labels([], []);
    fireEvent.focus(first.input);
    expect(screen.getByText('No labels yet. Type one to add it.')).toBeTruthy();
    fireEvent.keyDown(first.input, { key: 'ArrowDown' });
    fireEvent.keyDown(first.input, { key: 'Enter' });
    expect(first.onSave).not.toHaveBeenCalled();
    cleanup();

    const all = labels(['frontend', 'Bug', 'storefront']);
    fireEvent.focus(all.input);
    expect(screen.getByText('Every label on this plan is on this card.')).toBeTruthy();
    fireEvent.change(all.input, { target: { value: 'bug' } });
    expect(screen.getByText('“bug” is on this card already.')).toBeTruthy();
    cleanup();

    const twelve = Array.from({ length: ITEM_LABELS_MAX }, (_, i) => `l${i}`);
    const full = labels(twelve);
    fireEvent.focus(full.input);
    fireEvent.change(full.input, { target: { value: 'fro' } });
    expect(screen.getByText(/A card holds up to 12 labels/)).toBeTruthy();
    fireEvent.keyDown(full.input, { key: 'Enter' });
    expect(full.onSave).not.toHaveBeenCalled();
  });

  it('removes a label, and clears the field with its last', () => {
    const { onSave } = labels(['Bug', 'ui']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove label Bug' }));
    expect(onSave).toHaveBeenCalledWith(['ui']);
    cleanup();
    const last = labels(['ui']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove label ui' }));
    expect(last.onSave).toHaveBeenCalledWith(undefined);
  });

  it('is the chips alone to someone who may only view', () => {
    render(<LabelsEditor id="l" value={['Bug']} disabled suggestions={USES} onSave={vi.fn()} />);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('Bug')).toBeTruthy();
  });
});
