// A share link's page head (liveworkspace/docs/specs/006-media/previews.md "The share page's head"), the same in every app. An app's
// share page (`/<item>/shared?s=<code>`) is the same static shell as every item, so a link preview, whose crawler
// never runs the page's script, would see the app's name over an empty box. For a link whose preview may name its
// item, the previews service answers its name (`GET /api/previews/share/<code>/card`), and the shell's head is
// rewritten to carry it and the share card before it is sent.
//
// When the service is slow, unreachable or says no, the shell goes out as built, with the brand card the app's
// layout declares. Each app only says what is its own: which path is its share page, and its words.

import { oembedDiscoveryTag } from './oembed';
import { previewSharePath } from './previews';
import { fetchShareCard, type ShareCardOptions } from './share-card';

export { SHARE_CARD_TIMEOUT_MS } from './share-card';

// The few Workers runtime types used here, written out so an app's DOM-lib typecheck covers this file too.
type RewriterElement = {
  setAttribute(name: string, value: string): void;
  setInnerContent(content: string): void;
  append(content: string, options: { html: boolean }): void;
};
type Rewriter = {
  on(selector: string, handlers: { element(el: RewriterElement): void }): Rewriter;
  transform(response: Response): Response;
};
declare const HTMLRewriter: new () => Rewriter;

// A preview line is one line: a name with newlines or runs of spaces would wrap oddly in every chat app.
const NAME_MAX = 200;

export type SharePageConfig = {
  /** The app's name as a reader knows it ("livediagram"): the image's alt text says the item was drawn in it. */
  app: string;
  /** The app's share page addresses. */
  pagePath: RegExp;
  /** The title for an item with a blank name ("Untitled document"). */
  untitled: string;
  /** What a named preview says under the item's name. */
  pitch: string;
};

export type ShareHead = {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  /** The oEmbed discovery tag (./oembed.ts), so a pasted link unfolds into its embed. */
  oembedLink: string;
};

export type SharePageOptions = ShareCardOptions;

// Plain functions, not methods, so an app can destructure them.
export type SharePage = {
  isSharePagePath: (pathname: string) => boolean;
  /** The head for the link `code` opens at `origin` + `pathname` (the share page's own address). */
  shareHead: (name: string, code: string, origin: string, pathname: string) => ShareHead;
  /** The shell, its head naming the item when the service allows it. */
  sharePage: (
    request: Request,
    shell: () => Promise<Response>,
    options?: SharePageOptions,
  ) => Promise<Response>;
};

export function createSharePage(config: SharePageConfig): SharePage {
  const shareHead = (name: string, code: string, origin: string, pathname: string): ShareHead => {
    const title = name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) || config.untitled;
    return {
      title,
      description: config.pitch,
      // On the app's own origin, which its router forwards to the service.
      image: `${origin}${previewSharePath(code, 'image.png')}`,
      imageAlt: `${title}, drawn in ${config.app}`,
      oembedLink: oembedDiscoveryTag(origin, pathname, code, title),
    };
  };

  return {
    isSharePagePath: (pathname) => config.pagePath.test(pathname),
    shareHead,
    async sharePage(request, shell, options = {}) {
      const url = new URL(request.url);
      const code = url.searchParams.get('s');
      if (!code || request.method !== 'GET') return shell();
      // Both at once, so a visitor waits for the slower of the two, never their sum.
      const [page, card] = await Promise.all([
        shell(),
        fetchShareCard(request, code, options, 'share-page'),
      ]);
      if (typeof card === 'string' || !page.ok) return page;
      return withShareHead(page, shareHead(card.name, code, url.origin, url.pathname));
    },
  };
}

// The shell's head, rewritten to name the item. The selectors match what each app's layout metadata emits.
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
    .on('head', { element: (el) => void el.append(head.oembedLink, { html: true }) })
    .transform(shell);
}
