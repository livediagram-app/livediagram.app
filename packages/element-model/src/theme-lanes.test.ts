import { describe, expect, it } from 'vitest';
import {
  recolourElementsForTheme,
  resetThemeElementsToTheme,
  switchThemeElements,
} from './theme-graph';
import { getBuiltInTheme } from './themes';
import type { Element, ShapeElement } from './element';
import { createShape } from './testing/flowchart';

// docs/specs/009-elements/lane.md "A lane in the tab's theme": a lane's heading strip follows its border, so a
// theme that writes the border takes the strip too. It used to keep the hue it was built with.
describe('a lane under a theme', () => {
  const forest = getBuiltInTheme('forest');
  const sunset = getBuiltInTheme('sunset');
  const rainbow = getBuiltInTheme('rainbow');
  const plain = getBuiltInTheme(undefined);

  // A lane as the Swimlane template builds one: its own body, border, title and heading hues.
  const templateLane = (): ShapeElement => ({
    ...createShape('lane', 0, 0),
    id: 'lane',
    fillColor: '#faf5ff',
    strokeColor: '#d8b4fe',
    textColor: '#6b21a8',
    headerFill: '#f3e8ff',
  });
  const laneOf = (els: Element[]) => els.find((e) => e.id === 'lane') as ShapeElement;

  it('painted with a theme, takes its colours and drops the heading it was built with', () => {
    const lane = laneOf(recolourElementsForTheme<Element>([templateLane()], forest));
    expect(lane).toMatchObject({
      fillColor: forest.elementFill,
      strokeColor: forest.elementStroke,
      textColor: forest.elementText,
    });
    expect(lane.headerFill).toBeUndefined();
  });

  it('painted with a multi-colour theme, drops the heading too', () => {
    const lane = laneOf(recolourElementsForTheme<Element>([templateLane()], rainbow));
    expect(lane.strokeColor).not.toBe('#d8b4fe');
    expect(lane.headerFill).toBeUndefined();
  });

  it('keeps its heading under a theme that paints no element colours', () => {
    expect(plain.elementStroke).toBeNull();
    const lane = laneOf(recolourElementsForTheme<Element>([templateLane()], plain));
    expect(lane.headerFill).toBe('#f3e8ff');
  });

  it('on a theme pick, a lane whose border follows the theme drops a stale heading', () => {
    // As saved before the fix: body, border and title in the old theme, the heading still the template's.
    const stale: ShapeElement = {
      ...templateLane(),
      fillColor: forest.elementFill!,
      strokeColor: forest.elementStroke!,
      textColor: forest.elementText!,
    };
    const lane = laneOf(switchThemeElements<Element>([stale], forest, sunset));
    expect(lane.strokeColor).toBe(sunset.elementStroke);
    expect(lane.headerFill).toBeUndefined();
  });

  it('on a theme pick, a lane whose border is its own keeps its heading', () => {
    const lane = laneOf(switchThemeElements<Element>([templateLane()], forest, sunset));
    expect(lane.strokeColor).toBe('#d8b4fe');
    expect(lane.headerFill).toBe('#f3e8ff');
  });

  it('Reset Elements to Theme clears the heading', () => {
    const lane = laneOf(resetThemeElementsToTheme<Element>([templateLane()], sunset));
    expect(lane.strokeColor).toBe(sunset.elementStroke);
    expect(lane.headerFill).toBeUndefined();
  });

  it('leaves the header fill of a shape that is not a lane alone', () => {
    const card = { ...createShape('square', 0, 0), id: 'lane', headerFill: '#f3e8ff' };
    expect(laneOf(recolourElementsForTheme<Element>([card], forest)).headerFill).toBe('#f3e8ff');
  });
});
