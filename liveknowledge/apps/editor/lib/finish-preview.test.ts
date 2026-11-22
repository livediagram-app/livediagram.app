import { describe, expect, it } from 'vitest';
import { FINISH_PREVIEW_ELEMENTS, finishPreviewSvg } from './finish-preview';

// The Finish tab's preview (docs/specs/008-canvas/finish.md "Where it is set").
const tab = { background: '#0d121a' };

describe('finishPreviewSvg', () => {
  it('draws the sample scene: a step, a decision, the arrow between and a note', () => {
    expect(FINISH_PREVIEW_ELEMENTS.map((e) => e.type)).toEqual([
      'shape',
      'shape',
      'arrow',
      'sticky',
    ]);
    const svg = finishPreviewSvg('flexible', tab);
    for (const text of ['Plan the work', 'Ready?', 'Ship it']) expect(svg).toContain(text);
  });

  it('draws each finish differently, on the tab’s paper', () => {
    const [flex, pro, sketch] = (['flexible', 'professional', 'sketch'] as const).map((f) =>
      finishPreviewSvg(f, tab),
    );
    expect(new Set([flex, pro, sketch]).size).toBe(3);
    expect(sketch).toContain('data-finish="sketch"');
    expect(flex).not.toContain('data-finish="sketch"');
    expect(flex).toContain('#0d121a');
  });

  it('is the same drawing every time (fixed ids seed the wobble)', () => {
    expect(finishPreviewSvg('sketch', tab)).toBe(finishPreviewSvg('sketch', tab));
  });

  it('letters in the tab’s font', () => {
    expect(finishPreviewSvg('flexible', { ...tab, font: 'lora' })).toMatch(/Lora/);
  });
});

describe('finishPreviewSvg in a theme', () => {
  it('draws the sample in the tab’s theme colours', () => {
    expect(finishPreviewSvg('flexible', { ...tab, theme: 'forest' })).not.toBe(
      finishPreviewSvg('flexible', tab),
    );
  });
});
