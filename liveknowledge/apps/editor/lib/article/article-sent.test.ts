// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorState, NodeSelection, Plugin, TextSelection } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import type { ArticleBlock } from '@liveknowledge/document';
import type { PlanSend } from '@liveworkspace/index-client';
import {
  addSends,
  setSendSource,
} from '@liveworkspace/workbench/components/send-to-plan/send-store';
import {
  onSendToPlan,
  setSendHere,
  type SendRequest,
} from '@liveworkspace/workbench/components/send-to-plan/send-to-plan-entry';
import {
  closeSelectionMenu,
  currentSelectionMenu,
} from '@liveworkspace/workbench/components/selection-menu/selection-menu-store';
import { blocksToDoc } from './article-convert';
import {
  articleSendPick,
  articleSentSpec,
  onlySent,
} from '@liveworkspace/workbench/components/send-to-plan/article-sent';

const articleSentPlugin = (editable: () => boolean) =>
  new Plugin(
    articleSentSpec<Decoration, DecorationSet, EditorState>(editable, {
      widget: (pos, toDOM, spec) => Decoration.widget(pos, toDOM, spec),
      set: (doc, decos) => DecorationSet.create(doc, decos),
      empty: DecorationSet.empty,
    }),
  );

// Send to Plan in the writing (docs/specs/013-workspace/send-to-plan.md "What it sends", "The chip"): the words a send
// takes and the block it names, a sent block's chip after its last word, and the selection menu on the words picked
// (liveworkspace/docs/specs/004-index/send-to-plan.md "The selection menu").
const BLOCKS = [
  { id: 'p1', type: 'paragraph', runs: [{ text: 'Ship the release notes' }] },
  { id: 'l1', type: 'list', list: 'bullet', runs: [{ text: 'Book the venue' }] },
  { id: 't1', type: 'list', list: 'todo', runs: [{ text: 'Send the invites' }] },
  { id: 'e1', type: 'paragraph', runs: [] },
] as unknown as ArticleBlock[];

const sent = (id: string): PlanSend => ({
  id,
  ref: 'text:tab1:l1:abc',
  kind: 'text',
  plan: { id: 'P', title: 'Sprint' },
  card: { id: 'c1', title: 'Book the venue', column: 'To Do', done: false },
  link: 'https://lp/x',
  at: 1,
});

// Where each block's text starts.
function startOf(state: EditorState, id: string): number {
  let at = -1;
  state.doc.forEach((node, pos) => {
    if (node.attrs.id === id) at = pos + 1;
  });
  return at;
}
const caretIn = (id: string, offset = 2) => {
  const s = EditorState.create({ doc: blocksToDoc(BLOCKS) });
  return s.apply(s.tr.setSelection(TextSelection.create(s.doc, startOf(s, id) + offset)));
};

describe('the words a send from the writing takes', () => {
  it("takes the caret's whole paragraph, list item or checklist item, naming its block", () => {
    expect(articleSendPick(caretIn('p1'))).toEqual({
      blockId: 'p1',
      text: 'Ship the release notes',
    });
    expect(articleSendPick(caretIn('l1'))).toEqual({ blockId: 'l1', text: 'Book the venue' });
    expect(articleSendPick(caretIn('t1'))).toEqual({ blockId: 't1', text: 'Send the invites' });
  });

  it('takes the words picked, across blocks too, naming the block they start in', () => {
    const s = EditorState.create({ doc: blocksToDoc(BLOCKS) });
    const from = startOf(s, 'p1') + 9;
    const picked = s.apply(s.tr.setSelection(TextSelection.create(s.doc, from, from + 7)));
    expect(articleSendPick(picked)).toEqual({ blockId: 'p1', text: 'release' });
    const across = s.apply(
      s.tr.setSelection(TextSelection.create(s.doc, from, startOf(s, 'l1') + 4)),
    );
    expect(articleSendPick(across)).toEqual({ blockId: 'p1', text: 'release notes\nBook' });
  });

  it('takes nothing from an empty block, a whole block picked, or a block with no id', () => {
    expect(articleSendPick(caretIn('e1', 0))).toBeNull();
    const s = EditorState.create({ doc: blocksToDoc(BLOCKS) });
    expect(articleSendPick(s.apply(s.tr.setSelection(NodeSelection.create(s.doc, 0))))).toBeNull();
    const bare = s.apply(s.tr.setNodeAttribute(0, 'id', ''));
    const at = bare.apply(bare.tr.setSelection(TextSelection.create(bare.doc, 2)));
    expect(articleSendPick(at)).toBeNull();
  });
});

describe('the writing as it shows sends', () => {
  let heard: SendRequest[] = [];
  let stop: () => void = () => {};
  const views: EditorView[] = [];
  beforeEach(() => {
    heard = [];
    stop = onSendToPlan((r) => heard.push(r));
    setSendSource('D', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
    setSendHere({ app: 'liveknowledge', tabId: 'tab1' });
  });
  afterEach(() => {
    views.splice(0).forEach((v) => v.destroy());
    stop();
    setSendSource(null);
    setSendHere(null);
    document.getSelection()?.removeAllRanges();
    document.body.replaceChildren();
    closeSelectionMenu();
    vi.unstubAllGlobals();
  });
  const mount = (editable: boolean) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, {
      state: EditorState.create({
        doc: blocksToDoc(BLOCKS),
        plugins: [articleSentPlugin(() => editable)],
      }),
      editable: () => editable,
    });
    views.push(view);
    return view;
  };
  // Picks `to` characters of a node's words, as the browser would (jsdom has no layout: their box is stubbed).
  const pick = (node: Node, to: number) => {
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, to);
    range.getClientRects = () => [{ left: 0, right: 80, top: 0, bottom: 20 }] as never;
    range.getBoundingClientRect = () => ({ left: 0, bottom: 20 }) as DOMRect;
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  };
  const rightClick = (view: EditorView): boolean => {
    const e = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: 10,
      clientY: 10,
    });
    view.dom.querySelector('p')!.dispatchEvent(e);
    return e.defaultPrevented;
  };
  const listWords = (view: EditorView): Node => {
    const text = view.dom.querySelector('li')!.firstChild as Node;
    return text.nodeType === Node.TEXT_NODE ? text : text.firstChild!;
  };

  it('draws a sent block its chip after its last word, live, in a redraw that changes nothing', () => {
    const view = mount(true);
    expect(view.dom.querySelector('[data-sent-chip]')).toBeNull();
    const dispatched: boolean[] = [];
    view.setProps({
      dispatchTransaction: (tr) => {
        dispatched.push(onlySent(tr));
        view.updateState(view.state.apply(tr));
      },
    });
    addSends([sent('a')]);
    const chip = view.dom.querySelector('[data-sent-chip]')!;
    expect(chip.closest('li, p')?.textContent).toContain('Book the venue');
    expect(chip.getAttribute('aria-label')).toContain('Open the card “Book the venue”');
    expect(dispatched).toEqual([true]);
    expect(view.state.doc.textContent).not.toContain('To Do');
  });

  it("offers a reader Copy and Send to Plan on a right-click on the words picked, with their block's place", () => {
    const view = mount(false);
    pick(listWords(view), 4);
    expect(rightClick(view)).toBe(true);
    const { actions, anchor } = currentSelectionMenu()!;
    expect(anchor).toBe(view.dom);
    expect(actions.cut).toBeNull();
    expect(actions.paste).toBeNull();
    actions.sendToPlan!();
    expect(heard[0]!.places[0]).toMatchObject({ elementId: 'l1', text: 'Book' });
  });

  it('cuts and pastes through the writing itself while editing', async () => {
    const view = mount(true);
    pick(listWords(view), 4);
    const from = startOf(view.state, 'l1');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, from + 4)));
    expect(rightClick(view)).toBe(true);
    const { actions } = currentSelectionMenu()!;
    // jsdom has no browser cut: the words go as plain text, then out of the writing.
    const writeText = vi.fn().mockResolvedValue(undefined);
    const readText = vi.fn().mockResolvedValue('Hire');
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText, readText } });
    // jsdom has no paste events: the browser's, as the writing's paste reads them.
    class Transfer {
      data: Record<string, string> = {};
      types: string[] = [];
      setData(t: string, v: string) {
        this.data[t] = v;
        this.types.push(t);
      }
      getData(t: string) {
        return this.data[t] ?? '';
      }
    }
    class Paste extends Event {
      clipboardData: Transfer;
      constructor(type: string, init: EventInit & { clipboardData: Transfer }) {
        super(type, init);
        this.clipboardData = init.clipboardData;
      }
    }
    vi.stubGlobal('DataTransfer', Transfer);
    vi.stubGlobal('ClipboardEvent', Paste);
    actions.cut!();
    await vi.waitFor(() => expect(view.state.doc.textContent).not.toContain('Book the venue'));
    expect(writeText).toHaveBeenCalledWith('Book');
    expect(view.state.doc.textContent).toContain(' the venue');
    // The paste scrolls its caret into view, which jsdom cannot measure.
    view.coordsAtPos = () => ({ left: 0, right: 0, top: 0, bottom: 0 });
    actions.paste!();
    await vi.waitFor(() => expect(view.state.doc.textContent).toContain('Hire the venue'));
  });

  it('leaves the browser its menu with nothing picked, or for words outside the writing', () => {
    const outside = document.createElement('p');
    outside.textContent = 'Elsewhere';
    document.body.appendChild(outside);
    const reading = mount(false);
    expect(rightClick(reading)).toBe(false);
    pick(outside.firstChild!, 4);
    expect(rightClick(reading)).toBe(false);
    pick(reading.dom.querySelector('p')!.firstChild!, 0);
    expect(rightClick(reading)).toBe(false);
    expect(currentSelectionMenu()).toBeNull();
  });

  // A mouse picks a reader's words (send-to-plan.md "A mouse picks a reader's words"): prosemirror-view 1.43 prevents
  // a press's default when it can't start a drag, read only too, which stopped the browser selecting. jsdom has no
  // layout, so the press's place is stubbed (and the selection it sets not drawn).
  const pressOn = (view: EditorView): boolean => {
    view.posAtCoords = () => ({ pos: 3, inside: -1 });
    view.dispatch = () => {};
    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
    view.dom.querySelector('p')!.dispatchEvent(press);
    view.dom.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return press.defaultPrevented;
  };
  it('leaves a press in the read-only writing to the browser, which ProseMirror alone would take', () => {
    expect(pressOn(mount(false))).toBe(false);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const plain = new EditorView(host, {
      state: EditorState.create({ doc: blocksToDoc(BLOCKS) }),
      editable: () => false,
    });
    views.push(plain);
    expect(pressOn(plain)).toBe(true);
  });

  it('takes its menu away with the writing', () => {
    const view = mount(false);
    pick(view.dom.querySelector('p')!.firstChild!, 4);
    rightClick(view);
    expect(currentSelectionMenu()).not.toBeNull();
    view.destroy();
    views.splice(0);
    expect(currentSelectionMenu()).toBeNull();
    addSends([sent('b')]);
  });
});
