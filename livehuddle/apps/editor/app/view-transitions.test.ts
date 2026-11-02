import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// docs/specs/004-interface-design/motion.md "View Transitions" and its blueprint: the document root takes no part,
// each surface's classes live in its own stylesheet, and nothing starts a View Transition but React.

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const globals = readFileSync(here('./globals.css'), 'utf8');
const canvasMotion = readFileSync(here('./canvas-motion.css'), 'utf8');

const classesIn = (css: string) =>
  new Set(
    [...css.matchAll(/::view-transition-(?:old|new|group)\(\.([a-z-]+)\)/g)].map((m) => m[1]),
  );

describe('View Transitions', () => {
  it('leave the document root out, so only a named surface is captured', () => {
    expect(globals).toMatch(/html\s*\{\s*view-transition-name:\s*none;\s*\}/);
  });

  it('keep the start mode switch with chrome and the slide moves with the canvas', () => {
    expect([...classesIn(globals)]).toEqual(['start-mode']);
    expect([...classesIn(canvasMotion)].sort()).toEqual([
      'slide-back',
      'slide-fade',
      'slide-forward',
      'slide-in',
    ]);
  });

  it('are started only through React, never document.startViewTransition', () => {
    // With the editor code every editor shares (@liveworkspace/workbench).
    const roots = [
      '../app',
      '../components',
      '../hooks',
      '../lib',
      '../../../../packages/workbench/src',
      '../../../../packages/avatar/src',
    ].map(here);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = `${dir}/${name}`;
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
          if (/\bstartViewTransition\s*\(/.test(readFileSync(path, 'utf8'))) offenders.push(path);
        }
      }
    };
    roots.forEach(walk);
    expect(offenders).toEqual([]);
  });
});
