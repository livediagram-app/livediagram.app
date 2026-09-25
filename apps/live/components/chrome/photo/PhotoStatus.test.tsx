// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PhotoStatus } from './PhotoStatus';

afterEach(cleanup);

const base = { detecting: false, foundNothing: false, revealed: 3, detected: 3, readError: null };

// The reading pill says where the in-browser reader runs and, on the
// processor, WHY (spec/139 Phase 9).
describe('the reading pill', () => {
  it.each([
    ['no-webgpu', /this browser has no WebGPU/i],
    ['no-adapter', /no graphics card is available/i],
    ['no-f16', /can.t run the model.s half-precision maths/i],
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
