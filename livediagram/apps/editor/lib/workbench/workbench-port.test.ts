import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkbenchPort } from './workbench-port';

// The port (docs/specs/013-workspace/blueprints/workbench-embeds.md "Workbench messages"): sends only to
// the bound origin, accepts only from the parent at that origin, logs unknown types once.

const ORIGIN = 'https://127.0.0.1:5175';

type Listener = (event: MessageEvent) => void;

function fakeWindow() {
  const listeners = new Set<Listener>();
  const parent = { postMessage: vi.fn() };
  const win = {
    parent,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  const deliver = (data: unknown, origin = ORIGIN, source: unknown = parent) =>
    listeners.forEach((l) => l({ data, origin, source } as MessageEvent));
  return { win: win as unknown as Window, parent, deliver, listeners };
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createWorkbenchPort', () => {
  it('sends every message to the bound origin only', () => {
    const { win, parent } = fakeWindow();
    const port = createWorkbenchPort(ORIGIN, win);

    port.send({ type: 'livediagram:hello', v: 1 });
    port.send({ type: 'livediagram:renew', v: 1 });

    expect(parent.postMessage).toHaveBeenNthCalledWith(
      1,
      { type: 'livediagram:hello', v: 1 },
      ORIGIN,
    );
    expect(parent.postMessage).toHaveBeenNthCalledWith(
      2,
      { type: 'livediagram:renew', v: 1 },
      ORIGIN,
    );
    expect(port.origin).toBe(ORIGIN);
  });

  it('hands a valid workbench message to every subscriber', () => {
    const { win, deliver } = fakeWindow();
    const port = createWorkbenchPort(ORIGIN, win);
    const a = vi.fn();
    const b = vi.fn();
    port.subscribe(a);
    port.subscribe(b);

    deliver({ type: 'livediagram:theme', v: 1, colourScheme: 'dark' });

    const theme = { type: 'livediagram:theme', v: 1, colourScheme: 'dark' };
    expect(a).toHaveBeenCalledWith(theme);
    expect(b).toHaveBeenCalledWith(theme);
  });

  it('drops a message from another origin or another source silently', () => {
    const { win, deliver } = fakeWindow();
    const port = createWorkbenchPort(ORIGIN, win);
    const listener = vi.fn();
    port.subscribe(listener);

    deliver({ type: 'livediagram:theme', v: 1, colourScheme: 'dark' }, 'https://evil.example');
    deliver({ type: 'livediagram:theme', v: 1, colourScheme: 'dark' }, ORIGIN, {});
    deliver({ type: 'livediagram:dance', v: 1 }, 'https://evil.example');

    expect(listener).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs an unknown type once and never hands it on', () => {
    const { win, deliver } = fakeWindow();
    const port = createWorkbenchPort(ORIGIN, win);
    const listener = vi.fn();
    port.subscribe(listener);

    deliver({ type: 'livediagram:dance', v: 1 });
    deliver({ type: 'livediagram:dance', v: 1 });
    deliver({ type: 'livediagram:theme', v: 2, colourScheme: 'dark' });

    expect(listener).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith('[workbench] message-ignored', { type: 'livediagram:dance' });
    expect(warn).toHaveBeenCalledWith('[workbench] message-ignored', { type: 'livediagram:theme' });
  });

  it('logs an invalid message once per type and never hands it on', () => {
    const { win, deliver } = fakeWindow();
    const port = createWorkbenchPort(ORIGIN, win);
    const listener = vi.fn();
    port.subscribe(listener);

    deliver({ type: 'livediagram:hello-ack', v: 1, name: '' });
    deliver({ type: 'livediagram:hello-ack', v: 1 });

    expect(listener).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[workbench] message-invalid', {
      type: 'livediagram:hello-ack',
    });
  });

  it('stops handing messages on after unsubscribing and after closing', () => {
    const { win, deliver, listeners } = fakeWindow();
    const port = createWorkbenchPort(ORIGIN, win);
    const listener = vi.fn();
    const off = port.subscribe(listener);

    off();
    deliver({ type: 'livediagram:theme', v: 1, colourScheme: 'dark' });
    port.close();

    expect(listener).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });
});
