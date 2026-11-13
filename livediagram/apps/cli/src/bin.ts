#!/usr/bin/env node
// The livediagram command (docs/specs/015-api/cli.md), run by @liveworkspace/cli-kit's entry.
import { runBin } from '@liveworkspace/cli-kit/bin';
import { run } from './main';
import { nodeIo } from './node-io';

await runBin(run, nodeIo());
