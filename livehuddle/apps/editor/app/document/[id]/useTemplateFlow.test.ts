import { describe, expect, it } from 'vitest';
import { templateCanvasOverrides } from '@livehuddle/templates';
import { templateOpensIn } from './useTemplateFlow';

// docs/specs/007-editor/editor-modes.md: Workshop is the one mode, so every template opens in it.
describe('templateOpensIn', () => {
  it('opens every template in Workshop, the blanks and an event-storming board included', () => {
    for (const kind of ['blank', 'whiteboard', 'retrospective', 'event-storming'] as const) {
      expect(templateOpensIn(templateCanvasOverrides(kind))).toBe('workshop');
    }
  });
});
