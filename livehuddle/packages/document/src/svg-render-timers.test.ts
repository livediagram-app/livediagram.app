import { describe, expect, it } from 'vitest';
import { createShape, type ShapeElement } from './index';
import { timerPieceSvg } from './svg-render-timers';

// docs/specs/009-elements/timer-and-stopwatch.md "Export": the body and the time the face shows at the moment of the
// export, with its state word; no buttons.

const at = (shape: 'timer' | 'stopwatch', over: Partial<ShapeElement> = {}) =>
  ({ ...createShape(shape, 10, 20), ...over }) as ShapeElement & { type: 'shape' };

describe('timerPieceSvg', () => {
  it("draws an idle Timer's length and a running one's time left then", () => {
    expect(timerPieceSvg(at('timer'), 0)).toContain('>5:00<');
    expect(timerPieceSvg(at('timer'), 0)).toContain('>Ready<');
    const running = at('timer', {
      pieceTimer: { running: true, startedAt: 1_000, accumulatedMs: 0, durationMs: 600_000 },
    });
    const svg = timerPieceSvg(running, 61_000);
    expect(svg).toContain('>9:00<');
    expect(svg).toContain('>Running<');
    expect(svg).toContain('translate(10 20)');
    expect(svg).not.toContain('button');
  });

  it('draws an hour or more in the smaller digits', () => {
    const long = at('timer', {
      pieceTimer: { running: false, startedAt: 0, accumulatedMs: 0, durationMs: 7_200_000 },
    });
    expect(timerPieceSvg(long, 0)).toContain('>2:00:00<');
  });

  it("draws a Timer that ran out red, reading Time's Up", () => {
    const done = at('timer', {
      pieceTimer: { running: true, startedAt: 0, accumulatedMs: 0, durationMs: 60_000 },
    });
    const svg = timerPieceSvg(done, 90_000);
    expect(svg).toContain('>0:00<');
    expect(svg).toContain('Time&#39;s Up');
    expect(svg).toContain('#fecaca');
  });

  it("draws a paused Stopwatch's time taken", () => {
    const sw = at('stopwatch', {
      pieceTimer: { running: false, startedAt: 0, accumulatedMs: 3_725_000, durationMs: 0 },
    });
    const svg = timerPieceSvg(sw, 0);
    expect(svg).toContain('>1:02:05<');
    expect(svg).toContain('>Paused<');
    expect(svg).toContain('<circle');
  });
});
