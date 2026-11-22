import { describe, expect, it } from 'vitest';
import { knowledgeLightGroundCss } from './useEditorAccent';

describe('the light ground under a Knowledgebase Style', () => {
  it('washes white and the palest slates with the accent, in the light appearance only', () => {
    const css = knowledgeLightGroundCss('#2563eb');
    expect(css.startsWith('html:root:not(.dark){')).toBe(true);
    const ground = /--color-white:(#[0-9a-f]{6})/.exec(css)![1]!;
    expect(ground).not.toBe('#ffffff');
    // Pale: every channel stays above 230, so text keeps its contrast.
    for (const i of [1, 3, 5]) expect(parseInt(ground.slice(i, i + 2), 16)).toBeGreaterThan(230);
    expect(css).toContain('[data-canvas-root]{background-color:var(--color-white) !important;}');
    expect(css).not.toContain('--color-slate-500');
  });
});
