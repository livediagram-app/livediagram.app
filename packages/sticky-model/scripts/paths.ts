import { tmpdir } from 'node:os';

// Everything this package's scripts produce — synthetic shards, model weights,
// previews, overlays — lives outside the repository: weights trained on the
// private walls are derived from them and must never be committed.
export const WORK_DIR = process.env.STICKY_MODEL_DIR ?? `${tmpdir()}/livediagram-sticky-model`;
