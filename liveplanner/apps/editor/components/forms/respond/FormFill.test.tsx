// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PublicForm } from '@liveplanner/forms';
import { FormFill } from './FormFill';
import type { SubmitOutcome } from './useFormFill';

// Filling in a form (docs/specs/030-forms/forms.md "Filling in a form"): sections, checks, the error summary, Submit
// and every answer it can get, the confirmation, and answers kept while filling in.

const FORM: PublicForm = {
  heading: 'Event RSVP',
  description: 'See https://example.com for details',
  confirmation: 'See you there!',
  sections: [
    {
      id: 's-1',
      title: '',
      questions: [
        { id: 'q-name', type: 'short', prompt: 'Name', required: true },
        { id: 'q-mail', type: 'email', prompt: 'Email' },
      ],
    },
    {
      id: 's-2',
      title: 'Food',
      description: 'Tell us what you eat',
      questions: [
        {
          id: 'q-diet',
          type: 'multi',
          prompt: 'Dietary needs',
          options: ['Vegan', 'Halal'],
          max: 1,
        },
        {
          id: 'q-rate',
          type: 'rating',
          prompt: 'Excited?',
          scale: 5,
          style: 'stars',
          required: true,
        },
      ],
    },
  ],
};

afterEach(cleanup);
beforeEach(() => localStorage.clear());

function fill(
  submit = vi.fn(async (): Promise<SubmitOutcome> => ({ kind: 'sent' })),
  draftKey: string | null = 'k',
) {
  render(<FormFill form={FORM} submit={submit} draftKey={draftKey} footer={<p>Footer</p>} />);
  return submit;
}

const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));

describe('a form of two sections', () => {
  it('opens on the first, with its progress, heading and linked description', () => {
    fill();
    expect(screen.getByRole('heading', { name: 'Event RSVP' })).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1');
    expect(screen.getByRole('link', { name: 'https://example.com' })).toBeTruthy();
    expect(screen.getByText('Footer')).toBeTruthy();
  });

  it('holds Next until the section is answered, naming each problem in a summary', () => {
    fill();
    next();
    const summary = screen.getByRole('alert');
    expect(summary.textContent).toContain('One answer needs a look');
    expect(summary.textContent).toContain('Name: This question is required');
    expect(document.activeElement).toBe(summary);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Ada' } });
    expect(screen.queryByRole('alert')).toBeNull();
    next();
    expect(screen.getByRole('heading', { name: 'Food' })).toBeTruthy();
    expect(screen.getByText('Tell us what you eat')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('Ada');
  });

  it('checks a field when it is left, but not an empty one', () => {
    fill();
    const mail = screen.getByLabelText(/^Email/);
    fireEvent.blur(screen.getByLabelText(/^Name/));
    expect(screen.queryByText('This question is required')).toBeNull();
    fireEvent.change(mail, { target: { value: 'nope' } });
    fireEvent.blur(mail);
    expect(screen.getByText('Enter an email address like name@example.com')).toBeTruthy();
    expect(mail.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(mail, { target: { value: 'ada@example.com' } });
    expect(screen.queryByText('Enter an email address like name@example.com')).toBeNull();
  });

  // A press on Next, Back or Submit must not first blur the field: its error line pushed the button out from under the
  // pointer, so the click never landed and the first Submit did nothing.
  it('keeps focus in the field on a press of Next, Back or Submit, so the press is a click', () => {
    fill();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Ada' } });
    // fireEvent returns false when the default (moving focus off the field) was prevented.
    expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Next' }))).toBe(false);
    next();
    expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Back' }))).toBe(false);
    expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'Submit' }))).toBe(false);
  });

  it('sends the answers and the hidden field, then confirms with Submit Another Response', async () => {
    const submit = fill();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Ada' } });
    next();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Vegan' }));
    fireEvent.click(screen.getByRole('radio', { name: '4 stars of 5' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit' })));
    expect(submit).toHaveBeenCalledWith({
      answers: { 'q-name': 'Ada', 'q-diet': ['Vegan'], 'q-rate': 4 },
      other: {},
      website: '',
    });
    expect(screen.getByRole('status').textContent).toContain('See you there!');
    expect(localStorage.getItem('k')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Submit Another Response' }));
    expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('');
  });

  it('keeps what is typed across a reload of the page', () => {
    fill();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Grace' } });
    cleanup();
    fill();
    expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('Grace');
  });
});

describe('the error summary and focus', () => {
  const TWO: PublicForm = {
    heading: 'Bug',
    description: '',
    confirmation: 'Thanks',
    sections: [
      {
        id: 's-1',
        title: '',
        questions: [
          { id: 'q-a', type: 'short', prompt: 'Summary', required: true },
          { id: 'q-b', type: 'paragraph', prompt: 'What happened', required: true },
        ],
      },
    ],
  };
  const submitTwo = async () => {
    render(
      <FormFill
        form={TWO}
        submit={async () => ({ kind: 'sent' })}
        draftKey={null}
        footer={<p>Footer</p>}
      />,
    );
    return () => act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit' })));
  };

  it('keeps every character typed into a field after a refused Submit, and focus in it', async () => {
    const press = await submitTwo();
    await press();
    expect(document.activeElement).toBe(screen.getByRole('alert'));
    const field = screen.getByLabelText<HTMLInputElement>(/^Summary/);
    field.focus();
    let typed = '';
    for (const ch of 'abcdef') {
      typed += ch;
      fireEvent.change(field, { target: { value: typed } });
      expect(document.activeElement).toBe(field);
    }
    expect(field.value).toBe('abcdef');
    const area = screen.getByLabelText<HTMLTextAreaElement>(/^What happened/);
    area.focus();
    fireEvent.change(area, { target: { value: 'x' } });
    expect(document.activeElement).toBe(area);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('takes focus again on a second refused Submit', async () => {
    const press = await submitTwo();
    await press();
    const field = screen.getByLabelText<HTMLInputElement>(/^Summary/);
    field.focus();
    fireEvent.change(field, { target: { value: 'a' } });
    fireEvent.change(field, { target: { value: '' } });
    await press();
    expect(document.activeElement).toBe(screen.getByRole('alert'));
  });

  it('takes focus when the server turns an answer away', async () => {
    const field = (
      <FormFill
        form={TWO}
        submit={async () => ({ kind: 'invalid', errors: { 'q-a': 'required' } })}
        draftKey={null}
      />
    );
    render(field);
    fireEvent.change(screen.getByLabelText(/^Summary/), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText(/^What happened/), { target: { value: 'y' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit' })));
    expect(document.activeElement).toBe(screen.getByRole('alert'));
  });
});

describe('what Submit can be told', () => {
  it('sends once for a double press', async () => {
    let finish: (o: SubmitOutcome) => void = () => {};
    const submit = fill(vi.fn(() => new Promise<SubmitOutcome>((r) => (finish = r))));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Ada' } });
    next();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Vegan' }));
    fireEvent.click(screen.getByRole('radio', { name: '4 stars of 5' }));
    const button = screen.getByRole('button', { name: 'Submit' });
    // Both presses land before React renders the disabled button.
    act(() => {
      button.click();
      button.click();
    });
    await act(async () => finish({ kind: 'sent' }));
    expect(submit).toHaveBeenCalledTimes(1);
  });

  const answerAll = async () => {
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Ada' } });
    next();
    fireEvent.click(screen.getByRole('radio', { name: '5 stars of 5' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit' })));
  };

  it('goes back to the section the api refused, its errors shown', async () => {
    fill(
      vi.fn(async (): Promise<SubmitOutcome> => ({
        kind: 'invalid',
        errors: { 'q-name': 'too_long' },
      })),
    );
    await answerAll();
    expect(screen.getByRole('alert').textContent).toContain('Keep it under 200 characters');
    expect(screen.queryByRole('heading', { name: 'Food' })).toBeNull();
  });

  it('says so when the api refuses without naming a question', async () => {
    fill(vi.fn(async (): Promise<SubmitOutcome> => ({ kind: 'invalid', errors: {} })));
    await answerAll();
    expect(screen.getByRole('alert').textContent).toContain('Some answers could not be accepted');
  });

  it('says a form closed meanwhile, and a failure keeps every answer', async () => {
    fill(vi.fn(async (): Promise<SubmitOutcome> => ({ kind: 'closed' })));
    await answerAll();
    expect(screen.getByRole('status').textContent).toContain('This form has just closed');
    cleanup();
    fill(
      vi.fn(async (): Promise<SubmitOutcome> => ({
        kind: 'failed',
        message: 'Offline, try again.',
      })),
    );
    await answerAll();
    expect(screen.getByRole('alert').textContent).toBe('Offline, try again.');
    expect(screen.getByRole('button', { name: 'Submit' })).toBeTruthy();
  });

  // axe aria-allowed-attr: a group of checkboxes may not carry aria-required (a radiogroup may). Its prompt says
  // "(required)" to a screen reader either way.
  it('marks a required choice group required only where ARIA allows it', () => {
    const form: PublicForm = {
      heading: 'Choices',
      confirmation: 'Thanks',
      sections: [
        {
          id: 's-1',
          title: '',
          questions: [
            {
              id: 'q-one',
              type: 'single',
              prompt: 'Pick one',
              options: ['A', 'B'],
              required: true,
            },
            {
              id: 'q-many',
              type: 'multi',
              prompt: 'Pick some',
              options: ['A', 'B'],
              required: true,
            },
          ],
        },
      ],
    };
    render(<FormFill form={form} submit={vi.fn()} draftKey={null} />);
    expect(screen.getByRole('radiogroup', { name: /Pick one/ }).getAttribute('aria-required')).toBe(
      'true',
    );
    const many = screen.getByRole('group', { name: /Pick some/ });
    expect(many.hasAttribute('aria-required')).toBe(false);
    expect(many.getAttribute('aria-labelledby')).toBeTruthy();
    expect(screen.getByText('Pick some').parentElement?.textContent).toContain('(required)');
  });

  it('in Preview, says nothing was sent', async () => {
    render(
      <FormFill form={FORM} preview draftKey={null} submit={async () => ({ kind: 'sent' })} />,
    );
    await answerAll();
    expect(screen.getByRole('status').textContent).toContain(
      'This is a preview: nothing was sent.',
    );
  });
});

// Clear Answer and the limit on a text answer (forms.md "Filling in a form").
describe('answers that can be taken back, and text near its limit', () => {
  const PICKS: PublicForm = {
    heading: 'Feedback',
    confirmation: 'Thanks',
    sections: [
      {
        id: 's-1',
        title: '',
        questions: [
          { id: 'q-size', type: 'single', prompt: 'Size', options: ['S', 'M'] },
          {
            id: 'q-must',
            type: 'single',
            prompt: 'Colourway',
            options: ['Crimson', 'Navy'],
            required: true,
          },
          {
            id: 'q-drop',
            type: 'single',
            prompt: 'Country',
            options: ['UK', 'FR'],
            dropdown: true,
          },
          { id: 'q-stars', type: 'rating', prompt: 'Stars', scale: 5, style: 'stars' },
          { id: 'q-hue', type: 'colour', prompt: 'Hue' },
          { id: 'q-note', type: 'short', prompt: 'Note' },
          { id: 'q-tick', type: 'checkbox', prompt: 'Agree' },
        ],
      },
    ],
  };
  // What Submit sent, once it has.
  const sentAnswers: { now: Record<string, unknown> | null } = { now: null };
  const open = () => {
    sentAnswers.now = null;
    render(
      <FormFill
        form={PICKS}
        submit={async (state): Promise<SubmitOutcome> => {
          sentAnswers.now = state.answers;
          return { kind: 'sent' };
        }}
        draftKey={null}
      />,
    );
  };
  const clear = (prompt: string) =>
    screen.queryByRole('button', { name: `Clear Answer: ${prompt}` });

  it('offers Clear Answer only once an optional pick is made, and takes the pick back', async () => {
    open();
    expect(screen.queryByRole('button', { name: /^Clear Answer/ })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'M' }));
    fireEvent.click(screen.getByRole('radio', { name: '4 stars of 5' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Teal' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Crimson' }));
    fireEvent.change(screen.getByLabelText(/^Country/), { target: { value: 'UK' } });
    fireEvent.change(screen.getByLabelText(/^Note/), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('checkbox'));
    // A required pick, a dropdown (it has Choose…), text and a tick box have no Clear Answer.
    expect(screen.getAllByRole('button', { name: /^Clear Answer/ })).toHaveLength(3);
    fireEvent.click(clear('Size')!);
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'M' }).checked).toBe(false);
    expect(clear('Size')).toBeNull();
    // Focus goes back to the question's first choice, not to the page.
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'S' }));
    fireEvent.click(clear('Stars')!);
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: '1 star of 5' }));
    fireEvent.click(clear('Hue')!);
    expect(screen.queryByRole('button', { name: /^Clear Answer/ })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    });
    const sent = sentAnswers.now!;
    expect(sent['q-size']).toBe('');
    expect(sent['q-stars']).toBeUndefined();
    expect(sent['q-hue']).toBeUndefined();
    expect(sent['q-must']).toBe('Crimson');
  });

  it('counts a text answer as it nears its limit, and says so at the limit', () => {
    open();
    const note = screen.getByLabelText(/^Note/);
    fireEvent.change(note, { target: { value: 'a'.repeat(100) } });
    expect(screen.queryByText(/of 200 characters/)).toBeNull();
    fireEvent.change(note, { target: { value: 'a'.repeat(170) } });
    expect(screen.getByText('170 of 200 characters')).toBeTruthy();
    fireEvent.change(note, { target: { value: 'a'.repeat(200) } });
    expect(screen.getByText('200 of 200 characters: nothing more is kept')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Character limit reached');
  });
});

// Answers kept in the browser, Clear Form and Enter (forms.md "Filling in a form").
describe('answers kept in this browser', () => {
  const stored = () =>
    JSON.parse(localStorage.getItem('k') ?? 'null') as { answers: object } | null;
  const keep = (answers: object, at: number) =>
    localStorage.setItem('k', JSON.stringify({ answers, other: {}, at }));

  it('keeps nothing for a form only opened, and what is typed once something is', () => {
    fill();
    expect(localStorage.getItem('k')).toBeNull();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Ada' } });
    expect(stored()!.answers).toEqual({ 'q-name': 'Ada' });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: '' } });
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('brings back answers from an earlier visit and says so, until Start Again', () => {
    keep({ 'q-name': 'Ada' }, Date.now() - 60 * 60 * 1000);
    fill();
    expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('Ada');
    expect(screen.getByText(/Your answers from earlier are still here/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start Again' }));
    expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('');
    expect(screen.queryByText(/Your answers from earlier/)).toBeNull();
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('drops answers kept more than a day ago, with no time, or from the future', () => {
    for (const at of [Date.now() - 25 * 60 * 60 * 1000, undefined, Date.now() + 60_000]) {
      localStorage.setItem('k', JSON.stringify({ answers: { 'q-name': 'Old' }, other: {}, at }));
      fill();
      expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('');
      expect(screen.queryByText(/Your answers from earlier/)).toBeNull();
      expect(localStorage.getItem('k')).toBeNull();
      cleanup();
    }
    localStorage.setItem('k', '{broken');
    fill();
    expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('');
  });

  it('offers Clear Form once something is answered, and asks before it empties the form', () => {
    fill();
    expect(screen.queryByRole('button', { name: 'Clear Form' })).toBeNull();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Ada' } });
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Form' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.getByRole('heading', { name: 'Food' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Form' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    // Back at the first section, empty, with nothing kept.
    expect(screen.getByLabelText<HTMLInputElement>(/^Name/).value).toBe('');
    expect(localStorage.getItem('k')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear Form' })).toBeNull();
  });

  it('does not say answers were kept after Submit Another Response', async () => {
    keep({ 'q-name': 'Ada', 'q-rate': 4 }, Date.now());
    fill();
    next();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Submit' })));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Another Response' }));
    expect(screen.queryByText(/Your answers from earlier/)).toBeNull();
  });
});

describe('Enter in a one-line answer', () => {
  it('moves to the next answer, then to Next, and never sends the form', () => {
    const submit = fill();
    const name = screen.getByLabelText(/^Name/);
    name.focus();
    expect(fireEvent.keyDown(name, { key: 'Enter' })).toBe(false);
    expect(document.activeElement).toBe(screen.getByLabelText(/^Email/));
    fireEvent.keyDown(screen.getByLabelText(/^Email/), { key: 'Enter' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next' }));
    expect(submit).not.toHaveBeenCalled();
  });

  it('leaves Enter alone with a modifier, while composing, and outside a one-line box', () => {
    fill();
    const name = screen.getByLabelText(/^Name/);
    name.focus();
    expect(fireEvent.keyDown(name, { key: 'Enter', shiftKey: true })).toBe(true);
    expect(fireEvent.keyDown(name, { key: 'Enter', isComposing: true })).toBe(true);
    expect(fireEvent.keyDown(name, { key: 'a' })).toBe(true);
    expect(fireEvent.keyDown(screen.getByRole('button', { name: 'Next' }), { key: 'Enter' })).toBe(
      true,
    );
    expect(document.activeElement).toBe(name);
  });
});
