// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { ArticleBlock } from '@livedocuments/document';
import { blocksToDoc } from './article-convert';
import { decorationsPlugin } from './article-plugins';

// docs/specs/007-editor/article-pages.md "Blocks": an empty list item keeps its bullet, number or to-do box, and its
// placeholder sits whole after the marker, never in its place. The marker is the item's ::before and the placeholder
// its ::after (app/article-pages.css); this mounts the real editor under the real stylesheet and reads both.

const css = readFileSync(join(__dirname, '../../app/article-pages.css'), 'utf8');

const views: EditorView[] = [];
afterEach(() => {
  views.splice(0).forEach((v) => v.destroy());
  document.body.replaceChildren();
});

function mount(blocks: ArticleBlock[], editable = true) {
  const host = document.createElement('div');
  host.className = 'article-flow';
  document.body.append(host);
  const view = new EditorView(host, {
    state: EditorState.create({
      doc: blocksToDoc(blocks),
      plugins: [decorationsPlugin(() => editable)],
    }),
    editable: () => editable,
  });
  views.push(view);
  return host;
}

const BODY: ArticleBlock = { id: 'p', type: 'paragraph', runs: [{ text: 'Some writing.' }] };
const item = (list: 'bullet' | 'numbered' | 'todo', checked = false): ArticleBlock => ({
  id: 'li',
  type: 'list',
  list,
  runs: [],
  ...(checked ? { checked } : {}),
});

// jsdom computes no pseudo-element styles, so this cascades the stylesheet's ::before / ::after rules itself: every
// rule whose selector, less its pseudo-element, matches the element; the most specific, then the latest, wins.
function specificity(selector: string): number {
  // :not(x) counts as x does; a ::pseudo-element counts as a type.
  const flat = selector.replace(/:not\(([^)]*)\)/g, ' $1');
  const ids = (flat.match(/#[\w-]+/g) ?? []).length;
  const classes = (flat.match(/\.[\w-]+|\[[^\]]+\]|(?<!:):(?!:)[\w-]+/g) ?? []).length;
  const types = (flat.replace(/\[[^\]]+\]/g, '').match(/(^|[\s>+~])[a-z][\w-]*|::[\w-]+/gi) ?? [])
    .length;
  return ids * 10000 + classes * 100 + types;
}
// The sheet's top-level rules as written (jsdom's CSSOM drops `content: attr(...)`); @media blocks are left out.
const RULES: { selectors: string[]; decls: Map<string, string> }[] = [];
{
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  let head = '';
  let body = '';
  let skip = false;
  for (const ch of text) {
    if (ch === '{') {
      if (depth === 0) skip = head.trim().startsWith('@');
      else if (!skip) body += ch;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        if (!skip) {
          const decls = new Map<string, string>();
          for (const decl of body.split(';')) {
            const at = decl.indexOf(':');
            if (at > 0) decls.set(decl.slice(0, at).trim(), decl.slice(at + 1).trim());
          }
          RULES.push({ selectors: head.split(',').map((x) => x.trim()), decls });
        }
        head = '';
        body = '';
      }
    } else if (depth === 0) head += ch;
    else body += ch;
  }
}
function pseudoStyle(el: Element, pseudo: '::before' | '::after', prop: string): string {
  const hits: { spec: number; order: number; value: string }[] = [];
  RULES.forEach(({ selectors, decls }, order) => {
    const value = decls.get(prop);
    if (value === undefined) return;
    for (const part of selectors) {
      if (part.endsWith(pseudo) && el.matches(part.slice(0, -pseudo.length)))
        hits.push({ spec: specificity(part), order, value });
    }
  });
  hits.sort((a, b) => a.spec - b.spec || a.order - b.order);
  return hits.at(-1)?.value ?? '';
}
// What a pseudo-element draws as text: an attr() read from the element, a string unquoted, nothing for none.
function drawn(el: Element, pseudo: '::before' | '::after'): string {
  const value = pseudoStyle(el, pseudo, 'content');
  const attr = /^attr\(([\w-]+)\)$/.exec(value);
  if (attr) return el.getAttribute(attr[1]!) ?? '';
  return value === '' || value === 'none' ? '' : value.replace(/^["']|["']$/g, '');
}

describe('an empty list item', () => {
  it.each([
    ['bullet', '•'],
    ['numbered', '1.'],
  ] as const)('a %s item keeps its marker and shows "List" after it', (list, marker) => {
    const li = mount([BODY, item(list)]).querySelector('li')!;
    expect(li.getAttribute('data-marker')).toBe(marker);
    expect(li.classList).toContain('article-empty');
    expect(drawn(li, '::before')).toBe(marker);
    expect(drawn(li, '::after')).toBe('List');
    // Whole, and in the text column past the marker's gutter (the item's own indent).
    expect(pseudoStyle(li, '::after', 'position')).toBe('absolute');
    expect(pseudoStyle(li, '::after', 'white-space')).toBe('nowrap');
    expect(pseudoStyle(li, '::after', 'left')).toBe('calc(28px * (var(--article-level) + 1))');
    expect(pseudoStyle(li, '::before', 'left')).toBe('calc(28px * var(--article-level))');
    expect(pseudoStyle(li, '::before', 'color')).toBe('var(--article-accent)');
  });

  it('a to-do keeps its box and shows "To-do" after it', () => {
    const li = mount([BODY, item('todo')]).querySelector('li')!;
    expect(drawn(li, '::before')).toBe('');
    expect(pseudoStyle(li, '::before', 'border')).toContain('solid');
    expect(pseudoStyle(li, '::before', 'width')).toBe('16px');
    expect(drawn(li, '::after')).toBe('To-do');
  });

  it('a ticked to-do keeps its tick and has no placeholder', () => {
    const li = mount([BODY, item('todo', true)]).querySelector('li')!;
    expect(li.classList).toContain('article-done');
    expect(li.classList).not.toContain('article-empty');
    expect(drawn(li, '::after')).toBe('');
    expect(pseudoStyle(li, '::after', 'transform')).toBe('rotate(45deg)');
  });

  it('leaves a paragraph its placeholder in its ::before', () => {
    const host = mount([{ id: 'h', type: 'paragraph', style: 'h1', runs: [] }]);
    const p = host.querySelector('.article-empty')!;
    expect(drawn(p, '::before')).toBe('Heading 1');
    expect(drawn(p, '::after')).toBe('');
  });

  it('shows a reader its marker and no placeholder', () => {
    const li = mount([BODY, item('bullet')], false).querySelector('li')!;
    expect(li.classList).not.toContain('article-empty');
    expect(drawn(li, '::before')).toBe('•');
    expect(drawn(li, '::after')).toBe('');
  });
});
