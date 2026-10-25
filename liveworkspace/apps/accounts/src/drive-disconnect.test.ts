import { describe, expect, it, vi } from 'vitest';
import { disconnectDrive } from './drive-disconnect.ts';

type Call = { url: string; method: string; authorization: string | null };

function service(answer: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetcher = {
    fetch: async (url: string, init: RequestInit) => {
      calls.push({
        url,
        method: init.method ?? 'GET',
        authorization: new Headers(init.headers).get('authorization'),
      });
      return answer();
    },
  } as unknown as Fetcher;
  return { calls, fetcher };
}

describe('disconnectDrive', () => {
  it('asks the Drive service to forget the person, with accounts’ key', async () => {
    const { calls, fetcher } = service(() => new Response(null, { status: 204 }));
    expect(await disconnectDrive({ driveService: fetcher, driveKey: 'k' }, 'user_ada')).toBe('done');
    expect(calls).toEqual([
      { url: 'https://drive/app/people/user_ada', method: 'DELETE', authorization: 'Bearer k' },
    ]);
  });

  it('takes a person who never connected (404) as done', async () => {
    const { fetcher } = service(() => new Response(null, { status: 404 }));
    expect(await disconnectDrive({ driveService: fetcher, driveKey: 'k' }, 'user_ada')).toBe('done');
  });

  it('sends nothing without the binding or the key', async () => {
    const { calls, fetcher } = service(() => new Response(null, { status: 204 }));
    expect(await disconnectDrive({ driveKey: 'k' }, 'user_ada')).toBe('skipped');
    expect(await disconnectDrive({ driveService: fetcher, driveKey: ' ' }, 'user_ada')).toBe(
      'skipped',
    );
    expect(calls).toEqual([]);
  });

  it('logs a refusal or an outage and never throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const down = service(() => new Response(null, { status: 502 }));
    expect(await disconnectDrive({ driveService: down.fetcher, driveKey: 'k' }, 'user_ada')).toBe(
      'failed',
    );
    const broken = service(() => {
      throw new TypeError('network');
    });
    expect(
      await disconnectDrive({ driveService: broken.fetcher, driveKey: 'k' }, 'user_ada'),
    ).toBe('failed');
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
