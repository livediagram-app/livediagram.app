// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { TextRun } from '@liveplanner/project';
import type { CustomFieldDef, Item } from '@liveplanner/items';
import { ParagraphField, paragraphPatch, paragraphRuns } from './ParagraphField';

// docs/specs/026-plan/item-types.md "An item type": a Long Text field is rich text, its value plain beside it.
vi.mock('@/components/notes/NoteRichTextEditor', () => ({
  NoteRichTextEditor: (p: {
    label: string;
    onBlur: () => void;
    onChange: (plain: string, runs: TextRun[]) => void;
  }) => (
    <textarea
      aria-label={p.label}
      onChange={(e) =>
        p.onChange(
          e.target.value,
          e.target.value.startsWith('*')
            ? [{ text: e.target.value, bold: true }]
            : [{ text: e.target.value }],
        )
      }
      onBlur={p.onBlur}
    />
  ),
}));

afterEach(cleanup);

const item = (fields: Item['fields']) =>
  ({ id: 'item0001', key: 1, type: 'bug', fields }) as unknown as Item;
const STEPS: CustomFieldDef = { id: 'f-steps', label: 'Steps to Reproduce', kind: 'longtext' };

describe('paragraphRuns', () => {
  it('reads old plain text, and formatting only while it spells the value', () => {
    expect(paragraphRuns(item({ 'f-steps': 'One\nTwo' }), 'f-steps')).toEqual([
      { text: 'One\nTwo' },
    ]);
    const runs = [{ text: 'Go', bold: true }];
    expect(paragraphRuns(item({ 'f-steps': 'Go', 'f-stepsRich': runs }), 'f-steps')).toEqual(runs);
    expect(paragraphRuns(item({ 'f-steps': 'Gone', 'f-stepsRich': runs }), 'f-steps')).toEqual([
      { text: 'Gone' },
    ]);
    expect(paragraphRuns(item({ 'f-steps': 3 }), 'f-steps')).toEqual([]);
  });
});

describe('paragraphPatch', () => {
  it('keeps the runs’ own text and the runs while any is marked', () => {
    const runs: TextRun[] = [{ text: 'Open ' }, { text: 'it', italic: true }];
    expect(paragraphPatch(item({}), 'f-steps', runs)).toEqual({
      set: { 'f-steps': 'Open it', 'f-stepsRich': runs },
    });
  });

  it('stores unmarked text plain, dropping formatting the card had', () => {
    const runs: TextRun[] = [{ text: 'Plain' }];
    expect(paragraphPatch(item({}), 'f-steps', runs)).toEqual({ set: { 'f-steps': 'Plain' } });
    expect(paragraphPatch(item({ 'f-stepsRich': [] }), 'f-steps', runs)).toEqual({
      set: { 'f-steps': 'Plain' },
      clear: ['f-stepsRich'],
    });
  });

  it('leaves an emptied field to the host', () => {
    expect(paragraphPatch(item({}), 'f-steps', [{ text: '  ' }])).toBeUndefined();
  });
});

describe('ParagraphField', () => {
  it('invites the field by name, and writes what is typed', () => {
    const onPatch = vi.fn();
    const onEmpty = vi.fn();
    render(
      <ParagraphField item={item({})} field={STEPS} canEdit onPatch={onPatch} onEmpty={onEmpty} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Add steps to reproduce…/ }));
    const box = screen.getByLabelText('Steps to Reproduce');
    fireEvent.change(box, { target: { value: '*Crash' } });
    fireEvent.blur(box);
    expect(onPatch).toHaveBeenCalledWith({
      set: { 'f-steps': '*Crash', 'f-stepsRich': [{ text: '*Crash', bold: true }] },
    });
  });

  it('hands an emptied field to the host', () => {
    const onPatch = vi.fn();
    const onEmpty = vi.fn();
    render(
      <ParagraphField
        item={item({ 'f-steps': 'Old' })}
        field={STEPS}
        canEdit
        onPatch={onPatch}
        onEmpty={onEmpty}
      />,
    );
    fireEvent.click(screen.getByText('Old'));
    const box = screen.getByLabelText('Steps to Reproduce');
    fireEvent.change(box, { target: { value: 'x' } });
    fireEvent.change(box, { target: { value: '' } });
    fireEvent.blur(box);
    expect(onEmpty).toHaveBeenCalled();
    expect(onPatch).not.toHaveBeenCalled();
  });
});
