import { useEffect, useSyncExternalStore } from 'react';

import type { CodeLanguage } from '@livediagram/diagram';
import type { CodeToken } from './code-tokens';

// Async loader for the code tokenizer (spec/82), on the icon-registry
// pattern: one memoized dynamic import, a useSyncExternalStore pair, and a
// synchronous lookup that returns undefined pre-load so CodeBlockView
// degrades to plain monospace text (never blanks) until the chunk lands.

type Tokenizer = (code: string, language: CodeLanguage) => CodeToken[][];

let tokenizer: Tokenizer | null = null;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function ensureCodeTokenizer(): Promise<void> {
  if (tokenizer) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = import('./code-tokens')
    .then((m) => {
      tokenizer = m.tokenizeCode;
      listeners.forEach((l) => l());
    })
    .catch((err) => {
      // Failed chunk fetch: log, clear the memo so the next consumer mount
      // retries, keep rendering plain text meanwhile.
      console.error('code tokenizer failed to load', err);
      loadPromise = null;
    });
  return loadPromise;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const isLoaded = () => tokenizer !== null;

// Tokenize synchronously if the chunk has landed; undefined otherwise.
export function tokenizeLoaded(code: string, language: CodeLanguage): CodeToken[][] | undefined {
  return tokenizer ? tokenizer(code, language) : undefined;
}

// Kick the load on mount + re-render once when it lands.
export function useCodeTokenizer(): boolean {
  useEffect(() => {
    void ensureCodeTokenizer();
  }, []);
  return useSyncExternalStore(subscribe, isLoaded, () => false);
}
