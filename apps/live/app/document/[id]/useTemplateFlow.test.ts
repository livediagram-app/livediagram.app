import { describe, expect, it } from 'vitest';
import { templateCanvasOverrides } from '@liveplanner/templates';
import { templateOpensIn } from './useTemplateFlow';

// docs/specs/007-editor/editor-modes.md "Where the mode lives": a template decides the mode.
describe('templateOpensIn', () => {
  it('opens every template but the Whiteboard in Diagram, Blank included', () => {
    expect(templateOpensIn(templateCanvasOverrides('mindmap'))).toBe('diagram');
    expect(templateOpensIn(templateCanvasOverrides('blank'))).toBe('diagram');
  });

  it('opens the Whiteboard in Draw', () => {
    expect(templateOpensIn(templateCanvasOverrides('whiteboard'))).toBe('draw');
  });

  it('gives an event-storming board no mode (it is always Diagram)', () => {
    expect(templateOpensIn(templateCanvasOverrides('event-storming'))).toBeUndefined();
  });
});
