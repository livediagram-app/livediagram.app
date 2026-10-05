// Everything the CLI touches outside itself (docs/specs/015-api/blueprints/cli.md "Testing"): streams, the
// environment, files, the network and the clock, injected so every command runs on fakes in tests.

export type CliFiles = {
  read(path: string): Promise<string | null>;
  // Written to a temporary file in the same directory, then renamed; `mode` for secrets (0o600).
  write(path: string, data: string, mode?: number): Promise<void>;
  mkdir(path: string, mode?: number): Promise<void>;
  // The file's permission bits, or null when it does not exist.
  mode(path: string): Promise<number | null>;
  chmod(path: string, mode: number): Promise<void>;
  remove(path: string): Promise<void>;
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
};
