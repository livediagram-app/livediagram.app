// @vitest-environment jsdom
// Send to Knowledge Base's chips (liveworkspace/docs/specs/004-index/send-to-knowledge.md "The chips"): the source's
// sends by element, the knowledgebase's received sends by link, and the page's Sent From chip drawn after the line
// that links back. Never polled; a failed read keeps what was there.
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/index-client', () => ({ indexClient: {} }));

import type { KnowledgeReceived, KnowledgeSend } from '@liveworkspace/index-client';
import {
  addKnowledgeSend,
  elementKnowledgeSends,
  sentPageWords,
  setKnowledgeSendSource,
} from './knowledge-send-store';
import { receivedAt, setKnowledgeReceivedSource } from './knowledge-received-store';
import { articleReceivedSpec, receivedChipDom } from './article-received';
import {
  canSendKnowledgeHere,
  onSendToKnowledge,
  sendToKnowledge,
  setKnowledgeSummariser,
} from './send-to-knowledge-entry';

const send = (over: Partial<KnowledgeSend> = {}): KnowledgeSend => ({
  id: 'ks_1',
  tabId: 't1',
  elementIds: ['a', 'b'],
  knowledgebase: { id: 'K', title: 'Team Wiki' },
  page: { id: 'p1', title: 'Onboarding' },
  link: 'https://lk/document/K#t=p1',
  at: 1,
  ...over,
});
const LINK = 'https://www.livediagram.app/document/D#t=t1&el=a';
const received: KnowledgeReceived = {
  id: 'ks_1',
  page: 'p1',
  place: LINK,
  source: { app: 'livediagram', id: 'D', title: 'Payments Flow' },
};
const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  setKnowledgeSendSource(null);
  setKnowledgeReceivedSource(null);
  setKnowledgeSummariser(null);
});

describe('the source’s sends', () => {
  it('reads once, indexes by element, adds a send at once, and keeps what it had when a read fails', async () => {
    const reader = { knowledgeSends: vi.fn().mockResolvedValue({ sends: [send()] }) };
    setKnowledgeSendSource('D', null, reader as never);
    await flush();
    expect(elementKnowledgeSends('a').map((s) => s.id)).toEqual(['ks_1']);
    addKnowledgeSend(send({ id: 'ks_2', elementIds: ['a'] }));
    expect(elementKnowledgeSends('a').map((s) => s.id)).toEqual(['ks_2', 'ks_1']);
    expect(elementKnowledgeSends('b').map((s) => s.id)).toEqual(['ks_1']);
    expect(sentPageWords(send())).toBe('On Onboarding · Team Wiki');
    // The same item again reads nothing more.
    setKnowledgeSendSource('D', null, reader as never);
    expect(reader.knowledgeSends).toHaveBeenCalledTimes(1);
  });
});

describe('the knowledgebase’s received sends', () => {
  it('reads once and finds a send by the link its line holds', async () => {
    const reader = { knowledgeReceived: vi.fn().mockResolvedValue({ received: [received] }) };
    setKnowledgeReceivedSource('K', null, reader as never);
    await flush();
    expect(receivedAt(LINK)?.source.title).toBe('Payments Flow');
    expect(receivedAt('https://elsewhere')).toBeNull();
  });

  it('leaves the lines plain when the read is refused', async () => {
    const reader = { knowledgeReceived: vi.fn().mockRejectedValue(new Error('403')) };
    setKnowledgeReceivedSource('K', null, reader as never);
    await flush();
    expect(receivedAt(LINK)).toBeNull();
  });
});

describe('the Sent From chip', () => {
  const block = (href: string | null) => ({
    attrs: {},
    isTextblock: true,
    nodeSize: 10,
    forEach: (f: (child: { marks: unknown[] }) => void) => {
      f({ marks: [] });
      f({ marks: href ? [{ type: { name: 'link' }, attrs: { href } }] : [] });
    },
  });
  const draw = {
    widget: (pos: number, toDOM: () => Node, spec: { key: string }) => ({ pos, toDOM, spec }),
    set: (_doc: unknown, decos: unknown[]) => decos,
    empty: [] as unknown[],
  };
  const stateOf = (blocks: ReturnType<typeof block>[]) =>
    ({
      doc: {
        forEach: (f: (n: unknown, pos: number) => void) => blocks.forEach((b, i) => f(b, i * 10)),
      },
    }) as never;

  it('draws after a line that links to a received place, and nowhere else', async () => {
    // Nothing received: no walk, no chips.
    expect(articleReceivedSpec(draw as never).props.decorations(stateOf([block(LINK)]))).toEqual(
      [],
    );
    const reader = { knowledgeReceived: vi.fn().mockResolvedValue({ received: [received] }) };
    setKnowledgeReceivedSource('K', null, reader as never);
    await flush();
    const spec = articleReceivedSpec(draw as never);
    const decos = spec.props.decorations(
      stateOf([block(null), block(LINK), block('https://other')]),
    ) as unknown as { pos: number; toDOM: () => HTMLElement }[];
    expect(decos.map((d) => d.pos)).toEqual([19]);
    const chip = decos[0]!.toDOM();
    expect(chip.textContent).toBe('Payments Flow');
    expect(chip.getAttribute('aria-label')).toBe('Open “Payments Flow” in livediagram');
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null);
    chip.click();
    expect(opened).toHaveBeenCalledWith(LINK, '_blank', 'noopener,noreferrer');
  });

  it('names an untitled source plainly', () => {
    expect(receivedChipDom({ app: 'liveplanner', title: '' }, LINK).textContent).toBe('Untitled');
  });
});

describe('the entry', () => {
  it('opens the picker only while a host offers it, and only for a selection', () => {
    const seen = vi.fn();
    expect(canSendKnowledgeHere()).toBe(false);
    const off = onSendToKnowledge(seen);
    setKnowledgeSummariser(async () => ({ ok: true, markdown: '' }));
    expect(canSendKnowledgeHere()).toBe(true);
    const capture = {
      tabId: 't1',
      elementIds: ['a'],
      selection: { items: [{ id: 'a', kind: 'shape', label: 'A' }], links: [] },
      heading: 'A',
      picture: async () => null,
    };
    sendToKnowledge({ ...capture, elementIds: [] });
    sendToKnowledge(null);
    sendToKnowledge(capture);
    expect(seen).toHaveBeenCalledTimes(1);
    off();
    expect(canSendKnowledgeHere()).toBe(false);
  });
});
