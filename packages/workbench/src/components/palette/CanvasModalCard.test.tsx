// @vitest-environment jsdom
// The name card every editor opens from Change Name (Work Tracker 1522): with the welcome gate gone the canvas's
// floating chrome stays up while it is open, so the card covers every canvas layer (each editor's corner clusters sit
// on `panel`, `toolbar` or `chrome`, beside it in CanvasChrome) and carries the mark that page-drawn chrome
// (liveknowledge's Edit and Zen pair) hides by.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CanvasModalCard } from './CanvasModalCard';

const themeCss = readFileSync(join(__dirname, '../../../../tailwind-config/theme.css'), 'utf8');
const rung = (name: string): number => {
  const m = themeCss.match(new RegExp(`--z-${name}:\\s*(\\d+);`));
  if (!m) throw new Error(`no --z-${name}`);
  return Number(m[1]);
};

describe('CanvasModalCard', () => {
  it('carries the canvas card mark, on the canvas-modal rung', () => {
    const { container } = render(
      <CanvasModalCard label="Confirm your name" width="sm:w-[26rem]">
        card
      </CanvasModalCard>,
    );
    const layer = container.querySelector('[data-canvas-modal-card]')!;
    expect(layer).not.toBeNull();
    expect(layer.className).toContain('z-[var(--z-canvas-modal)]');
  });

  it('sits above every rung floating canvas chrome uses', () => {
    for (const below of ['panel', 'toolbar', 'chrome', 'overlay'])
      expect(rung('canvas-modal')).toBeGreaterThan(rung(below));
  });
});
