import { describe, expect, it } from 'vitest';
import { modeDefaultTool } from './useModeDefaultTool';

// docs/specs/007-editor/editor-modes.md "The tool a mode starts with".
describe('modeDefaultTool', () => {
  it('starts Plan on Hand and every other mode on Select', () => {
    expect(modeDefaultTool('plan', false)).toBe('pan');
    expect(modeDefaultTool('diagram', false)).toBe('select');
    expect(modeDefaultTool('draw', false)).toBe('select');
    expect(modeDefaultTool('illustrate', false)).toBe('select');
  });

  it('starts every mode on Hand on a phone', () => {
    expect(modeDefaultTool('diagram', true)).toBe('pan');
    expect(modeDefaultTool('plan', true)).toBe('pan');
  });
});
