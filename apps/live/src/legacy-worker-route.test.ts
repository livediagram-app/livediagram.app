import { describe, expect, it } from 'vitest';
import worker from './worker';

function env() {
  const seen: string[] = [];
  const ASSETS = {
    fetch: async (req: Request) => {
      seen.push(new URL(req.url).pathname);
      return new Response('<html></html>', { headers: { 'content-type': 'text/html' } });
    },
  };
  return { env: { ASSETS } as never, seen };
}

// The old editor address still reaches the editor while a deploy rolls out
// (docs/specs/016-platform/router-app.md, "Legacy editor route").
describe('live worker, the old editor address', () => {
  it('serves it for an old /diagram/<id> address during a deploy', async () => {
    const { env: e, seen } = env();
    await worker.fetch(new Request('https://livediagram.app/diagram/abc'), e);
    expect(seen).toEqual(['/document/placeholder']);
  });
});
