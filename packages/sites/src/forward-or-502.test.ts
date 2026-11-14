// An unreachable downstream answers 502, never a throw (Work Tracker 850): the shared helper, and each forward in
// workspace-proxy that goes through it.
import { describe, expect, it } from 'vitest';
import { forwardOr502, forwardToDrive, forwardToIndex, routeToWorkspace } from './workspace-proxy';

const unreachable = (async () => {
  throw new Error('Network connection lost.');
}) as typeof fetch;

async function expect502(res: Response | null, origin: string, what: string) {
  expect(res!.status).toBe(502);
  expect(res!.headers.get('Cache-Control')).toBe('no-store');
  expect(await res!.text()).toBe(`router: ${what} at ${origin} could not be reached`);
}

describe('forwardOr502', () => {
  it('hands on the answer of an origin that answers, whatever its status', async () => {
    const answered = new Response('gone', { status: 404 });
    const res = await forwardOr502(
      new Request('http://127.0.0.1:3101/'),
      'marketing',
      async () => answered,
    );
    expect(res).toBe(answered);
  });

  it('answers 502 naming the origin when it cannot be reached', async () => {
    await expect502(
      await forwardOr502(new Request('http://127.0.0.1:3101/pricing'), 'marketing', unreachable),
      'http://127.0.0.1:3101',
      'marketing',
    );
    await expect502(
      await forwardOr502(new Request('http://127.0.0.1:3101/'), undefined, unreachable),
      'http://127.0.0.1:3101',
      'the downstream',
    );
  });

  it('is what the index, Drive and liveworkspace forwards answer when theirs is down', async () => {
    const at = (path: string) => new Request(`http://localhost:3100${path}`);
    const url = (path: string) => new URL(`http://localhost:3100${path}`);
    await expect502(
      await forwardToIndex(
        at('/api/index/items'),
        url('/api/index/items'),
        'http://127.0.0.1:8793',
        {
          fetch: unreachable,
        },
      ),
      'http://127.0.0.1:8793',
      'the index',
    );
    await expect502(
      await forwardToDrive(
        at('/api/drive/x'),
        url('/api/drive/x'),
        'http://127.0.0.1:3011',
        unreachable,
      ),
      'http://127.0.0.1:3011',
      'the Drive mirror',
    );
    await expect502(
      await routeToWorkspace(at('/explorer'), {
        app: 'livediagram',
        origin: 'http://localhost:3000',
        fetch: unreachable,
      }),
      'http://localhost:3000',
      'liveworkspace',
    );
  });
});
