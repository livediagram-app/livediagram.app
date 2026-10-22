import { describe, expect, it } from 'vitest';
import type { FormLinkResponse } from '@liveplanner/api-schema';
import { OTHER_ANSWER, SHORT_ANSWER_MAX, type FormDefinition } from '@liveplanner/forms';
import { fakeApi } from '../testing/fake-api';
import { bugForm, firstStatus, formPlan, formTabBody } from '../testing/forms';
import { tryForm } from './form-try';

// try_form (docs/specs/030-forms/forms.md "Agents"): the answers checked as the form link checks them, then the card or
// row a response makes, titled "Preview: ...": through the api's form-preview when the form is published or goes to a
// sheet, else a card made through the items route, as the editor's Preview makes it.
const PUBLISHED: FormLinkResponse = {
  link: { code: 'AbCdEfGhIjKlMnOpQrStUv', open: true, createdAt: 1 },
  responses: 4,
  unseen: 0,
  suspendedAt: null,
  canPublish: true,
};
const UNPUBLISHED: FormLinkResponse = { ...PUBLISHED, link: null, responses: 0 };

function api(
  form: FormDefinition = bugForm(),
  link: FormLinkResponse = UNPUBLISHED,
  preview: (body: unknown) => Response = () => Response.json({ number: 5 }, { status: 201 }),
) {
  const writes: { path: string; body: unknown }[] = [];
  const write = (answer: (body: unknown) => Response) => async (r: Request) => {
    const body: unknown = await r.json();
    writes.push({ path: new URL(r.url).pathname.replace(/^\/api/, ''), body });
    return answer(body);
  };
  const client = fakeApi({
    '/projects/doc/plan': formPlan(),
    '/projects/doc/tabs/form': { tab: formTabBody(form) },
    '/projects/doc/tabs/form/form-link': link,
    '/projects/doc/tabs/form/form-preview': write(preview),
    '/projects/doc/items': write((body) =>
      Response.json({
        item: { id: 'item-1', fields: (body as { fields: Record<string, unknown> }).fields },
        rev: 2,
      }),
    ),
  });
  return { client, writes };
}

describe('tryForm', () => {
  it('makes an unpublished board form’s card itself, titled Preview, its answers mapped', async () => {
    const { client, writes } = api();
    const r = await tryForm(client, 'doc', undefined, {
      Summary: 'Login button does nothing',
      'q-sev': 'High',
    });
    expect(r).toEqual({
      ok: true,
      projectId: 'doc',
      tabId: 'form',
      made: 'card',
      number: null,
      where: expect.stringMatching(/^the ".+" board, column .+$/),
      title: 'Preview: Login button does nothing',
      itemId: 'item-1',
      lines: [],
    });
    expect(writes).toEqual([
      {
        path: '/projects/doc/items',
        body: {
          type: 'bug',
          fields: expect.objectContaining({
            title: 'Preview: Login button does nothing',
            'f-severity': 'High',
          }),
          place: { status: firstStatus() },
        },
      },
    ]);
  });

  it('sends a published form’s preview to the api, which counts it', async () => {
    const { client, writes } = api(bugForm(), PUBLISHED);
    const r = await tryForm(client, 'doc', 'Bug Report', {
      summary: 'Crash',
      'Can we contact you?': true,
    });
    expect(r).toMatchObject({
      ok: true,
      made: 'card',
      number: 5,
      title: 'Preview: Crash',
      itemId: null,
    });
    expect(writes).toEqual([
      {
        path: '/projects/doc/tabs/form/form-preview',
        body: { answers: { 'q-sum': 'Crash', 'q-ok': true }, other: {} },
      },
    ]);
  });

  it('refuses wrong answers with why and the options there are, sending nothing', async () => {
    const { client, writes } = api();
    const r = await tryForm(client, 'doc', undefined, { 'q-sev': 'Medium' });
    expect(r).toEqual({
      ok: false,
      code: 'invalid_answers',
      message:
        'Nothing was sent. "Summary" (q-sum): This question is required. "Severity" (q-sev): Pick one of the options (options: "Low", "High").',
    });
    expect(writes).toEqual([]);
  });

  it('refuses a question it does not have, naming the ones there are', async () => {
    const { client } = api();
    const r = await tryForm(client, 'doc', undefined, { Colour: 'Red' });
    expect(r).toMatchObject({ ok: false, code: 'question_unknown' });
    expect(!r.ok && r.message).toContain('Summary (q-sum)');
  });

  it('takes text that is no option as a choice’s Other answer', async () => {
    const form = bugForm();
    const [, sev] = form.sections[0]!.questions;
    form.sections[0]!.questions[1] = { ...sev!, other: true };
    form.sections[0]!.questions.push({
      id: 'q-os',
      type: 'multi',
      prompt: 'Systems',
      options: ['Mac', 'Windows'],
      other: true,
    });
    const { client, writes } = api(form, PUBLISHED);
    await tryForm(client, 'doc', undefined, {
      Summary: 'x',
      Severity: 'Blocker',
      Systems: ['Mac', 'ChromeOS'],
    });
    expect(writes[0]!.body).toEqual({
      answers: { 'q-sum': 'x', 'q-sev': OTHER_ANSWER, 'q-os': ['Mac', OTHER_ANSWER] },
      other: { 'q-sev': 'Blocker', 'q-os': 'ChromeOS' },
    });
  });

  it('says which answers it left out because their section did not show', async () => {
    const form = bugForm();
    form.sections.push({
      id: 's-2',
      title: 'Details',
      showIf: { questionId: 'q-sev', anyOf: ['High'] },
      questions: [{ id: 'q-steps', type: 'paragraph', prompt: 'Steps' }],
    });
    const { client } = api(form);
    const r = await tryForm(client, 'doc', undefined, {
      Summary: 'x',
      Severity: 'Low',
      Steps: 'Click',
    });
    expect(r.ok && r.lines).toEqual([
      '"Steps" (q-steps) was left out: its section does not show for these answers',
    ]);
  });

  it('writes a sheet form’s row through the api, published or not, a row having no title', async () => {
    const form: FormDefinition = {
      ...bugForm(),
      destination: undefined,
      sheet: { tabId: 'budget', sheetId: 'sheet_budget' },
    };
    const { client, writes } = api(form, UNPUBLISHED, () =>
      Response.json({ number: 0 }, { status: 201 }),
    );
    const r = await tryForm(client, 'doc', undefined, { Summary: 'x' });
    expect(r).toMatchObject({
      ok: true,
      made: 'row',
      number: null,
      where: 'the sheet "Budget"',
      title: null,
    });
    expect(writes.map((w) => w.path)).toEqual(['/projects/doc/tabs/form/form-preview']);
  });

  it('refuses a form whose responses go nowhere, and an unpublished one whose board is gone', async () => {
    const { client } = api({ ...bugForm(), destination: undefined });
    const r = await tryForm(client, 'doc', undefined, { Summary: 'x' });
    expect(r).toMatchObject({ ok: false, code: 'form_destination_missing' });
    const gone = { ...bugForm(), destination: { tabId: 'bugs', typeId: 'bug', status: 'nowhere' } };
    const unpublished = api(gone);
    expect(await tryForm(unpublished.client, 'doc', undefined, { Summary: 'x' })).toMatchObject({
      ok: false,
      code: 'form_destination_missing',
    });
    expect(unpublished.writes).toEqual([]);
    // Published, the api decides: it answers form_closed when the board is gone.
    const published = api(gone, PUBLISHED);
    expect(await tryForm(published.client, 'doc', undefined, { Summary: 'x' })).toMatchObject({
      ok: true,
      where: 'its board',
    });
  });

  it('words the api’s own refusals: answers checked again, a destination gone', async () => {
    const changed = api(bugForm(), PUBLISHED, () =>
      Response.json({ error: 'invalid_answers', errors: { 'q-sum': 'too_long' } }, { status: 400 }),
    );
    expect(await tryForm(changed.client, 'doc', undefined, { Summary: 'x' })).toEqual({
      ok: false,
      code: 'invalid_answers',
      message: `Nothing was sent. "Summary" (q-sum): Keep it under ${SHORT_ANSWER_MAX} characters.`,
    });
    const gone = api(bugForm(), PUBLISHED, () =>
      Response.json({ error: 'form_closed' }, { status: 409 }),
    );
    const r = await tryForm(gone.client, 'doc', undefined, { Summary: 'x' });
    expect(r).toMatchObject({ ok: false, code: 'form_closed' });
    expect(!r.ok && r.message).toContain('read_form lists the problem');
  });

  it('names the Form tab it cannot find, and takes no answers as none', async () => {
    const { client } = api();
    expect(await tryForm(client, 'doc', 'Nope', {})).toMatchObject({
      ok: false,
      code: 'form_tab_unknown',
    });
    // An MCP call with its answers left out: every question unanswered, the required one refused.
    expect(await tryForm(client, 'doc', undefined, undefined as never)).toMatchObject({
      ok: false,
      code: 'invalid_answers',
    });
  });

  it('keeps options picked on a choice with Other as they are, and says Other takes any text', async () => {
    const form = bugForm();
    form.sections[0]!.questions.push(
      { id: 'q-os', type: 'multi', prompt: 'Systems', options: ['Mac', 'Windows'], other: true },
      { id: 'q-ch', type: 'single', prompt: 'Channel', options: ['Web', 'App'], other: true },
    );
    const { client, writes } = api(form, PUBLISHED);
    await tryForm(client, 'doc', undefined, { Summary: 'x', Systems: ['Mac', 'Windows'] });
    expect(writes[0]!.body).toEqual({
      answers: { 'q-sum': 'x', 'q-os': ['Mac', 'Windows'] },
      other: {},
    });
    const r = await tryForm(client, 'doc', undefined, { Summary: 'x', Channel: 3 });
    expect(!r.ok && r.message).toContain('(options: "Web", "App", or any other text)');
  });

  it('says where a sheet form’s row went when the plan does not show its sheet', async () => {
    const form: FormDefinition = {
      ...bugForm(),
      destination: undefined,
      sheet: { tabId: 'gone', sheetId: 'sheet_gone' },
    };
    const { client } = api(form, PUBLISHED);
    expect(await tryForm(client, 'doc', undefined, { Summary: 'x' })).toMatchObject({
      ok: true,
      made: 'row',
      number: 5,
      where: 'its sheet',
    });
  });

  it('words an api refusal of answers it lists no errors for, or errors for questions it lacks', async () => {
    const bare = api(bugForm(), PUBLISHED, () =>
      Response.json({ error: 'invalid_answers' }, { status: 400 }),
    );
    expect(await tryForm(bare.client, 'doc', undefined, { Summary: 'x' })).toEqual({
      ok: false,
      code: 'invalid_answers',
      message:
        'Nothing was sent: the form refused the answers. Read it again with read_form, then try again.',
    });
    const removed = api(bugForm(), PUBLISHED, () =>
      Response.json({ error: 'invalid_answers', errors: { 'q-new': 'required' } }, { status: 400 }),
    );
    expect(await tryForm(removed.client, 'doc', undefined, { Summary: 'x' })).toMatchObject({
      message: 'Nothing was sent. q-new: required.',
    });
  });
});
