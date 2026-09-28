import { describe, expect, it } from 'vitest';
import { renderElementsToSvg } from './svg-render';
import { createShape } from './factories';
import { wrapLabel } from './svg-render-primitives';
import type { ShapeElement, Tab } from './index';

// The Behaviour faces export the way the canvas draws them
// (docs/specs/020-import-export/export-fidelity.md "The behaviour faces").

const shape = (kind: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  ...(createShape(kind as ShapeElement['shape'], 0, 0) as ShapeElement),
  id: `el-${kind}`,
  ...overrides,
});
const svgOf = (el: ShapeElement, background?: string) =>
  renderElementsToSvg({ id: 't', name: 'T', elements: [el] } as unknown as Tab, { background });

describe('Behaviour face export', () => {
  it('draws a timer Session button as the idle dial: ticks, the kicker and its length', () => {
    const svg = svgOf(shape('session-button', { session: { tool: 'timer', minutes: 10 } }));
    expect(svg).toContain('>TIMER<');
    expect(svg).toContain('>10:00<');
    // 24 ticks, the quarters taller.
    expect(svg.match(/<rect[^>]*height="7" fill="[^"]+" fill-opacity="0.3"\/>/g)).toHaveLength(4);
    expect(svg.match(/<rect[^>]*height="4" fill="[^"]+" fill-opacity="0.16"\/>/g)).toHaveLength(20);
  });

  it('names an unlabelled Mode button by its destination', () => {
    const svg = svgOf(shape('mode-button', { mode: 'laser', label: '' }));
    expect(svg).toContain('>SWITCH TO<');
    expect(svg).toContain('>Laser<');
  });

  it('draws a portal as its lit ring when paired, and dim when not', () => {
    expect(svgOf(shape('portal', { portalTarget: 'x' }))).toContain('stop-opacity="0.95"');
    expect(svgOf(shape('portal'))).toContain('stop-opacity="0.35"');
  });

  it('puts a Reaction pad label in its chip', () => {
    const svg = svgOf(shape('reaction-pad', { label: 'Applause' }));
    expect(svg).toMatch(/fill-opacity="0.07"\/><text[^>]*font-size="10.5"[^>]*>Applause</);
  });

  it('covers a Reveal with the gesture chip, on the wrapper radius', () => {
    const svg = svgOf(shape('reveal', { label: 'Answer' }));
    expect(svg).toContain('>Double-click to reveal<');
    expect(svg).toMatch(/rx="4" fill="#/);
  });

  it('prints a chair label under the seat', () => {
    expect(svgOf(shape('chair', { label: 'Scribe' }))).toContain('>Scribe<');
  });

  it('shades a Picker at both lips and offers Again once something landed', () => {
    const svg = svgOf(shape('picker', { label: 'Who?', pickerResult: 'Sam' }));
    expect(svg).toContain('linearGradient id="reel-el-picker"');
    expect(svg).toContain('>Sam<');
    expect(svg).toContain('>Again<');
  });

  it('writes a roll call with the stack, the chips and the Take again bar', () => {
    const at = Date.now();
    const svg = svgOf(
      shape('roll-call', {
        rollCall: [
          { name: 'Priya Kaur', color: '#db2777', at },
          { name: 'Sam Lee', color: '#16a34a', at },
        ],
      }),
    );
    for (const s of ['>2<', '>PRESENT<', '>Priya Kaur<', '>Sam Lee<', '>Take again<'])
      expect(svg).toContain(s);
  });

  it('starts a page label under the masthead, and turns back its corner', () => {
    const el = shape('page', { label: 'Body', pageTitle: 'Doc', pageSubtitle: 'Sub' });
    const svg = svgOf(el, '#0d121a');
    const bodyY = Number(/<text x="[\d.]+" y="([\d.]+)"[^>]*font-size="14"/.exec(svg)?.[1]);
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

  it('keeps an over-long word whole for an icon caption', () => {
    expect(wrapLabel('smartwatch', 50, (s) => s.length * 7)).toEqual(['smartwatch']);
  });
});
