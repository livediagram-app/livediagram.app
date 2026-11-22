// @vitest-environment jsdom
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageOfRun, type ArticleBlock } from '@liveknowledge/document';
import { blocksToDoc, docToBlocks } from '@/lib/article/article-convert';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { firstLines, pageOfPastedUrl, pagePickItems } from './page-link-pick';
import {
  openPageLinkPicker,
  pageLinkKey,
  pageLinkPlugin,
  pickPageLink,
  type PageLinkBridge,
} from './page-link-plugin';
import { cssString, installPageLinkTitles, linkedPagesKey, pageLinkCss } from './page-link-titles';

// docs/specs/030-knowledgebase/links-and-embeds.md "Page links".

const para = (id: string, runs: object[], style?: string) =>
  ({ id, type: 'paragraph', ...(style ? { style } : {}), runs }) as ArticleBlock;
const linked = [
  para('t', [{ text: 'Release' }], 'title'),
  para('b', [
    { text: 'See ' },
    { text: 'Rollbacks', page: 'p2' },
    { text: ' and ', b: true },
    { text: 'the site', href: 'https://example.com/' },
    { text: '.' },
  ]),
];

describe('a page link in the writing', () => {
  it('survives the editor: stored runs to the article and back, unchanged', () => {
    const doc = blocksToDoc(linked);
    const back = docToBlocks(doc, []);
    expect(back).toEqual(linked);
    const run = (back[1] as { runs: { text: string }[] }).runs[1]!;
    expect(pageOfRun(run)).toBe('p2');
    // The same blocks read back are the same objects: no commit is made of a page nobody typed on.
    expect(docToBlocks(doc, linked)[1]).toBe(linked[1]);
  });

  it('is one mark: to a page, never also to an address', () => {
    const doc = blocksToDoc([
      para('b', [{ text: 'Both', page: 'p2', href: 'https://example.com/' }]),
    ]);
    const marks = doc.firstChild!.firstChild!.marks.map((m) => m.type.name);
    expect(marks).toEqual(['pageLink']);
  });

  it('draws as a link by the page’s id, its stored words hidden from a screen reader', () => {
    const el = document.createElement('div');
    const view = new EditorView(el, { state: EditorState.create({ doc: blocksToDoc(linked) }) });
    const a = el.querySelector('a.article-page-link')!;
    expect(a.getAttribute('data-page')).toBe('p2');
    expect(a.getAttribute('href')).toBe('#t=p2');
    const words = a.querySelector('.article-page-link-text')!;
    expect(words.getAttribute('aria-hidden')).toBe('true');
    expect(words.textContent).toBe('Rollbacks');
    view.destroy();
  });
});

describe('the title a link shows', () => {
  it('is the page’s current title, written as a rule a page', () => {
    const css = pageLinkCss([
      { id: 'p1', name: 'Release Process' },
      { id: 'p2', name: '' },
    ]);
    expect(css).toContain('a.article-page-link[data-page="p1"]::before{content:"Release Process"}');
    expect(css).toContain('[data-page="p2"]::before{content:"Untitled Page"}');
    expect(css).toContain('text-decoration:underline');
    // A page that is gone has no rule: the base look says Deleted Page, struck through.
    expect(css).not.toContain('p3');
    expect(pageLinkCss([])).toBe('');
  });

  it('cannot be broken out of by a title', () => {
    expect(cssString('a"}body{display:none}\\')).toBe('"a\\22 }body{display:none}\\5c "');
    expect(cssString('two\nlines')).toBe('"two\\a lines"');
  });

  it('is written once into the page, and again only when it changed', () => {
    installPageLinkTitles('a{}');
    installPageLinkTitles('b{}');
    const styles = document.querySelectorAll('#page-link-titles');
    expect(styles).toHaveLength(1);
    expect(styles[0]!.textContent).toBe('b{}');
    expect(linkedPagesKey([{ id: 'p1', name: 'A' }])).not.toBe(
      linkedPagesKey([{ id: 'p1', name: 'B' }]),
    );
  });
});

function editor(over: Partial<PageLinkBridge> = {}, blocks: ArticleBlock[] = [para('b', [])]) {
  const changes: unknown[] = [];
  const bridge: PageLinkBridge = {
    onChange: (state) => changes.push(state),
    onKey: vi.fn(() => true),
    onOpen: vi.fn(),
    pageOfUrl: vi.fn(() => undefined),
    canInsert: () => true,
    ...over,
  };
  const el = document.createElement('div');
  document.body.append(el);
  const view = new EditorView(el, {
    state: EditorState.create({ doc: blocksToDoc(blocks), plugins: [pageLinkPlugin(bridge)] }),
  });
  view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
  const type = (text: string) => {
    for (const c of text) view.dispatch(view.state.tr.insertText(c));
  };
  const key = (name: string) => {
    const event = new KeyboardEvent('keydown', { key: name, cancelable: true });
    let taken = false;
    view.someProp('handleKeyDown', (f) => {
      taken = f(view, event) === true;
      return taken;
    });
    return taken;
  };
  const query = () => pageLinkKey.getState(view.state);
  const text = () => view.state.doc.textContent;
  return { view, bridge, type, key, query, text, changes, el };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the [[ picker', () => {
  it('opens on [[, filters as you type, and closes on ]', () => {
    const e = editor();
    e.type('See [');
    expect(e.query()).toEqual({ active: false });
    e.type('[');
    expect(e.query()).toEqual({ active: true, from: 5, query: '' });
    e.type('Roll b');
    expect(e.query()).toMatchObject({ active: true, query: 'Roll b' });
    e.type(']');
    expect(e.query()).toEqual({ active: false });
  });

  it('gives the arrows and Enter to the picker, and Escape leaves the text as typed', () => {
    const e = editor();
    e.type('[[Ro');
    expect(e.key('ArrowDown')).toBe(true);
    expect(e.key('Enter')).toBe(true);
    expect(e.bridge.onKey).toHaveBeenCalledWith('down');
    expect(e.bridge.onKey).toHaveBeenLastCalledWith('enter');
    expect(e.key('Escape')).toBe(true);
    expect(e.query()).toEqual({ active: false });
    expect(e.text()).toBe('[[Ro');
    // Closed, the keys are the writing's again.
    expect(e.key('ArrowDown')).toBe(false);
  });

  it('puts the link where the [[ and the typing were, the caret after it', () => {
    const e = editor();
    e.type('See [[Roll');
    pickPageLink(e.view, 'p2', 'Rollbacks');
    const blocks = docToBlocks(e.view.state.doc, []) as { runs: object[] }[];
    expect(blocks[0]!.runs).toEqual([{ text: 'See ' }, { text: 'Rollbacks', page: 'p2' }]);
    expect(e.view.state.selection.head).toBe(e.view.state.doc.content.size - 1);
    expect(e.query()).toEqual({ active: false });
    // Typing on is plain text, not more of the link.
    e.type('!');
    expect((docToBlocks(e.view.state.doc, []) as { runs: object[] }[])[0]!.runs).toEqual([
      { text: 'See ' },
      { text: 'Rollbacks', page: 'p2' },
      { text: '!' },
    ]);
  });

  it('opens from the slash menu’s Link to Page', () => {
    const e = editor();
    openPageLinkPicker(e.view);
    expect(e.query()).toEqual({ active: true, from: 1, query: '' });
  });

  it('opens for a Participant as for an Editor, never for a Viewer, a paste or a remote change', () => {
    const participant = resolveEditorCapabilities('participate');
    const typed = editor({ canInsert: () => participant.writeArticle });
    typed.type('[[');
    expect(typed.query()).toMatchObject({ active: true });
    for (const level of ['view'] as const) {
      const can = resolveEditorCapabilities(level);
      const e = editor({ canInsert: () => can.writeArticle });
      e.type('[[');
      expect(e.query()).toEqual({ active: false });
    }
    const editorCan = resolveEditorCapabilities('edit');
    const e = editor({ canInsert: () => editorCan.writeArticle });
    e.view.dispatch(e.view.state.tr.insertText('[[').setMeta('uiEvent', 'paste'));
    expect(e.query()).toEqual({ active: false });
    e.view.dispatch(e.view.state.tr.insertText('[[').setMeta('article-remote', true));
    expect(e.query()).toEqual({ active: false });
    e.type('[[');
    expect(e.query()).toMatchObject({ active: true });
  });
});

describe('a link is one thing to the caret', () => {
  const blocks = [
    para('b', [{ text: 'See ' }, { text: 'Rollbacks', page: 'p2' }, { text: ' now' }]),
  ];

  it('never rests inside one: it moves on to the edge it was heading for', () => {
    const e = editor({}, blocks);
    const at = (pos: number) =>
      e.view.dispatch(e.view.state.tr.setSelection(TextSelection.create(e.view.state.doc, pos)));
    at(5);
    // One step right from the link's start lands at its end.
    at(6);
    expect(e.view.state.selection.head).toBe(14);
    // One step left from its end lands at its start.
    at(13);
    expect(e.view.state.selection.head).toBe(5);
  });

  it('goes whole on Backspace after it and Delete before it', () => {
    const after = editor({}, blocks);
    after.view.dispatch(
      after.view.state.tr.setSelection(TextSelection.create(after.view.state.doc, 14)),
    );
    expect(after.key('Backspace')).toBe(true);
    expect(after.text()).toBe('See  now');
    const before = editor({}, blocks);
    before.view.dispatch(
      before.view.state.tr.setSelection(TextSelection.create(before.view.state.doc, 5)),
    );
    expect(before.key('Delete')).toBe(true);
    expect(before.text()).toBe('See  now');
    // Away from a link the keys are the writing's.
    const plain = editor({}, blocks);
    expect(plain.key('Backspace')).toBe(false);
  });
});

describe('following and pasting', () => {
  const blocks = [para('b', [{ text: 'See ' }, { text: 'Rollbacks', page: 'p2' }])];

  it('opens the page on a press, for every role, and leaves a modified press to the browser', () => {
    for (const level of ['edit', 'participate', 'view'] as const) {
      const can = resolveEditorCapabilities(level);
      const e = editor({ canInsert: () => can.writeArticle }, blocks);
      const link = e.el.querySelector('a.article-page-link')!;
      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(click);
      expect(e.bridge.onOpen).toHaveBeenCalledWith('p2');
      expect(click.defaultPrevented).toBe(true);
      const meta = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
      link.dispatchEvent(meta);
      expect(e.bridge.onOpen).toHaveBeenCalledTimes(1);
      expect(meta.defaultPrevented).toBe(false);
    }
  });

  const paste = (e: ReturnType<typeof editor>, text: string) => {
    const event = { clipboardData: { getData: () => text } } as unknown as ClipboardEvent;
    let taken = false;
    e.view.someProp('handlePaste', (f) => {
      taken = f(e.view, event, e.view.state.doc.slice(0, 0)) === true;
      return taken;
    });
    return taken;
  };

  it('turns a pasted address of a page into a link to it, for an Editor', () => {
    const e = editor({ pageOfUrl: (text) => (text.endsWith('#t=p2') ? 'p2' : undefined) });
    e.type('See ');
    expect(paste(e, 'https://x.test/k/d1#t=p2')).toBe(true);
    const runs = (docToBlocks(e.view.state.doc, []) as { runs: { text: string }[] }[])[0]!.runs;
    expect(pageOfRun(runs[1]!)).toBe('p2');
    // Any other text pastes as it always did.
    expect(paste(e, 'https://elsewhere.test/')).toBe(false);
    expect(paste(e, 'two words')).toBe(false);
    const viewer = editor({ canInsert: () => false, pageOfUrl: () => 'p2' });
    expect(paste(viewer, 'https://x.test/k/d1#t=p2')).toBe(false);
  });

  it('reads a page from the knowledgebase’s own address alone', () => {
    const here = { origin: 'https://x.test', documentId: 'd1', pages: [{ id: 'p2' }] };
    expect(pageOfPastedUrl('https://x.test/knowledgebase/d1#t=p2', here)).toBe('p2');
    expect(pageOfPastedUrl('https://x.test/knowledgebase/d1#t=gone', here)).toBeUndefined();
    expect(pageOfPastedUrl('https://x.test/knowledgebase/other#t=p2', here)).toBeUndefined();
    expect(pageOfPastedUrl('https://evil.test/knowledgebase/d1#t=p2', here)).toBeUndefined();
    expect(pageOfPastedUrl('not a url', here)).toBeUndefined();
  });
});

describe('what the picker lists', () => {
  const pages = [
    { id: 'a', name: 'Handbook' },
    { id: 'b', name: 'Release Process', parent: 'a' },
    { id: 'c', name: 'Rollbacks', parent: 'b' },
    { id: 'd', name: 'Hotfix Releases' },
    { id: 'e', name: '' },
  ];
  const labels = (query: string, canCreate = true) =>
    pagePickItems(pages, query, { exclude: 'a', canCreate }).map((i) => i.label);

  it('lists the pages but the one being written, titles starting with the words first', () => {
    expect(labels('')).toEqual([
      'Release Process',
      'Rollbacks',
      'Hotfix Releases',
      'Untitled Page',
    ]);
    expect(labels('rel')).toEqual(['Release Process', 'Hotfix Releases', 'Create Page']);
    const [first] = pagePickItems(pages, 'roll', { canCreate: false });
    expect(first).toMatchObject({
      hint: 'Handbook / Release Process',
      action: { kind: 'page', page: 'c', title: 'Rollbacks' },
    });
  });

  it('offers Create Page at the foot with the typed title, to whoever may add pages', () => {
    const items = pagePickItems(pages, ' Runbooks ', { canCreate: true });
    expect(items.at(-1)).toMatchObject({
      label: 'Create Page',
      hint: '"Runbooks"',
      action: { kind: 'create-page', title: 'Runbooks' },
    });
    expect(labels('Runbooks', false)).toEqual([]);
    // Nothing typed: nothing to name a page.
    expect(labels('')).not.toContain('Create Page');
  });

  it('shows a page’s first lines, never its Title', () => {
    expect(
      firstLines([
        para('t', [{ text: 'Release' }], 'title'),
        para('a', [{ text: 'Tag  the build.' }]),
        para('b', [{ text: 'Then ship it.' }]),
      ]),
    ).toBe('Tag the build. Then ship it.');
    expect(firstLines([para('a', [{ text: 'x'.repeat(400) }])])).toHaveLength(181);
    expect(firstLines([])).toBe('');
  });
});
