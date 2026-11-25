// @vitest-environment jsdom
// Send to Plan in an article's writing (livedocuments' and liveknowledge's docs/specs/013-workspace/send-to-plan.md
// "What it sends", "The chip"): a sent block's chip, drawn outside React, and the words a send from the writing takes.
import type { IconPrim } from '@liveworkspace/icons';
import type { PlanSend } from '@liveworkspace/index-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/index-client', () => ({ indexClient: {} }));

import { glyphDom, sendArticleWords, sentChipDom } from './article-send-dom';
import { addSends, elementSends, onSendsChanged, setSendSource } from './send-store';
import { onSendToPlan, setSendHere, type SendRequest } from './send-to-plan-entry';

const sent = (id: string, over: Partial<PlanSend['card']> = {}): PlanSend => ({
  id,
  ref: 'text:t1:b1:abc',
  kind: 'text',
  plan: { id: 'P', title: 'Sprint' },
  card: { id: `c_${id}`, title: 'Fix login', column: 'To Do', done: false, ...over },
  link: `https://lp/${id}`,
  at: 1,
});

let heard: SendRequest[] = [];
let stop: () => void = () => {};
const up = () => {
  setSendSource('D', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
  setSendHere({ app: 'livedocuments', tabId: 't1' });
};
beforeEach(() => {
  heard = [];
  stop = onSendToPlan((r) => heard.push(r));
});
afterEach(() => {
  stop();
  setSendSource(null);
  setSendHere(null);
  vi.restoreAllMocks();
});

describe('a glyph drawn outside React', () => {
  it('draws each kind of line-art primitive, and nothing for a text glyph', () => {
    const prims: IconPrim[] = [
      { t: 'path', d: 'M0 0' },
      { t: 'circle', cx: 1, cy: 2, r: 3 },
      { t: 'line', x1: 0, y1: 0, x2: 1, y2: 1 },
      { t: 'rect', x: 1, y: 1, w: 2, h: 2 },
      { t: 'rect', x: 1, y: 1, w: 2, h: 2, rx: 1 },
      { t: 'polyline', points: '0,0 1,1' },
      { t: 'polygon', points: '0,0 1,1 2,0' },
      { t: 'ellipse', cx: 1, cy: 1, rx: 2, ry: 1 },
      { t: 'text', text: 'A', x: 12, y: 12, size: 10 },
    ];
    const svg = glyphDom(prims, 14);
    expect(svg.getAttribute('width')).toBe('14');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect([...svg.children].map((c) => c.tagName)).toEqual([
      'path',
      'circle',
      'line',
      'rect',
      'rect',
      'polyline',
      'polygon',
      'ellipse',
      'g',
    ]);
    expect(svg.children[3]!.getAttribute('rx')).toBe('0');
    expect(svg.children[4]!.getAttribute('rx')).toBe('1');
  });
});

describe("a sent block's chip", () => {
  it('names the card and where it stands, opens it, and never takes the caret', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const chip = sentChipDom([sent('a')]);
    expect(chip.contentEditable).toBe('false');
    expect(chip.classList.contains('article-chrome')).toBe(true);
    expect(chip.getAttribute('aria-label')).toBe(
      'Open the card “Fix login”, To Do · Sprint, in liveplanner',
    );
    expect(chip.dataset.done).toBeUndefined();
    expect(chip.textContent).toBe('To Do · Sprint');
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    chip.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    chip.click();
    expect(open).toHaveBeenCalledWith('https://lp/a', '_blank', 'noopener,noreferrer');
  });

  it('ticks a done card, counts the rest, and names an untitled card', () => {
    const chip = sentChipDom([sent('a', { done: true, column: 'Done', title: '' }), sent('b')]);
    expect(chip.dataset.done).toBe('');
    expect(chip.getAttribute('aria-label')).toBe(
      'Open the card “Card”, done, Done · Sprint, in liveplanner',
    );
    expect(chip.textContent).toContain('+1');
    expect(chip.title).toContain('and 1 more');
  });
});

describe('sending words from the writing', () => {
  it('sends the words with their block as the place, and nothing without words', () => {
    up();
    sendArticleWords(null);
    sendArticleWords({ blockId: 'b1', text: '  ' });
    expect(heard).toHaveLength(0);
    sendArticleWords({ blockId: 'b1', text: 'Ship the release notes' });
    expect(heard[0]).toMatchObject({
      noun: 'words',
      places: [
        expect.objectContaining({ kind: 'text', elementId: 'b1', text: 'Ship the release notes' }),
      ],
    });
  });

  it("keeps the store's sends readable outside React, telling a listener of each change", () => {
    up();
    const told = vi.fn();
    const off = onSendsChanged(told);
    addSends([sent('a')]);
    expect(told).toHaveBeenCalled();
    expect(elementSends('b1').map((s) => s.id)).toEqual(['a']);
    expect(elementSends('b1', 'thread')).toEqual([]);
    off();
    addSends([sent('b')]);
    expect(told).toHaveBeenCalledTimes(1);
  });
});
