import { homedir } from 'node:os';

// The synthetic-only weights (group E's kept model); override with
// STICKY_MODEL_WEIGHTS=<dir holding model.json>.
export const WEIGHTS_DIR =
  process.env.STICKY_MODEL_WEIGHTS ?? `${homedir()}/.local/share/livediagram-es95/models/synth-v1`;
