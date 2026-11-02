import { describe, expect, it } from 'vitest';
import { layOutPages, pageScreenRect, type Element } from '@livedesign/design';
import {
  inspectCanvasLines,
  inspectNeighbourLines,
  inspectNeighbours,
  inspectTarget,
  inspectTargetSpec,
} from './inspect-target';

// docs/specs/007-editor/wireframe-pages.md "Inspect": what the overlay and the panel both read.
const pages = layOutPages([
  { id: 'p1', kind: 'wireframe', device: 'iphone', size: 'device' },
  { id: 'p2', kind: 'wireframe', device: 'iphone', size: 'device' },
] as never);
const screen = pageScreenRect(pages[0]!);
const other = pageScreenRect(pages[1]!);

const box = (id: string, x: number, y: number, w = 100, h = 40, extra = {}) =>
  ({ id, type: 'shape', shape: 'square', x, y, width: w, height: h, ...extra }) as Element;

const a = box('a', screen.x + 16, screen.y + 100);
const b = box('b', screen.x + 16, screen.y + 160);
const far = box('far', other.x + 16, other.y + 100);
const arrow = { id: 'arrow', type: 'arrow', x1: 0, y1: 0, x2: 1, y2: 1 } as unknown as Element;
const elements = [a, b, far, arrow];

describe('inspectTarget', () => {
  it('finds the element, its page and that page’s screen', () => {
    const t = inspectTarget('a', elements, pages)!;
    expect(t.el).toBe(a);
    expect(t.page?.id).toBe('p1');
    expect(t.screen).toEqual(screen);
    expect(t.rect).toEqual({ x: screen.x + 16, y: screen.y + 100, width: 100, height: 40 });
  });

  it('is null for no id, an unknown id and an arrow', () => {
    expect(inspectTarget(null, elements, pages)).toBeNull();
    expect(inspectTarget('nope', elements, pages)).toBeNull();
    expect(inspectTarget('arrow', elements, pages)).toBeNull();
  });

  it('has no page or screen off every page', () => {
    const loose = box('loose', -99_999, -99_999);
    const t = inspectTarget('loose', [loose], pages)!;
    expect(t.page).toBeNull();
    expect(t.screen).toBeNull();
  });
});

describe('neighbours and lines', () => {
  const t = inspectTarget('a', elements, pages)!;

  it('keeps to the target’s page, skipping arrows', () => {
    expect(inspectNeighbours(t, elements, pages).map((e) => e.id)).toEqual(['b']);
  });

  it('measures to the neighbour and to the screen’s edges', () => {
    const lines = inspectNeighbourLines(t, elements, pages);
    const below = lines.find((l) => l.side === 'bottom')!;
    expect(below.distance).toBe(20);
    expect(below.toElement).toBe(b);
    const left = lines.find((l) => l.side === 'left')!;
    expect(left.distance).toBe(16);
    expect(left.toElement).toBeNull();
  });

  it('measures between the selected and the hovered, else round whichever is set', () => {
    const hb = inspectTarget('b', elements, pages)!;
    const pair = inspectCanvasLines(t, hb, elements, pages);
    expect(pair).toHaveLength(1);
    expect(pair[0]!.distance).toBe(20);
    expect(pair[0]!.toElement).toBe(b);
    expect(inspectCanvasLines(t, t, elements, pages)).toEqual(
      inspectNeighbourLines(t, elements, pages),
    );
    expect(inspectCanvasLines(null, hb, elements, pages)).toEqual(
      inspectNeighbourLines(hb, elements, pages),
    );
    expect(inspectCanvasLines(null, null, elements, pages)).toEqual([]);
  });
});

describe('inspectTargetSpec', () => {
  it('measures from the screen’s top-left', () => {
    const spec = inspectTargetSpec(inspectTarget('a', elements, pages)!, {});
    expect(spec.x).toBe(16);
    expect(spec.y).toBe(100);
    expect(spec.width).toBe(100);
  });

  it('measures from the canvas origin off every page', () => {
    const loose = box('loose', -99_999, -99_998);
    const spec = inspectTargetSpec(inspectTarget('loose', [loose], pages)!, {});
    expect(spec.x).toBe(-99_999);
    expect(spec.y).toBe(-99_998);
  });

  it('reads colours against a dark page as that page draws them', () => {
    const dark = layOutPages([
      {
        id: 'd',
        kind: 'wireframe',
        device: 'iphone',
        size: 'device',
        background: { fill: { kind: 'solid', color: '#0f172a' } },
      },
    ] as never);
    const s = pageScreenRect(dark[0]!);
    const el = box('t', s.x + 10, s.y + 10, 100, 40, { label: 'Hi' });
    const onDark = inspectTargetSpec(inspectTarget('t', [el], dark)!, {});
    const onLight = inspectTargetSpec(
      inspectTarget(
        't',
        [box('t', screen.x + 10, screen.y + 10, 100, 40, { label: 'Hi' })],
        pages,
      )!,
      {},
    );
    expect(onDark.text?.color).not.toBe(onLight.text?.color);
  });
});

// docs/specs/007-editor/wireframe-pages.md "The measurements on the canvas": a hover over a new element costs one
// pass over the tab's elements, so a busy tab stays well inside a frame.
describe('a busy tab', () => {
  it('measures round an element among 5,000 within a frame', () => {
    const many: Element[] = [];
    for (let i = 0; i < 5_000; i++) {
      const p = i % 2 === 0 ? screen : other;
      many.push(box(`e${i}`, p.x + (i % 7) * 50, p.y + Math.floor(i / 14) * 2, 40, 1));
    }
    const t = inspectTarget('e1000', many, pages)!;
    const start = performance.now();
    for (let i = 0; i < 10; i++) inspectCanvasLines(t, null, many, pages);
    const perCall = (performance.now() - start) / 10;
    expect(perCall).toBeLessThan(16);
  });
});
