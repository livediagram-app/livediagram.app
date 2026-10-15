// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FormDefinition, FormQuestion } from '@livediagram/forms';
import { FormBuilderContext, type FormBuilderValue } from './form-builder-context';
import { PlaceholderField, takesPlaceholder } from './PlaceholderField';

// A text question's answer box and its placeholder are one field (docs/specs/030-forms/forms.md "Question types").

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup(q: FormQuestion) {
  let form: FormDefinition = {
    v: 1,
    heading: 'F',
    sections: [{ id: 's', title: '', questions: [q] }],
  };
  const value = {
    form,
    canEdit: true,
    actions: { changeForm: (fn: (f: FormDefinition) => FormDefinition) => (form = fn(form)) },
  } as unknown as FormBuilderValue;
  render(
    <FormBuilderContext.Provider value={value}>
      <PlaceholderField question={q} />
    </FormBuilderContext.Provider>,
  );
  return () => form.sections[0]!.questions[0]!;
}

describe('PlaceholderField', () => {
  it('takes the placeholder typed into the answer box itself', () => {
    vi.useFakeTimers();
    const now = setup({ id: 'q', type: 'short', prompt: 'Name' });
    const box = screen.getByRole('textbox', { name: 'Placeholder' });
    fireEvent.change(box, { target: { value: 'Jane Doe' } });
    act(() => vi.advanceTimersByTime(600));
    expect(now().placeholder).toBe('Jane Doe');
  });

  it("shows the type's own hint while it has none", () => {
    setup({ id: 'q', type: 'email', prompt: 'Email' });
    expect(screen.getByRole('textbox', { name: 'Placeholder' }).getAttribute('placeholder')).toBe(
      'name@example.com',
    );
  });

  it('is for the text answers alone', () => {
    const q = (type: FormQuestion['type']) => ({ id: 'q', type, prompt: 'x' }) as FormQuestion;
    expect(
      ['short', 'paragraph', 'number', 'email', 'link'].every((t) =>
        takesPlaceholder(q(t as FormQuestion['type'])),
      ),
    ).toBe(true);
    expect(takesPlaceholder(q('rating'))).toBe(false);
    expect(takesPlaceholder(q('single'))).toBe(false);
  });
});
