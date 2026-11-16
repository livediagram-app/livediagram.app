// Canvas suggestions over REST (liveworkspace/docs/specs/014-suggestions/canvas-suggestions.md "The routes"):
//   GET  /api/designs/<id>/tabs/<tabId>/suggestions          the tab's suggestions
//   POST /api/designs/<id>/tabs/<tabId>/suggestions          suggest `{ ops }`
//   POST /api/designs/<id>/tabs/<tabId>/suggestions/accept   `{ ids }` or `{ all: true }`: one changeset
//   POST /api/designs/<id>/tabs/<tabId>/suggestions/reject   the same, removing them
// The rule is @liveworkspace/suggestions' (answerSuggestions); this door resolves the caller, the tab and the
// item's own element rules, and tells the room when the tab's suggestions changed.
import { collabKeyFor } from '@liveworkspace/api-kit/collab-key';
import {
  answerSuggestions,
  type SuggestionAction,
  type SuggestionLevel,
} from '@liveworkspace/suggestions/route';
import { suggestionStore } from '@liveworkspace/suggestions/store';
import { mintSuggestionId, type SuggestionAuthor } from '@liveworkspace/suggestions';
import { suggestionsRoomOp } from '@liveworkspace/suggestions/room-signal';
import {
  applyElementOps,
  elementFingerprint,
  isValidElement,
  isValidTab,
  type Element,
  type Tab,
} from '@livedesign/design';
import { acceptWriter } from '../changesets/accept';
import { frontDoorOf } from '../changesets/front-door';
import { readStoredTab } from '../changesets/stored-tab';
import { getDesign } from '../db';
import { getParticipant } from '../accounts/profiles';
import { forbidden, json, notFound } from '../responses';
import { roomFetch } from '../room-client';
import { authorOf } from './changesets';
import { grantOn, missingDesign, requireOwner, type DesignRouteContext } from './context';

// How long a write waits on the room's word to its sessions: the suggestion is stored either way.
const SUGGESTIONS_RELAY_MS = 2_000;

const ACTIONS: Record<string, SuggestionAction> = { accept: 'accept', reject: 'reject' };

function actionOf(ctx: DesignRouteContext): SuggestionAction | null {
  const { segments, request } = ctx;
  if (segments[1] !== 'designs' || segments[3] !== 'tabs' || segments[5] !== 'suggestions')
    return null;
  if (segments.length === 6) {
    if (request.method === 'GET') return 'list';
    if (request.method === 'POST') return 'submit';
    return null;
  }
  if (segments.length === 7 && request.method === 'POST') return ACTIONS[segments[6]!] ?? null;
  return null;
}

/** Null when the path is not a suggestion route. */
export async function handleSuggestionRoutes(ctx: DesignRouteContext): Promise<Response | null> {
  const action = actionOf(ctx);
  if (!action) return null;
  const id = ctx.segments[2]!;
  const tabId = ctx.segments[4]!;
  const owner = requireOwner(ctx);
  if (owner instanceof Response) return owner;
  const design = await getDesign(ctx.env, id);
  if (!design) return missingDesign(ctx, id);
  const grant = grantOn(ctx, id);
  if (!grant) return forbidden();
  // A grant confined to another tab reads this one as missing (no existence leak).
  if (grant.tabScope !== null && grant.tabScope !== tabId) return notFound();
  if (ctx.token?.readOnly && action !== 'list') return forbidden('read_only_token');
  const level: SuggestionLevel = grant.role;
  const participant = level === 'view' ? null : await getParticipant(ctx.env, owner);
  const author: SuggestionAuthor | null =
    level === 'view'
      ? null
      : {
          key: await collabKeyFor(owner),
          name: participant?.name ?? 'Someone',
          color: participant?.color ?? '#0ea5e9',
        };
  const body = action === 'list' ? null : await ctx.request.json().catch(() => null);
  // The tab as stored, read once per request: its own fields frame a validity check of the changed elements.
  let shell: Tab | null = null;
  const answer = await answerSuggestions<Element>(action, body, {
    level,
    author,
    tabId,
    store: suggestionStore<Element>(ctx.env.DESIGN_DB),
    model: { fingerprint: elementFingerprint, apply: applyElementOps },
    parseElement: (v) => (isValidElement(v) ? v : null),
    readElements: async () => {
      shell = (await readStoredTab(ctx.env, id, tabId))?.tab ?? null;
      return shell?.elements ?? null;
    },
    isValid: (elements) => shell !== null && isValidTab({ ...shell, elements }),
    writeAccepted: async (decide) =>
      acceptWriter({
        env: ctx.env,
        design: design,
        tabId,
        author: await authorOf(ctx, owner),
        frontDoor: frontDoorOf(ctx.request),
        ...(ctx.waitUntil ? { waitUntil: ctx.waitUntil } : {}),
      })(decide),
    changed: () => tellRoom(ctx, id, tabId),
    now: () => Date.now(),
    mintId: () => mintSuggestionId(),
    log: (event, fields) => console.info(event, { designId: id, ...fields }),
  });
  return json(answer.body, { status: answer.status });
}

async function tellRoom(ctx: DesignRouteContext, id: string, tabId: string): Promise<void> {
  try {
    await roomFetch(
      ctx.env,
      id,
      '/suggestions',
      { method: 'POST', body: JSON.stringify(suggestionsRoomOp(tabId)) },
      SUGGESTIONS_RELAY_MS,
    );
  } catch (error) {
    // Stored either way: an editor reads them again when it next opens the tab.
    console.warn('[suggestion] relay-failed', { designId: id, tabId, error: String(error) });
  }
}
