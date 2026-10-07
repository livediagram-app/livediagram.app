// Everything the CLI touches outside itself (docs/specs/015-api/blueprints/cli.md "Testing"): streams, the
// environment, files, the network and the clock, injected so every command runs on fakes in tests.

export type CliFiles = {
  read(path: string): Promise<string | null>;
  // Written to a temporary file in the same directory, then renamed; `mode` for secrets (0o600).
  write(path: string, data: string, mode?: number): Promise<void>;
  // Bytes, written the same way (a PNG).
  writeBytes(path: string, data: Uint8Array): Promise<void>;
  mkdir(path: string, mode?: number): Promise<void>;
  // The file's permission bits, or null when it does not exist.
  mode(path: string): Promise<number | null>;
  chmod(path: string, mode: number): Promise<void>;
  // A file, or an empty directory.
  remove(path: string): Promise<void>;
  // Entries of a directory, or null when it is not one; symbolic links reported as 'link' and never followed.
  list(path: string): Promise<{ name: string; kind: 'file' | 'dir' | 'link' }[] | null>;
  // rename(2); parent directories created.
  move(from: string, to: string): Promise<void>;
  // An O_EXCL create; false when the path exists.
  createExclusive(path: string, data: string): Promise<boolean>;
  // The path with every symbolic link resolved, or null when nothing is there.
  realpath(path: string): Promise<string | null>;
};

// The room socket `wait` and `watch` listen on (blueprint "The room stream"): text frames in, a close code out.
export type RoomSocket = {
  onOpen(handler: () => void): void;
  onMessage(handler: (data: string) => void): void;
  // Fires once, with the close code (1006 for an error).
  onClose(handler: (code: number) => void): void;
  close(code: number): void;
};

export type CliIo = {
  env: Readonly<Record<string, string | undefined>>;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  readStdin: () => Promise<string>;
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
  // Writes `prompt` to stderr and reads one line from stdin (the terminal's own line editing); null at end of input.
  readLine: (prompt: string) => Promise<string | null>;
  // Recursive change events under `dir`; the returned function stops it.
  watchTree: (dir: string, onChange: (path: string) => void) => () => void;
  pid: number;
  hostname: string;
  // Whether a process of this machine is alive (signal 0 answered without ESRCH).
  processAlive: (pid: number) => boolean;
  fetch: (request: Request) => Promise<Response>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  files: CliFiles;
  homedir: string;
  cwd: string;
  // `node/<version> <platform>`, for the User-Agent.
  runtime: string;
  openSocket: (url: string) => RoomSocket;
  // Runs `handler` after `ms`; the returned function cancels it.
  timer: (ms: number, handler: () => void) => () => void;
  // Runs `handler` on SIGINT instead of the default exit; the returned function stops listening.
  onInterrupt: (handler: () => void) => () => void;
  // A file shipped beside the CLI (the PNG renderer's wasm and font), read only when a render needs it.
  readAsset: (name: CliAsset) => Promise<Uint8Array>;
  listenLoopback: () => Promise<LoopbackServer>;
  // Opens a URL in the person's browser; false when no opener ran.
  openUrl: (url: string) => Promise<boolean>;
  // `process.platform`: which credential store the system offers.
  platform: string;
  // Runs a system tool with `input` on its stdin (never a secret in `args`) and collects its stdout; null when the
  // tool could not be started.
  runTool: (command: string, args: readonly string[], input: string) => Promise<ToolRun | null>;
};

export type ToolRun = { code: number; stdout: string };

// A one-shot HTTP listener on 127.0.0.1 for the browser sign-in's callback (blueprint "The CLI's OAuth client").
export type LoopbackRequest = {
  path: string;
  query: URLSearchParams;
  respond(status: number, html: string): void;
};
export type LoopbackServer = { port: number; next(): Promise<LoopbackRequest>; close(): void };

export type CliAsset = 'resvg.wasm' | 'Inter-Regular.ttf';
