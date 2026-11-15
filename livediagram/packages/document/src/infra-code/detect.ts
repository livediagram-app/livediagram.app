// Which format a file or a paste holds (docs/specs/020-import-export/infrastructure-import.md "Formats", blueprint
// "detectInfraFormat").

import type { InfraFormat } from './types';

const COMPOSE_NAME = /^(?:docker-)?compose(?:\.[\w-]+)*\.ya?ml$/;

/** The base name of a path, lowercased. */
export function baseName(name: string): string {
  const slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  return name.slice(slash + 1).toLowerCase();
}

// Whether a line of `text` starts `services:` at column 0: scanned line by line, no regex over the whole text.
function hasServicesLine(text: string): boolean {
  let start = 0;
  for (;;) {
    if (text.startsWith('services', start)) {
      let i = start + 'services'.length;
      while (text[i] === ' ' || text[i] === '\t') i++;
      if (text[i] === ':') return true;
    }
    const end = text.indexOf('\n', start);
    if (end === -1) return false;
    start = end + 1;
  }
}

export function detectInfraFormat(name: string | undefined, text: string): InfraFormat {
  if (name) {
    const base = baseName(name);
    if (base.endsWith('.toml')) return 'wrangler';
    if (COMPOSE_NAME.test(base) || base.endsWith('.yml') || base.endsWith('.yaml'))
      return 'compose';
  }
  // A paste, or a name that says nothing (I1).
  return hasServicesLine(text) ? 'compose' : 'wrangler';
}
