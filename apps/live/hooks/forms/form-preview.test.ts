import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemCreate, ItemTypeDef } from '@livediagram/items';
import { FROM_FORM_FIELD, type FormDefinition } from '@livediagram/forms';
import { PREVIEW_FAILED, PREVIEW_NO_DESTINATION, sendPreview } from './form-preview';

const track = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...a: unknown[]) => track(...a) }));

// Submit in the builder's Preview (docs/specs/030-forms/forms.md "Preview").

const type: ItemTypeDef = {
  id: 'bug',
  label: 'Bug',
  newTitle: 'New bug',
  glyph: 'bug',
  color: '#dc2626',
  fields: ['title', 'status', 'description'],
};
const form: FormDefinition = {
  v: 1,
  heading: 'Bug Report',
  sections: [
    {
      id: 's',
      title: '',
      questions: [
        { id: 'q-t', type: 'short', prompt: 'Summary', required: true, goesTo: { to: 'title' } },
        { id: 'q-d', type: 'paragraph', prompt: 'What happened?' },
      ],
    },
  ],
  destination: { tabId: 'board', typeId: 'bug', status: 'triage' },
};

beforeEach(() => track.mockClear());

const send = (over: Partial<Parameters<typeof sendPreview>[0]> = {}) => {
  const made: ItemCreate[] = [];
  const result = sendPreview({
    form,
    tabId: 'tab-f',
    type,
    problem: null,
    addItems: async (creates) => {
      made.push(...creates);
      return true;
    },
    state: { answers: { 'q-t': 'Login fails', 'q-d': 'On Safari' }, other: {} },
    ...over,
  });
  return { made, result };
};

describe('sendPreview', () => {
  it('makes the card a response would, titled Preview and not counted as one', async () => {
    const { made, result } = send();
    expect(await result).toEqual({ kind: 'sent' });
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({
      type: 'bug',
      place: { status: 'triage' },
      fields: { title: 'Preview: Login fails', description: 'What happened?\nOn Safari' },
    });
    expect(made[0]!.fields).not.toHaveProperty(FROM_FORM_FIELD);
    expect(track).toHaveBeenCalledWith('Form', 'Sent', 'Preview');
  });

  it('refuses answers the api would refuse, making nothing', async () => {
    const { made, result } = send({ state: { answers: {}, other: {} } });
    expect(await result).toEqual({ kind: 'invalid', errors: { 'q-t': 'required' } });
    expect(made).toEqual([]);
  });

  it('says Responses Go To needs a board when the destination cannot take a card', async () => {
    for (const over of [{ problem: 'no_board' }, { type: undefined }, { addItems: undefined }]) {
      expect(await send(over).result).toEqual({ kind: 'failed', message: PREVIEW_NO_DESTINATION });
    }
    expect(track).not.toHaveBeenCalled();
  });

  it('says so when the card could not be made', async () => {
    const { result } = send({ addItems: async () => false });
    expect(await result).toEqual({ kind: 'failed', message: PREVIEW_FAILED });
  });

  it('sends a published form’s preview through its link, counted there, and says what it answered', async () => {
    const link = vi.fn(async () => ({ kind: 'sent' as const }));
    const { made, result } = send({ sendToLink: link });
    expect(await result).toEqual({ kind: 'sent' });
    expect(made).toEqual([]);
    // The api counts it: no second count here.
    expect(track).not.toHaveBeenCalled();
    expect(
      await send({
        sendToLink: async () => ({ kind: 'invalid', errors: { 'q-t': 'required' } }),
      }).result,
    ).toEqual({ kind: 'invalid', errors: { 'q-t': 'required' } });
    expect(await send({ sendToLink: async () => ({ kind: 'failed' }) }).result).toEqual({
      kind: 'failed',
      message: PREVIEW_FAILED,
    });
  });

  it('makes the card itself when the form has no link yet', async () => {
    const { made, result } = send({ sendToLink: async () => ({ kind: 'not_published' }) });
    expect(await result).toEqual({ kind: 'sent' });
    expect(made[0]!.fields['title']).toBe('Preview: Login fails');
  });

  it('sends a Sheet form’s preview through the api, and fails with no way to reach it', async () => {
    const toSheet = { ...form, sheet: { tabId: 'st', sheetId: 'AAAAAAAAAAA1' } };
    expect(
      await send({ form: toSheet, sendToLink: async () => ({ kind: 'sent' }) }).result,
    ).toEqual({ kind: 'sent' });
    const { made, result } = send({ form: toSheet });
    expect(await result).toEqual({ kind: 'failed', message: PREVIEW_FAILED });
    expect(made).toEqual([]);
  });
});
