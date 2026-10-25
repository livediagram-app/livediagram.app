import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { FileReader } from './collect.ts';

// The FileReader over the real file system, for the generator and each app's
// lists-its-dependencies test.
export const nodeReader: FileReader = {
  readText: (path) => {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return undefined;
    }
  },
  listFiles: (dir) => {
    try {
      return readdirSync(dir).filter((name) => statSync(join(dir, name)).isFile());
    } catch {
      return [];
    }
  },
};
