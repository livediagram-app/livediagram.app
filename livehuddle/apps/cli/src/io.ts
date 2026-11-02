// Everything the CLI touches outside itself (docs/specs/015-api/blueprints/cli.md "Testing"): @liveworkspace/cli-kit's
// streams, environment, files, network and clock, and what the repository link needs besides: directory listings,
// moves and exclusive creates, watching a tree, and which processes are alive.

import type { CliFiles as KitFiles, CliIo as KitIo } from '@liveworkspace/cli-kit/io';

export type {
  CliAsset,
  LoopbackRequest,
  LoopbackServer,
  RoomSocket,
  ToolRun,
} from '@liveworkspace/cli-kit/io';

export type CliFiles = KitFiles & {
  // Entries of a directory, or null when it is not one; symbolic links reported as 'link' and never followed.
  list(path: string): Promise<{ name: string; kind: 'file' | 'dir' | 'link' }[] | null>;
  // rename(2); parent directories created.
  move: (from: string, to: string) => Promise<void>;
  // An O_EXCL create; false when the path exists.
  createExclusive: (path: string, data: string) => Promise<boolean>;
  // The path with every symbolic link resolved, or null when nothing is there.
  realpath: (path: string) => Promise<string | null>;
};

export type CliIo = Omit<KitIo, 'files'> & {
  files: CliFiles;
  // Recursive change events under `dir`; the returned function stops it.
  watchTree: (dir: string, onChange: (path: string) => void) => () => void;
  pid: number;
  hostname: string;
  // Whether a process of this machine is alive (signal 0 answered without ESRCH).
  processAlive: (pid: number) => boolean;
};
