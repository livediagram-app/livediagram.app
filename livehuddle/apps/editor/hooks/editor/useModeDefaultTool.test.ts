import { describe, expect, it } from 'vitest';
import { modeDefaultTool } from './useModeDefaultTool';

// docs/specs/007-editor/editor-modes.md "The tool a mode starts with".
describe('modeDefaultTool', () => {
  it('starts on Select, and on Hand on a phone', () => {
    expect(modeDefaultTool(false)).toBe('select');
    expect(modeDefaultTool(true)).toBe('pan');
  });
});
