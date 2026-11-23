// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorState, NodeSelection, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { ArticleBlock } from '@livedocuments/document';
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
import { blocksToDoc } from './article-convert';
import { articleSendPick, articleSentPlugin, onlySent } from './article-sent';

// Send to Plan in the writing (docs/specs/013-workspace/send-to-plan.md "What it sends", "The chip"): the words a send
// takes and the block it names, a sent block's chip after its last word, and a reader's pill under the words picked.
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
    setSendHere({ app: 'livedocuments', tabId: 'tab1' });
  });
  afterEach(() => {
    views.splice(0).forEach((v) => v.destroy());
    stop();
    setSendSource(null);
    setSendHere(null);
    document.getSelection()?.removeAllRanges();
    document.body.replaceChildren();
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
  const pill = () => document.querySelector<HTMLButtonElement>('[data-read-send-pill]');

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

  it("offers a reader Send to Plan under the words picked, sending them with their block's place", () => {
    const view = mount(false);
    const text = view.dom.querySelector('[data-block-id="l1"], li')!.firstChild as Node;
    const words = text.nodeType === Node.TEXT_NODE ? text : text.firstChild!;
    const range = document.createRange();
    range.setStart(words, 0);
    range.setEnd(words, 4);
    range.getBoundingClientRect = () => ({ left: 30, bottom: 50 }) as DOMRect;
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    expect(pill()!.style.top).toBe('58px');
    pill()!.click();
    expect(heard[0]!.places[0]).toMatchObject({ elementId: 'l1', text: 'Book' });
    expect(pill()).toBeNull();
  });

  it('shows no pill to someone writing, for nothing picked, or for words outside the writing', () => {
    const outside = document.createElement('p');
    outside.textContent = 'Elsewhere';
    document.body.appendChild(outside);
    const writing = mount(true);
    const pick = (node: Node, to: number) => {
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, to);
      range.getBoundingClientRect = () => ({ left: 0, bottom: 0 }) as DOMRect;
      document.getSelection()!.removeAllRanges();
      document.getSelection()!.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    };
    pick(writing.dom.querySelector('p')!.firstChild!, 4);
    expect(pill()).toBeNull();
    writing.destroy();
    views.splice(0);
    const reading = mount(false);
    pick(outside.firstChild!, 4);
    expect(pill()).toBeNull();
    pick(reading.dom.querySelector('p')!.firstChild!, 0);
    expect(pill()).toBeNull();
    document.getSelection()!.removeAllRanges();
    document.dispatchEvent(new Event('selectionchange'));
    expect(pill()).toBeNull();
  });

  it('takes its pill away with the writing', () => {
    const view = mount(false);
    const words = view.dom.querySelector('p')!.firstChild!;
    const range = document.createRange();
    range.setStart(words, 0);
    range.setEnd(words, 4);
    range.getBoundingClientRect = () => ({ left: 0, bottom: 0 }) as DOMRect;
    document.getSelection()!.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    expect(pill()).not.toBeNull();
    view.destroy();
    views.splice(0);
    expect(pill()).toBeNull();
    addSends([sent('b')]);
  });
});
