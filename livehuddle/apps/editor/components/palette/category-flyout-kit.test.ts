// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FLYOUT_KIT, sideFloor } from './category-flyout-kit';

// This editor's side panel rules for the shared category flyout (docs/specs/007-editor/toolbar-layout.md "The category
// bar"); the panel itself, and how it uses them, is workbench's, tested there.

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('sideFloor', () => {
  it('is the canvas region bottom, 8px clear, else the window bottom', () => {
    vi.stubGlobal('innerHeight', 900);
    const panel = document.createElement('div');
    document.body.append(panel);
    expect(sideFloor(panel)).toBe(892);
    const region = document.createElement('div');
    region.setAttribute('data-canvas-root', '');
    document.body.append(region);
    vi.spyOn(region, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 76, 304, 770));
    expect(sideFloor(panel)).toBe(838);
  });
});

describe('the flyout kit', () => {
  it('keeps the side panel clear of the tab bar, over the whole flyout on a phone, and hidden while dragging', () => {
    expect(FLYOUT_KIT.sideFloor).toBe(sideFloor);
    expect(FLYOUT_KIT.sideCoversFlyoutOnPhone).toBe(true);
    expect(FLYOUT_KIT.sideHidesOnDrag).toBe(true);
  });
});
