// Describe a Page, `POST /api/page-drafts` (docs/specs/007-editor/describe-a-page.md; blueprint "The api"): the
// person's words made into what the next page of the tab holds, for an Editor of the document who is signed in. The
// AI is Ask's (@liveworkspace/ask/server openAiDraft): the key that applies, else built-in AI on Ask's daily count, and
// with Pro on one AI credit, spent once the page's words are in hand. The asks and their reading are
// page-drafts/page-draft-asks.ts. Nothing is made here: the editor makes the page from the answer, one edit. Every
// refusal is fixed words, never the model's; the words and the replies are never logged.
import {
  askCreditsOf,
  openAiDraft,
  spendAsk,
  type AiDraftCodes,
  type AiDraftSharedCode,
} from '@liveworkspace/ask/server';
import { ASK_MAX_ID_CHARS } from '@liveworkspace/ask';
import { personAiKey } from '@liveworkspace/auth-client/ai-key';
import { AI_CREDIT_COSTS } from '@liveworkspace/subscription';
import {
  PAGE_DRAFT_PROMPT_MAX,
  type PageDraft,
  type PageDraftError,
  type PageDraftResponse,
} from '@livedocuments/api-schema';
import type { PageKind } from '@livedocuments/document';
import { accountCredentials } from '../auth/accounts';
import {
  chooseLayoutRequest,
  fillLayoutRequest,
  isLaidKind,
  readLayoutChoice,
  readLayoutFill,
  withPlaceholderNote,
  readWriting,
  writePageRequest,
} from '../page-drafts/page-draft-asks';
import { json, methodNotAllowed, notFound, signInRequired } from '../responses';
import { readBody, type RouteContext } from './context';
import { resolveDocumentGrant } from './document-grant';

const KINDS: readonly PageKind[] = ['slide', 'infographic', 'article', 'flashcard'];

const NOUN: Record<PageKind, string> = {
  slide: 'a slide',
  infographic: 'a page',
  article: 'an article',
  flashcard: 'a card',
};

export const PAGE_DRAFT_WORDS = {
  needsAccount: 'Sign in to describe a page with AI.',
  invalid: 'Describe the page in 1 to 500 characters.',
  forbidden: 'Only an Editor of this document can add a page to it.',
  offTopic: (kind: PageKind) =>
    `That doesn't describe ${NOUN[kind]}. Say what it should be about and what it should say.`,
  unreadable: "The AI's answer couldn't be read. Try again, or say it another way.",
  notSetUp:
    "Built-in AI isn't set up on this server. Add your own AI key in Settings to describe a page.",
  limit: "You have used today's built-in AI. Try again tomorrow, or use your own AI key.",
  countFailed: "The built-in AI couldn't answer just now. Try again in a moment.",
  used: "This month's AI credits are used. You can still add a page and lay it out yourself.",
} as const;

const CODES: AiDraftCodes<Exclude<PageDraftError, AiDraftSharedCode>> = {
  unavailable: 'page_draft_unavailable',
  limit: 'page_draft_built_in_limit',
  failed: 'page_draft_failed',
};

const refuse = (
  status: number,
  error: PageDraftError,
  message: string,
  more: Record<string, unknown> = {},
) => json({ error, message, ...more }, { status });

const idOf = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 && v.length <= ASK_MAX_ID_CHARS ? v : null;

export async function handlePageDrafts(ctx: RouteContext): Promise<Response> {
  if (ctx.segments.length !== 2) return notFound();
  if (ctx.request.method !== 'POST') return methodNotAllowed();
  // Signed in: a guest is told it needs an account, and no identity at all is asked to sign in.
  const accountId = ctx.verifiedUserId;
  if (!accountId)
    return ctx.resolveOwner()
      ? refuse(403, 'page_draft_needs_account', PAGE_DRAFT_WORDS.needsAccount)
      : signInRequired();
  const body = await readBody(ctx);
  if (body instanceof Response) return body;
  const prompt = typeof body['prompt'] === 'string' ? body['prompt'].trim() : '';
  const kind = KINDS.find((k) => k === body['kind']);
  const documentId = idOf(body['documentId']);
  const tabId = idOf(body['tabId']);
  if (!prompt || prompt.length > PAGE_DRAFT_PROMPT_MAX || !kind || !documentId || !tabId)
    return refuse(400, 'page_draft_invalid', PAGE_DRAFT_WORDS.invalid);
  // An Editor of the document, on the tab a tab-scoped link opens when it is one; never in the Trash.
  const grant = await resolveDocumentGrant(ctx, documentId);
  if (grant instanceof Response) return grant;
  if (!grant || grant.level !== 'edit' || grant.trashed || (grant.tab && grant.tab !== tabId))
    return refuse(403, 'page_draft_forbidden', PAGE_DRAFT_WORDS.forbidden);

  const { env } = ctx;
  const door = {
    request: ctx.request,
    accountId,
    itemId: documentId,
    aiKey: (teamId: string | null) => personAiKey(accountCredentials(env), ctx, teamId),
    builtIn: env.AI ?? null,
    spend: (who: string, now: number) => spendAsk(env.DOCUMENT_ROOM, who, now),
    // Null with Pro off: no grant is read and the subscription service is never asked.
    credits: askCreditsOf({
      env,
      app: 'livedocuments.app',
      rooms: env.DOCUMENT_ROOM,
      teams: ctx.teams,
      grant: (itemId) => resolveDocumentGrant(ctx, itemId),
    }),
  };
  const ai = await openAiDraft(door, {
    accountId,
    teamId: idOf(body['teamId']),
    builtInChosen: body['ai'] === 'built-in',
    codes: CODES,
    words: PAGE_DRAFT_WORDS,
    refuse,
    log: 'page-draft',
  });
  if ('refused' in ai) return ai.refused;

  const started = Date.now();
  let asks = 0;
  // The kind, the layout picked, how many asks and how long: never the words or a reply.
  const done = (answer: string, response: Response, layout?: string) => {
    console.info('[page-draft] draft', {
      answer,
      kind,
      layout,
      asks,
      tookMs: Date.now() - started,
    });
    return response;
  };
  const ask = async (request: Parameters<typeof ai.ask>[0]) => {
    asks += 1;
    return ai.ask(request);
  };
  const offTopic = () =>
    done('off_topic', refuse(422, 'page_draft_off_topic', PAGE_DRAFT_WORDS.offTopic(kind)));
  const unreadable = () =>
    done('unreadable', refuse(422, 'page_draft_unreadable', PAGE_DRAFT_WORDS.unreadable));

  let draft: PageDraft;
  let model: string;
  if (isLaidKind(kind)) {
    const chose = await ask(chooseLayoutRequest(kind, prompt));
    if ('refused' in chose) return done('failed', chose.refused);
    const choice = readLayoutChoice(kind, chose.text);
    if ('offTopic' in choice) return offTopic();
    if ('unreadable' in choice) return unreadable();
    const { layout } = choice;
    const request = fillLayoutRequest(kind, layout, prompt);
    let filled = await ask(request);
    if ('refused' in filled) return done('failed', filled.refused, layout.id);
    let fill = readLayoutFill(layout, filled.text, prompt);
    // Placeholders ("[Insert number here]", "N/A") are never laid on a page: asked once more, told so; a second
    // reply that still has some keeps its real words, the placeholders' slots dropped.
    if (fill && fill.placeholders > 0) {
      const again = await ask(withPlaceholderNote(request));
      const reread = 'refused' in again ? null : readLayoutFill(layout, again.text, prompt);
      if (reread && reread.placeholders <= fill.placeholders && !('refused' in again)) {
        fill = reread;
        filled = again;
      }
    }
    if (!fill) return unreadable();
    draft = {
      kind: 'layout',
      layout: layout.id,
      label: layout.label,
      text: fill.text,
      ...(fill.name ? { name: fill.name } : {}),
    };
    model = filled.model;
  } else {
    const request = writePageRequest(kind, prompt);
    let wrote = await ask(request);
    if ('refused' in wrote) return done('failed', wrote.refused);
    let writing = readWriting(wrote.text, prompt);
    // As a fill: once more on placeholders, keeping whichever reply has fewer; their lines are dropped either way.
    if ('placeholders' in writing && writing.placeholders > 0) {
      const again = await ask(withPlaceholderNote(request));
      const reread = 'refused' in again ? null : readWriting(again.text, prompt);
      if (
        reread &&
        'placeholders' in reread &&
        reread.placeholders <= writing.placeholders &&
        !('refused' in again)
      ) {
        writing = reread;
        wrote = again;
      }
    }
    if ('offTopic' in writing) return offTopic();
    if ('unreadable' in writing) return unreadable();
    draft = { kind: 'writing', markdown: writing.markdown };
    model = wrote.model;
  }
  // The credit, now the page's words are in hand (Pro on, built-in AI only).
  const unpaid = await ai.charge(AI_CREDIT_COSTS.pageDraft);
  if (unpaid) return done('capped', unpaid);
  const answer: PageDraftResponse = { draft, provider: ai.provider, model };
  return done('drafted', json(answer), draft.kind === 'layout' ? draft.layout : undefined);
}
