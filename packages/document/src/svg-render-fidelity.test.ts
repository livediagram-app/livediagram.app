import { describe, expect, it } from 'vitest';
import { renderElementsToSvg } from './svg-render';
import { createShape, createText } from './factories';
import { wrapLabel } from './svg-render-primitives';
import { SELECTION_MODES } from './selection-mode';
import { MODE_GLYPHS } from '@liveplanner/icons/mode-glyphs';
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
  it('draws a timer Session button as the idle dial: ticks, the kicker and its length', () => {
    const svg = svgOf(shape('session-button', { session: { tool: 'timer', minutes: 10 } }));
    expect(svg).toContain('>TIMER<');
    expect(svg).toContain('>10:00<');
    // 24 ticks, the quarters taller.
    expect(svg.match(/<rect[^<>]*height="7" fill="[^"]+" fill-opacity="0.3"\/>/g)).toHaveLength(4);
    expect(svg.match(/<rect[^<>]*height="4" fill="[^"]+" fill-opacity="0.16"\/>/g)).toHaveLength(
      20,
    );
  });

  it('draws a vote, poll or stopwatch Session button as its tool and what pressing it does', () => {
    const vote = svgOf(shape('session-button', { session: { tool: 'vote', dots: 3 }, label: '' }));
    expect(vote).toContain('>START VOTE<');
    expect(vote).toContain('>3 dots each<');
    expect(vote.match(/<circle[^<>]*r="3"/g)).toHaveLength(3);
    const poll = svgOf(
      shape('session-button', {
        session: { tool: 'poll', question: 'Ship it?', options: ['Yes', 'No'] },
        label: '',
      }),
    );
    expect(poll).toContain('>Ship it?<');
    // The kicker names the shape of its answers.
    expect(poll).toContain('>ASK · 2 OPTIONS<');
    const yesNo = svgOf(
      shape('session-button', {
        session: { tool: 'poll', style: 'yesNo', question: 'Ship it?' },
        label: '',
      }),
    );
    expect(yesNo).toContain('>ASK · YES / NO<');
    expect(poll).toContain('rx="1"');
    const watch = svgOf(shape('session-button', { session: { tool: 'stopwatch' }, label: 'Lap' }));
    expect(watch).toContain('>Lap<');
    expect(watch).toContain('r="10"');
  });

  it('names an unlabelled Mode button by its destination', () => {
    const svg = svgOf(shape('mode-button', { mode: 'laser', label: '' }));
    expect(svg).toContain('>SWITCH TO<');
    expect(svg).toContain('>Laser<');
  });

  it('names a Mode button whose stored mode this build does not know by the default mode', () => {
    const svg = svgOf(shape('mode-button', { mode: 'eraser' as never, label: '' }));
    expect(svg).toContain('>Avatar<');
  });

  it('draws a portal as its lit ring when paired, and dim when not', () => {
    expect(svgOf(shape('portal', { portalTarget: 'x' }))).toContain('stop-opacity="0.95"');
    expect(svgOf(shape('portal'))).toContain('stop-opacity="0.35"');
  });

  it("draws a Reaction pad's emoji from its art when the caller has it, else as text", () => {
    const pad = shape('reaction-pad', { reaction: 'applause', label: 'Applause' });
    expect(svgOf(pad)).toMatch(/dominant-baseline="central"[^>]*>👏</);
    const art = { viewBox: '0 0 36 36', markup: '<path d="M1 1"/>' };
    const drawn = renderElementsToSvg(
      { id: 't', name: 'T', elements: [pad] },
      {
        resolveEmojiArt: (g) => (g === '👏' ? art : undefined),
      },
    );
    expect(drawn).toContain('viewBox="0 0 36 36"><path d="M1 1"/></svg>');
    expect(drawn).not.toContain('>👏<');
  });

  it('draws a Reaction pad whose stored reaction this build does not know as the default one', () => {
    const pad = shape('reaction-pad', { reaction: 'stardust' as never, label: 'Pad' });
    expect(svgOf(pad)).toMatch(/>🎉</);
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

  it('writes a roll call with the stack, the chips and the Take Again bar', () => {
    const at = Date.now();
    const svg = svgOf(
      shape('roll-call', {
        rollCall: [
          { name: 'Priya Kaur', color: '#db2777', at },
          { name: 'Sam Lee', color: '#16a34a', at },
        ],
      }),
    );
    for (const s of ['>2<', '>PRESENT<', '>Priya Kaur<', '>Sam Lee<', '>Take Again<'])
      expect(svg).toContain(s);
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

  it('keeps an over-long word whole for an icon caption', () => {
    expect(wrapLabel('smartwatch', 50, (s) => s.length * 7)).toEqual(['smartwatch']);
  });
});

describe('Mode button glyph (docs/specs/020-import-export/export-fidelity.md)', () => {
  it('draws the mode’s own glyph from the shared data, not a placeholder ring', () => {
    for (const mode of SELECTION_MODES) expect(MODE_GLYPHS[mode], mode).toBeDefined();
    const el = { ...createShape('mode-button', 0, 0), mode: 'isometric' as const };
    const svg = renderElementsToSvg({ id: 't', name: 'T', elements: [el] });
    const cube = MODE_GLYPHS.isometric!.prims[0] as { d: string };
    expect(svg).toContain(cube.d);
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
