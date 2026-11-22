// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  drawingZoneEditing,
  resetDrawingZoneEditing,
  setDrawingZoneEditing,
} from './drawing-zone-store';

// docs/specs/030-knowledgebase/page-surface.md "The formatting bar": a drawing's tools show while its zone is being
// edited, and reaching for them or using them does not put them away.
afterEach(() => {
  resetDrawingZoneEditing();
  document.body.innerHTML = '';
});

function strip(): { button: HTMLButtonElement; outside: HTMLElement } {
  document.body.innerHTML =
    '<div data-toolbar-palette><button id="tile">Square</button></div><main id="page" tabindex="-1"><div id="writing" contenteditable="true"></div></main>';
  return {
    button: document.querySelector<HTMLButtonElement>('#tile')!,
    outside: document.querySelector<HTMLElement>('#page')!,
  };
}
const fire = (el: HTMLElement, type: string) =>
  el.dispatchEvent(new Event(type, { bubbles: true }));

describe('the drawing zone being edited', () => {
  it('starts when the writing says so', () => {
    expect(drawingZoneEditing()).toBe(false);
    setDrawingZoneEditing(true);
    expect(drawingZoneEditing()).toBe(true);
  });

  it('outlasts the zone bar letting go (the pointer on its way to the tools) and presses on the tools', () => {
    const { button } = strip();
    setDrawingZoneEditing(true);
    setDrawingZoneEditing(false);
    expect(drawingZoneEditing()).toBe(true);
    fire(button, 'pointerdown');
    fire(button, 'keydown');
    expect(drawingZoneEditing()).toBe(true);
  });

  it('ends on the next press outside the tools', () => {
    const { outside } = strip();
    setDrawingZoneEditing(true);
    setDrawingZoneEditing(false);
    fire(outside, 'pointerdown');
    expect(drawingZoneEditing()).toBe(false);
  });

  it('ends on a key typed into the writing, not on a key pressed on the page (a drawing’s own)', () => {
    const { outside } = strip();
    setDrawingZoneEditing(true);
    setDrawingZoneEditing(false);
    fire(outside, 'keydown');
    expect(drawingZoneEditing()).toBe(true);
    fire(document.querySelector<HTMLElement>('#writing')!, 'keydown');
    expect(drawingZoneEditing()).toBe(false);
  });

  it('ends at once when the zone bar lets go in answer to a press elsewhere', () => {
    const { outside } = strip();
    setDrawingZoneEditing(true);
    fire(outside, 'pointerdown');
    setDrawingZoneEditing(false);
    expect(drawingZoneEditing()).toBe(false);
  });

  it('does not end on a press elsewhere while the writing still says a drawing is edited', () => {
    const { outside } = strip();
    setDrawingZoneEditing(true);
    fire(outside, 'pointerdown');
    expect(drawingZoneEditing()).toBe(true);
  });

  it('is simply edited again when the zone takes the pointer back', () => {
    const { outside } = strip();
    setDrawingZoneEditing(true);
    setDrawingZoneEditing(false);
    setDrawingZoneEditing(true);
    fire(outside, 'pointerdown');
    expect(drawingZoneEditing()).toBe(true);
  });
});
