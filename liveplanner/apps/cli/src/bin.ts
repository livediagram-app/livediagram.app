#!/usr/bin/env node
// The liveplanner command (docs/specs/015-api/cli.md), run by @liveworkspace/cli-kit's entry.
import { runBin } from '@liveworkspace/cli-kit/bin';
import { run } from './main';
import { nodeIo } from '@liveworkspace/cli-kit/node-io';

await runBin(run, nodeIo());
