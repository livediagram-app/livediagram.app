import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  confinementRefusal,
  getWorkbenchConfinement,
  noteWorkbenchResponse,
  subscribeWorkbenchSessionRefused,
  setWorkbenchConfinement,
  WorkbenchConfinedError,
} from './workbench-confinement';

// Client confinement (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor in a
// workbench", WB16): a request the allow-list refuses is refused here, before it is sent.

const SECRET = `lvw_${'s'.repeat(43)}`;
const BEARER = { Authorization: `Bearer ${SECRET}` };
const SESSION = { documentId: 'doc-1', ownerId: 'user_1' };

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  setWorkbenchConfinement(null);
  vi.restoreAllMocks();
});

describe('confinementRefusal', () => {
  it('lets every request through while no session is confined', () => {
    expect(confinementRefusal('/api/documents', { headers: BEARER })).toBeNull();
  });

  it('lets an allowed route through', () => {
    setWorkbenchConfinement(SESSION);

    expect(confinementRefusal('/api/documents/doc-1', { headers: BEARER })).toBeNull();
    expect(
      confinementRefusal('/api/documents/doc-1/tabs/t1', { method: 'PUT', headers: BEARER }),
    ).toBeNull();
  });

  it('refuses a confined route presenting the session', () => {
    setWorkbenchConfinement(SESSION);

    const refusal = confinementRefusal('/api/documents', { headers: BEARER });

    expect(refusal).toBeInstanceOf(WorkbenchConfinedError);
    expect(refusal?.route).toBe('Get.Documents');
  });

  it('refuses another document', () => {
    setWorkbenchConfinement(SESSION);

    expect(confinementRefusal('/api/documents/doc-2', { headers: BEARER })).toBeInstanceOf(
      WorkbenchConfinedError,
    );
  });

  it('reads the path from an absolute api address and ignores the query', () => {
    setWorkbenchConfinement(SESSION);

    expect(
      confinementRefusal('http://localhost:8787/api/images/i1?d=doc-1', { headers: BEARER }),
    ).toBeNull();
    expect(
      confinementRefusal('http://localhost:8787/api/preferences', {
        method: 'put',
        headers: BEARER,
      }),
    ).toBeInstanceOf(WorkbenchConfinedError);
  });

  it('refuses a path outside the api', () => {
    setWorkbenchConfinement(SESSION);

    expect(confinementRefusal('/elsewhere', { headers: BEARER })).toBeInstanceOf(
      WorkbenchConfinedError,
    );
  });

  it('leaves a request that does not present the session alone', () => {
    setWorkbenchConfinement(SESSION);

    expect(confinementRefusal('/api/events', { method: 'POST' })).toBeNull();
    expect(
      confinementRefusal('/api/documents', { headers: { Authorization: 'Bearer clerk-jwt' } }),
    ).toBeNull();
    expect(
      confinementRefusal('/api/documents', { headers: new Headers({ 'X-Owner-Id': 'g' }) }),
    ).toBeNull();
  });

  it('reads the bearer from a Headers object or header pairs', () => {
    setWorkbenchConfinement(SESSION);

    expect(confinementRefusal('/api/folders', { headers: new Headers(BEARER) })).toBeInstanceOf(
      WorkbenchConfinedError,
    );
    expect(
      confinementRefusal('/api/folders', { headers: [['authorization', `Bearer ${SECRET}`]] }),
    ).toBeInstanceOf(WorkbenchConfinedError);
  });

  it('logs each refused route once', () => {
    setWorkbenchConfinement(SESSION);

    confinementRefusal('/api/folders', { headers: BEARER });
    confinementRefusal('/api/folders', { headers: BEARER });
    confinementRefusal('/api/teams', { headers: BEARER });

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith('[workbench] request-confined', {
      method: 'GET',
      route: 'Get.Folders',
    });
  });

  it('logs a route again after the confinement is set anew', () => {
    setWorkbenchConfinement(SESSION);
    confinementRefusal('/api/folders', { headers: BEARER });
    setWorkbenchConfinement(SESSION);
    confinementRefusal('/api/folders', { headers: BEARER });

    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('getWorkbenchConfinement', () => {
  it('reads the confined session, or null', () => {
    expect(getWorkbenchConfinement()).toBeNull();
    setWorkbenchConfinement(SESSION);
    expect(getWorkbenchConfinement()).toEqual(SESSION);
  });
});

describe('noteWorkbenchResponse', () => {
  const refusal = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), { status });

  it('tells every listener when the api refuses the session', async () => {
    const heard = vi.fn();
    const off = subscribeWorkbenchSessionRefused(heard);

    await noteWorkbenchResponse({ headers: BEARER }, refusal(401, 'invalid_session'));
    off();
    await noteWorkbenchResponse({ headers: BEARER }, refusal(401, 'invalid_session'));

    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('ignores any other answer, and requests that do not present the session', async () => {
    const heard = vi.fn();
    const off = subscribeWorkbenchSessionRefused(heard);

    await noteWorkbenchResponse({ headers: BEARER }, refusal(403, 'workbench_confined'));
    await noteWorkbenchResponse({ headers: BEARER }, refusal(401, 'sign_in_required'));
    await noteWorkbenchResponse(undefined, refusal(401, 'invalid_session'));
    off();

    expect(heard).not.toHaveBeenCalled();
  });
});
