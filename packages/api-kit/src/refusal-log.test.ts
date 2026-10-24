import { afterEach, describe, expect, it, vi } from 'vitest';
import { logRefusal } from './refusal-log';

// The agent-presence blueprint "Observability": a refusal's fingerprint carries its status and code, never text.

afterEach(() => vi.restoreAllMocks());

describe('logRefusal', () => {
  it('logs the fields, the status and the code a JSON body names', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await logRefusal(
      '[x] refused',
      Response.json({ error: 'tab_busy', message: 'secret text' }, { status: 409 }),
      { a: 1 },
    );
    await logRefusal('[x] refused', Response.json({ message: 'no code' }, { status: 400 }), {});
    await logRefusal('[x] refused', new Response('plain', { status: 500 }), {});
    expect(warn.mock.calls).toEqual([
      ['[x] refused', { a: 1, status: 409, code: 'tab_busy' }],
      ['[x] refused', { status: 400, code: null }],
      ['[x] refused', { status: 500, code: null }],
    ]);
  });
});
