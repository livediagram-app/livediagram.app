import { describe, expect, it } from 'vitest';
import { EDITOR_MODE_CATALOGUE, EDITOR_MODES, isEditorMode, parseEditorMode } from './editor-mode';

// The editor mode (docs/specs/026-plan/plan-mode.md): every tab is worked on in Plan.
describe('the editor mode', () => {
  it('is Plan alone', () => {
    expect(EDITOR_MODES).toEqual(['plan']);
    expect(EDITOR_MODE_CATALOGUE.map((m) => m.label)).toEqual(['Plan']);
  });

  it('recognises Plan and nothing else', () => {
    expect(isEditorMode('plan')).toBe(true);
    expect(isEditorMode('diagram')).toBe(false);
    expect(isEditorMode('Plan')).toBe(false);
    expect(isEditorMode('')).toBe(false);
    expect(isEditorMode(undefined)).toBe(false);
    expect(isEditorMode(null)).toBe(false);
    expect(isEditorMode(1)).toBe(false);
  });
});

describe('parseEditorMode', () => {
  it('reads every retired mode, under each name it was stored by, as Plan', () => {
    for (const id of [
      'plan',
      'diagram',
      'draw',
      'workshop',
      'pages',
      'illustrate',
      'infographic',
      'facilitate',
    ])
      expect(parseEditorMode(id), id).toBe('plan');
  });

  it('reads anything else as unknown', () => {
    expect(parseEditorMode('sketch')).toBeUndefined();
    expect(parseEditorMode('whiteboard')).toBeUndefined();
    expect(parseEditorMode('Diagram')).toBeUndefined();
    expect(parseEditorMode(undefined)).toBeUndefined();
    expect(parseEditorMode(3)).toBeUndefined();
  });
});
