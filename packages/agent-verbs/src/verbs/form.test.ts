import { describe, expect, it } from 'vitest';
import { VerbRefusal } from '../define';
import { contextOf, DOC_A, fakeApi, library } from '../testing/fake-api';
import { formPlan, formTabBody } from '../testing/forms';
import { formChange, formGet, formShare } from './form';

// The form verbs (docs/specs/030-forms/forms.md "Agents"; docs/specs/015-api/cli.md "Commands").
const plan = formPlan();
const LINK = {
  link: { code: 'AbCdEfGhIjKlMnOpQrStUv', open: false, createdAt: 1 },
  responses: 4,
  unseen: 0,
  suspendedAt: null,
  canPublish: true,
};

function ctxWith(input = '') {
  const writes: string[] = [];
  const base = `/documents/${DOC_A}`;
  const api = fakeApi({
    ...library,
    [base]: {
      document: {
        id: DOC_A,
        name: 'Auth flow',
        tabs: plan.tabs!.map((t, i) => ({ id: t.id, name: t.name, orderIndex: i })),
      },
    },
    [`${base}/plan`]: plan,
    [`${base}/tabs/form`]: { tab: formTabBody() },
    [`${base}/tabs/form/form-link`]: (r: Request) => {
      if (r.method !== 'GET') writes.push(`${r.method} form-link`);
      return Response.json(
        r.method === 'PUT' ? { ...LINK, link: { ...LINK.link, open: true } } : LINK,
      );
    },
    [`${base}/tabs/form/form`]: (r: Request) => {
      writes.push(`${r.method} form`);
      return Response.json({ tabId: 'form', rev: 8, name: 'Bug Report' });
    },
  });
  return { ctx: contextOf(api, [], [], { readInput: async () => input }), writes };
}

describe('form get', () => {
  it('prints the state, where responses go and each question with its id', async () => {
    const { ctx } = ctxWith();
    const out = await formGet.run!(ctx, formGet.input.parse({ doc: DOC_A }));
    expect(formGet.text!(out)).toEqual([
      'Bug Report  closed  4 responses  https://livediagram.app/form/AbCdEfGhIjKlMnOpQrStUv',
      'responses: Bug cards in New on Bugs',
      'section 1',
      '  q-sum  short*  Summary  → Title',
      '  q-sev  single  Severity  → Severity',
      '  q-ok  checkbox  Can we contact you?  → Description',
    ]);
    expect(formGet.quiet!(out)).toEqual(['https://livediagram.app/form/AbCdEfGhIjKlMnOpQrStUv']);
  });
});

describe('form change and share', () => {
  it('applies changes read from stdin', async () => {
    const { ctx, writes } = ctxWith('[{"op":"set_form","heading":"Crash Report"}]');
    const out = await formChange.run!(ctx, formChange.input.parse({ doc: DOC_A, changes: '-' }));
    expect(formChange.text!(out)[0]).toBe('~ changed the form');
    expect(writes).toEqual(['POST form']);
  });

  it('refuses changes that are not JSON, as a usage error', async () => {
    const { ctx } = ctxWith('not json');
    await expect(
      formChange.run!(ctx, formChange.input.parse({ doc: DOC_A, changes: '-' })),
    ).rejects.toBeInstanceOf(VerbRefusal);
  });

  it('opens a closed form again', async () => {
    const { ctx, writes } = ctxWith();
    const out = await formShare.run!(ctx, formShare.input.parse({ doc: DOC_A, action: 'publish' }));
    expect(writes).toEqual(['PUT form-link']);
    expect(out.lines).toEqual(['opened again: the same link takes responses']);
  });
});
