// @vitest-environment jsdom
// docs/specs/030-forms/describe-a-form.md: the dialog (an example, the count, Ctrl / ⌘ Enter), a refusal said in the
// api's fixed words, the guest's sign-in nudge, Check Your Form's questions and Responses Go To (the draft's choice,
// or where the form sends responses now, first), Create Form handing the draft and the target up, and Back.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FORM_DRAFT_OFF_TOPIC, readFormDraft, type FormDraft } from '@liveplanner/forms';
import type { FormDraftResponse } from '@liveplanner/api-schema';
import { formDraftTargets } from '@liveplanner/templates';
import { createShape, type Tab } from '@liveplanner/project';
import { presetSetup } from '@liveplanner/items';
import {
  DESCRIBE_FORM_EXAMPLES,
  DESCRIBE_FORM_FAILED,
  DESCRIBE_FORM_SIGN_IN,
  DescribeFormDialog,
} from './DescribeFormDialog';
import { FormDraftRefusal } from './form-draft-client';

const read = readFormDraft(
  {
    outcome: 'form',
    form: {
      heading: 'Summer Party RSVP',
      respondsTo: 'sheet',
      sections: [
        {
          questions: [
            { type: 'short', prompt: 'Your name', required: true },
            { type: 'single', prompt: 'Are you coming?', options: ['Yes', 'No'] },
          ],
        },
      ],
    },
  },
  'rsvp',
);
const DRAFT = (read as { draft: FormDraft }).draft;

const triage: Tab = {
  id: 'triage',
  name: 'Triage',
  kind: 'board',
  elements: [{ ...createShape('plan-board', 0, 0), id: 'el-1', planBoard: presetSetup('kanban') }],
};
const OPTIONS = formDraftTargets([triage], 'form');

function mount(
  opts: {
    signedIn?: boolean;
    draft?: (prompt: string) => Promise<FormDraftResponse>;
    current?: Parameters<typeof DescribeFormDialog>[0]['current'];
  } = {},
) {
  const draft = vi.fn(opts.draft ?? (async () => ({ draft: DRAFT })));
  const onCreate = vi.fn(() => null);
  const onClose = vi.fn();
  render(
    <DescribeFormDialog
      signedIn={opts.signedIn ?? true}
      signInHref="/sign-in/"
      draft={draft}
      options={OPTIONS}
      current={opts.current}
      typeLabelFor={(h) => h}
      onCreate={onCreate}
      onClose={onClose}
    />,
  );
  return { draft, onCreate, onClose };
}

const box = () => screen.getByRole('textbox', { name: 'Describe the form' });
const button = (name: string | RegExp) => screen.getByRole('button', { name });

describe('Describe a Form', () => {
  it('fills the box from an example, counts it, drafts with Ctrl Enter and shows the questions', async () => {
    const { draft } = mount();
    expect(button(/Draft Form/).hasAttribute('disabled')).toBe(true);
    fireEvent.click(button(DESCRIBE_FORM_EXAMPLES[0]!.label));
    expect(screen.getByText(`${DESCRIBE_FORM_EXAMPLES[0]!.text.length} / 500`)).toBeTruthy();
    expect(screen.getByText('Uses AI: plans and forms share 10 drafts a day.')).toBeTruthy();
    fireEvent.keyDown(box(), { key: 'Enter', ctrlKey: true });
    expect(draft).toHaveBeenCalledWith(DESCRIBE_FORM_EXAMPLES[0]!.text);
    await screen.findByText('Check Your Form');
    expect(screen.getByText('Summer Party RSVP')).toBeTruthy();
    expect(screen.getByText('Are you coming?')).toBeTruthy();
    expect(screen.getByText('Single Choice')).toBeTruthy();
    // The draft said a sheet.
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe('new-sheet');
    expect(screen.getByText('A column for each question.')).toBeTruthy();
  });

  it('creates the form with the chosen target, and Back keeps the words', async () => {
    const { onCreate } = mount();
    fireEvent.change(box(), { target: { value: 'an rsvp' } });
    fireEvent.click(button(/Draft Form/));
    await screen.findByText('Check Your Form');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'board:el-1' } });
    expect(
      screen.getByText('A new card type, “Summer Party RSVP”, with a field for each question.'),
    ).toBeTruthy();
    fireEvent.click(button('Create Form'));
    expect(onCreate).toHaveBeenCalledWith(DRAFT, {
      to: 'board',
      tabId: 'triage',
      elementId: 'el-1',
    });
    fireEvent.click(button('Back'));
    expect((box() as HTMLTextAreaElement).value).toBe('an rsvp');
  });

  it('selects where the form sends responses now first', async () => {
    mount({ current: { destination: { tabId: 'triage', typeId: 'task', status: 'todo' } } });
    fireEvent.change(box(), { target: { value: 'an rsvp' } });
    fireEvent.click(button(/Draft Form/));
    await screen.findByText('Check Your Form');
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe('board:el-1');
  });

  it('says a refusal in the api’s words, and anything else in its own', async () => {
    let fail: Error = new FormDraftRefusal(422, 'form_draft_off_topic', FORM_DRAFT_OFF_TOPIC);
    mount({
      draft: async () => {
        throw fail;
      },
    });
    fireEvent.change(box(), { target: { value: 'tell me a joke' } });
    fireEvent.click(button(/Draft Form/));
    expect((await screen.findByRole('alert')).textContent).toBe(FORM_DRAFT_OFF_TOPIC);
    fail = new Error('network');
    fireEvent.click(button(/Draft Form/));
    expect((await screen.findByRole('alert')).textContent).toBe(DESCRIBE_FORM_FAILED);
    expect((box() as HTMLTextAreaElement).value).toBe('tell me a joke');
  });

  it('shows a guest the sign-in nudge in the box’s place', () => {
    const { draft } = mount({ signedIn: false });
    expect(screen.getByText(DESCRIBE_FORM_SIGN_IN)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(button('Sign In')).toBeTruthy();
    expect(draft).not.toHaveBeenCalled();
  });
});
