// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { overFloatingPanel, pastePointer } from './canvas-pointer';

// Where a paste lands on an event-storming board depends on whether the pointer
// is over the CANVAS (docs/specs/021-event-storming/event-storming.md "Always on a lane"). A floating panel sits
// on top of the canvas and still lets its pointer moves through, so it has to
// count as "elsewhere" by hand.
describe('pastePointer', () => {
  it('is the canvas point over the bare canvas', () => {
    const surface = document.createElement('div');
    expect(pastePointer(10, 20, surface)).toEqual({ x: 10, y: 20 });
  });

  it('is nothing over a floating panel', () => {
    const panel = document.createElement('div');
    panel.setAttribute('data-floating-panel', '');
    const row = document.createElement('button');
    panel.appendChild(row);
    expect(pastePointer(10, 20, row)).toBeNull();
  });

  it('is nothing once the pointer has left the canvas', () => {
    expect(pastePointer(null, null, null)).toBeNull();
  });
});

// A drop over a floating panel is the panel's ("changed my mind"), except over the category bar's flyout while one of
// its tiles is being dragged out (docs/specs/007-editor/toolbar-layout.md "The category bar"): that drop lands on the
// canvas it covers.
describe('overFloatingPanel', () => {
  it('counts a target inside a floating panel, not the bare canvas', () => {
    const panel = document.createElement('div');
    panel.setAttribute('data-floating-panel', '');
    const tile = document.createElement('button');
    panel.append(tile);
    expect(overFloatingPanel(tile)).toBe(true);
    expect(overFloatingPanel(document.createElement('div'))).toBe(false);
    expect(overFloatingPanel(null)).toBe(false);
  });

  it('lets a drop through a panel marked drop-through', () => {
    const panel = document.createElement('div');
    panel.setAttribute('data-floating-panel', '');
    panel.setAttribute('data-drop-through', '');
    const tile = document.createElement('button');
    panel.append(tile);
    expect(overFloatingPanel(tile)).toBe(false);
  });
});
