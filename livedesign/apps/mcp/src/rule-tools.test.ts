import { describe, expect, it, vi } from 'vitest';

vi.mock('./image-result', () => ({
  imageResult: () => ({ content: [{ type: 'text', text: 'stub image' }] }),
  tabSvg: async () => ({ svg: '<svg viewBox="0 0 10 10"></svg>', leftOut: 0 }),
}));

import { connectTestClient } from './mcp-test-client';

// The rule tools (docs/specs/013-workspace/automations.md "Agents"): a refusal is a tool error naming the api's code
// and the part at fault, what was applied before it said; a rule it cannot name is refused with the rules there are.
const BY = { id: 'u1', name: 'Ana', color: '#7c3aed' };
const RULE = {
  id: 'r1',
  name: 'Tell the owner',
  trigger: { kind: 'comment_added' },
  conditions: [],
  steps: [{ kind: 'email', to: { owner: true }, subject: 's', body: 'b' }],
  chain: false,
  timeZone: 'UTC',
  enabled: true,
  made: { by: BY, at: 1 },
  edited: { by: BY, at: 1 },
  stats: { lastRunAt: null, runsThisWeek: 0, failuresInARow: 0 },
  needs: [],
  attention: [],
};

function api(sent: string[]) {
  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname.replace(/^\/api/, '');
    sent.push(`${request.method} ${path}`);
    if (path.endsWith('/automations') && request.method === 'GET')
      return Response.json({ rules: [RULE], runsToday: 0, runsPerDay: 1000, tabs: [], people: [] });
    if (path.endsWith('/toggle')) return Response.json({ rule: { ...RULE, enabled: false } });
    return Response.json(
      { error: 'automation_invalid', path: 'steps.0.to', message: 'steps.0.to must name one' },
      { status: 400 },
    );
  };
}

const textOf = (r: unknown) => (r as { content: { text: string }[] }).content[0]!.text;

describe('the rule tools', () => {
  it('refuse a rule list_rules cannot name, with the rules there are', async () => {
    const client = await connectTestClient(api([]));
    const out = await client.callTool({
      name: 'list_rules',
      arguments: { designId: 'd1', rule: 'Nope' },
    });
    expect(out.isError).toBe(true);
    expect(textOf(out)).toBe('No rule "Nope". The rules: r1 "Tell the owner"');
  });

  it('stop change_rules at the api’s refusal, naming the code, the part and what was applied', async () => {
    const sent: string[] = [];
    const client = await connectTestClient(api(sent));
    const out = await client.callTool({
      name: 'change_rules',
      arguments: {
        designId: 'd1',
        changes: [
          { op: 'off', rule: 'Tell the owner' },
          { op: 'set', rule: 'r1', steps: [{ kind: 'email', to: {} }] },
          { op: 'on', rule: 'r1' },
        ],
      },
    });
    expect(out.isError).toBe(true);
    expect(textOf(out)).toBe(
      'Applied before it stopped:\n~ rule "Tell the owner" off\nThen: The api refused the rule ' +
        '(automation_invalid at steps.0.to): steps.0.to must name one. Fix that part and send the change again.',
    );
    expect(sent).toEqual([
      'GET /designs/d1/automations',
      'POST /designs/d1/automations/r1/toggle',
      'PUT /designs/d1/automations/r1',
    ]);
  });
});
