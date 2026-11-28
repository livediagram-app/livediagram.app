// What a chat shows (docs/specs/030-knowledgebase/chat-apps.md "What an answer shows", "Link previews"): Ask's
// answer read from the room's own stream, and a page's preview from its read and its health, both in the person's
// access, turned into @liveworkspace/chat's answer and preview. The words are the app's; the markup is the builders'.
import type {
  AskEvent,
  AskSource,
  KnowledgePageRead,
  KnowledgePageTrust,
  PageHealthResponse,
} from '@liveknowledge/api-schema';
import { answerParts, readEvents } from '@liveworkspace/ask';
import { plainCut, type ChatAnswer, type ChatPreview, type ChatTrust } from '@liveworkspace/chat';
import { appBaseUrl } from '../email/client';
import type { Env } from '../types';
import { callAsPerson, type ChatPersonDeps } from './chat-as-person';

/** What a chat says instead of an answer, already in the app's words. */
export type ChatRefusal = { refused: string };

export const NO_ACCESS =
  "You can't open this knowledgebase with your liveknowledge account. Ask one of its Editors to share it with you.";
const PAGES_ONLY =
  'Your access covers only some pages of this knowledgebase, and Ask answers from the whole of it. Open the pages in liveknowledge instead.';
const NOT_ANSWERED = "liveknowledge couldn't answer just now. Try again in a minute.";

const enc = encodeURIComponent;

export const pageUrl = (env: Env, knowledgebase: string, tab: string) =>
  `${appBaseUrl(env)}/document/${enc(knowledgebase)}#t=${enc(tab)}`;

/** The knowledgebase and page a pasted link names on this app's origin (www or not), or null. */
export function pageOfLink(env: Env, link: string): { knowledgebase: string; tab: string } | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  const home = new URL(appBaseUrl(env));
  const bare = (host: string) => host.replace(/^www\./, '');
  if (url.protocol !== home.protocol || bare(url.host) !== bare(home.host)) return null;
  const match = /^\/document\/([^/]+)\/?$/.exec(url.pathname);
  const tab = new URLSearchParams(url.hash.slice(1)).get('t');
  if (!match || !tab) return null;
  try {
    return { knowledgebase: decodeURIComponent(match[1]!), tab };
  } catch {
    return null;
  }
}

export function chatTrust(trust: {
  state: string;
  verifiedAt?: number;
  verifiedBy?: string;
}): ChatTrust {
  if (trust.state === 'verified' && trust.verifiedAt !== undefined)
    return {
      state: 'verified',
      verifiedAt: trust.verifiedAt,
      ...(trust.verifiedBy ? { verifiedBy: trust.verifiedBy } : {}),
    };
  if (trust.state === 'review-due')
    return {
      state: 'due',
      ...(trust.verifiedAt === undefined ? {} : { verifiedAt: trust.verifiedAt }),
    };
  if (trust.state === 'off') return { state: 'off' };
  return { state: 'never' };
}

const isAskEvent = (value: unknown): value is AskEvent =>
  !!value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string';

async function refusalOf(res: Response): Promise<ChatRefusal> {
  const body = await res
    .json<{ error?: string; message?: string }>()
    .catch((): { error?: string; message?: string } => ({}));
  if (body.error === 'no_access' || res.status === 404) return { refused: NO_ACCESS };
  if (res.status === 403 && !body.message) return { refused: PAGES_ONLY };
  return { refused: body.message ?? NOT_ANSWERED };
}

const verifiedLine = (sources: AskSource[]) => {
  if (sources.length === 0) return null;
  const verified = sources.filter((s) => s.trust === 'verified').length;
  if (verified === 0) return 'None of these pages is verified.';
  const pages = (n: number) => `${n} verified page${n === 1 ? '' : 's'}`;
  return verified === sources.length
    ? `Answered from ${pages(verified)}.`
    : `Answered from ${pages(verified)} of ${sources.length}.`;
};

/** Ask's answer to `question`, as `person`, ready for the builders; or what to say instead. */
export async function askAsPerson(
  env: Env,
  deps: ChatPersonDeps,
  ask: { knowledgebase: string; person: string; question: string },
): Promise<ChatAnswer | ChatRefusal> {
  const res = await callAsPerson(env, deps, {
    knowledgebase: ask.knowledgebase,
    person: ask.person,
    method: 'POST',
    path: `/api/documents/${enc(ask.knowledgebase)}/ask`,
    body: { question: ask.question },
  });
  if (!res.ok || !res.body || !res.headers.get('content-type')?.includes('text/event-stream'))
    return refusalOf(res);
  for await (const event of readEvents(res.body as ReadableStream<Uint8Array>, isAskEvent)) {
    if (event.type === 'error') return { refused: event.message || NOT_ANSWERED };
    if (event.type !== 'done') continue;
    // Pages only: no other app's item is read without the person's own bearer.
    const sources = event.sources.filter((s) => !s.source);
    const numbers = new Set(sources.map((s) => s.number));
    return {
      question: ask.question,
      parts: answerParts(event.text, numbers),
      sources: sources.map((s) => ({
        number: s.number,
        title: s.title,
        url: pageUrl(env, ask.knowledgebase, s.tab),
        trust: chatTrust({ state: s.trust, ...(s.verifiedAt ? { verifiedAt: s.verifiedAt } : {}) }),
        ...(s.health ? { health: { score: s.health.score, label: s.health.label } } : {}),
      })),
      trustLine: verifiedLine(sources),
      gaps: event.gaps,
      gapsNote: event.gaps.length
        ? "Sent to the knowledgebase's Unanswered Questions, for its Editors to cover."
        : null,
      footer: event.provider === 'built-in' ? 'liveknowledge · Built-In AI' : 'liveknowledge',
      open: {
        label: 'Open in liveknowledge',
        url: `${appBaseUrl(env)}/document/${enc(ask.knowledgebase)}`,
      },
      share: null,
    };
  }
  return { refused: NOT_ANSWERED };
}

/** The first words of a page's Markdown as plain text: no marks, links as their words. */
export function excerptOf(markdown: string): string {
  const text = markdown
    .split('\n')
    .filter((line) => !/^\s*(#|>|```|\||-{3,})/.test(line))
    .join(' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/^\s*[-+]\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plainCut(text, 300);
}

/** A page's preview as `person`, or null when they can't read it (nothing is shown, as for any link). */
export async function previewAsPerson(
  env: Env,
  deps: ChatPersonDeps,
  look: { knowledgebase: string; tab: string; person: string },
): Promise<ChatPreview | null> {
  const base = `/api/documents/${enc(look.knowledgebase)}/pages/${enc(look.tab)}`;
  const as = (path: string) =>
    callAsPerson(env, deps, {
      knowledgebase: look.knowledgebase,
      person: look.person,
      method: 'GET',
      path,
    });
  const read = await as(`${base}?maxChars=1200`);
  if (!read.ok) return null;
  const { page } = await read.json<{ page: KnowledgePageRead }>();
  const health = await as(`${base}/health`);
  const fields = health.ok ? await health.json<PageHealthResponse>() : null;
  const ownerId = fields?.knowledge.owner;
  const trust: KnowledgePageTrust = page.trust;
  return {
    title: page.title,
    url: pageUrl(env, look.knowledgebase, look.tab),
    excerpt: excerptOf(page.markdown),
    owner: (ownerId && fields?.names?.[ownerId]) || null,
    trust: chatTrust(trust),
    footer: 'liveknowledge',
  };
}
