import { describe, expect, it } from 'vitest';
import { ApiError } from '@livediagram/api-client';
import { WORKBENCH_NAME_MAX_LENGTH } from '@livediagram/api-schema';
import { AddressError } from '../addressing';
import { VerbRefusal } from '../define';
import { contextOf, DOC_A, DOC_C, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { workbenchNameOf, workbenchOpen, workbenchOriginOf, workbenchPair } from './workbench';

// docs/specs/013-workspace/blueprints/workbench-embeds.md "The CLI", "CLI verbs" (WB23, WB44).

const ORIGIN = 'https://127.0.0.1:5175';
const minted = {
  url: `https://livediagram.app/embed/workbench?d=${DOC_A}#ticket=${'t'.repeat(22)}`,
  documentId: DOC_A,
  tabId: null,
  expiresAt: Date.UTC(2026, 9, 5, 8, 1),
};

// The mint route, recording each body it was sent.
function mint(answer: (body: Record<string, unknown>) => Response) {
  const bodies: Record<string, unknown>[] = [];
  const route = async (request: Request) => {
    const body = (await request.json()) as Record<string, unknown>;
    bodies.push({ method: request.method, ...body });
    return answer(body);
  };
  return { bodies, route };
}

const refusalOf = async (work: Promise<unknown>) => {
  const err = await work.catch((e: unknown) => e);
  if (!(err instanceof VerbRefusal)) throw new Error(`expected a refusal, got ${String(err)}`);
  return err;
};

describe('workbench open', () => {
  it('mints a ticket for the whole document and prints its link', async () => {
    const { bodies, route } = mint((body) =>
      Response.json({ ...minted, documentId: body.documentId }, { status: 201 }),
    );
    const logs: string[] = [];
    const api = fakeApi({ ...library, '/workbench/tickets': route });
    const output = await workbenchOpen.run!(contextOf(api, [], logs), {
      doc: 'Shop',
      origin: ORIGIN,
    });
    expect(output).toEqual({ ...minted, documentId: DOC_C });
    expect(bodies).toEqual([{ method: 'POST', documentId: DOC_C, origin: ORIGIN }]);
    expect(workbenchOpen.text!(output)).toEqual([minted.url]);
    expect(logs).toContain(`workbench open minted ${DOC_C}`);
  });

  it('names the tab it was given', async () => {
    const { bodies, route } = mint(() =>
      Response.json({ ...minted, tabId: 'tab-two-0000' }, { status: 201 }),
    );
    const api = fakeApi({ ...library, ...tabsOfA, '/workbench/tickets': route });
    const output = await workbenchOpen.run!(contextOf(api), {
      doc: DOC_A,
      tab: 'Details',
      origin: ORIGIN,
    });
    expect(output.tabId).toBe('tab-two-0000');
    expect(bodies[0]).toMatchObject({ documentId: DOC_A, tabId: 'tab-two-0000', origin: ORIGIN });
  });

  it('refuses an unpaired workbench as not permitted, naming the pair command (WB23)', async () => {
    const { route } = mint(() =>
      Response.json(
        { error: 'pairing_required', pairingUrl: 'https://x/workbench/pair?code=c', expiresAt: 1 },
        { status: 428 },
      ),
    );
    const logs: string[] = [];
    const api = fakeApi({ ...library, '/workbench/tickets': route });
    const refusal = await refusalOf(
      workbenchOpen.run!(contextOf(api, [], logs), { doc: 'Shop', origin: ORIGIN }),
    );
    expect(refusal).toMatchObject({
      status: 403,
      code: 'pairing_required',
      message: 'this workbench is not paired with your token',
      hint: `livediagram workbench pair --origin ${ORIGIN}`,
    });
    expect(logs).toContain('workbench open pairing-required');
  });

  it('passes every other refusal of the api through as the api gave it', async () => {
    const { route } = mint(() => Response.json({ error: 'not_found' }, { status: 404 }));
    const logs: string[] = [];
    const api = fakeApi({ ...library, '/workbench/tickets': route });
    const err = await workbenchOpen.run!(contextOf(api, [], logs), {
      doc: 'Shop',
      origin: ORIGIN,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404 });
    expect(logs).toContain('workbench open refused 404');
  });

  it('lets a network failure through for the front door to report', async () => {
    const api = fakeApi({
      ...library,
      '/workbench/tickets': () => {
        throw new TypeError('fetch failed');
      },
    });
    const err = await workbenchOpen.run!(contextOf(api), { doc: 'Shop', origin: ORIGIN }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(TypeError);
  });

  it('opens only your own documents: a share link is a usage error', async () => {
    const api = fakeApi({});
    const logs: string[] = [];
    const err = await workbenchOpen.run!(contextOf(api, [], logs), {
      doc: 'https://livediagram.app/document/shared?s=abc',
      origin: ORIGIN,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AddressError);
    expect((err as AddressError).failure).toMatchObject({
      kind: 'usage',
      message: 'a workbench opens your own documents, not a share link',
    });
    expect(api.calls).toEqual([]);
    expect(logs).toContain('workbench open refused share-link');
  });

  it('refuses an origin that is not one before asking the api', async () => {
    const api = fakeApi({});
    const logs: string[] = [];
    const refusal = await refusalOf(
      workbenchOpen.run!(contextOf(api, [], logs), {
        doc: 'Shop',
        origin: 'https://127.0.0.1:5175/',
      }),
    );
    expect(refusal).toMatchObject({ status: 400, code: 'invalid_origin' });
    expect(api.calls).toEqual([]);
    expect(logs).toContain('workbench open refused invalid_origin');
  });
});

describe('the workbench origin', () => {
  it('takes exactly scheme://host[:port]', () => {
    expect(workbenchOriginOf(ORIGIN, 'open', () => {})).toBe(ORIGIN);
    expect(workbenchOriginOf('http://localhost:5175', 'pair', () => {})).toBe(
      'http://localhost:5175',
    );
  });

  it('names the shapes it takes when refusing one (E1)', () => {
    for (const bad of [
      '*',
      'null',
      'https://x.dev/path',
      'http://example.com',
      'https://x.dev:443',
      'ftp://x.dev',
    ]) {
      const logs: string[] = [];
      let refusal: unknown;
      try {
        workbenchOriginOf(bad, 'pair', (line) => logs.push(line));
      } catch (err) {
        refusal = err;
      }
      expect(refusal, bad).toBeInstanceOf(VerbRefusal);
      expect(refusal).toMatchObject({
        status: 400,
        code: 'invalid_origin',
        message: `"${bad}" is not a workbench origin`,
        lines: [
          'https://<host>[:<port>]',
          'http://localhost, http://127.0.0.1 or http://[::1], with an optional :<port>',
        ],
        hint: '--origin https://127.0.0.1:5175: no path, query or trailing slash',
      });
      expect(logs).toEqual(['workbench pair refused invalid_origin']);
    }
  });
});

describe('the workbench name', () => {
  it('is trimmed, and absent when not given', () => {
    expect(workbenchNameOf('  Spinner ', () => {})).toBe('Spinner');
    expect(workbenchNameOf(undefined, () => {})).toBeNull();
  });

  it('refuses an empty or overlong name', () => {
    for (const bad of ['   ', 'x'.repeat(WORKBENCH_NAME_MAX_LENGTH + 1)]) {
      const logs: string[] = [];
      let refusal: unknown;
      try {
        workbenchNameOf(bad, (line) => logs.push(line));
      } catch (err) {
        refusal = err;
      }
      expect(refusal).toMatchObject({
        status: 400,
        code: 'invalid_value',
        message: `--name takes 1 to ${WORKBENCH_NAME_MAX_LENGTH} characters`,
      });
      expect(logs).toEqual(['workbench pair refused invalid_name']);
    }
  });
});

describe('workbench pair', () => {
  it('prints the origin it paired, and the name when it has one', () => {
    expect(workbenchPair.text!({ status: 'paired', origin: ORIGIN, name: 'Spinner' })).toEqual([
      `paired ${ORIGIN} as Spinner`,
    ]);
    expect(workbenchPair.text!({ status: 'paired', origin: ORIGIN, name: null })).toEqual([
      `paired ${ORIGIN}`,
    ]);
  });
});
