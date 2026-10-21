// The presence verbs (docs/specs/015-api/cli.md "Commands"; agent-presence "Presence"): an agent shows the people on
// a tab what it is doing and what it is looking at, under its owner's name, for a while; or stops showing it.

import { z } from 'zod';
import { ApiError } from '@livediagram/api-client';
import {
  AGENT_PRESENCE_FOCUS_MAX,
  AGENT_PRESENCE_MAX_TTL_MS,
  AGENT_PRESENCE_STATUS_MAX,
  parseAgentPresenceRequest,
  type AgentPresenceRequestCode,
  type AgentPresenceResult,
} from '@livediagram/api-schema';
import { defineVerb, VerbRefusal } from '../define';
import { tabOf, tabPath } from './shared';

const docArg = z.string().describe('A name, id prefix or livediagram URL');
const tabFlag = z
  .string()
  .optional()
  .describe('A tab name or id prefix; the first tab when omitted');

// `HH:MM:SS` in UTC, so output does not depend on the machine.
const second = (ms: number) => new Date(ms).toISOString().slice(11, 19);

// What each refusal of the request rule means to the person typing the flags.
const REFUSALS: Record<AgentPresenceRequestCode, string> = {
  invalid_body: 'the presence request is not an object',
  status_too_long: `--status is at most ${AGENT_PRESENCE_STATUS_MAX} characters`,
  invalid_status: '--status holds a control character',
  too_many_focus: `--focus names at most ${AGENT_PRESENCE_FOCUS_MAX} elements`,
  invalid_focus: '--focus is a comma-separated list of refs',
  ttl_out_of_range: `--ttl is a whole number of seconds from 1 to ${AGENT_PRESENCE_MAX_TTL_MS / 1000}`,
};

export const presenceSet = defineVerb({
  id: 'presence.set',
  summary: 'Show the people on a tab what the agent is doing',
  description:
    'Shows a status line and focus on a tab, under the token owner\u2019s name, for the ttl (30 s by default); every changeset the token writes there keeps it up. Setting it again replaces both.',
  behaviour: 'write',
  input: z.object({
    doc: docArg,
    tab: tabFlag,
    status: z.string().optional().describe('What the agent is doing, up to 80 characters'),
    focus: z.string().optional().describe('Comma-separated refs of the elements it is looking at'),
    ttl: z.coerce.number().optional().describe('Seconds until it goes, 1 to 120'),
  }),
  output: z.object({
    tabName: z.string(),
    presence: z.object({
      tabId: z.string(),
      status: z.string().nullable(),
      focus: z.array(z.string()),
      expiresAt: z.number(),
    }),
  }),
  run: async (ctx, input) => {
    const body = {
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.focus === undefined
        ? {}
        : {
            focus: input.focus
              .split(',')
              .map((ref) => ref.trim())
              .filter(Boolean),
          }),
      ...(input.ttl === undefined ? {} : { ttl: input.ttl * 1000 }),
    };
    // The api's own rule, checked first so a mistyped flag never reaches the host.
    const parsed = parseAgentPresenceRequest(body);
    if (!parsed.ok)
      throw new VerbRefusal({
        status: 400,
        code: parsed.code,
        message: REFUSALS[parsed.code],
        hint: 'livediagram presence set --help',
      });
    const { document, tab } = await tabOf(ctx, input.doc, input.tab);
    const { presence } = await ctx.api.json<{ presence: AgentPresenceResult }>(
      `${tabPath(document.id, tab.id)}/presence`,
      { method: 'PUT', body: JSON.stringify(body) },
    );
    return { tabName: tab.name, presence };
  },
  text: ({ tabName, presence }) => [
    `presence on ${JSON.stringify(tabName)} until ${second(presence.expiresAt)}`,
  ],
  cli: {
    positionals: ['doc'],
    examples: [
      'livediagram presence set "Shop" --status "Adding the payment flow" --focus api,db',
      'livediagram presence set 3f9c --tab Flow --status "Reviewing" --ttl 120',
    ],
    prints: 'the tab and when the presence goes (UTC)',
  },
});

export const presenceClear = defineVerb({
  id: 'presence.clear',
  summary: 'Stop showing the agent on a tab',
  description: 'Takes the token\u2019s presence off a tab at once; nothing there changes nothing.',
  behaviour: 'write',
  input: z.object({ doc: docArg, tab: tabFlag }),
  output: z.object({ text: z.string() }),
  run: async (ctx, input) => {
    const { document, tab } = await tabOf(ctx, input.doc, input.tab);
    const res = await ctx.api.fetch(`${tabPath(document.id, tab.id)}/presence`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return { text: `presence cleared on ${JSON.stringify(tab.name)}` };
  },
  text: ({ text }) => [text],
  cli: {
    positionals: ['doc'],
    examples: ['livediagram presence clear "Shop"', 'livediagram presence clear 3f9c --tab Flow'],
    prints: 'the tab it left',
  },
});
