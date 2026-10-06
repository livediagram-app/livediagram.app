import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Canvas motion keeps its own pace (docs/specs/004-interface-design/motion.md): it lives
// in canvas-motion.css, which the chrome motion budget does not read.
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('canvas-motion.css', () => {
  it('declares the element entry pop at the canvas pace', () => {
    expect(read('./canvas-motion.css')).toContain(
      '--animate-element-pop-in: pop-in 360ms cubic-bezier(0.34, 1.56, 0.64, 1);',
    );
  });

  it('is imported by the editor stylesheet', () => {
    expect(read('./globals.css')).toContain("@import './canvas-motion.css';");
  });
});

// Editor arrival (docs/specs/004-interface-design/motion.md): the chrome fades in, the board appears
// at once, since fading the canvas world re-lays out the page's compositing as it starts and ends.
describe('the editor fade-in rule', () => {
  const rule = () => {
    const css = read('./globals.css');
    const match = /\{\s*((?:\[data-[a-z-]+\],?\s*)+)\{\s*animation: fade-in/.exec(css);
    if (!match) throw new Error('the editor fade-in rule is missing from globals.css');
    return match[1]!.split(',').map((s) => s.trim());
  };

  it('fades the chrome in, never the board', () => {
    expect(rule()).toEqual([
      '[data-floating-panel]',
      '[data-editor-tabbar]',
      '[data-zoom-cluster]',
    ]);
  });
});
