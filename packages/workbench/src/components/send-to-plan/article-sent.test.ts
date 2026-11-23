// @vitest-environment jsdom
// Send to Plan in an article's writing, its ProseMirror side (livedocuments' and liveknowledge's
// docs/specs/013-workspace/send-to-plan.md "What it sends", "The chip"), read through the few shapes it takes. Each
// editor's own article-sent.test.ts drives it on a real ProseMirror view.
import type { PlanSend } from '@liveworkspace/index-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/index-client', () => ({ indexClient: {} }));

import { articleSendPick, articleSentSpec, onlySent, type PMState } from './article-sent';
import { addSends, setSendSource } from './send-store';
import { onSendToPlan, setSendHere, type SendRequest } from './send-to-plan-entry';

type Block = { id: unknown; text: string; isTextblock?: boolean };
const node = (b: Block) => ({
  attrs: { id: b.id },
  isTextblock: b.isTextblock ?? true,
  nodeSize: b.text.length + 2,
  textContent: b.text,
});
function stateOf(
  blocks: Block[],
  sel: { from: number; to?: number; depth?: number; block?: number },
): PMState {
  const nodes = blocks.map(node);
  const $from = {
    depth: sel.depth ?? 1,
    node: () => nodes[sel.block ?? 0]!,
    parent: nodes[sel.block ?? 0]!,
  };
  const tr = { meta: {} as Record<string, unknown>, setMeta: vi.fn(), getMeta: vi.fn() };
  tr.setMeta.mockImplementation((k: string, v: unknown) => ((tr.meta[k] = v), tr));
  tr.getMeta.mockImplementation((k: string) => tr.meta[k]);
  return {
    doc: {
      ...node({ id: null, text: '' }),
      forEach: (f) => {
        let pos = 0;
        nodes.forEach((n, i) => {
          f(n, pos, i);
          pos += n.nodeSize;
        });
      },
      content: { size: 100 },
      resolve: () => $from,
      textBetween: () => 'picked words',
    },
    selection: { from: sel.from, to: sel.to ?? sel.from, $from },
    tr,
  };
}

const sent = (id: string): PlanSend => ({
  id,
  ref: 'text:t1:b1:abc',
  kind: 'text',
  plan: { id: 'P', title: 'Sprint' },
  card: { id: 'c1', title: 'Fix', column: 'To Do', done: false },
  link: 'https://lp/x',
  at: 1,
});

let heard: SendRequest[] = [];
let stop: () => void = () => {};
beforeEach(() => {
  heard = [];
  stop = onSendToPlan((r) => heard.push(r));
  setSendSource('D', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
  setSendHere({ app: 'livedocuments', tabId: 't1' });
});
afterEach(() => {
  stop();
  setSendSource(null);
  setSendHere(null);
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

describe('the words a send from the writing takes', () => {
  it('takes the words picked or the caret block’s, naming the block, and nothing else', () => {
    const blocks = [{ id: 'b1', text: 'Ship it' }];
    expect(articleSendPick(stateOf(blocks, { from: 1, to: 4 }))).toEqual({
      blockId: 'b1',
      text: 'picked words',
    });
    expect(articleSendPick(stateOf(blocks, { from: 1 }))).toEqual({
      blockId: 'b1',
      text: 'Ship it',
    });
    expect(articleSendPick(stateOf(blocks, { from: 0, depth: 0 }))).toBeNull();
    expect(articleSendPick(stateOf([{ id: '', text: 'x' }], { from: 1 }))).toBeNull();
    expect(articleSendPick(stateOf([{ id: 'b1', text: '  ' }], { from: 1 }))).toBeNull();
  });
});

describe('the chips and the pill', () => {
  const draw = {
    widget: vi.fn((pos: number, toDOM: () => Node, spec: { key: string }) => ({
      pos,
      toDOM,
      key: spec.key,
    })),
    set: vi.fn((_doc: unknown, decos: unknown[]) => decos),
    empty: [] as unknown[],
  };

  it('draws a chip after each sent text block’s last word, and none for the rest', () => {
    const spec = articleSentSpec(() => true, draw);
    const blocks = [
      { id: 'b1', text: 'Ship' },
      { id: 'b2', text: 'Zone', isTextblock: false },
      { id: 7, text: 'odd' },
      { id: 'b3', text: 'Plain' },
    ];
    expect(spec.props.decorations(stateOf(blocks, { from: 1 }))).toBe(draw.empty);
    addSends([sent('a')]);
    const decos = spec.props.decorations(stateOf(blocks, { from: 1 })) as {
      pos: number;
      toDOM: () => Node;
    }[];
    expect(decos).toHaveLength(1);
    expect(decos[0]!.pos).toBe(5);
    expect((decos[0]!.toDOM() as HTMLElement).dataset.sentChip).toBe('');
  });

  it('redraws as sends change, marking the redraw, until the writing goes', () => {
    const state = stateOf([{ id: 'b1', text: 'Ship' }], { from: 1 });
    const view = {
      state,
      dom: document.createElement('div'),
      isDestroyed: false,
      dispatch: vi.fn<(tr: PMState['tr']) => void>(),
      posAtDOM: () => 1,
    };
    const shown = articleSentSpec(() => true, draw).view(view);
    addSends([sent('a')]);
    expect(view.dispatch).toHaveBeenCalledTimes(1);
    expect(onlySent(view.dispatch.mock.calls[0]![0])).toBe(true);
    view.isDestroyed = true;
    addSends([sent('b')]);
    expect(view.dispatch).toHaveBeenCalledTimes(1);
    shown.destroy();
    addSends([sent('c')]);
    expect(view.dispatch).toHaveBeenCalledTimes(1);
  });

  it('shows a reader Send to Plan under words picked in the writing, and no one else', () => {
    const dom = document.createElement('div');
    dom.textContent = 'Book the venue';
    const outside = document.createElement('p');
    outside.textContent = 'Elsewhere';
    document.body.append(dom, outside);
    let editable = false;
    let blockId: unknown = 'b2';
    const view = {
      get state() {
        return stateOf([{ id: blockId, text: 'Book the venue' }], { from: 1 });
      },
      dom,
      isDestroyed: false,
      dispatch: vi.fn(),
      posAtDOM: () => 200,
    };
    const shown = articleSentSpec(() => editable, draw).view(view);
    const pill = () => document.querySelector<HTMLButtonElement>('[data-read-send-pill]');
    const pick = (el: Element, to: number) => {
      const range = document.createRange();
      range.setStart(el.firstChild!, 0);
      range.setEnd(el.firstChild!, to);
      range.getBoundingClientRect = () => ({ left: 20, bottom: 40 }) as DOMRect;
      document.getSelection()!.removeAllRanges();
      document.getSelection()!.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    };
    document.dispatchEvent(new Event('selectionchange'));
    expect(pill()).toBeNull();
    pick(outside, 4);
    expect(pill()).toBeNull();
    pick(dom, 0);
    expect(pill()).toBeNull();
    blockId = '';
    pick(dom, 4);
    expect(pill()).toBeNull();
    blockId = 'b2';
    editable = true;
    pick(dom, 4);
    expect(pill()).toBeNull();
    editable = false;
    pick(dom, 4);
    expect(pill()!.style.top).toBe('48px');
    pill()!.click();
    expect(heard[0]!.places[0]).toMatchObject({ elementId: 'b2', text: 'Book' });
    pick(dom, 4);
    shown.destroy();
    expect(pill()).toBeNull();
  });

  it('reads a block at depth 0 as no block', () => {
    const dom = document.createElement('div');
    dom.textContent = 'Words';
    document.body.append(dom);
    const view = {
      state: stateOf([{ id: 'b1', text: 'Words' }], { from: 0, depth: 0 }),
      dom,
      isDestroyed: false,
      dispatch: vi.fn(),
      posAtDOM: () => 0,
    };
    const shown = articleSentSpec(() => false, draw).view(view);
    const range = document.createRange();
    range.setStart(dom.firstChild!, 0);
    range.setEnd(dom.firstChild!, 3);
    document.getSelection()!.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    expect(document.querySelector('[data-read-send-pill]')).toBeNull();
    shown.destroy();
  });
});
