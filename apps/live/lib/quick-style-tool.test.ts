import { describe, expect, it } from 'vitest';
import { defaultScheme } from '@livediagram/document';
import { toolCaption, toolPhantom } from './quick-style-tool';
import { whiteboardShapeIntent } from './whiteboard-tool';

// docs/specs/023-whiteboard/whiteboard.md "The quick style panel stays": with a shape, line, arrow or
// text tool in hand, the panel styles what that tool draws next.
const theme = defaultScheme('light');

describe('toolPhantom', () => {
  it('is the plain board shape a shape tool would draw', () => {
    const el = toolPhantom(whiteboardShapeIntent('rectangle'), theme)!;
    expect(el).toMatchObject({ type: 'shape', shape: 'square', fillColor: 'transparent' });
  });

  it('is an unpainted line or arrow for those tools', () => {
    const line = toolPhantom(whiteboardShapeIntent('line'), theme)!;
    expect(line).toMatchObject({ type: 'arrow', arrowEnds: 'none' });
    expect('strokeColor' in line).toBe(false);
  });

  it('is a text box for the text tool, and nothing for a note or a pen', () => {
    expect(toolPhantom({ type: 'text' }, theme)).toMatchObject({ type: 'text' });
    expect(toolPhantom({ type: 'sticky' }, theme)).toBeNull();
    expect(
      toolPhantom(
        { type: 'freehand', variant: 'whiteboard', colour: null, width: 1.5, recognise: false },
        theme,
      ),
    ).toBeNull();
  });
});

describe('toolCaption', () => {
  it('names what comes next', () => {
    expect(toolCaption(whiteboardShapeIntent('ellipse'))).toBe('Next ellipse');
    expect(toolCaption(whiteboardShapeIntent('arrow'))).toBe('Next arrow');
    expect(toolCaption({ type: 'text' })).toBe('Next text box');
  });
});

describe('the Path tool (docs/specs/023-whiteboard/path-tool.md "Style")', () => {
  it('styles the next path: an unpainted closed stand-in, so a fill can be chosen too', () => {
    const el = toolPhantom({ type: 'path' }, theme)!;
    expect(el).toMatchObject({ type: 'path', closed: true });
    expect('strokeColor' in el).toBe(false);
    expect('fillColor' in el).toBe(false);
    expect(toolCaption({ type: 'path' })).toBe('Next path');
  });
});

// docs/specs/008-canvas/quick-style-panel.md "With a tool in hand": on a diagram tab too.
describe('a tool in hand on a diagram tab', () => {
  const diagram = { theme: undefined, backgroundColor: undefined, patternColor: undefined };

  it('stands in a themed, filled shape', () => {
    const el = toolPhantom({ type: 'shape', kind: 'square' }, theme, diagram)!;
    expect(el).toMatchObject({ type: 'shape', shape: 'square' });
    expect((el as { fillColor?: string }).fillColor).not.toBe('transparent');
  });

  it('stands in a painted arrow', () => {
    const arrow = toolPhantom({ type: 'arrow', ends: 'to' }, theme, diagram)!;
    expect('strokeColor' in arrow).toBe(true);
  });

  it('names a shape as the palette does', () => {
    expect(toolCaption({ type: 'shape', kind: 'square' }, false)).toBe('Next square');
    expect(toolCaption({ type: 'shape', kind: 'square' })).toBe('Next rectangle');
  });
});
