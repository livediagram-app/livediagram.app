// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRINT_FRAME_ATTR, PRINT_FRAME_CLEANUP_MS, printInFrame } from './print-frame';

// docs/specs/020-import-export/print.md "How it prints". jsdom loads no srcdoc, so each test fires the frame's load.

const frameNow = () => document.querySelector<HTMLIFrameElement>(`iframe[${PRINT_FRAME_ATTR}]`);
const load = (print: () => void = vi.fn()) => {
  const frame = frameNow()!;
  frame.contentWindow!.print = print;
  frame.dispatchEvent(new Event('load'));
  return frame;
};

afterEach(() => {
  frameNow()?.remove();
  vi.useRealTimers();
});

describe('printInFrame', () => {
  it('prints the document from a sandboxed, unseen frame once it loads', async () => {
    const print = vi.fn();
    const done = printInFrame('<p>Sheet</p>');
    const frame = frameNow()!;
    expect(frame.getAttribute('sandbox')).toBe('allow-same-origin allow-modals');
    expect(frame.getAttribute('aria-hidden')).toBe('true');
    expect(frame.style.visibility).toBe('hidden');
    expect(frame.srcdoc).toBe('<p>Sheet</p>');
    load(print);
    await done;
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('removes the frame after printing, or after a minute', async () => {
    const done = printInFrame('<p>a</p>');
    const frame = load();
    await done;
    frame.contentWindow!.dispatchEvent(new Event('afterprint'));
    expect(frameNow()).toBeNull();

    vi.useFakeTimers();
    const again = printInFrame('<p>b</p>');
    load();
    await again;
    expect(frameNow()).not.toBeNull();
    vi.advanceTimersByTime(PRINT_FRAME_CLEANUP_MS);
    expect(frameNow()).toBeNull();
  });

  it('keeps one frame: a second print replaces the first', () => {
    void printInFrame('<p>one</p>');
    void printInFrame('<p>two</p>');
    const frames = document.querySelectorAll(`iframe[${PRINT_FRAME_ATTR}]`);
    expect(frames).toHaveLength(1);
    expect((frames[0] as HTMLIFrameElement).srcdoc).toBe('<p>two</p>');
    load();
  });

  it('rejects, frame gone, when printing throws', async () => {
    const done = printInFrame('<p>x</p>');
    load(() => {
      throw new Error('Blocked');
    });
    await expect(done).rejects.toThrow('Blocked');
    expect(frameNow()).toBeNull();
  });

  it('rejects when the frame has no window', async () => {
    const done = printInFrame('<p>x</p>');
    const frame = frameNow()!;
    Object.defineProperty(frame, 'contentWindow', { value: null });
    frame.dispatchEvent(new Event('load'));
    await expect(done).rejects.toThrow('Printing is not available here.');
    expect(frameNow()).toBeNull();
  });
});
