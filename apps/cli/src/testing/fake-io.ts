// An in-memory CliIo for the suites (docs/specs/015-api/blueprints/cli.md "Testing"): captured streams, a map
// of files with their modes, a scripted fetch and a fixed clock.

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { CliAsset, CliIo, LoopbackRequest, RoomSocket } from '../io';

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
  // URLs the CLI asked to open in a browser.
  opened: string[];
  // A browser visiting the loopback: the answer the CLI gave, once it gave one.
  visit(url: string): Promise<{ status: number; html: string }>;
  // Moves the clock on, running each timer that falls due, in order.
  advance(ms: number): Promise<void>;
  interrupt(): void;
  // Directories made with mkdir; a file's parents exist without one.
  dirMap: Set<string>;
  // Symbolic links: path to target.
  linkMap: Map<string, string>;
  // A change under a watched directory: each `watchTree` handler whose directory holds the path hears it.
  touch(path: string): void;
  // The prompts `readLine` showed, in order.
  prompts: string[];
  // Processes this machine runs, for `processAlive`.
  alive: Set<number>;
};

const parentOf = (path: string) => path.slice(0, Math.max(path.lastIndexOf('/'), 1));
const under = (dir: string, path: string) =>
  path.startsWith(dir === '/' ? '/' : `${dir}/`) && path !== dir;

export const NOW = Date.UTC(2026, 9, 5, 8, 0, 0);

export function fakeIo(
  options: {
    env?: Record<string, string>;
    routes?: Route[];
    stdin?: string;
    stdinIsTTY?: boolean;
    stdoutIsTTY?: boolean;
    files?: Record<string, string>;
    links?: Record<string, string>;
    // The answers `readLine` gives, in order; null is the end of input; past the end, null.
    lines?: (string | null)[];
    // The answers `runTool` gives: a function of the command and its arguments.
    tool?: (
      command: string,
      args: readonly string[],
    ) => { code: number; stdout: string } | null | Promise<{ code: number; stdout: string } | null>;
  } = {},
): FakeIo {
  let out = '';
  let err = '';
  const fileMap = new Map(
    Object.entries(options.files ?? {}).map(([k, v]) => [k, { data: v, mode: 0o600 }]),
  );
  const byteMap = new Map<string, Uint8Array>();
  const dirMap = new Set<string>();
  const linkMap = new Map(Object.entries(options.links ?? {}));
  const watchers = new Set<{ dir: string; onChange: (path: string) => void }>();
  const prompts: string[] = [];
  const answers = [...(options.lines ?? [])];
  const alive = new Set<number>();
  const requests: Request[] = [];
  const slept: number[] = [];
  let clock = NOW;
  const sockets: FakeSocket[] = [];
  let timers: { at: number; seq: number; run: () => void }[] = [];
  let seq = 0;
  const interrupts = new Set<() => void>();
  const opened: string[] = [];
  const loopbackWaiting: ((r: LoopbackRequest) => void)[] = [];
  const loopbackQueued: LoopbackRequest[] = [];
  return {
    // Quiet by default: a suite about the usage count turns it on with LIVEDIAGRAM_TELEMETRY: '1'.
    env: { LIVEDIAGRAM_TELEMETRY: '0', ...options.env },
    stdout: (text) => void (out += text),
    stderr: (text) => void (err += text),
    readStdin: async () => options.stdin ?? '',
    stdinIsTTY: options.stdinIsTTY ?? false,
    stdoutIsTTY: options.stdoutIsTTY ?? false,
    readLine: async (prompt) => {
      prompts.push(prompt);
      err += prompt;
      return answers.length > 0 ? answers.shift()! : null;
    },
    watchTree: (dir, onChange) => {
      const watcher = { dir, onChange };
      watchers.add(watcher);
      return () => void watchers.delete(watcher);
    },
    pid: 4242,
    hostname: 'test-host',
    processAlive: (pid) => alive.has(pid),
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
      mkdir: async (path) => void dirMap.add(path),
      mode: async (path) => fileMap.get(path)?.mode ?? null,
      chmod: async (path, mode) => {
        const file = fileMap.get(path);
        if (file) file.mode = mode;
      },
      remove: async (path) => {
        fileMap.delete(path);
        if (![...fileMap.keys(), ...dirMap].some((p) => under(path, p))) dirMap.delete(path);
      },
      list: async (path) => {
        const children = new Map<string, 'file' | 'dir' | 'link'>();
        for (const p of [...fileMap.keys(), ...dirMap]) {
          if (!under(path, p)) continue;
          const rest = p.slice(path === '/' ? 1 : path.length + 1);
          const name = rest.split('/')[0]!;
          children.set(name, rest.includes('/') || dirMap.has(p) ? 'dir' : 'file');
        }
        for (const p of linkMap.keys())
          if (parentOf(p) === path) children.set(p.slice(path.length + 1), 'link');
        if (children.size === 0 && !dirMap.has(path)) return null;
        return [...children].map(([name, kind]) => ({ name, kind }));
      },
      move: async (from, to) => {
        const file = fileMap.get(from);
        if (!file) throw Object.assign(new Error(`ENOENT: ${from}`), { code: 'ENOENT' });
        fileMap.delete(from);
        fileMap.set(to, file);
      },
      createExclusive: async (path, data) => {
        if (fileMap.has(path)) return false;
        fileMap.set(path, { data, mode: 0o600 });
        return true;
      },
      realpath: async (path) => {
        for (const [link, target] of linkMap)
          if (path === link || under(link, path)) return `${target}${path.slice(link.length)}`;
        const exists =
          fileMap.has(path) ||
          dirMap.has(path) ||
          [...fileMap.keys(), ...dirMap].some((p) => under(path, p));
        return exists ? path : null;
      },
    },
    listenLoopback: async () => ({
      port: 4321,
      next: () => {
        const ready = loopbackQueued.shift();
        return ready ? Promise.resolve(ready) : new Promise((r) => loopbackWaiting.push(r));
      },
      close: () => {},
    }),
    openUrl: async (url) => {
      opened.push(url);
      return true;
    },
    visit: (url) =>
      new Promise((resolve) => {
        const parsed = new URL(url);
        const request: LoopbackRequest = {
          path: parsed.pathname,
          query: parsed.searchParams,
          respond: (status, html) => resolve({ status, html }),
        };
        const take = loopbackWaiting.shift();
        if (take) take(request);
        else loopbackQueued.push(request);
      }),
    // No platform store unless a suite gives one: the credentials file keeps the token.
    platform: 'test',
    runTool: async (command, args) => (options.tool ? options.tool(command, args) : null),
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
    dirMap,
    linkMap,
    touch: (path) => {
      for (const w of [...watchers]) if (under(w.dir, path)) w.onChange(path);
    },
    prompts,
    alive,
    out: () => out,
    err: () => err,
    fileMap,
    byteMap,
    requests,
    slept,
    sockets,
    opened,
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
