// An in-memory CliIo for the suites (docs/specs/015-api/blueprints/cli.md "Testing"): captured streams, a map
// of files with their modes, a scripted fetch and a fixed clock.

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { CliAsset, CliIo, RoomSocket } from '../io';

// The real assets, from the packages that ship them, so a suite renders real PNGs.
const requireHere = createRequire(import.meta.url);
const ASSET_PATHS: Record<CliAsset, string> = {
  'resvg.wasm': requireHere.resolve('@resvg/resvg-wasm/index_bg.wasm'),
  'Inter-Regular.ttf': requireHere.resolve('@livediagram/render-png/fonts/Inter-Regular.ttf'),
};

// A room socket the suite drives: it opens, delivers frames and closes when told to.
export type FakeSocket = RoomSocket & {
  url: string;
  closedWith: number | null;
  open(): void;
  send(frame: unknown): void;
  // A frame as raw text, for one that is not JSON.
  sendRaw(text: string): void;
  drop(code: number): void;
};

function fakeSocket(url: string): FakeSocket {
  const handlers = {
    open: [] as (() => void)[],
    message: [] as ((data: string) => void)[],
    close: [] as ((code: number) => void)[],
  };
  const socket: FakeSocket = {
    url,
    closedWith: null,
    onOpen: (h) => void handlers.open.push(h),
    onMessage: (h) => void handlers.message.push(h),
    onClose: (h) => void handlers.close.push(h),
    close: (code) => socket.drop(code),
    open: () => handlers.open.forEach((h) => h()),
    send: (frame) => socket.sendRaw(JSON.stringify(frame)),
    sendRaw: (text) => handlers.message.forEach((h) => h(text)),
    drop: (code) => {
      if (socket.closedWith !== null) return;
      socket.closedWith = code;
      handlers.close.forEach((h) => h(code));
    },
  };
  return socket;
}

export type Route = (
  request: Request,
  url: URL,
) => Response | undefined | Promise<Response | undefined>;

export type FakeIo = CliIo & {
  out: () => string;
  err: () => string;
  fileMap: Map<string, { data: string; mode: number }>;
  // Files written as bytes.
  byteMap: Map<string, Uint8Array>;
  requests: Request[];
  slept: number[];
  sockets: FakeSocket[];
  // Moves the clock on, running each timer that falls due, in order.
  advance(ms: number): Promise<void>;
  interrupt(): void;
};

export const NOW = Date.UTC(2026, 9, 5, 8, 0, 0);

export function fakeIo(
  options: {
    env?: Record<string, string>;
    routes?: Route[];
    stdin?: string;
    stdinIsTTY?: boolean;
    files?: Record<string, string>;
  } = {},
): FakeIo {
  let out = '';
  let err = '';
  const fileMap = new Map(
    Object.entries(options.files ?? {}).map(([k, v]) => [k, { data: v, mode: 0o600 }]),
  );
  const byteMap = new Map<string, Uint8Array>();
  const requests: Request[] = [];
  const slept: number[] = [];
  let clock = NOW;
  const sockets: FakeSocket[] = [];
  let timers: { at: number; seq: number; run: () => void }[] = [];
  let seq = 0;
  const interrupts = new Set<() => void>();
  return {
    // Quiet by default: a suite about the usage count turns it on with LIVEDIAGRAM_TELEMETRY: '1'.
    env: { LIVEDIAGRAM_TELEMETRY: '0', ...options.env },
    stdout: (text) => void (out += text),
    stderr: (text) => void (err += text),
    readStdin: async () => options.stdin ?? '',
    stdinIsTTY: options.stdinIsTTY ?? false,
    now: () => clock,
    sleep: async (ms) => {
      slept.push(ms);
      clock += ms;
    },
    homedir: '/home/agent',
    cwd: '/work',
    runtime: 'node/24.0.0 linux',
    fetch: async (request) => {
      requests.push(request);
      const url = new URL(request.url);
      for (const r of options.routes ?? []) {
        const answer = await r(request, url);
        if (answer) return answer;
      }
      return Response.json({ error: 'not_found' }, { status: 404 });
    },
    files: {
      read: async (path) => fileMap.get(path)?.data ?? null,
      write: async (path, data, mode) => void fileMap.set(path, { data, mode: mode ?? 0o644 }),
      writeBytes: async (path, data) => void byteMap.set(path, data),
      mkdir: async () => {},
      mode: async (path) => fileMap.get(path)?.mode ?? null,
      chmod: async (path, mode) => {
        const file = fileMap.get(path);
        if (file) file.mode = mode;
      },
      remove: async (path) => void fileMap.delete(path),
    },
    readAsset: async (name) => new Uint8Array(await readFile(ASSET_PATHS[name])),
    openSocket: (url) => {
      const socket = fakeSocket(url);
      sockets.push(socket);
      return socket;
    },
    timer: (ms, run) => {
      const entry = { at: clock + ms, seq: seq++, run };
      timers.push(entry);
      return () => void (timers = timers.filter((t) => t !== entry));
    },
    onInterrupt: (handler) => {
      interrupts.add(handler);
      return () => void interrupts.delete(handler);
    },
    advance: async (ms) => {
      const until = clock + ms;
      for (;;) {
        const due = timers
          .filter((t) => t.at <= until)
          .sort((a, b) => a.at - b.at || a.seq - b.seq)[0];
        if (!due) break;
        timers = timers.filter((t) => t !== due);
        clock = due.at;
        due.run();
        // Let what the timer started (a fetch, a reconnect) run before the next one falls due.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      clock = until;
    },
    interrupt: () => [...interrupts].forEach((h) => h()),
    out: () => out,
    err: () => err,
    fileMap,
    byteMap,
    requests,
    slept,
    sockets,
  };
}

// A host that has sign-in, at livediagram.app.
export const capabilities: Route = (_, url) =>
  url.pathname === '/api/capabilities'
    ? Response.json({
        aiEnabled: false,
        apiBase: 'https://livediagram.app/api',
        authEnabled: true,
        documentFormat: 2,
      })
    : undefined;

export const TOKEN = `lvd_${'a'.repeat(43)}`;
