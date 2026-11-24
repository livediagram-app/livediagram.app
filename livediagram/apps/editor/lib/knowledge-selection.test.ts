// Send to Knowledge Base's capture (docs/specs/013-workspace/send-to-knowledge.md "What it sends"): reading order, a
// frame's contents, arrows with an end outside the selection sent as null, notes, caps, and the picture's size steps.
import { describe, expect, it, vi } from 'vitest';
import type { Element } from '@livediagram/document';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  KNOWLEDGE_SEND_ITEMS_MAX,
  KNOWLEDGE_SEND_PICTURE_BYTES_MAX,
} from '@liveworkspace/index-client';
import {
  base64Bytes,
  captureKnowledgeSelection,
  gatherSelection,
  pictureWithin,
  selectionTab,
} from './knowledge-selection';

const box = (id: string, x: number, y: number, over: Record<string, unknown> = {}) =>
  ({
    id,
    type: 'shape',
    shape: 'rectangle',
    x,
    y,
    width: 100,
    height: 50,
    label: id.toUpperCase(),
    ...over,
  }) as unknown as Element;
const frame = (id: string, x: number, y: number, w: number, h: number, label = 'Checkout') =>
  box(id, x, y, { shape: 'frame', width: w, height: h, label });
const arrow = (id: string, from: string, to: string, label?: string) =>
  ({
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: from, anchor: 'right' },
    to: { kind: 'pinned', elementId: to, anchor: 'left' },
    ...(label ? { label } : {}),
  }) as unknown as Element;

describe('captureKnowledgeSelection', () => {
  it('reads top to bottom, then left to right, with labels and notes', () => {
    const els = [box('c', 0, 200), box('b', 300, 0, { note: 'Retries twice' }), box('a', 0, 0)];
    const { selection, elementIds, heading } = captureKnowledgeSelection(
      els,
      new Set(['a', 'b', 'c']),
    );
    expect(selection.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(selection.items[1]).toEqual({
      id: 'b',
      kind: 'Rectangle',
      label: 'B',
      note: 'Retries twice',
    });
    expect(elementIds).toEqual(['a', 'b', 'c']);
    expect(heading).toBe('A');
  });

  it('gathers a picked frame’s contents and the arrows between them, the frame naming the heading', () => {
    const els = [
      frame('f', 0, 0, 500, 300),
      box('in1', 20, 40),
      box('in2', 300, 40),
      box('out', 900, 900),
      arrow('a1', 'in1', 'in2', 'pays'),
      arrow('a2', 'in2', 'out'),
    ];
    const { selection, heading } = captureKnowledgeSelection(els, new Set(['f']));
    expect(selection.items.map((i) => [i.id, i.in])).toEqual([
      ['f', undefined],
      ['in1', 'f'],
      ['in2', 'f'],
    ]);
    // The arrow to an element outside is not part of the frame, and so not sent.
    expect(selection.links).toEqual([{ from: 'in1', to: 'in2', label: 'pays' }]);
    expect(heading).toBe('Checkout');
  });

  it('sends an arrow’s end outside the selection as null, never naming it', () => {
    const els = [box('a', 0, 0), box('secret', 400, 0), arrow('x', 'a', 'secret')];
    const { selection } = captureKnowledgeSelection(els, new Set(['a', 'x']));
    expect(selection.links).toEqual([{ from: 'a', to: null }]);
    expect(JSON.stringify(selection)).not.toContain('secret');
  });

  it('reads an image’s alt text and a table’s cells', () => {
    const els = [
      box('i', 0, 0, { type: 'image', label: undefined, alt: 'Login screen' }),
      box('t', 0, 100, {
        type: 'table',
        label: undefined,
        cells: [
          ['Name', 'Owner'],
          ['Cart', 'Ana'],
        ],
      }),
    ];
    const { selection } = captureKnowledgeSelection(els, new Set(['i', 't']));
    expect(selection.items.map((i) => i.label)).toEqual([
      'Login screen',
      'Name | Owner; Cart | Ana',
    ]);
  });

  it('caps a huge selection, marking it cut, within a CPU budget', () => {
    const els = Array.from({ length: 5_000 }, (_, i) => box(`e${i}`, (i % 50) * 120, i * 3));
    const ids = new Set(els.map((e) => e.id));
    let out: ReturnType<typeof captureKnowledgeSelection> | undefined;
    const ms = cpuMsOf(() => {
      out = captureKnowledgeSelection(els, ids);
    });
    expect(out!.selection.items).toHaveLength(KNOWLEDGE_SEND_ITEMS_MAX);
    expect(out!.selection.cut).toBe(true);
    expect(ms).toBeLessThan(cpuBudgetMs(250));
  });

  it('a frame gathers only what lies wholly inside it, once', () => {
    const els = [frame('f', 0, 0, 200, 200), box('half', 150, 150), box('in', 10, 10)];
    expect(gatherSelection(els, new Set(['f', 'in'])).map((g) => g.el.id)).toEqual(['f', 'in']);
  });

  it('the picture’s tab holds the gathered elements alone', () => {
    const tab = {
      id: 't',
      elements: [frame('f', 0, 0, 300, 300), box('in', 10, 10), box('x', 900, 0)],
    };
    expect(selectionTab(tab as never, new Set(['f'])).elements.map((e) => e.id)).toEqual([
      'f',
      'in',
    ]);
  });
});

describe('pictureWithin', () => {
  const canvas = (width: number, b64Length: number) =>
    ({
      width,
      height: width / 2,
      toDataURL: () => `data:image/png;base64,${'A'.repeat(b64Length)}`,
    }) as unknown as HTMLCanvasElement;

  it('steps the scale down until the PNG fits', async () => {
    const tooBig = Math.ceil((KNOWLEDGE_SEND_PICTURE_BYTES_MAX * 4) / 3) + 8;
    const draw = vi.fn(async (scale: number) => canvas(400 * scale, scale > 1 ? tooBig : 400));
    const picture = await pictureWithin(draw);
    expect(draw.mock.calls.map((c) => c[0])).toEqual([2, 1.5, 1]);
    expect(picture).toMatchObject({ width: 400, height: 200 });
  });

  it('goes without one when no scale fits', async () => {
    const tooBig = Math.ceil((KNOWLEDGE_SEND_PICTURE_BYTES_MAX * 4) / 3) + 8;
    expect(await pictureWithin(async () => canvas(100, tooBig))).toBeNull();
  });

  it('counts base64 bytes with its padding', () => {
    expect(base64Bytes('QUJD')).toBe(3);
    expect(base64Bytes('QUI=')).toBe(2);
    expect(base64Bytes('QQ==')).toBe(1);
  });
});
