// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PhotoStatus } from './PhotoStatus';

afterEach(cleanup);

const base = { detecting: false, foundNothing: false, revealed: 3, detected: 3, readError: null };

// The reading pill says where the in-browser reader runs and, on the
// processor, WHY (docs/specs/021-event-storming/event-storming.md Phase 9).
describe('the reading pill', () => {
  it.each([
    ['no-webgpu', /this browser has no WebGPU/i],
    ['no-adapter', /no graphics card is available/i],
    ['gpu-failed', /graphics card failed to start the model/i],
  ] as const)('explains the processor when %s', (why, words) => {
    render(<PhotoStatus {...base} reading readerBackend="wasm" readerWhy={why} />);
    const pill = screen.getByTestId('photo-reading');
    expect(pill.textContent).toMatch(/on the processor, which is slower/i);
    expect(pill.textContent).toMatch(words);
  });

  it('names the graphics card without a reason', () => {
    render(<PhotoStatus {...base} reading readerBackend="webgpu" />);
    expect(screen.getByTestId('photo-reading').textContent).toMatch(/on your graphics card/i);
  });
});

// When the hosted budget is spent, the review says the device reads instead,
// and does not say whose budget it was.
describe('the budget note', () => {
  it('shows when the reader failed over', () => {
    render(<PhotoStatus {...base} reading={false} readerFallback="budget" />);
    expect(screen.getByTestId('photo-reader-fallback').textContent).toMatch(
      /free monthly budget reached\. reading on this device instead/i,
    );
  });

  it('stays away otherwise', () => {
    render(<PhotoStatus {...base} reading={false} />);
    expect(screen.queryByTestId('photo-reader-fallback')).toBeNull();
  });
});

// A spinning spinner keeps the browser's compositor drawing every frame, and
// on the graphics card that starved the reader: 42 notes took 200 s with it,
// 25 s without (docs/specs/021-event-storming/event-storming.md Phase 9). On the card the pills stay still; the count
// ticking up is the sign of life.
describe('the reading pills while the graphics card reads', () => {
  it('does not spin on the graphics card', () => {
    render(<PhotoStatus {...base} reading readerBackend="webgpu" rereading={2} />);
    expect(screen.getByTestId('photo-reading').querySelector('.animate-spin')).toBeNull();
    expect(screen.getByTestId('photo-rereading').querySelector('.animate-spin')).toBeNull();
  });

  it('still spins on the processor, where it costs the reader nothing', () => {
    render(<PhotoStatus {...base} reading readerBackend="wasm" rereading={2} />);
    expect(screen.getByTestId('photo-reading').querySelector('.animate-spin')).not.toBeNull();
    expect(screen.getByTestId('photo-rereading').querySelector('.animate-spin')).not.toBeNull();
  });
});
