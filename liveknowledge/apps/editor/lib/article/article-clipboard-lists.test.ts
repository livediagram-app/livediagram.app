// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import * as pmView from 'prosemirror-view';
import type { Node as PMNode, ResolvedPos, Slice } from 'prosemirror-model';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { articleSchema } from './article-schema';
import { articleClipboardSerializer, wrapListItems } from './article-clipboard-lists';

// docs/specs/030-knowledgebase/editing.md "Selecting and copying": copied list items keep their list, so a rich
// editor pastes bullets and numbers.

const { EditorView } = pmView;
// ProseMirror's own paste parser, exported for tests but not typed.
const parseFromClipboard = (
  pmView as unknown as {
    __parseFromClipboard: (
      view: pmView.EditorView,
      text: string,
      html: string,
      plain: boolean,
      $context: ResolvedPos,
    ) => Slice | null;
  }
).__parseFromClipboard;

const s = articleSchema;
const p = (text: string) => s.node('paragraph', null, [s.text(text)]);
const li = (text: string, list = 'bullet', level = 0) =>
  s.node('list_item', { list, level }, [s.text(text)]);

let view: pmView.EditorView | null = null;
afterEach(() => {
  view?.destroy();
  view = null;
  document.body.innerHTML = '';
});

/** The writing in a view, the whole of it or `from`..`to` selected, copied as the view copies it. */
function copy(blocks: PMNode[], from?: number, to?: number) {
  const doc = s.node('doc', null, blocks);
  const state = EditorState.create({ doc });
  const host = document.createElement('div');
  document.body.appendChild(host);
  view = new EditorView(host, {
    state,
    editable: () => false,
    clipboardSerializer: articleClipboardSerializer,
  });
  const sel = TextSelection.create(doc, from ?? 1, to ?? doc.content.size - 1);
  view.dispatch(view.state.tr.setSelection(sel));
  const slice = view.state.selection.content();
  const wrap = document.createElement('div');
  wrap.appendChild(articleClipboardSerializer.serializeFragment(slice.content, { document }));
  return { wrap, html: wrap.innerHTML, slice };
}

/** Each element's tag and, for an item, its text: the clipboard's shape without its attributes. */
function shape(el: Element): unknown {
  return [...el.children].map((c) =>
    c.tagName === 'LI'
      ? [
          'li',
          [...c.childNodes]
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent)
            .join(''),
          ...(c.children.length ? [shape(c)] : []),
        ]
      : [
          c.tagName.toLowerCase(),
          c.tagName === 'UL' || c.tagName === 'OL' ? shape(c) : c.textContent,
        ],
  );
}

describe('copied list items keep their list', () => {
  it('a selection inside one list: its items in a <ul>, a deeper one in a list inside the item before it', () => {
    const { wrap } = copy([
      li('Laptop'),
      li('Badge'),
      li('Spare charger', 'bullet', 1),
      li('Photo ID'),
    ]);
    expect(shape(wrap)).toEqual([
      [
        'ul',
        [
          ['li', 'Laptop'],
          ['li', 'Badge', [['ul', [['li', 'Spare charger']]]]],
          ['li', 'Photo ID'],
        ],
      ],
    ]);
  });

  it('a selection over paragraphs and a numbered list: the list in an <ol> between them', () => {
    const { wrap } = copy([
      p('Before you start:'),
      li('Sign in', 'numbered'),
      li('Say hello', 'numbered'),
      p('Then read on.'),
    ]);
    expect(shape(wrap)).toEqual([
      ['p', 'Before you start:'],
      [
        'ol',
        [
          ['li', 'Sign in'],
          ['li', 'Say hello'],
        ],
      ],
      ['p', 'Then read on.'],
    ]);
  });

  it('a new kind at the same level starts a new list; a checklist is a <ul>', () => {
    const { wrap } = copy([
      li('One', 'numbered'),
      li('Two', 'numbered'),
      li('Tick', 'todo'),
      li('Dot'),
    ]);
    expect(shape(wrap)).toEqual([
      [
        'ol',
        [
          ['li', 'One'],
          ['li', 'Two'],
        ],
      ],
      [
        'ul',
        [
          ['li', 'Tick'],
          ['li', 'Dot'],
        ],
      ],
    ]);
  });

  it('closes deeper lists on the way back up, and starts a deeper list in place when nothing is open above it', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = [
      '<li data-article-list="bullet" data-level="2">Deep</li>',
      '<li data-article-list="bullet" data-level="0">Top</li>',
      '<li data-article-list="numbered" data-level="1">Inner</li>',
      '<li data-article-list="bullet" data-level="1">Other</li>',
      '<li data-article-list="bullet" data-level="nope">Plain</li>',
      '<p>After</p>',
      '<li data-article-list="bullet">Again</li>',
    ].join('');
    wrapListItems(wrap);
    expect(shape(wrap)).toEqual([
      ['ul', [['li', 'Deep']]],
      [
        'ul',
        [
          [
            'li',
            'Top',
            [
              ['ol', [['li', 'Inner']]],
              ['ul', [['li', 'Other']]],
            ],
          ],
          ['li', 'Plain'],
        ],
      ],
      ['p', 'After'],
      ['ul', [['li', 'Again']]],
    ]);
  });

  it('pastes back as the same items: kind, level and text', () => {
    const blocks = [p('Intro'), li('A'), li('B', 'bullet', 1), li('C', 'numbered')];
    const { html } = copy(blocks);
    const back = parseFromClipboard(view!, '', html, false, view!.state.doc.resolve(1));
    const items: [string, string, number][] = [];
    back!.content.forEach((n) => {
      if (n.type.name === 'list_item')
        items.push([n.textContent, n.attrs.list as string, n.attrs.level as number]);
    });
    expect(items).toEqual([
      ['A', 'bullet', 0],
      ['B', 'bullet', 1],
      ['C', 'numbered', 0],
    ]);
    expect(back!.content.firstChild!.textContent).toBe('Intro');
  });

  it('wraps 5,000 items within budget', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = Array.from(
      { length: 5000 },
      (_v, i) => `<li data-article-list="bullet" data-level="${i % 4}">Item ${i}</li>`,
    ).join('');
    expect(cpuMsOf(() => wrapListItems(wrap))).toBeLessThan(cpuBudgetMs(400));
    expect(wrap.children).toHaveLength(1);
  });
});
