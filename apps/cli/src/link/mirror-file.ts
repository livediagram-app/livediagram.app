// The mirror file (docs/specs/027-repositories/repository-link.md "The mirror file"; blueprint "The mirror file"):
// the CLI's pull file with no time, so the same revisions write the same bytes (RL30). Every object's keys are
// sorted at every depth (RL31) and each tab's elements print one a line, so a change to one element is a one-line
// diff and `rg` lands on the element's line.

import type { PullFile, PullSync } from '../sync/pull-file';
import { canonicalJson } from '../sync/pull-file';
import { isRecord } from '@livediagram/document';

export type MirrorFile = Omit<PullFile, 'exportedAt' | 'livediagramSync'> & {
  livediagramSync: Omit<PullSync, 'pulledAt'>;
};

// As `JSON.stringify(value, null, 2)` prints, keys sorted; an array at `document.tabs[i].elements` prints each
// element on its own line, as its canonical JSON.
function print(value: unknown, indent: string, path: string): string {
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const oneALine = /^document\.tabs\.\d+\.elements$/.test(path);
    const items = value.map((item, i) =>
      oneALine ? canonicalJson(item) : print(item, inner, `${path}.${i}`),
    );
    return `[\n${items.map((item) => `${inner}${item}`).join(',\n')}\n${indent}]`;
  }
  if (!isRecord(value)) return JSON.stringify(value);
  const keys = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort();
  if (keys.length === 0) return '{}';
  const entries = keys.map(
    (key) =>
      `${inner}${JSON.stringify(key)}: ${print(value[key], inner, path ? `${path}.${key}` : key)}`,
  );
  return `{\n${entries.join(',\n')}\n${indent}}`;
}

export function mirrorFileText(file: MirrorFile): string {
  const { kind, schemaVersion, document, livediagramSync } = file;
  return `${print({ kind, schemaVersion, document, livediagramSync }, '', '')}\n`;
}

// A line git writes around a conflict: `<<<<<<< `, `=======` alone, or `>>>>>>> `.
export function hasConflictMarkers(text: string): boolean {
  return /^(?:<{7} |={7}\r?$|>{7} )/m.test(text);
}
