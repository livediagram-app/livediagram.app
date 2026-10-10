// The workbench verbs (docs/specs/013-workspace/blueprints/workbench-embeds.md "The CLI", "CLI verbs"): a
// single-use link that opens a document live inside a developer tool's frame, and pairing the token with that
// tool once. `workbench pair` waits on the person's browser, so the CLI runs it (CLI55).

import { z } from 'zod';
import { ApiError } from '@livediagram/api-client';
import {
  normaliseWorkbenchName,
  parseWorkbenchOrigin,
  WORKBENCH_NAME_MAX_LENGTH,
  type WorkbenchTicketRequest,
  type WorkbenchTicketResponse,
} from '@livediagram/api-schema';
import { AddressError, parseDocumentUrl, resolveDocument } from '../addressing';
import { defineVerb, VerbRefusal, type VerbContext } from '../define';
import { tabOf } from './shared';

type Step = 'open' | 'pair';
type Log = (line: string) => void;

const EXAMPLE_ORIGIN = 'https://127.0.0.1:5175';

// `--origin` as the api takes it (`parseWorkbenchOrigin`, the one rule), refused here with the shapes it takes
// (E1), before anything is sent.
export function workbenchOriginOf(input: string, step: Step, log: Log): string {
  const parsed = parseWorkbenchOrigin(input);
  if (parsed.ok) return parsed.origin;
  log(`workbench ${step} refused invalid_origin`);
  throw new VerbRefusal({
    status: 400,
    code: 'invalid_origin',
    message: `"${input}" is not a workbench origin`,
    lines: [
      'https://<host>[:<port>]',
      'http://localhost, http://127.0.0.1 or http://[::1], with an optional :<port>',
    ],
    hint: `--origin ${EXAMPLE_ORIGIN}: no path, query or trailing slash`,
  });
}

// `--name`, trimmed, 1 to WORKBENCH_NAME_MAX_LENGTH characters (WB2); the api would drop a bad one silently.
export function workbenchNameOf(input: string | undefined, log: Log): string | null {
  if (input === undefined) return null;
  const name = normaliseWorkbenchName(input);
  if (name !== null) return name;
  log('workbench pair refused invalid_name');
  throw new VerbRefusal({
    status: 400,
    code: 'invalid_value',
    message: `--name takes 1 to ${WORKBENCH_NAME_MAX_LENGTH} characters`,
    hint: '--name "Acme Editor"',
  });
}

// The document, and the tab only when one is named: without one the editor opens the first (WB44).
async function ticketRequestOf(
  ctx: VerbContext,
  input: { doc: string; tab?: string },
  origin: string,
): Promise<WorkbenchTicketRequest> {
  if (input.tab === undefined) {
    const document = await resolveDocument(ctx.api, input.doc, ctx.host, ctx.log);
    return { documentId: document.id, origin };
  }
  const { document, tab } = await tabOf(ctx, input.doc, input.tab);
  return { documentId: document.id, tabId: tab.id, origin };
}

const originFlag = z
  .string()
  .describe('The workbench, as scheme://host[:port]: https, or http on a loopback host');

export const workbenchOpen = defineVerb({
  id: 'workbench.open',
  summary: 'A link that opens a document live inside a workbench',
  description:
    'Mints a link that opens your document in the editor, signed in as you, inside the workbench at --origin. The link works once, within a minute. A workbench the token is not paired with exits 4, naming workbench pair.',
  behaviour: 'write',
  input: z.object({
    doc: z.string().describe('A name, id prefix or livediagram URL of your own document'),
    tab: z
      .string()
      .optional()
      .describe("A tab name or id prefix; the document's first tab when omitted"),
    origin: originFlag,
  }),
  output: z.object({
    url: z.string(),
    documentId: z.string(),
    tabId: z.string().nullable(),
    expiresAt: z.number(),
  }),
  run: async (ctx, input) => {
    const origin = workbenchOriginOf(input.origin, 'open', ctx.log);
    // The owner's own access only (WB3): a share link's code never rides a mint.
    const url = parseDocumentUrl(input.doc, ctx.host);
    if (url && 'shareCode' in url) {
      ctx.log('workbench open refused share-link');
      throw new AddressError({
        kind: 'usage',
        what: 'document',
        input: input.doc,
        candidates: [],
        message: 'a workbench opens your own documents, not a share link',
        hint: 'livediagram document ls',
      });
    }
    const request = await ticketRequestOf(ctx, input, origin);
    try {
      const minted = await ctx.api.json<WorkbenchTicketResponse>('/workbench/tickets', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      ctx.log(`workbench open minted ${minted.documentId}`);
      return minted;
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      if (err.status !== 428) {
        ctx.log(`workbench open refused ${err.status}`);
        throw err;
      }
      ctx.log('workbench open pairing-required');
      // Not permitted until the person approves (WB23): mapped here to the auth exit, as a 403 would be.
      throw new VerbRefusal({
        status: 403,
        code: 'pairing_required',
        message: 'this workbench is not paired with your token',
        hint: `livediagram workbench pair --origin ${origin}`,
      });
    }
  },
  text: ({ url }) => [url],
  cli: {
    positionals: ['doc'],
    examples: [
      `livediagram workbench open "Home screen" --origin ${EXAMPLE_ORIGIN} --json`,
      `livediagram workbench open 3f9c --tab Wireframe --origin ${EXAMPLE_ORIGIN}`,
    ],
    prints: 'the link; --json { url, documentId, tabId, expiresAt }',
  },
});

export const workbenchPair = defineVerb({
  id: 'workbench.pair',
  summary: 'Pair the token with a workbench, approved once in the browser',
  description:
    'Asks to pair this token with the workbench at --origin and waits until you answer in your signed-in browser. Prints the approval link first; opens it in the browser only when stdout is a terminal. Exits 0 once paired (at once when already paired), 4 when declined or expired.',
  behaviour: 'write',
  local: true,
  input: z.object({
    origin: originFlag,
    name: z.string().optional().describe('The workbench’s name, shown beside its origin'),
  }),
  output: z.object({
    status: z.literal('paired'),
    origin: z.string(),
    name: z.string().nullable(),
  }),
  text: ({ origin, name }) => [name ? `paired ${origin} as ${name}` : `paired ${origin}`],
  cli: {
    positionals: [],
    examples: [
      `livediagram workbench pair --origin ${EXAMPLE_ORIGIN} --name "Acme Editor"`,
      'livediagram workbench pair --origin http://localhost:5175 --json',
    ],
    prints: 'the approval link, then paired <origin> [as <name>]',
  },
});
