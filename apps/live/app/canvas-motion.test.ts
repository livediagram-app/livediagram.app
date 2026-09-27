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
