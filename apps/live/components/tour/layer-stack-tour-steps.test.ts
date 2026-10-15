// @vitest-environment jsdom

// The Layer Stack tour (docs/specs/007-editor/element-tours.md "The Layer Stack tour"): its steps on the selected
// stack, the ones left out, the "+" ring it opens and closes, and the animation it previews.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ElementTourApi } from './element-tour-api';
import { layerStackTourSteps } from './layer-stack-tour-steps';
import type { ConceptTourContext } from './concept-element-tour-steps';

vi.mock('./tour-dom', () => ({ waitForSelector: async () => null }));

afterEach(() => {
  document.body.innerHTML = '';
});

const rows = [
  { label: 'Presentation', note: 'Next.js' },
  { label: 'API' },
  { label: 'Storage', note: 'D1' },
];
const ctxOf = (over: Partial<ConceptTourContext> = {}): ConceptTourContext => ({
  elementId: 'st',
  rows,
  hasMore: true,
  touch: false,
  ...over,
});
const api = (): ElementTourApi => ({
  focus: vi.fn(),
  clearFocus: vi.fn(),
  openFlows: vi.fn(),
  closeFlows: vi.fn(),
  showTable: vi.fn(),
  showText: vi.fn(),
  previewConcept: vi.fn(),
  showStageBar: vi.fn(),
  openSequence: vi.fn(),
  closeSequence: vi.fn(),
  showSequenceTab: vi.fn(),
  clearPreview: vi.fn(),
});

describe('layerStackTourSteps', () => {
  it('walks the stack, a layer, a note, adding, the menu, colours and the Build animation', () => {
    expect(layerStackTourSteps(ctxOf()).map((s) => s.id)).toEqual([
      'layers',
      'edit',
      'notes',
      'add',
      'rows',
      'colours',
      'animate',
      'outro',
    ]);
  });

  it('leaves out notes on a stack with none, and the menu where More is not shown', () => {
    const ids = layerStackTourSteps(
      ctxOf({ rows: [{ label: 'A' }, { label: 'B' }], hasMore: false }),
    ).map((s) => s.id);
    expect(ids).not.toContain('notes');
    expect(ids).not.toContain('rows');
  });

  it('points at the real stack: the top layer, the first note, the bottom layer', () => {
    const steps = layerStackTourSteps(ctxOf());
    const sel = (id: string) => steps.find((s) => s.id === id)!.selector!(api());
    expect(sel('layers')).toBe('[data-element-id="st"]');
    expect(sel('edit')).toBe('[data-element-id="st"] [data-concept-row="0"]');
    expect(sel('notes')).toBe('[data-element-id="st"] [data-concept-note="0"]');
    expect(sel('colours')).toBe('[data-element-id="st"] [data-concept-row="2"]');
    expect(sel('add')).toBe('[data-quick-ring] button[aria-label="Add Layer"]');
    expect(sel('rows')).toBe('#selection-more-actions');
  });

  it('says tap on a touch screen, and counts the layers in the colour step', () => {
    const body = (id: string, touch: boolean) =>
      layerStackTourSteps(ctxOf({ touch })).find((s) => s.id === id)!.body;
    expect(body('edit', false)).toMatch(/^Click/);
    expect(body('edit', true)).toMatch(/^Tap/);
    expect(body('colours', false)).toContain('all 3 follow');
  });

  it('opens the "+" ring on the first side shown, and closes it on leaving', async () => {
    document.body.innerHTML =
      '<button data-quick-plus="below" aria-expanded="false"></button><button data-quick-plus="right" aria-expanded="false"></button>';
    const below = document.querySelector<HTMLElement>('[data-quick-plus="below"]')!;
    // jsdom lays nothing out: give the first side a box, as a browser would.
    below.getClientRects = () => [{}] as unknown as DOMRectList;
    const clicks: string[] = [];
    for (const b of document.querySelectorAll<HTMLElement>('[data-quick-plus]'))
      b.addEventListener('click', () => {
        clicks.push(b.dataset.quickPlus!);
        b.setAttribute(
          'aria-expanded',
          b.getAttribute('aria-expanded') === 'true' ? 'false' : 'true',
        );
      });
    const add = layerStackTourSteps(ctxOf()).find((s) => s.id === 'add')!;
    const a = api();
    await add.prepare!(a);
    expect(clicks).toEqual(['below']);
    expect(a.clearPreview).toHaveBeenCalled();
    // Entering again with the ring open does not toggle it shut.
    await add.prepare!(a);
    expect(clicks).toEqual(['below']);
    add.cleanup!(a);
    expect(clicks).toEqual(['below', 'below']);
    expect(below.getAttribute('aria-expanded')).toBe('false');
  });

  it('previews Build on the animation step only, and stops it on leaving', async () => {
    const steps = layerStackTourSteps(ctxOf());
    const a = api();
    const animate = steps.find((s) => s.id === 'animate')!;
    await animate.prepare!(a);
    expect(a.previewConcept).toHaveBeenCalledWith('build');
    animate.cleanup!(a);
    expect(a.clearPreview).toHaveBeenCalled();
    const colours = steps.find((s) => s.id === 'colours')!;
    vi.mocked(a.previewConcept).mockClear();
    await colours.prepare!(a);
    expect(a.previewConcept).not.toHaveBeenCalled();
  });

  it('ends on its closing card', () => {
    const outro = layerStackTourSteps(ctxOf()).at(-1)!;
    expect(outro).toMatchObject({ card: 'outro', title: 'That Is a Layer Stack' });
  });
});
