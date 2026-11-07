// @vitest-environment jsdom

// The web components' menu row editors (docs/specs/009-elements/web-components-and-no-groups.md): add / remove / reorder,
// bounded by each kind's minimum and maximum.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARD_TAGS_MAX, createShape, type WebRows } from '@livehuddle/document';

import { ConceptRowsEditor, TextRowsEditor, WebRowsMenuSection } from './context-menu-web-editors';

afterEach(cleanup);

const open = () => ({ open: true, onToggle: () => {}, flush: true });

function renderSection(shape: Parameters<typeof createShape>[0], patch: object = {}) {
  const onSetRows = vi.fn<(rows: WebRows) => void>();
  render(
    <WebRowsMenuSection
      target={{ ...createShape(shape, 0, 0), ...patch }}
      sectionProps={open}
      onSetRows={onSetRows}
    />,
  );
  return onSetRows;
}

describe('WebRowsMenuSection (docs/specs/009-elements/web-components-and-no-groups.md)', () => {
  it("adds a card's tag and removes one", () => {
    const onSetRows = renderSection('card', { tags: ['Design', 'Q3'] });
    fireEvent.click(screen.getByRole('button', { name: 'Add Tag' }));
    expect(onSetRows).toHaveBeenLastCalledWith({ tags: ['Design', 'Q3', 'Tag'] });
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove tag' })[0]!);
    expect(onSetRows).toHaveBeenLastCalledWith({ tags: ['Q3'] });
  });

  it('reorders a tag, and disables moves past either end', () => {
    const onSetRows = renderSection('card', { tags: ['Design', 'Q3', 'Live'] });
    fireEvent.click(screen.getAllByRole('button', { name: 'Move tag down' })[0]!);
    expect(onSetRows).toHaveBeenLastCalledWith({ tags: ['Q3', 'Design', 'Live'] });
    expect(
      (screen.getAllByRole('button', { name: 'Move tag up' })[0] as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('will not add above the maximum', () => {
    renderSection('card', { tags: Array(CARD_TAGS_MAX).fill('t') });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Add Tag' }).disabled).toBe(true);
  });

  it('commits a retyped tag on blur', () => {
    const onSetRows = renderSection('card', { tags: ['Design', 'Q3'] });
    const input = screen.getByRole('textbox', { name: 'Tag 1' });
    fireEvent.change(input, { target: { value: 'Research' } });
    fireEvent.blur(input);
    expect(onSetRows).toHaveBeenLastCalledWith({ tags: ['Research', 'Q3'] });
  });

  it('shows nothing for an element with no rows', () => {
    renderSection('square');
    expect(screen.queryByRole('button', { name: /^Add / })).toBeNull();
  });
});

// docs/specs/009-elements/timeline.md: a concept graphic's rows, a label each and a note where its kind
// draws one.
describe('ConceptRowsEditor', () => {
  const rows = [{ label: 'Plan', note: 'Q1' }, { label: 'Build' }];

  it('edits a label and a note, committing on blur, and adds a numbered row', () => {
    const onChange = vi.fn();
    render(
      <ConceptRowsEditor rows={rows} min={1} max={3} noun="Layer" notes onChange={onChange} />,
    );
    const note = screen.getByRole('textbox', { name: 'Layer 2 note' });
    fireEvent.change(note, { target: { value: '9' } });
    fireEvent.blur(note);
    expect(onChange).toHaveBeenLastCalledWith([
      { label: 'Plan', note: 'Q1' },
      { label: 'Build', note: '9' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Add Layer' }));
    // The draft keeps the edit, so the add and the move carry it.
    const edited = [rows[0], { label: 'Build', note: '9' }];
    expect(onChange).toHaveBeenLastCalledWith([...edited, { label: 'Layer 3' }]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Move layer down' })[0]!);
    expect(onChange).toHaveBeenLastCalledWith([edited[1], edited[0]]);
  });

  it('shows no note where the kind draws none, and stops at its bounds', () => {
    render(
      <ConceptRowsEditor
        rows={rows}
        min={2}
        max={2}
        noun="Tier"
        notes={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole('textbox', { name: 'Tier 1 note' })).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Add Tier' }).disabled).toBe(true);
    expect(
      (screen.getAllByRole('button', { name: 'Remove tier' })[0] as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('TextRowsEditor', () => {
  it('commits a retyped row on blur and names a new one from its count', () => {
    const onChange = vi.fn();
    render(
      <TextRowsEditor
        rows={['Home', 'Docs']}
        min={1}
        max={5}
        noun="Link"
        addLabel="Add Link"
        nextRow={(n) => `Link ${n + 1}`}
        onChange={onChange}
      />,
    );
    const first = screen.getByRole('textbox', { name: 'Link 1' });
    fireEvent.change(first, { target: { value: 'Start' } });
    fireEvent.blur(first);
    expect(onChange).toHaveBeenLastCalledWith(['Start', 'Docs']);
    fireEvent.click(screen.getByRole('button', { name: 'Add Link' }));
    expect(onChange).toHaveBeenLastCalledWith(['Start', 'Docs', 'Link 3']);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove link' })[0]!);
    expect(onChange).toHaveBeenLastCalledWith(['Docs']);
  });
});
