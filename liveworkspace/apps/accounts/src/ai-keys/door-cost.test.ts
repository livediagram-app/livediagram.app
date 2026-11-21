// What the internal door costs an app's model call (liveworkspace/docs/specs/003-accounts/ai-keys.md "What it costs"):
// one call over the binding, whose work here is the client check (cached), the person's introspection, one indexed
// read and one HKDF and AES-GCM open. A CPU-time budget, so a slow runner's scheduling never fails it.
import { cpuUsage } from 'node:process';
import { describe, expect, it } from 'vitest';
import type { Auth } from '../auth.ts';
import type { Env } from '../env.ts';
import { addClient, addUser, testD1 } from '../test-d1.ts';
import { AI_KEY_INTERNAL_PATH, handleAiKeyInternal } from './internal.ts';
import { aiKeyHint, aiKeySecrets, openAiKey, sealAiKey } from './seal.ts';
import { saveAiKeyStatement } from './store.ts';

const KEY = 'sk-ant-api03-planted-secret-key-4f2a';
const auth = {
  handler: async (request: Request) => {
    const token = new URLSearchParams(await request.text()).get('token');
    return Response.json(
      token === 'jwt-ada'
        ? { active: true, sub: 'user_ada', client_id: 'liveknowledge' }
        : { active: false },
    );
  },
} as unknown as Auth;

const cpuMs = () => {
  const { user, system } = cpuUsage();
  return (user + system) / 1000;
};

describe('the cost of a key', () => {
  it('opens a sealed key in well under a millisecond of CPU, and answers the door in a few', async () => {
    const { db, sql } = testD1();
    addUser(sql, { id: 'user_ada', email: 'ada@example.com' });
    addClient(sql, 'liveknowledge', 'liveknowledge.app');
    const secrets = aiKeySecrets({ AI_KEY_SECRET: '1:cost-secret' })!;
    const { sealed, version } = await sealAiKey(secrets, 'account:user_ada', 'anthropic', KEY);
    await saveAiKeyStatement(db, {
      ownerKind: 'account',
      ownerId: 'user_ada',
      provider: 'anthropic',
      model: 'claude-fable-5-2',
      sealed,
      keyVersion: version,
      hint: aiKeyHint(KEY),
      setBy: 'user_ada',
      setAt: 1,
    }).run();
    const env = { AUTH_DB: db, AI_KEY_SECRET: '1:cost-secret' } as unknown as Env;
    const door = () =>
      handleAiKeyInternal(
        new Request(`http://accounts${AI_KEY_INTERNAL_PATH}`, {
          method: 'POST',
          headers: { authorization: `Basic ${btoa('liveknowledge:secret')}` },
          body: JSON.stringify({ token: 'jwt-ada', want: 'key' }),
        }),
        env,
        auth,
      );
    await door();

    const runs = 200;
    let start = cpuMs();
    for (let i = 0; i < runs; i++)
      await openAiKey(secrets, 'account:user_ada', 'anthropic', sealed);
    const open = (cpuMs() - start) / runs;
    start = cpuMs();
    for (let i = 0; i < runs; i++) expect((await door()).status).toBe(200);
    const answer = (cpuMs() - start) / runs;
    console.info(`[ai-keys cost] open ${open.toFixed(3)} ms, door ${answer.toFixed(3)} ms CPU`);
    expect(open).toBeLessThan(2);
    expect(answer).toBeLessThan(10);
  });
});
