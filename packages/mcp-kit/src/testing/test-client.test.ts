import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { connectTestClient } from './test-client';

describe('connectTestClient', () => {
  it('connects a client to the tools, each call bearing a token and reaching the api stub', async () => {
    const client = await connectTestClient(
      (server, env) => {
        server.registerTool(
          'whoami',
          { inputSchema: { name: z.string().max(5) } },
          async ({ name }, extra) => {
            const answer = await env.API.fetch(new Request(`https://api.test/${name}`));
            return {
              content: [{ type: 'text', text: `${extra.authInfo?.token} ${await answer.text()}` }],
            };
          },
        );
      },
      async (request) => new Response(new URL(request.url).pathname),
    );
    const result = await client.callTool({ name: 'whoami', arguments: { name: 'ada' } });
    expect(result.content).toEqual([{ type: 'text', text: 'lwt_test /ada' }]);
    // The SDK parses the input schema, as the Worker's own transport does.
    const tooLong = await client.callTool({ name: 'whoami', arguments: { name: 'adaline' } });
    expect(tooLong.isError).toBe(true);
  });
});
