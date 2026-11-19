// Which format a file or a paste holds (docs/specs/020-import-export/infrastructure-import.md "Formats", blueprint
// "detectInfraFormat"). Every check walks the text line by line: no regex runs over the whole text.

import type { InfraFormat } from './types';

const COMPOSE_NAME = /^(?:docker-)?compose(?:\.[\w-]+)*\.ya?ml$/;

// The words that open a Terraform top-level block, and what must follow them (after spaces) to be one.
const TERRAFORM_STARTS: readonly (readonly [word: string, next: string])[] = [
  ['resource', '"'],
  ['module', '"'],
  ['provider', '"'],
  ['data', '"'],
  ['terraform', '{'],
];

/** The base name of a path, lowercased. */
export function baseName(name: string): string {
  const slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  return name.slice(slash + 1).toLowerCase();
}

// Whether a line starting at `start` is `word`, then spaces or tabs, then `next`.
function lineOpens(text: string, start: number, word: string, next: string): boolean {
  if (!text.startsWith(word, start)) return false;
  let i = start + word.length;
  while (text[i] === ' ' || text[i] === '\t') i++;
  return text[i] === next;
}

// What the lines of `text` say, read once: a `services:` line, an `apiVersion:` and a `kind:` line, a Terraform block.
function scanLines(text: string): {
  services: boolean;
  apiVersion: boolean;
  kind: boolean;
  terraform: boolean;
} {
  const seen = { services: false, apiVersion: false, kind: false, terraform: false };
  let start = 0;
  for (;;) {
    if (lineOpens(text, start, 'services', ':')) seen.services = true;
    else if (lineOpens(text, start, 'apiVersion', ':')) seen.apiVersion = true;
    else if (lineOpens(text, start, 'kind', ':')) seen.kind = true;
    else if (TERRAFORM_STARTS.some(([word, next]) => lineOpens(text, start, word, next)))
      seen.terraform = true;
    const end = text.indexOf('\n', start);
    if (end === -1) return seen;
    start = end + 1;
  }
}

const isKubernetes = (s: ReturnType<typeof scanLines>) => !s.services && s.apiVersion && s.kind;

export function detectInfraFormat(name: string | undefined, text: string): InfraFormat {
  if (name) {
    const base = baseName(name);
    if (base.endsWith('.toml')) return 'wrangler';
    if (base.endsWith('.tf')) return 'terraform';
    if (COMPOSE_NAME.test(base)) return 'compose';
    if (base.endsWith('.yml') || base.endsWith('.yaml'))
      return isKubernetes(scanLines(text)) ? 'kubernetes' : 'compose';
  }
  // A paste, or a name that says nothing (I1).
  const seen = scanLines(text);
  if (seen.services) return 'compose';
  if (isKubernetes(seen)) return 'kubernetes';
  return seen.terraform ? 'terraform' : 'wrangler';
}
