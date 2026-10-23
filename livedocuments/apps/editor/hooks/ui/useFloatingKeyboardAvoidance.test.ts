// @vitest-environment jsdom
// docs/specs/004-interface-design/tooltips-hover-cards-popovers.md "On-screen keyboard": a floating surface whose
// field has focus moves into the part of the page the keyboard leaves in view, and back when the field lets go.
import { afterEach, describe, expect, it } from 'vitest';
import { checkFloatingField, liftFor, releaseAll } from './useFloatingKeyboardAvoidance';

const M = 8;

describe('liftFor', () => {
  const visible = { top: 0, bottom: 400 };

  it('leaves a surface already in view alone', () => {
    expect(liftFor({ top: 100, bottom: 300 }, { top: 200, bottom: 230 }, visible, M)).toBe(0);
  });

  it('lifts a surface that fits the visible band just clear of its bottom', () => {
    expect(liftFor({ top: 300, bottom: 600 }, { top: 550, bottom: 580 }, visible, M)).toBe(208);
  });

  it('brings one above the band down into it', () => {
    expect(liftFor({ top: -50, bottom: 100 }, { top: 0, bottom: 30 }, visible, M)).toBe(-58);
  });

  it('shows the field of a surface taller than the band, never lifting it past its top', () => {
    // 700 px tall in a 384 px band: the field comes clear of the bottom.
    expect(liftFor({ top: 100, bottom: 800 }, { top: 700, bottom: 730 }, visible, M)).toBe(338);
    // A field just under the band but near the top of its surface moves no further than its own top allows.
    expect(liftFor({ top: 100, bottom: 800 }, { top: 390, bottom: 420 }, visible, M)).toBe(28);
  });
});

describe('checkFloatingField', () => {
  const rect = (top: number, height: number) => () =>
    ({ top, bottom: top + height, left: 0, right: 300, width: 300, height }) as DOMRect;
  let restoreViewport = () => {};

  function viewport(height: number) {
    const was = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: { offsetTop: 0, height, addEventListener() {}, removeEventListener() {} },
    });
    restoreViewport = () => {
      if (was) Object.defineProperty(window, 'visualViewport', was);
      else delete (window as { visualViewport?: unknown }).visualViewport;
    };
  }

  afterEach(() => {
    releaseAll();
    restoreViewport();
    document.body.innerHTML = '';
  });

  function popover(top: number) {
    const panel = document.createElement('div');
    panel.setAttribute('data-anchored-popover', '');
    panel.style.transform = 'scale(1)';
    const input = document.createElement('input');
    panel.append(input);
    document.body.append(panel);
    // Where they sit unmoved; the lift is a transform, which a real layout would add back in.
    panel.getBoundingClientRect = () => {
      const dy = Number(/translateY\((-?[\d.]+)px\)/.exec(panel.style.transform)?.[1] ?? 0);
      return rect(top + dy, 200)();
    };
    input.getBoundingClientRect = () => {
      const dy = Number(/translateY\((-?[\d.]+)px\)/.exec(panel.style.transform)?.[1] ?? 0);
      return rect(top + 150 + dy, 30)();
    };
    return { panel, input };
  }

  it('lifts the popover of a focused field above the keyboard, keeping its own transform', () => {
    viewport(400);
    const { panel, input } = popover(500);
    input.focus();
    checkFloatingField();
    expect(panel.style.transform).toBe('translateY(-308px) scale(1)');
    // Checked again (the keyboard settling), it stays where it is.
    checkFloatingField();
    expect(panel.style.transform).toBe('translateY(-308px) scale(1)');
  });

  it('puts it back when the field lets go, or the keyboard goes', () => {
    viewport(400);
    const { panel, input } = popover(500);
    input.focus();
    checkFloatingField();
    input.blur();
    checkFloatingField();
    expect(panel.style.transform).toBe('scale(1)');
    input.focus();
    checkFloatingField();
    viewport(900);
    checkFloatingField();
    expect(panel.style.transform).toBe('scale(1)');
  });

  // A popover capped at the little room its placement had grows to the visible band while its field has focus, so it
  // moves up whole rather than scrolling a clipped line under its top edge, and gets its own cap back after.
  it('grows a capped popover to its content within the visible band, and restores its cap', () => {
    viewport(400);
    const { panel, input } = popover(500);
    panel.style.maxHeight = '120px';
    Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: 300 });
    Object.defineProperty(panel, 'clientHeight', { configurable: true, value: 120 });
    Object.defineProperty(panel, 'offsetHeight', { configurable: true, value: 122 });
    input.focus();
    checkFloatingField();
    expect(panel.style.maxHeight).toBe('302px');
    input.blur();
    checkFloatingField();
    expect(panel.style.maxHeight).toBe('120px');
    // Never past the band itself.
    viewport(200);
    input.focus();
    checkFloatingField();
    expect(panel.style.maxHeight).toBe(`${200 - 2 * M}px`);
  });

  // A phone's column sheet focused its name field while it slid up: measured mid-slide it was lifted by the distance
  // still to travel, and came to rest above the screen.
  it('waits for a surface still arriving, then measures it where it rests', async () => {
    viewport(800);
    const { panel, input } = popover(500);
    let rising = true;
    let settle = () => {};
    const finished = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const resting = panel.getBoundingClientRect;
    // Mid-slide it sits low, past the visible band.
    panel.getBoundingClientRect = () => (rising ? rect(900, 200)() : resting());
    panel.getAnimations = () =>
      rising
        ? [
            {
              playState: 'running',
              effect: { getTiming: () => ({ iterations: 1 }) },
              finished,
            } as unknown as Animation,
          ]
        : [];
    input.focus();
    checkFloatingField();
    expect(panel.style.transform).toBe('scale(1)');
    rising = false;
    settle();
    await new Promise((r) => setTimeout(r, 50));
    // At rest it is in view: nothing to lift.
    expect(panel.style.transform).toBe('scale(1)');
  });

  it('leaves a sheet docked flush at the foot of the screen while no keyboard is up', () => {
    viewport(window.innerHeight);
    const { panel, input } = popover(window.innerHeight - 200);
    input.focus();
    checkFloatingField();
    expect(panel.style.transform).toBe('scale(1)');
  });

  it('does not wait on a looping animation', () => {
    viewport(400);
    const { panel, input } = popover(500);
    panel.getAnimations = () => [
      {
        playState: 'running',
        effect: { getTiming: () => ({ iterations: Infinity }) },
        finished: new Promise(() => {}),
      } as unknown as Animation,
    ];
    input.focus();
    checkFloatingField();
    expect(panel.style.transform).toBe('translateY(-308px) scale(1)');
  });

  it('leaves a field outside any floating surface, and a button, alone', () => {
    viewport(400);
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    checkFloatingField();
    expect(input.style.transform).toBe('');
    const { panel } = popover(500);
    const button = document.createElement('button');
    panel.append(button);
    button.focus();
    checkFloatingField();
    expect(panel.style.transform).toBe('scale(1)');
  });
});
