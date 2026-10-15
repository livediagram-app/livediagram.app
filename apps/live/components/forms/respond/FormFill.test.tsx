// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PublicForm } from '@livediagram/forms';
import { FormFill } from './FormFill';
import type { SubmitOutcome } from './useFormFill';

// Filling in a form (docs/specs/030-forms/forms.md "Filling in a form"): sections, checks, the error summary, Submit
// and every answer it can get, the confirmation, and answers kept while filling in.

const FORM: PublicForm = {
  heading: 'Event RSVP',
  description: 'See https://example.com for details',
  accent: '#7c3aed',
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
beforeEach(() => sessionStorage.clear());

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
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Ada');
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
    expect(sessionStorage.getItem('k')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Submit Another Response' }));
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('');
  });

  it('keeps what is typed across a reload of the page', () => {
    fill();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Grace' } });
    cleanup();
    fill();
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Grace');
  });
});

describe('what Submit can be told', () => {
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
