#!/usr/bin/env node
// The livediagram command (docs/specs/015-api/cli.md).
import { run } from './main';
import { nodeIo } from './node-io';

// Once the command is done, nothing it opened may keep the process alive: a room socket's close waits for the
// server's answer for up to ten seconds, and a process manager gives far less before it gives up on the process.
const EXIT_GRACE_MS = 250;

process.exitCode = await run(process.argv.slice(2), nodeIo());
setTimeout(() => process.exit(), EXIT_GRACE_MS).unref();
