// The share page's head (docs/specs/013-workspace/share-link-previews.md). `/design/shared?s=<code>` is the same
// static shell as every design, so a link preview, whose crawler never runs the page's script, saw "livedesign"
// over an empty box. For a link whose preview may name its design, the api answers its name, and the shell's head
// is rewritten to carry it and the share card before it is sent.
//
// Without the API binding (a self-host that leaves it out), or when the api is slow or says no, the shell goes out as
// built, with the brand card the root layout declares.

import {
  shareCardImagePath,
  sharePreviewCardPath,
  type SharePreviewResponse,
} from '@livedesign/api-schema';

// The few runtime types used here, written out so the app's one DOM-lib typecheck covers this file too.
export type Fetcher = { fetch: (input: Request | string, init?: RequestInit) => Promise<Response> };
type RewriterElement = {
  setAttribute(name: string, value: string): void;
  setInnerContent(content: string): void;
};
type Rewriter = {
  on(selector: string, handlers: { element(el: RewriterElement): void }): Rewriter;
  transform(response: Response): Response;
};
declare const HTMLRewriter: new () => Rewriter;

// How long the page waits on the api before sending the plain shell. The card is three indexed D1 reads (tens of
// milliseconds), so this only bites when the api is in trouble.
export const SHARE_CARD_TIMEOUT_MS = 1500;

// What a named preview says under the design's name.
export const SHARE_PITCH =
  'Open it in livedesign: diagrams, whiteboards and designs, made together.';

// A preview line is one line: a name with newlines or runs of spaces would wrap oddly in every chat app.
const NAME_MAX = 200;

export function isSharePagePath(pathname: string): boolean {
  return /^\/(?:design|diagram)\/shared\/?$/.test(pathname);
}

type ShareHead = { title: string; description: string; image: string; imageAlt: string };

export function shareHead(name: string, code: string, origin: string): ShareHead {
  const title = name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) || 'Untitled design';
  return {
    title,
    description: SHARE_PITCH,
    image: `${origin}/api${shareCardImagePath(code)}`,
    imageAlt: `${title}, drawn in livedesign`,
  };
}

// The name the api lets this link's preview show, or null for every other answer.
async function sharePreviewName(
  api: Fetcher,
  request: Request,
  origin: string,
  code: string,
): Promise<string | null> {
  const headers = new Headers();
  // The api limits previews per visitor; without this it would see the live worker as one caller.
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) headers.set('CF-Connecting-IP', ip);
  try {
    const res = await api.fetch(`${origin}/api${sharePreviewCardPath(code)}`, {
      headers,
      signal: AbortSignal.timeout(SHARE_CARD_TIMEOUT_MS),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn('[share-page] api answered', res.status);
      return null;
    }
    const body = (await res.json()) as Partial<SharePreviewResponse>;
    return typeof body.name === 'string' ? body.name : null;
  } catch (err) {
    console.warn('[share-page] api unreachable', String(err));
    return null;
  }
}

// The shell's head, rewritten to name the design. The selectors match what app/layout.tsx's metadata emits.
function withShareHead(shell: Response, head: ShareHead): Response {
  const set = (value: string) => ({
    element(el: RewriterElement) {
      el.setAttribute('content', value);
    },
  });
  return new HTMLRewriter()
    .on('title', { element: (el) => void el.setInnerContent(head.title) })
    .on('meta[name="description"]', set(head.description))
    .on('meta[property="og:title"]', set(head.title))
    .on('meta[property="og:description"]', set(head.description))
    .on('meta[property="og:image"]', set(head.image))
    .on('meta[property="og:image:alt"]', set(head.imageAlt))
    .on('meta[name="twitter:title"]', set(head.title))
    .on('meta[name="twitter:description"]', set(head.description))
    .on('meta[name="twitter:image"]', set(head.image))
    .transform(shell);
}

// The share page: the shell, its head naming the design when the api allows it. `shell` is the placeholder
// request the editor route serves for every design address.
export async function sharePage(
  request: Request,
  api: Fetcher | undefined,
  shell: () => Promise<Response>,
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('s');
  if (!api || !code || request.method !== 'GET') return shell();
  // Both at once, so a visitor waits for the slower of the two, never their sum.
  const [page, name] = await Promise.all([
    shell(),
    sharePreviewName(api, request, url.origin, code),
  ]);
  if (name === null || !page.ok) return page;
  return withShareHead(page, shareHead(name, code, url.origin));
}
