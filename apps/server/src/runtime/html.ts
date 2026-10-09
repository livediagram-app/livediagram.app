import type { HtmlHandlers, HtmlTransformer, HtmlTransformerFactory } from '@livediagram/runtime';

// \`HTMLRewriter\` for the self-hosted runtime
// (docs/specs/016-platform/blueprints/self-hosted-runtime.md, "The runtime seam").
//
// It is not a general HTML rewriter: the only caller is link unfurling, which
// reads \`<title>\`, \`<meta>\` and \`<link>\` out of a page's head and never modifies
// the document. That is exactly what this implements, which is why it needs no
// parser dependency.
//
// The stream is passed through unchanged: handlers run when the caller has read
// the body to the end (or stopped reading at its byte cap), the same as the
// platform's streaming rewriter.

const TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const META = /<meta\s+([^>]*?)\/?>/gi;
const LINK = /<link\s+([^>]*?)\/?>/gi;
const ATTRIBUTE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function attributesOf(source: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of source.matchAll(ATTRIBUTE)) {
    const name = match[1]?.toLowerCase();
    if (!name) continue;
    found.set(name, match[2] ?? match[3] ?? match[4] ?? '');
  }
  return found;
}

function elementOf(attributes: Map<string, string>) {
  return {
    getAttribute: (name: string) => attributes.get(name.toLowerCase()) ?? null,
    setAttribute: () => {},
    remove: () => {},
    text: () => '',
  };
}

function runHandlers(html: string, handlers: Map<string, HtmlHandlers>): void {
  const title = handlers.get('title');
  if (title?.text) {
    const match = TITLE.exec(html);
    if (match?.[1] !== undefined) title.text({ text: match[1], remove: () => {} });
  }
  const meta = handlers.get('meta');
  if (meta?.element) {
    for (const match of html.matchAll(META)) {
      if (match[1]) meta.element(elementOf(attributesOf(match[1])));
    }
  }
  const link = handlers.get('link');
  if (link?.element) {
    for (const match of html.matchAll(LINK)) {
      if (match[1]) link.element(elementOf(attributesOf(match[1])));
    }
  }
}

export function nodeHtml(): HtmlTransformerFactory {
  return () => {
    const handlers = new Map<string, HtmlHandlers>();
    const transformer: HtmlTransformer = {
      on: (selector, next) => {
        handlers.set(selector, next);
        return transformer;
      },
      transform: (response) => {
        const decoder = new TextDecoder();
        let seen = '';
        const stream = new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            controller.enqueue(chunk);
            seen += decoder.decode(chunk, { stream: true });
          },
          flush() {
            runHandlers(seen, handlers);
          },
        });
        return new Response(response.body?.pipeThrough(stream) ?? null, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      },
    };
    return transformer;
  };
}
