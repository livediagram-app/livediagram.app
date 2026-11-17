// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { partShade } from '@livehuddle/avatar/furniture-shading';
import { createShape, type ShapeElement } from '@livehuddle/document';
import { FurnitureView, isFurnitureViewShape } from './FurnitureView';
import { GardenFenceView, GardenPathView, GrassView } from './GardenViews';

afterEach(cleanup);

const shape = (kind: Parameters<typeof createShape>[0]) =>
  ({ ...createShape(kind, 0, 0), id: kind }) as ShapeElement;
const sitter = (name: string) => ({ name, color: '#0ea5e9' });

// docs/specs/009-elements/office.md "Office Pod" to "Garden Fence".

// A lit part's top: its colour in the light (furniture-art-style.md "Light").
const lit = (fill: string) => partShade(fill, 'panel').top;

describe('the pod, bar and garden views', () => {
  it('draws the grid pieces from the furniture table, the sized ones elsewhere', () => {
    for (const kind of [
      'office-pod',
      'bar',
      'bar-stool',
      'drinks-cabinet',
      'drinks-fridge',
      'outdoor-plant',
      'tree',
    ] as const) {
      expect(isFurnitureViewShape(kind)).toBe(true);
      const { container, unmount } = render(
        <FurnitureView element={shape(kind)} stroke="#94a3b8" sitters={[]} />,
      );
      expect(container.querySelector('svg')).not.toBeNull();
      unmount();
    }
    expect(isFurnitureViewShape('garden-path')).toBe(false);
    expect(isFurnitureViewShape('garden-fence')).toBe(false);
    expect(isFurnitureViewShape('grass')).toBe(false);
  });

  it('shuts the pod’s door only while two sit in it, and names them', () => {
    const door = (sitters: ReturnType<typeof sitter>[]) => {
      const { container, unmount } = render(
        <FurnitureView element={shape('office-pod')} stroke="#94a3b8" sitters={sitters} />,
      );
      const state = container.querySelector('[data-pod-door]')?.getAttribute('data-pod-door');
      const label = container.querySelector('svg')?.getAttribute('aria-label');
      unmount();
      return { state, label };
    };
    expect(door([])).toEqual({ state: 'open', label: 'Empty office pod' });
    expect(door([sitter('Ada')]).state).toBe('open');
    expect(door([sitter('Ada'), sitter('Grace')])).toEqual({
      state: 'closed',
      label: 'Office pod, Ada and Grace sitting',
    });
  });

  // docs/specs/009-elements/furniture-facing.md "Live faces": the door turns with the pod.
  it('slides a turned pod’s door in the doorway its drawing shows', () => {
    const door = (chairFacing: 'n' | 'e' | 's' | 'w', sitters: ReturnType<typeof sitter>[]) => {
      const { container, unmount } = render(
        <FurnitureView
          element={{ ...shape('office-pod'), chairFacing }}
          stroke="#94a3b8"
          sitters={sitters}
        />,
      );
      const panel = container.querySelector('[data-pod-door] rect[rx="2"]')!;
      const slide = (container.querySelector('.lh-pod-door') as HTMLElement).style.transform;
      const mirrored = !!panel.closest('g[transform]');
      const at = ['x', 'y', 'width', 'height'].map((k) => Number(panel.getAttribute(k)));
      unmount();
      return { at, slide, mirrored };
    };
    expect(door('n', [])).toEqual({
      at: [54, 134, 68, 9],
      slide: 'translate(68px)',
      mirrored: false,
    });
    expect(door('s', []).at).toEqual([54, 7, 68, 30]);
    expect(door('s', []).slide).toBe('translate(-68px)');
    expect(door('e', [])).toEqual({
      at: [0, 68, 9, 68],
      slide: 'translate(0px, 68px)',
      mirrored: false,
    });
    // Facing right is the side mirrored, the door with it.
    expect(door('w', []).mirrored).toBe(true);
    expect(door('e', [sitter('Ada'), sitter('Grace')]).slide).toBe('translate(0px)');
  });

  it('draws no ring under a bar stool’s or a pod bench’s sitter', () => {
    const rings = (kind: 'bar-stool' | 'office-pod', seat?: number) => {
      const { container, unmount } = render(
        <FurnitureView
          element={shape(kind)}
          stroke="#94a3b8"
          sitters={[{ ...sitter('Ada'), ...(seat === undefined ? {} : { seat }) }]}
        />,
      );
      const found = [...container.querySelectorAll('ellipse[stroke="#0ea5e9"]')].map((e) =>
        Number(e.getAttribute('cx')),
      );
      unmount();
      return found;
    };
    // No ring on a taken seat any more (chair.md "Occupied", the owner 2026-11-17).
    expect(rings('bar-stool')).toEqual([]);
    expect(rings('office-pod', 1)).toEqual([]);
  });

  it('draws a garden path in its fill and a garden fence in white pickets', () => {
    const path = render(
      <GardenPathView element={shape('garden-path')} stroke="#94a3b8" floor="#e7dcc4" />,
    );
    expect(path.container.querySelector('svg')?.getAttribute('aria-label')).toBe('Garden Path');
    expect(path.container.querySelector('rect[fill="#e7dcc4"]')).not.toBeNull();
    path.unmount();
    const fence = render(<GardenFenceView element={shape('garden-fence')} stroke="#94a3b8" />);
    expect(fence.container.querySelector('svg')?.getAttribute('aria-label')).toBe('Garden Fence');
    expect(fence.container.innerHTML).toContain(`stop-color="${lit('#ffffff')}"`);
    expect(fence.container.querySelectorAll('path[fill^="url("]').length).toBeGreaterThan(5);
  });

  it('draws grass as its lawn plus its mottling, two turf tiles and the light across it, the same few nodes however large', () => {
    const count = (width: number, height: number) => {
      const el = { ...shape('grass'), width, height };
      const { container, unmount } = render(<GrassView element={el} floor="#9bd27a" />);
      const svg = container.querySelector('svg')!;
      const lawn = svg.querySelector('path[fill="#9bd27a"]');
      const ids = [...svg.querySelectorAll('pattern, linearGradient')].map((p) => p.id);
      const layers = [...svg.querySelectorAll('path[fill^="url(#"]')].map((p) =>
        p.getAttribute('fill'),
      );
      const result = {
        label: svg.getAttribute('aria-label'),
        lawn: lawn !== null,
        nodes: svg.querySelectorAll('*').length,
        linked: layers.every((f) => ids.some((id) => f === `url(#${id})`)),
        layers: layers.length,
      };
      unmount();
      return result;
    };
    const small = count(240, 160);
    expect(small).toMatchObject({ label: 'Grass', lawn: true, linked: true, layers: 4 });
    expect(count(4000, 3000).nodes).toBe(small.nodes);
  });

  it('gives each lawn its own pattern ids', () => {
    const { container } = render(
      <>
        <GrassView element={shape('grass')} floor="#9bd27a" />
        <GrassView element={shape('grass')} floor="#9bd27a" />
      </>,
    );
    const ids = [...container.querySelectorAll('pattern')].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
