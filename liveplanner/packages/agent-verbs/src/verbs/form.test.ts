import { describe, expect, it } from 'vitest';
import { VerbRefusal } from '../define';
import { contextOf, DOC_A, fakeApi, library } from '../testing/fake-api';
import { formPlan, formTabBody } from '../testing/forms';
import { formAdd, formChange, formGet, formShare, formTry } from './form';

// The form verbs (docs/specs/030-forms/forms.md "Agents"; docs/specs/015-api/cli.md "Commands").
const plan = formPlan();
const LINK = {
  link: { code: 'AbCdEfGhIjKlMnOpQrStUv', open: false, createdAt: 1 },
  responses: 4,
  unseen: 0,
  suspendedAt: null,
  canPublish: true,
};

function ctxWith(input = '', planOf = plan) {
  const writes: string[] = [];
  const base = `/projects/${DOC_A}`;
  const routes: Record<string, unknown> = {
    ...library,
    // The library lists on a GET; a new project is made on a POST.
    '/projects': (r: Request) =>
      r.method === 'POST'
        ? Response.json({ project: { id: 'new' } }, { status: 201 })
        : Response.json((library as Record<string, unknown>)['/projects']),
    [`${base}/item-types`]: { ok: true },
    [base]: {
      project: {
        id: DOC_A,
        name: 'Auth flow',
        tabs: planOf.tabs!.map((t, i) => ({ id: t.id, name: t.name, orderIndex: i })),
      },
    },
    [`${base}/plan`]: planOf,
    [`${base}/tabs/form`]: { tab: formTabBody() },
    [`${base}/tabs/form/form-link`]: (r: Request) => {
      if (r.method !== 'GET') writes.push(`${r.method} form-link`);
      return Response.json(
        r.method === 'PUT' ? { ...LINK, link: { ...LINK.link, open: true } } : LINK,
      );
    },
    [`${base}/tabs/form/form-preview`]: (r: Request) => {
      writes.push(`${r.method} form-preview`);
      return Response.json({ number: 5 }, { status: 201 });
    },
    [`${base}/tabs/form/form`]: (r: Request) => {
      writes.push(`${r.method} form`);
      return Response.json({ tabId: 'form', rev: 8, name: 'Bug Report' });
    },
  };
  // A new tab's changeset, on whatever id it was given.
  const api = fakeApi(
    new Proxy(routes, {
      get: (t, k: string) =>
        k in t
          ? t[k]
          : k.endsWith('/changesets')
            ? { changeset: { id: 'cs_1', rev: 1 } }
            : undefined,
      has: (t, k: string) => k in t || k.endsWith('/changesets'),
    }),
  );
  return { ctx: contextOf(api, [], [], { readInput: async () => input }), writes };
}

describe('form get', () => {
  it('prints the state, where responses go and each question with its id', async () => {
    const { ctx } = ctxWith();
    const out = await formGet.run!(ctx, formGet.input.parse({ project: DOC_A }));
    expect(formGet.text!(out)).toEqual([
      'Bug Report  closed  4 responses  https://liveplanner.app/form/AbCdEfGhIjKlMnOpQrStUv',
      'responses: Bug cards in New on Bugs',
      'section 1',
      '  q-sum  short*  Summary  → Title',
      '  q-sev  single  Severity  → Severity',
      '  q-ok  checkbox  Can we contact you?  → Description',
    ]);
    expect(formGet.quiet!(out)).toEqual(['https://liveplanner.app/form/AbCdEfGhIjKlMnOpQrStUv']);
  });
});

describe('form change and share', () => {
  it('applies changes read from stdin', async () => {
    const { ctx, writes } = ctxWith('[{"op":"set_form","heading":"Crash Report"}]');
    const out = await formChange.run!(
      ctx,
      formChange.input.parse({ project: DOC_A, changes: '-' }),
    );
    expect(formChange.text!(out)[0]).toBe('~ changed the form');
    expect(writes).toEqual(['POST form']);
  });

  it('refuses changes that are not JSON, as a usage error', async () => {
    const { ctx } = ctxWith('not json');
    await expect(
      formChange.run!(ctx, formChange.input.parse({ project: DOC_A, changes: '-' })),
    ).rejects.toBeInstanceOf(VerbRefusal);
  });

  it('opens a closed form again', async () => {
    const { ctx, writes } = ctxWith();
    const out = await formShare.run!(
      ctx,
      formShare.input.parse({ project: DOC_A, action: 'publish' }),
    );
    expect(writes).toEqual(['PUT form-link']);
    expect(out.lines).toEqual(['opened again: the same link takes responses']);
  });
});

describe('the form verbs, every path', () => {
  it('prints a sheet form, a form going nowhere, sections with rules, and problems', () => {
    const base = {
      projectId: DOC_A,
      tabId: 'form',
      heading: 'RSVP',
      state: 'not_published',
      link: null,
      responses: 0,
      lines: [],
      made: ['Sheet tab "RSVP Responses" (t1)'],
      problems: ['Add a question: a form needs at least one.'],
    };
    const sheet = formGet.text!({
      ...base,
      respondsTo: { to: 'sheet', sheet: 'RSVP Responses' },
      sections: [
        { id: 's1', place: 1, questions: [] },
        {
          id: 's2',
          place: 2,
          title: 'More',
          showIf: { questionId: 'q', prompt: 'Coming?', anyOf: ['Yes', 'Maybe'] },
          questions: [{ id: 'q2', type: 'short', typeName: 'Short Answer', prompt: 'Name' }],
        },
      ],
    });
    expect(sheet).toEqual([
      '+ Sheet tab "RSVP Responses" (t1)',
      'RSVP  not_published  0 responses',
      'responses: rows in RSVP Responses',
      'section 1',
      'section 2 More (shown when Coming? is Yes or Maybe)',
      '  q2  short  Name',
      '! Add a question: a form needs at least one.',
    ]);
    expect(
      formGet.text!({
        ...base,
        made: [],
        problems: [],
        respondsTo: { to: 'nowhere' },
        sections: [],
      })[1],
    ).toBe('responses: nowhere yet');
    expect(formGet.quiet!({ ...base, respondsTo: {}, sections: [] })).toEqual([]);
    expect(formShare.quiet!({ ...base, respondsTo: {}, sections: [] })).toEqual([]);
    expect(
      formShare.quiet!({ ...base, link: 'https://x/form/a', respondsTo: {}, sections: [] }),
    ).toEqual(['https://x/form/a']);
  });

  it('refuses as the engine refuses: not found for an unknown Form tab, else a refusal', async () => {
    const { ctx } = ctxWith();
    await expect(
      formGet.run!(ctx, formGet.input.parse({ project: DOC_A, tab: 'Nope' })),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      formShare.run!(
        ctx,
        formShare.input.parse({ project: DOC_A, action: 'delete_link', tab: 'Bugs' }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('hints at making a form, not reading one, when the project has no Form tab', async () => {
    const { ctx } = ctxWith('', { ...plan, tabs: plan.tabs!.filter((t) => t.kind !== 'form') });
    await expect(formGet.run!(ctx, formGet.input.parse({ project: DOC_A }))).rejects.toMatchObject({
      status: 404,
      code: 'form_tab_none',
      hint: 'make one with: liveplanner form add <project> --starter contact',
    });
  });

  it('adds a form to a project from a starter, or from a file of add_form input', async () => {
    const { ctx } = ctxWith('{"questions":[{"type":"short","prompt":"Name"}]}');
    const fromFile = await formAdd.run!(
      ctx,
      formAdd.input.parse({ project: DOC_A, from: '-', name: 'Lunch' }),
    );
    expect(fromFile.heading).toBe('Lunch');
    expect(formAdd.quiet!(fromFile)).toEqual([fromFile.tabId]);
    const starter = await formAdd.run!(ctx, formAdd.input.parse({ starter: 'rsvp' }));
    expect(starter.heading).toBe('Event RSVP');
    expect(formChange.quiet!(starter)).toEqual([starter.tabId]);
  });
});

describe('form try', () => {
  it('sends answers read from stdin as a counted preview of a published form', async () => {
    const { ctx, writes } = ctxWith('{"Summary": "Crash on save", "Severity": "High"}');
    const out = await formTry.run!(ctx, formTry.input.parse({ project: DOC_A, answers: '-' }));
    expect(writes).toEqual(['POST form-preview']);
    expect(formTry.text!(out)).toEqual([
      expect.stringMatching(
        /^\+ card "Preview: Crash on save" in the ".+" board, column .+, response #5$/,
      ),
    ]);
    expect(formTry.quiet!(out)).toEqual([]);
  });

  it('refuses a wrong answer, with the fix, sending nothing', async () => {
    const { ctx, writes } = ctxWith('{"Severity": "Medium"}');
    await expect(
      formTry.run!(ctx, formTry.input.parse({ project: DOC_A, answers: '-' })),
    ).rejects.toMatchObject({ code: 'invalid_answers' });
    await expect(
      formTry.run!(ctx, formTry.input.parse({ project: DOC_A, answers: '-' })),
    ).rejects.toBeInstanceOf(VerbRefusal);
    expect(writes).toEqual([]);
  });

  it('refuses answers that are not JSON', async () => {
    const { ctx } = ctxWith('Summary: x');
    await expect(
      formTry.run!(ctx, formTry.input.parse({ project: DOC_A, answers: '-' })),
    ).rejects.toMatchObject({ code: 'usage' });
  });

  it('prints a row, uncounted, after what it left out', () => {
    expect(
      formTry.text!({
        projectId: 'd',
        tabId: 'form',
        made: 'row',
        number: null,
        where: 'the sheet "Budget"',
        title: null,
        itemId: 'i1',
        lines: ['"Steps" (q-steps) was left out: its section does not show for these answers'],
      }),
    ).toEqual([
      '~ "Steps" (q-steps) was left out: its section does not show for these answers',
      '+ row in the sheet "Budget", not counted',
    ]);
  });

  it('names an unknown Form tab as not found, and prints a card it made by its id', async () => {
    const { ctx } = ctxWith('{"Summary": "x"}');
    await expect(
      formTry.run!(ctx, formTry.input.parse({ project: DOC_A, answers: '-', tab: 'Nope' })),
    ).rejects.toMatchObject({ status: 404, code: 'form_tab_unknown' });
    expect(
      formTry.quiet!({
        projectId: 'd',
        tabId: 'form',
        made: 'card',
        number: null,
        where: 'w',
        title: 'Preview: x',
        itemId: 'i1',
        lines: [],
      }),
    ).toEqual(['i1']);
  });
});
