import { describe, expect, it } from 'vitest';
import { renderElementsToSvg } from './svg-render';
import { createShape, createText } from './factories';
import { wrapLabel } from './svg-render-primitives';
import { SELECTION_MODES } from './selection-mode';
import { MODE_GLYPHS } from './mode-glyphs';
import type { ShapeElement, Tab } from './index';

// The Behaviour faces export the way the canvas draws them
// (docs/specs/020-import-export/export-fidelity.md "The behaviour faces").

const shape = (kind: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape(kind as ShapeElement['shape'], 0, 0),
  id: `el-${kind}`,
  ...overrides,
});
const svgOf = (el: ShapeElement, background?: string) =>
  renderElementsToSvg({ id: 't', name: 'T', elements: [el] }, { background });

describe('Behaviour face export', () => {
  it('names an unlabelled Mode button by its destination', () => {
    const svg = svgOf(shape('mode-button', { mode: 'avatar', label: '' }));
    expect(svg).toContain('>SWITCH TO<');
    expect(svg).toContain('>Avatar<');
  });

  it('draws a portal as its lit ring when paired, and dim when not', () => {
    expect(svgOf(shape('portal', { portalTarget: 'x' }))).toContain('stop-opacity="0.95"');
    expect(svgOf(shape('portal'))).toContain('stop-opacity="0.35"');
  });

  it('draws an arrow whose stored head shape this build does not know with the default head', () => {
    const a = createShape('square', 0, 0);
    const b = createShape('square', 300, 0);
    const svg = renderElementsToSvg({
      id: 't',
      name: 'T',
      elements: [
        a,
        b,
        {
          id: 'arr',
          type: 'arrow',
          from: { kind: 'pinned', elementId: a.id, anchor: 'e' },
          to: { kind: 'pinned', elementId: b.id, anchor: 'w' },
          arrowEnds: 'both',
          arrowheadShape: 'star' as never,
          arrowheadStartShape: 'moon' as never,
        },
      ],
    });
    expect(svg).toContain('<polygon');
  });

  it('prints a chair label under the seat', () => {
    expect(svgOf(shape('chair', { label: 'Scribe' }))).toContain('>Scribe<');
  });

  it('starts a page label under the masthead, and turns back its corner', () => {
    const el = shape('page', { label: 'Body', pageTitle: 'Doc', pageSubtitle: 'Sub' });
    const svg = svgOf(el, '#0d121a');
    const bodyY = Number(/<text x="[\d.]+" y="([\d.]+)"[^<>]*font-size="14"/.exec(svg)?.[1]);
    const ruleY = Number(/<path d="M 26 ([\d.]+) L/.exec(svg)?.[1]);
    expect(bodyY).toBeGreaterThan(ruleY);
    // The cut corner shows the paper under the page.
    expect(svg).toContain('fill="#0d121a"/><path');
  });
});

describe('wrapLabel', () => {
  it('breaks a word wider than the line, as the canvas does', () => {
    const lines = wrapLabel('smartwatch', 50, (s) => s.length * 7, true);
    expect(lines).toEqual(['smartwa', 'tch']);
  });

  it('never cuts an emoji in half when it breaks a word', () => {
    // Each emoji is two UTF-16 units; a line holds one and a half of them.
    const lines = wrapLabel('😀😀😀', 21, (s) => [...s].length * 14, true);
    expect(lines).toEqual(['😀', '😀', '😀']);
    // A flag (two code points) and a joined family emoji stay whole too.
    expect(wrapLabel('🇬🇧👨‍👩‍👧', 10, (s) => [...s].length * 14, true)).toEqual(['🇬🇧', '👨‍👩‍👧']);
  });

  it('keeps an over-long word whole for an icon caption', () => {
    expect(wrapLabel('smartwatch', 50, (s) => s.length * 7)).toEqual(['smartwatch']);
  });
});

describe('Mode button glyph (docs/specs/020-import-export/export-fidelity.md)', () => {
  it('draws the mode’s own glyph from the shared data, not a placeholder ring', () => {
    for (const mode of SELECTION_MODES) expect(MODE_GLYPHS[mode], mode).toBeDefined();
    const el = { ...createShape('mode-button', 0, 0), mode: 'avatar' as const };
    const svg = renderElementsToSvg({ id: 't', name: 'T', elements: [el] });
    const footprint = MODE_GLYPHS.avatar!.prims[0] as { d: string };
    expect(svg).toContain(footprint.d);
  });
});

// docs/specs/023-draw-mode/draw-mode.md "Text boxes": a Shift-resized text box draws its text
// scaled, and exports that way too.
describe('Scaled text box export', () => {
  it('draws the label at its size times its scale', () => {
    const el = { ...createText(0, 0), id: 'txt', label: 'Big', textSize: 'sm' as const };
    const tab = (textScale?: number) =>
      ({ id: 't', name: 'T', elements: [{ ...el, textScale }] }) as unknown as Tab;
    expect(renderElementsToSvg(tab())).toContain('font-size="14"');
    expect(renderElementsToSvg(tab(2.5))).toContain('font-size="35"');
  });
});
