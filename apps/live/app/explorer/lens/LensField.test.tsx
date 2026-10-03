// @vitest-environment jsdom

// The lens field (docs/specs/013-workspace/explorer-filters.md "The field", "Suggestions",
// "Accessibility"): a WAI-ARIA combobox over the draft, the tokens as removable pills.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  documentSubject,
  parseLens,
  type LensContext,
  type LensSubject,
} from '@livediagram/explorer-lens';
import { LensField } from './LensField';
import type { ExplorerLens } from './useExplorerLens';

afterEach(cleanup);

const NOW = Date.UTC(2026, 5, 15, 12);
const aggregate: LensContext = { view: 'aggregate', teams: [] };
const scoped: LensContext = { view: 'scoped', teams: [] };

function Harness({
  initial = '',
  context = aggregate,
  subjects = [],
}: {
  initial?: string;
  context?: LensContext;
  subjects?: LensSubject[];
}) {
  const [input, setInputState] = useState(initial);
  const [caret, setCaret] = useState<number | null>(null);
  const lens: ExplorerLens = {
    view: context.view,
    context,
    input,
    caret,
    parsed: parseLens(input, context, caret ?? undefined),
    now: NOW,
    setField: (next, at) => {
      setInputState(next);
      setCaret(at);
    },
    setInput: setInputState,
    blur: () => setCaret(null),
  };
  return (
    <>
      <LensField lens={lens} subjects={subjects} />
      <output data-testid="lens">{input}</output>
    </>
  );
}

const field = () => screen.getByRole('combobox', { name: 'Filter documents' });
const lensString = () => screen.getByTestId('lens').textContent;
const type = (value: string) => {
  fireEvent.focus(field());
  fireEvent.change(field(), { target: { value } });
};

describe('LensField', () => {
  it('is a combobox controlling a listbox, closed at first', () => {
    render(<Harness />);
    const input = field();
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    const list = document.getElementById(input.getAttribute('aria-controls')!);
    expect(list?.getAttribute('role')).toBe('listbox');
    expect(input.getAttribute('placeholder')).toBe('Search or filter documents');
  });

  it('offers the dimensions a word starts, and accepts one with Down and Enter', () => {
    render(<Harness />);
    type('temp');
    expect(field().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('option').map((o) => o.getAttribute('aria-label'))).toEqual([
      'Template',
    ]);
    // No suggestion is active until one is pressed.
    expect(field().getAttribute('aria-activedescendant')).toBeNull();
    fireEvent.keyDown(field(), { key: 'ArrowDown' });
    expect(field().getAttribute('aria-activedescendant')).toBe(
      screen.getAllByRole('option')[0]!.id,
    );
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect((field() as HTMLInputElement).value).toBe('template:');
  });

  it('turns an accepted value into a pill and keeps typing after it', () => {
    render(<Harness />);
    type('template:k');
    expect(screen.getAllByRole('option').map((o) => o.getAttribute('aria-label'))).toEqual([
      // Nothing is listed in this harness, so every value is marked.
      'Kanban, Template, no matches',
    ]);
    fireEvent.click(screen.getAllByRole('option')[0]!);
    expect(lensString()).toBe('template:kanban ');
    expect((field() as HTMLInputElement).value).toBe('');
    expect(screen.getByText('Template: Kanban')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove filter Template: Kanban' })).toBeTruthy();
  });

  it('makes a typed token a pill once a space follows it', () => {
    render(<Harness />);
    type('made-by:ai ');
    expect(lensString()).toBe('made-by:ai ');
    expect(screen.getByRole('button', { name: 'Remove filter Made by AI' })).toBeTruthy();
  });

  it('marks a value that would match nothing, never hiding it', () => {
    const subjects = [
      documentSubject(
        { name: 'Plan', savedAt: NOW, ownerId: 'me', teamId: null, source: null },
        'me',
      ),
    ];
    render(<Harness subjects={subjects} />);
    type('made-by:');
    expect(screen.getByRole('option', { name: 'Made by AI, Made by AI, no matches' })).toBeTruthy();
    expect(screen.getByText('No matches')).toBeTruthy();
  });

  it('closes the suggestions with Escape and keeps the text', () => {
    render(<Harness />);
    type('ed');
    expect(field().getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(field().getAttribute('aria-expanded')).toBe('false');
    expect((field() as HTMLInputElement).value).toBe('ed');
  });

  it('selects the last pill with Backspace at the start, and removes it with a second', () => {
    render(<Harness initial="made-by:ai edited:7d " />);
    fireEvent.focus(field());
    (field() as HTMLInputElement).setSelectionRange(0, 0);
    fireEvent.keyDown(field(), { key: 'Backspace' });
    expect(lensString()).toBe('made-by:ai edited:7d ');
    fireEvent.keyDown(field(), { key: 'Backspace' });
    expect(lensString()).toBe('made-by:ai ');
  });

  it('removes a pill with its button', () => {
    render(<Harness initial="template:kanban plan" />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter Template: Kanban' }));
    expect(lensString()).toBe('plan');
  });

  it('mutes a pill that cannot apply here and says why', () => {
    render(<Harness initial="space:mine" context={scoped} />);
    expect(
      screen.getByText(
        ', not applied: The breadcrumb sets the space here, so Space filters don’t apply.',
      ),
    ).toBeTruthy();
  });
});
