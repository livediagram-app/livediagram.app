import { describe, expect, it, vi } from 'vitest';
import { parseDocumentEnvelope } from '@livediagram/document';
import type { DiagramFromGraphInput } from '@liveworkspace/index-client';
import {
  documentFromGraph,
  graphDocumentFile,
  graphInputOf,
  graphTab,
  linkCaption,
} from './internal-graph';

const input: DiagramFromGraphInput = {
  owner: 'user_1',
  name: 'Onboarding diagram',
  caption: 'From Handbook, Onboarding',
  link: 'https://www.liveknowledge.app/document/doc-1#t=t1&el=b1',
  graph: {
    title: 'Onboarding',
    style: 'flow',
    direction: 'down',
    nodes: [
      { id: 'a', label: 'Offer signed', shape: 'circle' },
      { id: 'b', label: 'Laptop ready?', shape: 'diamond', group: 'it' },
      { id: 'c', label: 'First day', note: 'Meet the team', role: 'Buddy' },
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c', label: 'Yes', line: 'dashed' },
    ],
    groups: [{ id: 'it', label: 'IT' }],
  },
};

describe('graphInputOf', () => {
  it("maps the platform's graph onto the graph input, the caption as its subtitle", () => {
    expect(graphInputOf(input)).toMatchObject({
      title: 'Onboarding',
      subtitle: 'From Handbook, Onboarding',
      style: 'flow',
      direction: 'down',
      groups: [{ id: 'it', label: 'IT' }],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c', label: 'Yes', line: 'dashed' },
      ],
    });
    expect(
      graphInputOf({ ...input, graph: { nodes: [{ id: 'a', label: 'A' }], edges: [] } }),
    ).toEqual({
      subtitle: input.caption,
      nodes: [{ id: 'a', label: 'A' }],
      edges: [],
    });
  });
});

describe('linkCaption', () => {
  it('links the first text that is the caption, and nothing else', () => {
    const els = [
      { id: '1', type: 'shape', label: 'From X' },
      { id: '2', type: 'text', label: 'From X' },
      { id: '3', type: 'text', label: 'From X' },
    ] as never;
    const out = linkCaption(els, 'From X', 'https://a.test') as unknown as Record<
      string,
      unknown
    >[];
    expect(out.map((e) => e.link ?? null)).toEqual([
      null,
      { kind: 'url', url: 'https://a.test' },
      null,
    ]);
  });
});

describe('graphDocumentFile', () => {
  it('compiles the graph into a laid-out, valid file with its caption linked back', () => {
    const file = graphDocumentFile(input)!;
    const parsed = parseDocumentEnvelope(file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const [tab] = parsed.envelope.document.tabs;
    const els = tab!.elements as unknown as Record<string, unknown>[];
    const labels = els.map((e) => e.label);
    expect(labels).toEqual(expect.arrayContaining(['Offer signed', 'Laptop ready?', 'Onboarding']));
    expect(els.filter((e) => e.type === 'arrow')).toHaveLength(2);
    const caption = els.find((e) => e.label === input.caption)!;
    expect(caption.link).toEqual({ kind: 'url', url: input.link });
    // Laid out: the boxes do not all sit at the origin.
    const xs = new Set(
      els.filter((e) => e.type === 'shape').map((e) => `${String(e.x)},${String(e.y)}`),
    );
    expect(xs.size).toBeGreaterThan(2);
  });

  it('refuses a graph the engine cannot draw', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      graphDocumentFile({
        ...input,
        graph: { style: 'lanes', nodes: [{ id: 'a', label: 'A' }], edges: [] } as never,
      }),
    ).toBeNull();
    warn.mockRestore();
  });
});

describe('documentFromGraph', () => {
  it('answers invalid_graph without reaching the index for a graph that cannot be drawn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(
      documentFromGraph({} as never, {
        ...input,
        graph: { style: 'lanes', nodes: [{ id: 'a', label: 'A' }], edges: [] } as never,
      }),
    ).resolves.toEqual({ status: 'invalid_graph' });
    warn.mockRestore();
  });
});

describe('documentFromGraph into an existing canvas', () => {
  const drawing = (status: 'ok' | 'not_found' = 'ok') => {
    const drawGraphTab = vi.fn(async () => ({ status }) as const);
    return { drawGraphTab, room: vi.fn(() => ({ drawGraphTab })) };
  };

  it('draws a new tab with a fresh id, its caption linked, as the owner', async () => {
    const { drawGraphTab, room } = drawing();
    const result = await documentFromGraph({} as never, { ...input, itemId: 'doc-9' }, room);
    expect(room).toHaveBeenCalledWith('doc-9');
    const write = (drawGraphTab.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(write).toMatchObject({ name: 'Onboarding diagram', owner: 'user_1' });
    expect(typeof write.tabId).toBe('string');
    expect(result).toEqual({ status: 'ok', id: 'doc-9', tabId: write.tabId });
    const linked = (write.elements as { link?: { url: string } }[]).filter((e) => e.link);
    expect(linked.map((e) => e.link?.url)).toEqual([input.link]);
  });

  it('redraws the tab named, and passes a missing canvas on', async () => {
    const { drawGraphTab, room } = drawing();
    await expect(
      documentFromGraph({} as never, { ...input, itemId: 'doc-9', tabId: 'tab-2' }, room),
    ).resolves.toEqual({ status: 'ok', id: 'doc-9', tabId: 'tab-2' });
    expect(drawGraphTab).toHaveBeenCalledWith(expect.objectContaining({ tabId: 'tab-2' }));
    const gone = drawing('not_found');
    await expect(
      documentFromGraph({} as never, { ...input, itemId: 'doc-9' }, gone.room),
    ).resolves.toEqual({ status: 'not_found' });
  });

  it('never reaches the room for a graph that cannot be drawn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { room } = drawing();
    await expect(
      documentFromGraph(
        {} as never,
        {
          ...input,
          itemId: 'doc-9',
          graph: { style: 'lanes', nodes: [{ id: 'a', label: 'A' }], edges: [] } as never,
        },
        room,
      ),
    ).resolves.toEqual({ status: 'invalid_graph' });
    expect(room).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('a sequence graph', () => {
  it('compiles as lifelines and messages, its caption linked', () => {
    const tab = graphTab({
      ...input,
      graph: {
        style: 'sequence',
        nodes: [
          { id: 'u', label: 'User' },
          { id: 's', label: 'Server' },
        ],
        edges: [
          { from: 'u', to: 's', label: 'Sign in' },
          { from: 's', to: 'u', label: 'Token', line: 'dashed' },
          { from: 'u', to: 's', label: 'Fetch' },
        ],
      },
    });
    expect(tab).not.toBeNull();
    const labels = tab!.elements.map((e) => (e as { label?: string }).label).filter(Boolean);
    expect(labels).toEqual(expect.arrayContaining(['User', 'Server', 'Sign in', 'Token', 'Fetch']));
    expect(tab!.elements.some((e) => (e as { link?: unknown }).link)).toBe(true);
  });
});
