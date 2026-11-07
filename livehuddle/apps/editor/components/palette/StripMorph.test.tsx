// @vitest-environment jsdom
// The Edit | Walk morph's React half (docs/specs/007-editor/toolbar-layout.md "Switching morphs the strip"): only a
// flip of `walking` captures the outgoing strip, and the morph plays onto the incoming one.
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StripSnapshot } from './strip-morph-dom';
import { StripMorph } from './StripMorph';

const dom = vi.hoisted(() => ({
  captureStrip: vi.fn(),
  playStripMorph: vi.fn(),
  // What the outgoing strip looked like when the DOM was read: its text, so a test can tell before from after.
  seen: [] as string[],
}));
vi.mock('./strip-morph-dom', () => ({
  captureStrip: dom.captureStrip,
  playStripMorph: dom.playStripMorph,
}));

const SNAPSHOT = { box: { left: 0, top: 0, width: 10, height: 10 }, radius: 4 } as StripSnapshot;

const parent = document.createElement('div');
const wrapper = document.createElement('div');
parent.append(wrapper);
const wrapperRef = { current: wrapper };

function Host({ walking }: { walking: boolean }) {
  return (
    <>
      <StripMorph walking={walking} wrapperRef={wrapperRef} />
      <span data-strip>{walking ? 'avatar strip' : 'build strip'}</span>
    </>
  );
}

beforeEach(() => {
  dom.captureStrip.mockImplementation(() => {
    dom.seen.push(document.querySelector('[data-strip]')?.textContent ?? '');
    return SNAPSHOT;
  });
  dom.playStripMorph.mockReturnValue(vi.fn());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  dom.seen = [];
});

describe('StripMorph', () => {
  it('captures nothing on a load or a render that keeps the side', () => {
    const view = render(<Host walking={false} />);
    view.rerender(<Host walking={false} />);
    expect(dom.captureStrip).not.toHaveBeenCalled();
    expect(dom.playStripMorph).not.toHaveBeenCalled();
  });

  it('reads the outgoing strip before the DOM changes, then plays onto the incoming side', () => {
    const view = render(<Host walking={false} />);
    view.rerender(<Host walking />);
    expect(dom.captureStrip).toHaveBeenCalledWith(parent);
    expect(dom.seen).toEqual(['build strip']);
    expect(dom.playStripMorph).toHaveBeenCalledWith(parent, SNAPSHOT, 'walk');
    view.rerender(<Host walking={false} />);
    expect(dom.playStripMorph).toHaveBeenLastCalledWith(parent, SNAPSHOT, 'edit');
  });

  it('ends a morph under way when the switch flips again, and on unmount', () => {
    const first = vi.fn();
    const second = vi.fn();
    dom.playStripMorph.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const view = render(<Host walking={false} />);
    view.rerender(<Host walking />);
    view.rerender(<Host walking={false} />);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    view.unmount();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('switches at once when nothing was captured (no strip showing, or reduced motion)', () => {
    dom.captureStrip.mockReturnValue(null);
    const view = render(<Host walking={false} />);
    view.rerender(<Host walking />);
    expect(dom.playStripMorph).not.toHaveBeenCalled();
    view.unmount();
  });
});
