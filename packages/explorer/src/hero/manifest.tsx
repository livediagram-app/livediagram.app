// An app's hero manifest (`@<app>/templates/hero.json`, HeroSheets.tsx): its Home's pictures as data, so a host that
// carries none of the app's code (liveworkspace.app) draws the same art with `HeroArt`. Each picture is its markup,
// `[tag, props, ...children]` with React's prop names. The apps generate it from a test of their own (run under jsdom:
// a picture is rendered to markup, then read back through the DOM), which also guards the file against drift.
// Its own entry (`@liveworkspace/explorer/hero-manifest`), so react-dom/server never reaches a page's bundle.

import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import type { HeroArtManifest, HeroArtNode, HeroSheet } from './HeroSheets';

/** The manifest is read only when Home's hero shows on a wide screen; it stays small. */
export const HERO_MANIFEST_MAX_BYTES = 64 * 1024;

const camel = (name: string) => name.replace(/[-:]([a-z])/g, (_, c: string) => c.toUpperCase());

function styleObject(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of text.split(';')) {
    const at = part.indexOf(':');
    if (at < 0) continue;
    const key = part.slice(0, at).trim();
    const value = part.slice(at + 1).trim();
    if (key) out[key.startsWith('--') ? key : camel(key)] = value;
  }
  return out;
}

function nodeOf(node: Node): HeroArtNode | null {
  if (node.nodeType === node.TEXT_NODE) return node.textContent ? node.textContent : null;
  if (node.nodeType !== node.ELEMENT_NODE) return null;
  const el = node as Element;
  let props: Record<string, unknown> | null = null;
  for (const attr of Array.from(el.attributes)) {
    props ??= {};
    const name = attr.name;
    if (name === 'class') props.className = attr.value;
    else if (name === 'style') props.style = styleObject(attr.value);
    else if (name.startsWith('aria-') || name.startsWith('data-')) props[name] = attr.value;
    else props[camel(name)] = attr.value;
  }
  const children = Array.from(el.childNodes).flatMap((c) => {
    const n = nodeOf(c);
    return n === null ? [] : [n];
  });
  return [el.localName, props, ...children];
}

/** One picture as data. It must be a single element. Needs a DOM (jsdom in a test). */
export function heroArtNodeOf(picture: ReactNode): HeroArtNode {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(<>{picture}</>);
  const root = host.firstElementChild;
  if (!root || host.children.length !== 1) throw new Error('a picture is one element');
  return nodeOf(root)!;
}

/** The app's hero manifest, from the sheets its own Home draws. */
export function heroArtManifest(
  app: string,
  label: string,
  sheets: readonly HeroSheet[],
): HeroArtManifest {
  return {
    app,
    label,
    sheets: sheets.map((s) => ({
      id: s.id,
      label: s.label,
      light: heroArtNodeOf(s.light),
      dark: heroArtNodeOf(s.dark),
    })),
  };
}
