import { describe, expect, it } from 'vitest';
import { startPanelColours } from './start-palette';

// docs/specs/007-editor/start-diagramming.md "Look"
describe('startPanelColours', () => {
  const theme = {
    backgroundColor: '#fdf2f8',
    elementStroke: '#db2777',
    elementText: '#831843',
  };

  it("wears the tab's canvas, the theme's stroke as its accent and the theme's text as its ink", () => {
    expect(startPanelColours({}, theme)).toEqual({
      fill: '#fdf2f8',
      stroke: '#db2777',
      text: '#831843',
    });
  });

  it("prefers the tab's own canvas colour over the theme's", () => {
    expect(startPanelColours({ backgroundColor: '#ecfeff' }, theme).fill).toBe('#ecfeff');
  });

  it("reads a multi-colour theme's trunk colour as its accent", () => {
    const rainbow = {
      backgroundColor: '#ffffff',
      elementStroke: null,
      elementText: null,
      rootColor: { fill: '#fff', stroke: '#7c3aed', text: '#2e1065' },
    };
    expect(startPanelColours({}, rainbow)).toMatchObject({ stroke: '#7c3aed', text: '#2e1065' });
  });

  it('leaves an unthemed tab the app’s own look', () => {
    expect(
      startPanelColours({}, { backgroundColor: '#fff', elementStroke: null, elementText: null }),
    ).toEqual({});
  });
});
