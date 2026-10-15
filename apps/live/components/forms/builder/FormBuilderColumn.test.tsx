// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { questionsOf, type FormDefinition } from '@livediagram/forms';
import type { ItemTypeDef } from '@livediagram/items';
import type { FormActions } from '@/hooks/forms/useFormActions';
import { FormBuilderContext, type FormBuilderValue } from './form-builder-context';
import { FormBuilderColumn } from './FormBuilderColumn';

// The builder (docs/specs/030-forms/forms.md "Building a form", "Who may do what"): an Editor edits in place; anyone
// else sees the form as respondents do, with no editing chrome at all.

afterEach(cleanup);

const START: FormDefinition = {
  v: 1,
  heading: 'Bug Report',
  sections: [
    {
      id: 's-1',
      title: '',
      questions: [
        { id: 'q-1', type: 'short', prompt: 'Summary', required: true, goesTo: { to: 'title' } },
        { id: 'q-2', type: 'single', prompt: 'Severity', options: ['Low', 'High'] },
      ],
    },
  ],
};

const BUG: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'bug',
  color: '#dc2626',
  fields: ['title', 'status'],
};

let latest: FormDefinition = START;

function Harness({ canEdit }: { canEdit: boolean }) {
  const [form, setForm] = useState(START);
  const [selectedId, setSelected] = useState<string | null>(null);
  const [focusId, setFocus] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    latest = form;
  });
  const actions: FormActions = {
    startForm: vi.fn(),
    newFormFor: vi.fn(),
    changeForm: (fn) => setForm((f) => fn(f)),
    renameForm: (name) => setForm((f) => ({ ...f, heading: name })),
    addFieldFor: vi.fn(() => null),
    syncFieldOptions: vi.fn(),
    newResponsesBoard: vi.fn(),
    newCardType: vi.fn(),
  };
  const value: FormBuilderValue = {
    form,
    canEdit,
    actions,
    selectedId,
    select: (id, focus) => {
      setSelected(id);
      if (focus) setFocus(id);
    },
    focusId,
    clearFocus: () => setFocus(null),
    type: BUG,
    types: [BUG],
    openSettings: vi.fn(),
  };
  return (
    <FormBuilderContext.Provider value={value}>
      <div ref={scrollRef}>
        <FormBuilderColumn scrollRef={scrollRef} />
      </div>
    </FormBuilderContext.Provider>
  );
}

describe('someone who may not edit (a Participant, a Viewer)', () => {
  it('sees the form as respondents do, and nothing to edit', () => {
    render(<Harness canEdit={false} />);
    expect(screen.getByRole('heading', { name: 'Bug Report' })).toBeTruthy();
    expect(screen.getByText('Summary')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Edit question/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Add / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Move / })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Form heading' })).toBeNull();
  });
});

describe('an Editor', () => {
  it('selects a question to edit it, and Escape lets go', () => {
    render(<Harness canEdit />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit question: Summary' }));
    expect((screen.getByRole('textbox', { name: 'Question' }) as HTMLTextAreaElement).value).toBe(
      'Summary',
    );
    expect(screen.getByText('Title')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Question' }), { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Question' })).toBeNull();
  });

  it('turns Required off, duplicates, moves and deletes, each one edit', () => {
    render(<Harness canEdit />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit question: Summary' }));
    fireEvent.click(screen.getByRole('switch', { name: /Required/ }));
    expect(questionsOf(latest)[0]!.required).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Move Down' }));
    expect(questionsOf(latest).map((q) => q.id)).toEqual(['q-2', 'q-1']);
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(questionsOf(latest)).toHaveLength(3);
    // The copy is selected and goes nowhere special.
    expect(questionsOf(latest)[2]!.goesTo).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Delete question' }));
    expect(questionsOf(latest)).toHaveLength(2);
  });

  it('adds a question of the selected one’s type after it, focused', () => {
    render(<Harness canEdit />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit question: Severity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Single Choice' }));
    const qs = questionsOf(latest);
    expect(qs.map((q) => q.type)).toEqual(['short', 'single', 'single']);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Question' }));
  });

  it('adds a question of another type from the list', () => {
    render(<Harness canEdit />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a question of another type' }));
    fireEvent.click(screen.getByRole('option', { name: 'Rating' }));
    expect(questionsOf(latest).at(-1)).toMatchObject({ type: 'rating', scale: 5, style: 'stars' });
  });

  it('edits options: Enter adds the next, and Other comes and goes', () => {
    render(<Harness canEdit />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit question: Severity' }));
    const options = screen.getByRole('list', { name: 'Options' });
    fireEvent.keyDown(within(options).getByRole('textbox', { name: 'Option 2' }), { key: 'Enter' });
    expect(questionsOf(latest)[1]!.options).toEqual(['Low', 'High', 'Option 3']);
    fireEvent.click(screen.getByRole('button', { name: 'Add “Other”' }));
    expect(questionsOf(latest)[1]!.other).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Other' }));
    expect(questionsOf(latest)[1]!.other).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Low' }));
    expect(questionsOf(latest)[1]!.options).toEqual(['High', 'Option 3']);
  });

  it('changes a question’s type from its type button', () => {
    render(<Harness canEdit />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit question: Severity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Question type: Single Choice' }));
    fireEvent.click(screen.getByRole('option', { name: 'Multiple Choice' }));
    expect(questionsOf(latest)[1]).toMatchObject({ type: 'multi', options: ['Low', 'High'] });
  });

  it('splits the form with Add Section, and the new section can be removed', () => {
    render(<Harness canEdit />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit question: Summary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Section' }));
    expect(latest.sections.map((s) => s.questions.map((q) => q.id))).toEqual([['q-1'], ['q-2']]);
    expect(screen.getByText('Section 2 of 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete section 2' }));
    expect(latest.sections).toHaveLength(1);
  });

  it('renames the form from its heading, once typing pauses', async () => {
    vi.useFakeTimers();
    try {
      render(<Harness canEdit />);
      fireEvent.change(screen.getByRole('textbox', { name: 'Form heading' }), {
        target: { value: 'Defects' },
      });
      await act(async () => vi.advanceTimersByTime(600));
      expect(latest.heading).toBe('Defects');
    } finally {
      vi.useRealTimers();
    }
  });
});
