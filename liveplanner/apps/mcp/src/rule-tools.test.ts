import { describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES } from '@liveplanner/items';

vi.mock('./image-result', () => ({
  imageResult: () => ({ content: [{ type: 'text', text: 'stub image' }] }),
}));

import { connectTestClient } from './mcp-test-client';

// The rule tools (docs/specs/026-plan/automations.md "Agents and the CLI"): a refusal is a tool error naming the
// api's code and the part at fault, what was applied before it said; a rule it cannot name is refused with the rules.
const BY = { id: 'p1', name: 'Ana', color: '#7c3aed' };
const RULE = {
  id: 'r1',
  name: 'Done stamp',
  trigger: { kind: 'card_moved', to: ['done'] },
  conditions: [],
  steps: [{ kind: 'flag' }],
  chain: false,
  timeZone: 'UTC',
  enabled: true,
  made: { by: BY, at: 1 },
  edited: { by: BY, at: 1 },
  stats: { lastRunAt: null, runsThisWeek: 0, failuresInARow: 0 },
  needs: [],
};

function api(sent: string[]) {
  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname.replace(/^\/api/, '');
    sent.push(`${request.method} ${path}`);
    if (path.endsWith('/plan'))
      return Response.json({ boards: [], statuses: [], types: ITEM_TYPES, itemTypesRev: 1 });
    if (path.endsWith('/automations') && request.method === 'GET')
      return Response.json({ rules: [RULE], runsToday: 0, runsPerDay: 1000 });
    if (path.endsWith('/toggle')) return Response.json({ rule: { ...RULE, enabled: false } });
    return Response.json(
      {
        error: 'automation_invalid',
        path: 'steps.0.status',
        message: 'steps.0.status must be an id',
      },
      { status: 400 },
    );
  };
}

const textOf = (r: unknown) => (r as { content: { text: string }[] }).content[0]!.text;

describe('the rule tools', () => {
  it('refuses a rule list_rules cannot name, with the rules there are', async () => {
    const client = await connectTestClient(api([]));
    const out = await client.callTool({
      name: 'list_rules',
      arguments: { projectId: 'd1', rule: 'Nope' },
    });
    expect(out.isError).toBe(true);
    expect(textOf(out)).toBe('No rule "Nope". The rules: r1 "Done stamp"');
  });

  it('stops change_rules at the api’s refusal, naming the code, the part and what was applied', async () => {
    const sent: string[] = [];
    const client = await connectTestClient(api(sent));
    const out = await client.callTool({
      name: 'change_rules',
      arguments: {
        projectId: 'd1',
        changes: [
          { op: 'off', rule: 'Done stamp' },
          { op: 'set', rule: 'r1', steps: [{ kind: 'move' }] },
          { op: 'on', rule: 'r1' },
        ],
      },
    });
    expect(out.isError).toBe(true);
    expect(textOf(out)).toBe(
      'The api refused the rule (automation_invalid at steps.0.status): steps.0.status must be an id. Fix that ' +
        'part and send the change again. Applied before it: ~ rule "Done stamp" off.',
    );
    expect(sent.filter((s) => !s.startsWith('GET'))).toEqual([
      'POST /projects/d1/automations/r1/toggle',
      'PUT /projects/d1/automations/r1',
    ]);
  });
});
