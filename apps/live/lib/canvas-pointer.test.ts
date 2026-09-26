// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { pastePointer } from './canvas-pointer';

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
