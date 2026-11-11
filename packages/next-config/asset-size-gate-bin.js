#!/usr/bin/env node
// The `asset-size-gate` bin: `asset-size-gate out` after `next build` (asset-size-gate.js).
import { runAssetSizeGate } from './asset-size-gate.js';

runAssetSizeGate(process.argv[2]);
