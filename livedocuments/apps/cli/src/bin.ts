#!/usr/bin/env node
// The livedocuments command (docs/specs/015-api/cli.md), run by @liveworkspace/cli-kit's entry, with
// its update check (docs/specs/015-api/blueprints/cli.md "Update check").
import { runBin } from '@liveworkspace/cli-kit/bin';
import { binUpdate } from '@liveworkspace/cli-kit/update-check';
import { run } from './main';
import { nodeIo } from '@liveworkspace/cli-kit/node-io';
import { PRODUCT } from './product';

const io = nodeIo();
await runBin(run, io, { update: binUpdate(io, PRODUCT) });
