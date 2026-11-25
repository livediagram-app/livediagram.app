// @vitest-environment jsdom
// The selection menu's Cut, Copy and Paste (liveworkspace/docs/specs/004-index/send-to-plan.md "The selection menu"):
// the browser's own copy and cut, the words as plain text where it refuses, and the clipboard pasted through the
// writing's own paste with a paste event carrying it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canReadClipboard,
  pasteClipboard,
  runClipboardCommand,
  writeClipboardText,
  type PasteTarget,
} from './selection-clipboard';

const blob = (text: string) => ({ text: () => Promise.resolve(text) });
const item = (types: Record<string, string>) => ({
  types: Object.keys(types),
  getType: (t: string) => Promise.resolve(blob(types[t]!)),
});
const clipboard = (over: Partial<Clipboard>) => vi.stubGlobal('navigator', { clipboard: over });

function target(destroyed = false) {
  return {
    isDestroyed: destroyed,
    focus: vi.fn(),
    pasteHTML: vi.fn().mockReturnValue(true),
    pasteText: vi.fn().mockReturnValue(true),
  } satisfies PasteTarget;
}

// A paste event as the browser makes one: what it carries is read back.
class FakeTransfer {
  data: Record<string, string> = {};
  setData(t: string, v: string) {
    this.data[t] = v;
  }
}
class FakeClipboardEvent {
  type: string;
  init: { clipboardData: FakeTransfer };
  constructor(type: string, init: { clipboardData: FakeTransfer }) {
    this.type = type;
    this.init = init;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Copy and Cut', () => {
  it('run the browser’s own command, false where it refuses, throws or has none', () => {
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
    expect(runClipboardCommand('cut')).toBe(true);
    expect(exec).toHaveBeenCalledWith('cut');
    exec.mockReturnValue(false);
    expect(runClipboardCommand('copy')).toBe(false);
    exec.mockImplementation(() => {
      throw new Error('denied');
    });
    expect(runClipboardCommand('copy')).toBe(false);
    Object.defineProperty(document, 'execCommand', { value: undefined, configurable: true });
    expect(runClipboardCommand('copy')).toBe(false);
  });

  it('put the words as plain text where asked, false where refused', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboard({ writeText });
    expect(await writeClipboardText('Book')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('Book');
    writeText.mockRejectedValue(new Error('denied'));
    expect(await writeClipboardText('Book')).toBe(false);
  });
});

describe('Paste', () => {
  it('is offered only where the browser lets a page read the clipboard', () => {
    vi.stubGlobal('navigator', undefined);
    expect(canReadClipboard()).toBe(false);
    vi.stubGlobal('navigator', {});
    expect(canReadClipboard()).toBe(false);
    clipboard({});
    expect(canReadClipboard()).toBe(false);
    clipboard({ readText: vi.fn() });
    expect(canReadClipboard()).toBe(true);
    clipboard({ read: vi.fn() });
    expect(canReadClipboard()).toBe(true);
  });

  it('pastes the rich copy through the writing’s paste, with an event carrying both', async () => {
    vi.stubGlobal('DataTransfer', FakeTransfer);
    vi.stubGlobal('ClipboardEvent', FakeClipboardEvent);
    clipboard({
      read: vi
        .fn()
        .mockResolvedValue([
          item({ 'image/png': 'x' }),
          item({ 'text/html': '<b>Hi</b>', 'text/plain': 'Hi' }),
          item({ 'text/html': '<i>later</i>', 'text/plain': 'later' }),
        ]),
    });
    const t = target();
    expect(await pasteClipboard(t)).toBe(true);
    expect(t.focus).toHaveBeenCalled();
    const [html, event] = t.pasteHTML.mock.calls[0]!;
    expect(html).toBe('<b>Hi</b>');
    expect((event as unknown as FakeClipboardEvent).init.clipboardData.data).toEqual({
      'text/html': '<b>Hi</b>',
      'text/plain': 'Hi',
    });
  });

  it('pastes plain words as text, with no event where the browser can’t make one', async () => {
    vi.stubGlobal(
      'DataTransfer',
      class {
        constructor() {
          throw new TypeError('Illegal constructor');
        }
      },
    );
    clipboard({ read: vi.fn().mockResolvedValue([item({ 'text/plain': 'Plain' })]) });
    const t = target();
    expect(await pasteClipboard(t)).toBe(true);
    expect(t.pasteText).toHaveBeenCalledWith('Plain', undefined);
    expect(t.pasteHTML).not.toHaveBeenCalled();
  });

  it('falls back to a plain read where the rich one is refused or missing', async () => {
    vi.stubGlobal('DataTransfer', FakeTransfer);
    vi.stubGlobal('ClipboardEvent', FakeClipboardEvent);
    clipboard({
      read: vi.fn().mockRejectedValue(new Error('denied')),
      readText: vi.fn().mockResolvedValue('Words'),
    });
    const t = target();
    expect(await pasteClipboard(t)).toBe(true);
    const [text, event] = t.pasteText.mock.calls[0]!;
    expect(text).toBe('Words');
    expect((event as unknown as FakeClipboardEvent).init.clipboardData.data).toEqual({
      'text/plain': 'Words',
    });
    clipboard({ read: vi.fn().mockResolvedValue([item({ 'text/html': '<p>Rich</p>' })]) });
    const rich = target();
    expect(await pasteClipboard(rich)).toBe(true);
    expect(
      (rich.pasteHTML.mock.calls[0]![1] as unknown as FakeClipboardEvent).init.clipboardData.data,
    ).toEqual({ 'text/html': '<p>Rich</p>' });
    clipboard({ readText: vi.fn().mockResolvedValue('Only') });
    const u = target();
    expect(await pasteClipboard(u)).toBe(true);
    expect(u.pasteText).toHaveBeenCalledWith('Only', expect.anything());
  });

  it('pastes nothing where refused, empty, unreadable, or the writing went', async () => {
    vi.stubGlobal('navigator', {});
    const none = target();
    expect(await pasteClipboard(none)).toBe(false);
    expect(none.focus).not.toHaveBeenCalled();
    clipboard({ readText: vi.fn().mockRejectedValue(new Error('denied')) });
    expect(await pasteClipboard(target())).toBe(false);
    clipboard({ readText: vi.fn().mockResolvedValue('') });
    expect(await pasteClipboard(target())).toBe(false);
    clipboard({ readText: vi.fn().mockResolvedValue('Words') });
    const gone = target(true);
    expect(await pasteClipboard(gone)).toBe(false);
    expect(gone.pasteText).not.toHaveBeenCalled();
  });
});
