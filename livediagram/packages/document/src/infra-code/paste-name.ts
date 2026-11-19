// What a paste is called where a file would be named (blueprint infrastructure-import.md "Performance and limits"):
// a leaf of its own, so the sources record's parts (sources.ts) reach no parser through graph.ts.

import type { InfraFormat } from './types';

/** What a paste is called where a file would be named. */
export const PASTE_NAME: Record<InfraFormat, string> = {
  wrangler: 'wrangler.toml',
  compose: 'docker-compose.yml',
  terraform: 'main.tf',
  kubernetes: 'manifest.yaml',
};
