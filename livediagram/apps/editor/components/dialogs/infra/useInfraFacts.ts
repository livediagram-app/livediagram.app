// The infrastructure panels' view of their files (docs/specs/020-import-export/blueprints/infrastructure-import.md
// "The editor"): the parsers load once the Infrastructure panel opens, never before, and each file's format and
// Wrangler environments are read once per text, not on every render.

import { useEffect, useMemo, useState } from 'react';

type InfraCode = typeof import('@livediagram/document/infra-code');

export type InfraFacts = { format: string; envs: string[] };

let loading: Promise<InfraCode> | null = null;

// Past the most files a run reads (INFRA_MAX_FILES, 20), with room for a paste's settled texts.
const FACTS_CACHE_MAX = 32;

// The parsers, or null while they load (a few milliseconds after the panel opens).
export function useInfraCode(): InfraCode | null {
  const [code, setCode] = useState<InfraCode | null>(null);
  useEffect(() => {
    let live = true;
    loading ??= import('@livediagram/document/infra-code');
    void loading.then((m) => {
      if (live) setCode(m);
    });
    return () => {
      live = false;
    };
  }, []);
  return code;
}

// Each file's facts by its key. A file with no text (one to choose again) keeps the format it was remembered with.
export function useInfraFacts(
  code: InfraCode | null,
  files: readonly { key: string; name: string; text?: string; format?: string }[],
): Map<string, InfraFacts> {
  return useMemo(() => {
    const out = new Map<string, InfraFacts>();
    for (const f of files) {
      if (f.text === undefined) {
        if (f.format) out.set(f.key, { format: f.format, envs: [] });
        continue;
      }
      if (code) out.set(f.key, factsOf(code, f.name, f.text));
    }
    return out;
  }, [code, files]);
}

// Parsed once per name and text: adding or removing one row never re-reads the others. The answer is pure, so one
// cache serves every panel; bounded, since each key holds a file's text and a paste settles into a new one each pause.
const cache = new Map<string, InfraFacts>();
function factsOf(code: InfraCode, name: string, text: string): InfraFacts {
  const id = `${name}\u0000${text}`;
  let facts = cache.get(id);
  if (!facts) {
    if (cache.size >= FACTS_CACHE_MAX) cache.clear();
    facts = code.infraFileFacts({ name, text });
    cache.set(id, facts);
  }
  return facts;
}

// Every environment the files name, in the order they first appear.
export function envsOf(facts: Map<string, InfraFacts>): string[] {
  const seen = new Set<string>();
  for (const f of facts.values()) for (const e of f.envs) seen.add(e);
  return [...seen];
}

// A value that settles `ms` after it last changed: a paste read for its format once typing pauses.
export function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return settled;
}
