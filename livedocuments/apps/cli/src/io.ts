// Everything the CLI touches outside itself (docs/specs/015-api/blueprints/cli.md "Testing"): streams, the
// environment, files, the network and the clock, injected so every command runs on fakes in tests. The shape is
// @liveworkspace/cli-kit's, shared by every product's CLI.

export type {
  CliAsset,
  CliFiles,
  CliIo,
  LoopbackRequest,
  LoopbackServer,
  RoomSocket,
  ToolRun,
} from '@liveworkspace/cli-kit/io';
