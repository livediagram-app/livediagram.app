import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { drawnRecord, INFRA_SOURCES_MAX_STORED_CHARS } from './record';

const here = dirname(fileURLToPath(import.meta.url));

// Every module record.ts reaches through value imports (type-only ones vanish from a bundle), and every package
// those modules import by name. The api and MCP Workers bundle this graph, and the /licences page lists what their
// bundles' inputs hold, so a parser reached from here puts js-yaml and smol-toml back on the page.
function reached(entry: string): { files: string[]; packages: string[] } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const visit = (file: string) => {
    if (files.has(file)) return;
    files.add(file);
    const text = readFileSync(file, 'utf8');
    for (const [, kind, spec] of text.matchAll(
      /^(?:import|export)(\s+type)?[^'";]*?from\s+'([^']+)'/gm,
    )) {
      if (kind) continue;
      if (spec!.startsWith('.')) visit(`${resolve(dirname(file), spec!)}.ts`);
      else packages.add(spec!);
    }
  };
  visit(resolve(here, entry));
  return { files: [...files].map((f) => f.slice(here.length + 1)).sort(), packages: [...packages] };
}

describe('the infra-sources subpath', () => {
  it('exports the record writer and the text cap', () => {
    expect(typeof drawnRecord).toBe('function');
    expect(INFRA_SOURCES_MAX_STORED_CHARS).toBe(200_000);
  });

  it('reaches no parser', () => {
    const { files, packages } = reached('record.ts');
    expect(files).toEqual(['detect.ts', 'limits.ts', 'paste-name.ts', 'record.ts', 'sources.ts']);
    expect(packages).toEqual([]);
  });
});
