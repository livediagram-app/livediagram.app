// Markdown for agents, the build side (liveworkspace/docs/specs/010-site/markdown-for-agents.md "What the Markdown
// holds"): one exported page's HTML to its Markdown. Runs at build time only, over the static export, never on a
// request.
import { fromHtml } from 'hast-util-from-html';
import { toMdast } from 'hast-util-to-mdast';
import { gfmToMarkdown } from 'mdast-util-gfm';
import { toMarkdown } from 'mdast-util-to-markdown';

type Root = ReturnType<typeof fromHtml>;
type Child = Root['children'][number];
type Element = Extract<Child, { type: 'element' }>;
type Parent = Root | Element;

/** Elements only a browser needs: never in the Markdown, nor anything inside them. */
const DROPPED = new Set([
  'audio',
  'button',
  'canvas',
  'dialog',
  'embed',
  'form',
  'iframe',
  'input',
  'link',
  'meta',
  'nav',
  'noscript',
  'object',
  'script',
  'select',
  'style',
  'svg',
  'template',
  'textarea',
  'video',
]);

/** One page's Markdown and what its head says about it. */
export type PageMarkdown = {
  title: string;
  description: string;
  /** The page's canonical address, else the one it was built for. */
  url: string;
  /** The whole file: the front matter, then the page's content. */
  markdown: string;
};

function isElement(node: Child | Root): node is Element {
  return node.type === 'element';
}

/** A title's words: its text children (a title holds nothing else). */
function textOf(el: Element): string {
  return el.children
    .filter((child) => child.type === 'text')
    .map((child) => (child as { value: string }).value)
    .join('');
}

function find(node: Parent, test: (el: Element) => boolean): Element | undefined {
  for (const child of node.children) {
    if (!isElement(child)) continue;
    if (test(child)) return child;
    const inner = find(child, test);
    if (inner) return inner;
  }
  return undefined;
}

function stringProp(el: Element, name: string): string {
  const value = el.properties[name];
  if (Array.isArray(value)) return value.join(' ');
  return typeof value === 'string' ? value : '';
}

/** Whether an element is left out: its tag, hidden, aria-hidden, marked `data-agent-skip`, or a picture with no words
 *  (decorative, `alt=""`) or inlined as a `data:` address. */
function dropped(el: Element): boolean {
  if (DROPPED.has(el.tagName)) return true;
  const { properties } = el;
  if (properties.hidden !== undefined && properties.hidden !== false) return true;
  if (properties.ariaHidden === 'true') return true;
  if (properties.dataAgentSkip !== undefined) return true;
  if (el.tagName === 'img') {
    const src = stringProp(el, 'src');
    return !src || src.startsWith('data:') || !stringProp(el, 'alt').trim();
  }
  return false;
}

/** Elements that say nothing once emptied (their buttons and pictures dropped): left out rather than written as a
 *  bare list marker or an empty link. */
const EMPTY_DROPPED = new Set([
  'a',
  'blockquote',
  'dd',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'ol',
  'p',
  'ul',
]);

function hasContent(node: Child | Root): boolean {
  if (node.type === 'text') return node.value.trim().length > 0;
  if (node.type === 'element' && node.tagName === 'img') return true;
  return 'children' in node && node.children.some(hasContent);
}

const space = (): Child => ({ type: 'text', value: ' ' });

/** React's streamed Suspense boundaries, by id: the hidden `<div id="S:n">` each holds the content that replaces the
 *  `<template id="B:n">` placeholder (and its fallback, up to the `<!--/$-->` that closes it). */
function streamed(root: Root): Map<string, Element> {
  const found = new Map<string, Element>();
  const walk = (node: Parent) => {
    for (const child of node.children) {
      if (!isElement(child)) continue;
      const id = stringProp(child, 'id');
      if (child.tagName === 'div' && id.startsWith('S:')) found.set(id.slice(2), child);
      walk(child);
    }
  };
  walk(root);
  return found;
}

/** `node`'s children with the dropped elements gone and each streamed boundary put back in place, recursively. */
function clean(node: Parent, boundaries: Map<string, Element>): void {
  const out: Child[] = [];
  const children = node.children as Child[];
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    if (child.type === 'comment' || child.type === 'doctype') continue;
    if (!isElement(child)) {
      out.push(child);
      continue;
    }
    const id = stringProp(child, 'id');
    const boundary =
      child.tagName === 'template' && id.startsWith('B:') ? boundaries.get(id.slice(2)) : undefined;
    if (boundary) {
      // The fallback runs to the boundary's closing comment.
      while (i + 1 < children.length) {
        const next = children[i + 1]!;
        i++;
        if (next.type === 'comment' && next.value === '/$') break;
      }
      const content: Element = { ...boundary, properties: {}, children: [...boundary.children] };
      clean(content, boundaries);
      out.push(...(content.children as Child[]));
      continue;
    }
    if (dropped(child)) continue;
    clean(child, boundaries);
    if (EMPTY_DROPPED.has(child.tagName) && !hasContent(child)) continue;
    // A question's summary reads as one: bold, on a line of its own.
    if (child.tagName === 'summary') {
      child.tagName = 'p';
      child.children = [
        { type: 'element', tagName: 'strong', properties: {}, children: child.children },
      ];
    }
    // Two elements side by side with no text between them are laid out apart on the page (a card's title over its
    // line): a space keeps their words apart ("Blank Diagram An empty canvas", not "Blank DiagramAn empty canvas").
    const before = out[out.length - 1];
    if (before?.type === 'element' && before.tagName !== 'br') out.push(space());
    out.push(child);
  }
  (node as { children: Child[] }).children = out;
}

/** A front matter value: a JSON string is a valid YAML double-quoted scalar. */
const yaml = (value: string) => JSON.stringify(value);

/**
 * One exported page's Markdown: the page's `<main>` (else its `<body>`) as GitHub-flavoured Markdown, under a front
 * matter block of its title, description and canonical address. `url` is the address it was built for, used when the
 * page names no canonical. Null for a page with nothing to say (no main content).
 */
export function pageToMarkdown(html: string, url: string): PageMarkdown | null {
  const doc = fromHtml(html);
  const head = find(doc, (el) => el.tagName === 'head');
  const titleEl = head && find(head, (el) => el.tagName === 'title');
  const title = (titleEl ? textOf(titleEl) : '').trim();
  const descriptionEl =
    head && find(head, (el) => el.tagName === 'meta' && stringProp(el, 'name') === 'description');
  const description = descriptionEl ? stringProp(descriptionEl, 'content').trim() : '';
  const canonicalEl =
    head &&
    find(
      head,
      (el) => el.tagName === 'link' && stringProp(el, 'rel').split(' ').includes('canonical'),
    );
  const canonical = canonicalEl ? stringProp(canonicalEl, 'href') : '';
  // A redirect stub, or a page that asks not to be indexed, is not content.
  const refresh =
    head &&
    find(
      head,
      (el) => el.tagName === 'meta' && stringProp(el, 'httpEquiv').toLowerCase() === 'refresh',
    );
  const robotsEl =
    head && find(head, (el) => el.tagName === 'meta' && stringProp(el, 'name') === 'robots');
  if (refresh || (robotsEl && stringProp(robotsEl, 'content').toLowerCase().includes('noindex')))
    return null;

  const boundaries = streamed(doc);
  // The parser always gives a document its body.
  const main =
    find(doc, (el) => el.tagName === 'main') ?? find(doc, (el) => el.tagName === 'body')!;
  const content: Root = { type: 'root', children: [...(main.children as Child[])] };
  clean(content, boundaries);
  if (!find(content, (el) => el.tagName === 'h1') && title)
    content.children.unshift({
      type: 'element',
      tagName: 'h1',
      properties: {},
      children: [{ type: 'text', value: title }],
    });

  const body = toMarkdown(toMdast(content), {
    extensions: [gfmToMarkdown()],
    bullet: '-',
    emphasis: '_',
    rule: '-',
    fences: true,
    listItemIndent: 'one',
  }).trim();
  if (!body) return null;

  const pageUrl = canonical ? new URL(canonical, url).toString() : url;
  const front = [
    '---',
    `title: ${yaml(title)}`,
    ...(description ? [`description: ${yaml(description)}`] : []),
    `url: ${yaml(pageUrl)}`,
    '---',
  ].join('\n');
  return { title, description, url: pageUrl, markdown: `${front}\n\n${body}\n` };
}
