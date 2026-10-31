// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ITEM_TYPES, type Item, type ItemTypeDef } from '@liveplanner/items';
import { ItemFieldEditor, labelsItsControl, type ItemFieldContext } from './ItemFieldEditor';

// docs/specs/026-plan/item-types.md "An item type": a Long Text field in the card panel is rich text; emptying it
// clears it with its formatting, and a required one is kept by the host's own save.
vi.mock('@/components/notes/NoteRichTextEditor', () => ({
  NoteRichTextEditor: (p: {
    label: string;
    onBlur: () => void;
    onChange: (plain: string, runs: unknown[]) => void;
  }) => (
    <textarea
      aria-label={p.label}
      onChange={(e) => p.onChange(e.target.value, [{ text: e.target.value }])}
      onBlur={p.onBlur}
    />
  ),
}));

afterEach(cleanup);

const type = (required: boolean): ItemTypeDef => ({
  ...ITEM_TYPES[1],
  id: 'repro',
  fields: ['title', 'f-steps'],
  custom: [{ id: 'f-steps', label: 'Steps', kind: 'longtext', ...(required ? { required } : {}) }],
});
const item = (fields: Item['fields']) =>
  ({ id: 'item0001', key: 1, type: 'repro', fields: { title: 'T', ...fields } }) as unknown as Item;

function empty(fields: Item['fields'], required = false) {
  const ctx: ItemFieldContext = {
    item: item(fields),
    type: type(required),
    statuses: [],
    people: [],
    canEdit: true,
    labels: [],
    onSave: vi.fn(),
    onPatch: vi.fn(),
    onOpenItem: vi.fn(),
  };
  render(<ItemFieldEditor f="f-steps" ctx={ctx} />);
  fireEvent.click(screen.getByRole('button', { name: /Edit the steps|Add steps/ }));
  const box = screen.getByLabelText('Steps');
  fireEvent.change(box, { target: { value: ' ' } });
  fireEvent.blur(box);
  return ctx;
}

describe('a Long Text field in the card panel', () => {
  it('is rich text, never one labelled control', () => {
    expect(labelsItsControl(type(false), 'f-steps')).toBe(false);
    expect(labelsItsControl(type(false), 'title')).toBe(true);
  });

  it('clears with its formatting when emptied', () => {
    const ctx = empty({ 'f-steps': 'Go', 'f-stepsRich': [{ text: 'Go', bold: true }] });
    expect(ctx.onPatch).toHaveBeenCalledWith({ clear: ['f-steps', 'f-stepsRich'] });
    expect(ctx.onSave).not.toHaveBeenCalled();
  });

  it('clears a plain value alone, and writes nothing for a field already empty', () => {
    expect(empty({ 'f-steps': 'Go' }).onPatch).toHaveBeenCalledWith({ clear: ['f-steps'] });
    cleanup();
    expect(empty({}).onPatch).not.toHaveBeenCalled();
  });

  it('is kept by the host when it is required', () => {
    const ctx = empty({ 'f-steps': 'Go' }, true);
    expect(ctx.onSave).toHaveBeenCalledWith('f-steps', undefined);
    expect(ctx.onPatch).not.toHaveBeenCalled();
  });
});
