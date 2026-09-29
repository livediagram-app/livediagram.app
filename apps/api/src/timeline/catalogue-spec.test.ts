import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TIMELINE_EVENT_TYPES } from '@livediagram/api-schema';

// The Timeline spec's event catalogue (docs/specs/013-workspace/timeline.md §4)
// is what a renderer, filter or colour is built from, so it must name exactly
// the vocabulary: a type the worker can emit with no row is invisible to the
// next reader, and a row for a type nothing emits sends them after a phantom.

const SPEC = fileURLToPath(
  new URL('../../../../docs/specs/013-workspace/timeline.md', import.meta.url).href,
);

// Every `eventType` named in the first cell of a §4 catalogue table row.
function catalogueTypes(): Set<string> {
  const spec = readFileSync(SPEC, 'utf8');
  const start = spec.indexOf('## 4. Event catalogue');
  const section = spec.slice(start, spec.indexOf('\n## 5.', start));
  const types = new Set<string>();
  for (const line of section.split('\n')) {
    const firstCell = /^\|([^|]*)\|/.exec(line)?.[1] ?? '';
    for (const m of firstCell.matchAll(/`([a-z_]+)`/g)) {
      if (m[1] !== 'eventType') types.add(m[1]!);
    }
  }
  return types;
}

// Every event type the worker's timeline modules write, read from source.
function emittedTypes(): Set<string> {
  const dir = fileURLToPath(new URL('.', import.meta.url).href);
  const types = new Set<string>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.includes('.test.'))) {
    const source = readFileSync(`${dir}/${file}`, 'utf8');
    for (const m of source.matchAll(/'((?:[a-z]+_)+[a-z]+)'/g)) {
      if ((TIMELINE_EVENT_TYPES as readonly string[]).includes(m[1]!)) types.add(m[1]!);
    }
  }
  return types;
}

describe('the timeline event catalogue in the spec', () => {
  it('has a row for every type in the vocabulary', () => {
    const rows = catalogueTypes();
    expect(TIMELINE_EVENT_TYPES.filter((t) => !rows.has(t))).toEqual([]);
  });

  it('lists nothing outside the vocabulary', () => {
    const known = new Set<string>(TIMELINE_EVENT_TYPES);
    expect([...catalogueTypes()].filter((t) => !known.has(t))).toEqual([]);
  });

  it('only retires document_renamed: every other type is still emitted', () => {
    const emitted = emittedTypes();
    expect(TIMELINE_EVENT_TYPES.filter((t) => !emitted.has(t))).toEqual(['document_renamed']);
  });
});
