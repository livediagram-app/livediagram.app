#!/usr/bin/env node
// The livediagram command (docs/specs/015-api/cli.md).
import { run } from './main';
import { nodeIo } from './node-io';

process.exitCode = await run(process.argv.slice(2), nodeIo());
