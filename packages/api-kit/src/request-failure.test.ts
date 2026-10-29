import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  UNAVAILABLE_RETRY_AFTER_SECONDS,
  failedRequestResponse,
  guardRequest,
  storageOutageOf,
} from './request-failure';

// liveworkspace/docs/specs/002-architecture/architecture.md "When a request fails": the storage failing on its side
// is a retryable 503, anything else a 500, and neither body echoes the error's text.

const D1_INTERNAL = new Error('D1_ERROR: internal error; reference = 5jadrun66l32vrvmnfk8kgts');

// A Durable Object infrastructure error carries its flags as properties (Cloudflare's Durable Objects "Error handling").
const durableObjectError = (flags: {
  retryable?: boolean;
  overloaded?: boolean;
  remote?: boolean;
}) => Object.assign(new Error('Durable Object reset because its code was updated.'), flags);

const json = (body: unknown, init: ResponseInit = {}) =>
  Response.json(body, { ...init, headers: { ...init.headers, 'X-Cors': 'yes' } });

let errors: unknown[][];
beforeEach(() => {
  errors = [];
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => void errors.push(args));
});
afterEach(() => vi.restoreAllMocks());

describe('storageOutageOf', () => {
  it.each([
    'D1_ERROR: internal error; reference = abc',
    'D1_ERROR: Network connection lost.',
    'D1_ERROR: D1 DB is overloaded. Requests queued for too long.',
    'D1_ERROR: D1 DB storage operation exceeded timeout which caused object to be reset.',
    'D1_ERROR: Internal error while starting up D1 DB storage caused object to be reset.',
    'D1_ERROR: Cannot resolve D1 DB due to transient issue on remote node.',
    'D1_ERROR: D1 DB reset because its code was updated.',
  ])('names D1 for %s', (message) => {
    expect(storageOutageOf(new Error(message))).toBe('d1');
  });

  it.each([
    'D1_ERROR: UNIQUE constraint failed: documents.id: SQLITE_CONSTRAINT',
    'D1_TYPE_ERROR: Type undefined not supported for value undefined',
    'D1_ERROR: no such table: documents: SQLITE_ERROR',
    'internal error',
  ])('leaves %s to the 500', (message) => {
    expect(storageOutageOf(new Error(message))).toBeNull();
  });

  it('names a Durable Object for a retryable or overloaded infrastructure error', () => {
    expect(storageOutageOf(durableObjectError({ retryable: true }))).toBe('durable-object');
    expect(storageOutageOf(durableObjectError({ overloaded: true }))).toBe('durable-object');
  });

  it("leaves a Durable Object's own thrown error to the 500", () => {
    expect(storageOutageOf(durableObjectError({ remote: true }))).toBeNull();
    expect(storageOutageOf(durableObjectError({ retryable: false, overloaded: false }))).toBeNull();
  });

  it('leaves a thrown non-error to the 500', () => {
    expect(storageOutageOf('D1_ERROR: internal error')).toBeNull();
    expect(storageOutageOf({ retryable: true })).toBeNull();
    expect(storageOutageOf(undefined)).toBeNull();
  });
});

describe('failedRequestResponse', () => {
  it('answers a D1 outage 503 storage_unavailable with Retry-After, through the caller json', async () => {
    const reportCrash = vi.fn();

    const res = failedRequestResponse(D1_INTERNAL, { route: 'Get.Documents', json, reportCrash });

    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe(String(UNAVAILABLE_RETRY_AFTER_SECONDS));
    expect(res.headers.get('X-Cors')).toBe('yes');
    expect(await res.json()).toEqual({ error: 'storage_unavailable' });
    expect(errors).toEqual([['[d1] unavailable route=Get.Documents', D1_INTERNAL]]);
    expect(reportCrash).not.toHaveBeenCalled();
  });

  it('answers a Durable Object outage 503 storage_unavailable', async () => {
    const err = durableObjectError({ retryable: true });

    const res = failedRequestResponse(err, { route: 'Put.Documents.Tabs', json });

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'storage_unavailable' });
    expect(errors).toEqual([['[durable-object] unavailable route=Put.Documents.Tabs', err]]);
  });

  it('answers anything else 500 internal_error and reports the crash', async () => {
    const bug = new TypeError('cannot read properties of undefined');
    const reportCrash = vi.fn();

    const res = failedRequestResponse(bug, { route: 'Get.Documents', json, reportCrash });

    expect(res.status).toBe(500);
    expect(res.headers.get('Retry-After')).toBeNull();
    expect(res.headers.get('X-Cors')).toBe('yes');
    expect(await res.json()).toEqual({ error: 'internal_error' });
    expect(errors).toEqual([['api error route=Get.Documents', bug]]);
    expect(reportCrash).toHaveBeenCalledOnce();
  });

  it('answers 500 when no crash report is wired', async () => {
    const res = failedRequestResponse(new Error('boom'), { route: 'Get.Index', json });

    expect(res.status).toBe(500);
  });

  it('still answers 500 when the crash report itself throws, and logs it', async () => {
    const reportErr = new Error('telemetry down');

    const res = failedRequestResponse(new Error('boom'), {
      route: 'Get.Index',
      json,
      reportCrash: () => {
        throw reportErr;
      },
    });

    expect(res.status).toBe(500);
    expect(errors).toContainEqual(['[telemetry] crash report failed', reportErr]);
  });

  it('never echoes the error text', async () => {
    const res = failedRequestResponse(new Error('D1_ERROR: no such table: secret_table'), {
      route: 'Get.Documents',
      json,
    });

    expect(await res.text()).not.toContain('secret_table');
  });
});

describe('guardRequest', () => {
  it('passes an answer through untouched, without building the failure answer', async () => {
    const ok = new Response('ok');
    const answer = vi.fn();

    expect(await guardRequest(async () => ok, answer)).toBe(ok);
    expect(answer).not.toHaveBeenCalled();
  });

  it('answers a throw with the failure answer', async () => {
    const res = await guardRequest(
      async () => {
        throw D1_INTERNAL;
      },
      () => ({ route: 'Get.Index.Items', json }),
    );

    expect(res.status).toBe(503);
    expect(errors).toEqual([['[d1] unavailable route=Get.Index.Items', D1_INTERNAL]]);
  });

  it('answers a synchronous throw too', async () => {
    const res = await guardRequest(
      () => {
        throw new Error('sync');
      },
      () => ({ route: 'Get.Index', json }),
    );

    expect(res.status).toBe(500);
  });
});
