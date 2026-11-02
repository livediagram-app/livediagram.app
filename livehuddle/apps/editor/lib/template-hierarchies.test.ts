import { describe, expect, it } from 'vitest';
import { type Element } from '@livehuddle/document';
import { buildTemplate } from './template-builders';

// Structure pins for the hierarchy starters (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the OKR tree,
// the one left after Diagram mode's were cut. Each test maps to a sentence of that spec.

type Shape = Extract<Element, { type: 'shape' }>;
type Arrow = Extract<Element, { type: 'arrow' }>;

const shapes = (els: Element[], kind?: string) =>
  els.filter((el): el is Shape => el.type === 'shape' && (!kind || el.shape === kind));
const arrows = (els: Element[]) => els.filter((el): el is Arrow => el.type === 'arrow');
const texts = (els: Element[]) =>
  els.filter((el) => el.type === 'text').map((el) => (el as { label?: string }).label ?? '');
const byLabel = (els: Element[], start: string) =>
  shapes(els).find((s) => (s.label ?? '').startsWith(start))!;
const pinnedTo = (a: Arrow, end: 'from' | 'to') =>
  a[end].kind === 'pinned' ? (a[end] as { elementId: string }).elementId : undefined;

describe('OKR tree template', () => {
  const els = buildTemplate('okr-tree', 0, 0);
  const rings = shapes(els, 'progress-ring');

  it('tops the tree with a bold objective that names its owner', () => {
    const objective = byLabel(els, 'Make self-serve customers successful');
    expect(objective.colorPreset).toBe('bold');
    expect(objective.iconId).toBe('target');
    expect(objective.label).toContain('Owner');
  });

  it('gives every key result a progress ring and baseline → target numbers', () => {
    expect(rings).toHaveLength(3);
    const krs = texts(els).filter((t) => /^KR\d/.test(t));
    expect(krs).toHaveLength(3);
    expect(krs.every((t) => t.includes('→') && t.includes('Owner'))).toBe(true);
  });

  it('colours key-result health with the status presets, card and ring alike', () => {
    expect(rings.map((r) => r.colorPreset)).toEqual(['success', 'warning', 'success']);
    const cards = shapes(els, 'square').filter((s) => s.label === '');
    expect(cards.map((c) => c.colorPreset)).toEqual(['success', 'warning', 'success']);
  });

  it('hangs two badged initiatives off each key result on straight drops', () => {
    expect(shapes(els, 'sticker').map((s) => s.stickerId)).toEqual([
      'badge-done',
      'badge-wip',
      'badge-wip',
      'badge-todo',
      'badge-done',
      'badge-wip',
    ]);
    const lines = arrows(els);
    expect(lines).toHaveLength(9);
    expect(lines.every((a) => a.arrowEnds === 'none' && a.curvePoints?.length === 2)).toBe(true);
    // The six KR-to-initiative drops are straight: both waypoints share one x.
    const cardIds = new Set(
      shapes(els, 'square')
        .filter((s) => s.label === '')
        .map((s) => s.id),
    );
    const drops = lines.filter((a) => cardIds.has(pinnedTo(a, 'from') ?? ''));
    expect(drops).toHaveLength(6);
    expect(drops.every((a) => a.curvePoints![0]!.dx === a.curvePoints![1]!.dx)).toBe(true);
  });
});
