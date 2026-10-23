// @vitest-environment jsdom
// Home's hero art as a static manifest (liveworkspace/docs/site.md "The Explorer"): the pictures HeroFeatureFan draws,
// written beside the templates as @liveplanner/templates/hero.json so liveworkspace.app's Explorer draws the same art
// without any of this editor's code (@liveworkspace/explorer HeroArt). Each picture is its markup as data,
// `[tag, props, ...children]` with React's prop names, in the light and the dark plan palette. This test is the
// generator and its guard: run with HERO_WRITE=1 to write it; without, it fails when the file has drifted from the
// pictures.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { HeroArtManifest, HeroArtNode } from '@liveworkspace/explorer';
import { HERO_FEATURES_LABEL, heroSheets } from './HeroFeatureFan';

// From the editor's folder, where its tests run (jsdom's import.meta.url is not a file address).
const FILE = resolve(process.cwd(), '../../packages/templates/hero.json');
// The manifest is read only when Home's hero shows on a wide screen; it stays small.
const MAX_BYTES = 64 * 1024;

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

function pictureOf(picture: unknown): HeroArtNode {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(<>{picture}</>);
  const root = host.firstElementChild;
  if (!root || host.children.length !== 1) throw new Error('a picture is one element');
  return nodeOf(root)!;
}

export function heroManifest(): HeroArtManifest {
  return {
    app: 'liveplanner',
    label: HERO_FEATURES_LABEL,
    sheets: heroSheets().map((s) => ({
      id: s.id,
      label: s.label,
      light: pictureOf(s.light),
      dark: pictureOf(s.dark),
    })),
  };
}

describe('the hero manifest', () => {
  it('matches the pictures (HERO_WRITE=1 writes it)', () => {
    const text = `${JSON.stringify(heroManifest())}\n`;
    if (process.env.HERO_WRITE === '1') writeFileSync(FILE, text);
    expect(readFileSync(FILE, 'utf8')).toBe(text);
    expect(text.length).toBeLessThan(MAX_BYTES);
  });

  it('draws each of the four sheets in both palettes, as data alone', () => {
    const m = heroManifest();
    expect(m.sheets.map((s) => s.id)).toEqual(['board', 'sheet', 'dashboard', 'form']);
    const text = JSON.stringify(m);
    expect(text).not.toMatch(/"on[A-Z]|dangerouslySetInnerHTML|<script/);
    for (const s of m.sheets) expect(JSON.stringify(s.light)).not.toBe(JSON.stringify(s.dark));
  });
});
