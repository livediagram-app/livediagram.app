// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PRINT_FONTS_WAIT_MS,
  PRINT_FRAME_ATTR,
  PRINT_FRAME_CLEANUP_MS,
  printInFrame,
} from './print-frame';

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
    const done = printInFrame(
      '<p>Sheet</p><script>alert(1)</script><img src="x" onerror="alert(1)">',
    );
    const frame = frameNow()!;
    expect(frame.getAttribute('sandbox')).toBe('allow-same-origin allow-modals');
    expect(frame.getAttribute('aria-hidden')).toBe('true');
    expect(frame.style.visibility).toBe('hidden');
    // Sanitised as a whole page (docs/specs/016-platform/trusted-types.md "The sanitiser"): no script, no handler.
    expect(frame.srcdoc).toBe('<html><head></head><body><p>Sheet</p><img src="x"></body></html>');
    load(print);
    await done;
    expect(print).toHaveBeenCalledTimes(1);
  });

  // The sheets print in their own faces: the dialog waits for the frame's fonts, at most PRINT_FONTS_WAIT_MS.
  it('waits for the frame fonts before printing, and not past the wait', async () => {
    const withFonts = (ready: Promise<unknown>) => {
      const frame = frameNow()!;
      Object.defineProperty(frame.contentWindow!.document, 'fonts', {
        value: { ready },
        configurable: true,
      });
      return frame;
    };
    const print = vi.fn();
    let fontsIn!: () => void;
    const done = printInFrame('<p>a</p>');
    withFonts(new Promise<void>((r) => (fontsIn = r)));
    load(print);
    await Promise.resolve();
    expect(print).not.toHaveBeenCalled();
    fontsIn();
    await done;
    expect(print).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    const slow = vi.fn();
    const late = printInFrame('<p>b</p>');
    withFonts(new Promise(() => {}));
    load(slow);
    await vi.advanceTimersByTimeAsync(PRINT_FONTS_WAIT_MS - 1);
    expect(slow).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await late;
    expect(slow).toHaveBeenCalledTimes(1);
  });

  it('prints only the newest when a second print replaces one still waiting on its fonts', async () => {
    const first = vi.fn();
    const one = printInFrame('<p>one</p>');
    const frame = frameNow()!;
    Object.defineProperty(frame.contentWindow!.document, 'fonts', {
      value: { ready: Promise.resolve() },
    });
    load(first);
    frame.remove();
    await one;
    expect(first).not.toHaveBeenCalled();
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
    expect((frames[0] as HTMLIFrameElement).srcdoc).toBe(
      '<html><head></head><body><p>two</p></body></html>',
    );
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
