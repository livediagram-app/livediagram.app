// The workbench verbs (docs/specs/013-workspace/blueprints/workbench-embeds.md "The CLI", "CLI verbs", "The CLI,
// workspace scope"): a single-use link that opens a document, or the person's whole workspace, live inside a
// developer tool's frame, and pairing the token with that tool once, for one scope. `workbench pair` waits on the
// person's browser, so the CLI runs it (CLI55).

import { z } from 'zod';
import { ApiError } from '@livedesign/api-client';
import {
  normaliseWorkbenchName,
  parseWorkbenchOrigin,
  WORKBENCH_NAME_MAX_LENGTH,
  type WorkbenchTicketRequest,
  type WorkbenchTicketResponse,
  type WorkbenchWorkspaceTicketResponse,
} from '@livedesign/api-schema';
import { readLibraries } from '../find-documents';
import { folderChoices, resolveFolderRef } from '../folders';
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

// Exactly one of a document and --workspace; --tab only with a document, --folder only with --workspace.
function usageRefusal(message: string, hint: string): AddressError {
  return new AddressError({
    kind: 'usage',
    what: 'document',
    input: '',
    candidates: [],
    message,
    hint,
  });
}

function checkScope(input: { doc?: string; workspace?: boolean; tab?: string; folder?: string }) {
  const workspace = input.workspace === true;
  if (workspace === (input.doc !== undefined))
    throw usageRefusal(
      'name a document, or --workspace',
      `livedesign workbench open --workspace --origin ${EXAMPLE_ORIGIN}`,
    );
  if (workspace && input.tab !== undefined)
    throw usageRefusal('--tab opens a tab of a document, not of the workspace', 'drop --tab');
  if (!workspace && input.folder !== undefined)
    throw usageRefusal(
      '--folder takes --workspace',
      `livedesign workbench open --workspace --folder <f>`,
    );
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
    'Mints a link that opens your document in the editor, or with --workspace your whole workspace in the Explorer (on Home, or the --folder), signed in as you, inside the workbench at --origin. The link works once, within a minute. A workbench the token is not paired with for that scope exits 4, naming workbench pair.',
  behaviour: 'write',
  input: z.object({
    doc: z
      .string()
      .optional()
      .describe('A name, id prefix or livedesign URL of your own document; or --workspace'),
    workspace: z.boolean().optional().describe('The whole workspace, in the Explorer'),
    folder: z
      .string()
      .optional()
      .describe('With --workspace, the folder it starts on: its id, id prefix or name'),
    tab: z
      .string()
      .optional()
      .describe("A tab name or id prefix; the document's first tab when omitted"),
    origin: originFlag,
  }),
  output: z.union([
    z.object({
      url: z.string(),
      documentId: z.string(),
      tabId: z.string().nullable(),
      expiresAt: z.number(),
    }),
    z.object({
      url: z.string(),
      scope: z.literal('workspace'),
      folderId: z.string().nullable(),
      expiresAt: z.number(),
    }),
  ]),
  run: async (ctx, input) => {
    checkScope(input);
    const origin = workbenchOriginOf(input.origin, 'open', ctx.log);
    if (input.doc === undefined) return mintWorkspace(ctx, origin, input.folder);
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
        hint: 'livedesign document ls',
      });
    }
    const request = await ticketRequestOf(ctx, { doc: input.doc, tab: input.tab }, origin);
    const minted = await mint<WorkbenchTicketResponse>(ctx, request, '');
    ctx.log(`workbench open minted ${minted.documentId}`);
    return minted;
  },
  text: ({ url }) => [url],
  cli: {
    positionals: ['doc'],
    examples: [
      `livedesign workbench open "Home screen" --origin ${EXAMPLE_ORIGIN} --json`,
      `livedesign workbench open --workspace --folder Minigames --origin ${EXAMPLE_ORIGIN} --json`,
    ],
    prints:
      'the link; --json { url, documentId, tabId, expiresAt }, or with --workspace { url, scope, folderId, expiresAt }',
  },
});

// POST /workbench/tickets; a 428 is the pairing this scope still needs (exit 4, naming the command that asks).
async function mint<T>(
  ctx: VerbContext,
  request: WorkbenchTicketRequest,
  pairFlag: string,
): Promise<T> {
  try {
    return await ctx.api.json<T>('/workbench/tickets', {
      method: 'POST',
      body: JSON.stringify(request),
    });
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
      message: pairFlag
        ? 'this workbench is not paired with your token for your whole workspace'
        : 'this workbench is not paired with your token',
      hint: `livedesign workbench pair --origin ${request.origin}${pairFlag}`,
    });
  }
}

// The whole workspace, on Home or the folder named (WB52): a folder the person cannot reach exits 3.
async function mintWorkspace(
  ctx: VerbContext,
  origin: string,
  folder: string | undefined,
): Promise<WorkbenchWorkspaceTicketResponse> {
  const folderId =
    folder === undefined
      ? undefined
      : resolveFolderRef(folderChoices(await readLibraries(ctx.api)), folder, '--folder').id;
  const minted = await mint<WorkbenchWorkspaceTicketResponse>(
    ctx,
    { scope: 'workspace', ...(folderId ? { folderId } : {}), origin },
    ' --workspace',
  );
  ctx.log(`workbench open minted workspace${folderId ? ' folder' : ''}`);
  return minted;
}

export const workbenchPair = defineVerb({
  id: 'workbench.pair',
  summary: 'Pair the token with a workbench, approved once in the browser',
  description:
    'Asks to pair this token with the workbench at --origin and waits until you answer in your signed-in browser; --workspace asks for your whole workspace, a second approval of its own. Prints the approval link first; opens it in the browser only when stdout is a terminal. Exits 0 once paired (at once when already paired for that scope), 4 when declined or expired.',
  behaviour: 'write',
  local: true,
  input: z.object({
    origin: originFlag,
    name: z.string().optional().describe('The workbench’s name, shown beside its origin'),
    workspace: z
      .boolean()
      .optional()
      .describe('Ask for the whole workspace, not one document at a time'),
  }),
  output: z.object({
    status: z.literal('paired'),
    origin: z.string(),
    name: z.string().nullable(),
    scope: z.enum(['document', 'workspace']),
  }),
  text: ({ origin, name, scope }) => [
    `paired ${origin}${name ? ` as ${name}` : ''}${scope === 'workspace' ? ' (whole workspace)' : ''}`,
  ],
  cli: {
    positionals: [],
    examples: [
      `livedesign workbench pair --origin ${EXAMPLE_ORIGIN} --name "Acme Editor"`,
      `livedesign workbench pair --origin ${EXAMPLE_ORIGIN} --workspace`,
    ],
    prints: 'the approval link, then paired <origin> [as <name>]',
  },
});
