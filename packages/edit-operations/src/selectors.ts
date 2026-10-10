// Selectors (docs/specs/024-agents/edit-operations.md "Selectors"; blueprint "Selectors"): a ref, a
// quoted label, or `key:value` terms joined by spaces, every one of which must match. Matching runs
// against the working state, so an element an earlier operation added or named is addressable.

import type { EditRejection } from '@livediagram/api-schema';
import {
  isContainer,
  kindWordOf,
  resolveRef,
  type Element,
  type ElementId,
} from '@livediagram/document';
import { describeElement, kindOf, labelOf } from './element-text';
import { reachableFrom } from './graph-walk';
import { nearestElements } from './nearest';
import { currentElements, holdersOf, namingOf, noteTarget, refsOf, type EditState } from './state';
import {
  arrowParts,
  hasQuotes,
  isQuotedWord,
  tokeniseLine,
  unquotedPrefix,
  type Word,
} from './tokenise';
import { REJECTION_CANDIDATES_MAX, RESERVED_WORDS, SELECTOR_KEYS } from './vocabulary';

// Keys whose value names one element.
const WORD_KEYS = ['in', 'from', 'to', 'downstream', 'upstream'] as const;
type WordKey = (typeof WORD_KEYS)[number];

export type SelectorTerm =
  | { kind: 'ref'; text: string }
  | { kind: 'label'; text: string }
  | { kind: 'label~'; text: string }
  | { kind: 'type' | 'shape'; value: string }
  | { [K in WordKey]: { kind: K; word: string } }[WordKey]
  | { kind: 'arrow'; from: string; to: string }
  | { kind: 'selected' };

type Resolved<T> = T | { rejection: EditRejection };

const KEYED = /^([a-zA-Z][a-zA-Z-]*):/;

function termOf(word: Word): SelectorTerm | string {
  if (isQuotedWord(word)) return { kind: 'label', text: word.value };
  const prefix = unquotedPrefix(word);
  // `a->b` with either end quoted: `"Sign in"->"Pay"` (an unquoted `->` anywhere in the word).
  const parts = arrowParts(word);
  if (parts) {
    if (parts.length > 2) return 'a->b with one arrow: an arrow has two ends';
    const [from, to] = parts as [string, string];
    return from && to ? { kind: 'arrow', from, to } : 'a->b with an element on each side';
  }
  // The always-safe ref the views print for an id that is not a plain word: `id:"…"`.
  if (prefix === 'id:' && word.raw.length > 3) return { kind: 'ref', text: word.raw };
  if (/^label~/i.test(prefix)) return { kind: 'label~', text: word.value.slice('label~'.length) };
  const keyed = KEYED.exec(prefix);
  if (keyed) {
    const key = keyed[1]!.toLowerCase();
    const value = word.raw.slice(keyed[1]!.length + 1);
    if (!SELECTOR_KEYS.some((k) => k === key))
      return `"${keyed[1]}:" is not a selector key; keys: ${SELECTOR_KEYS.join(' ')}`;
    if (value === '') return `${key}: needs a value`;
    if (value.includes(',')) return 'one value a term; join terms with spaces';
    if (key === 'type' || key === 'shape')
      return { kind: key, value: word.value.slice(key.length + 1) };
    const wordKey = WORD_KEYS.find((k) => k === key)!;
    return { kind: wordKey, word: value };
  }
  if (word.value === 'selected') return { kind: 'selected' };
  if (RESERVED_WORDS.has(word.value))
    return `"${word.value}" is a keyword; reach an element named so by its label or a longer prefix`;
  return { kind: 'ref', text: word.value };
}

// A selector's terms, or why it does not read.
export function parseSelector(selector: string): SelectorTerm[] | string {
  const tokens = tokeniseLine(selector);
  if ('error' in tokens) return `column ${tokens.error.column}: expected ${tokens.error.expected}`;
  if (tokens.words.length === 0) return 'an empty selector';
  const terms: SelectorTerm[] = [];
  for (const word of tokens.words) {
    const term = termOf(word);
    if (typeof term === 'string') return term;
    terms.push(term);
  }
  return terms;
}

// A bare word that names one element by itself: a ref or a quoted label, not a `key:value`, `~` or
// `->` term and not a reserved word.
export function isSingleWord(word: Word): boolean {
  if (isQuotedWord(word)) return true;
  if (hasQuotes(word) || RESERVED_WORDS.has(word.value)) return false;
  return !/[:=~]|->/.test(word.value);
}

// What an operation that acts on many by nature (`wrap`, `layout`) acts on: each ref or quoted
// label names exactly one element, and the other words of a selector together one or more. In
// element order, each once.
export function resolveMembers(
  state: EditState,
  selectors: readonly string[],
  operation: number,
): Resolved<{ els: readonly Element[] }> {
  const ids = new Set<ElementId>();
  for (const selector of selectors) {
    const tokens = tokeniseLine(selector);
    if ('error' in tokens) return resolveSelector(state, selector, operation);
    const rest = tokens.words.filter((word) => !isSingleWord(word));
    for (const word of tokens.words.filter(isSingleWord)) {
      const one = resolveOne(state, word.raw, operation);
      if ('rejection' in one) return one;
      ids.add(one.el.id);
    }
    if (rest.length === 0) continue;
    const some = resolveSome(state, rest.map((word) => word.raw).join(' '), operation, true);
    if ('rejection' in some) return some;
    for (const el of some.els) ids.add(el.id);
  }
  return { els: currentElements(state).filter((el) => ids.has(el.id)) };
}

// A selector as a refusal quotes it: as written when it is one quoted label, else in quotes.
const ONE_LABEL = /^"[^"]*"$/;
export const shownSelector = (selector: string) =>
  ONE_LABEL.test(selector) ? selector : `"${selector}"`;

function candidateLines(state: EditState, ids: readonly ElementId[]): string[] {
  const naming = namingOf(state);
  const shown = ids
    .slice(0, REJECTION_CANDIDATES_MAX)
    .map((id) => `  ${describeElement(state.byId.get(id)!, naming)}`);
  const more = ids.length - REJECTION_CANDIDATES_MAX;
  return more > 0 ? [...shown, `  … ${more} more`] : shown;
}

export function notFound(
  state: EditState,
  selector: string,
  operation: number,
  why?: string,
): EditRejection {
  const quoted = ONE_LABEL.test(selector);
  const near = nearestElements(quoted ? selector.slice(1, -1) : selector, currentElements(state), {
    labelsOnly: quoted,
  });
  const naming = namingOf(state);
  return {
    code: 'target_not_found',
    operation,
    details: [
      why ?? `${shownSelector(selector)} matches nothing`,
      ...(near.length ? ['nearest:', ...near.map((el) => `  ${describeElement(el, naming)}`)] : []),
    ],
    hint: 'use a ref from the outline, or label~<word> for part of a label',
  };
}

export function ambiguous(
  state: EditState,
  selector: string,
  operation: number,
  ids: readonly ElementId[],
  options: { stale?: boolean; all?: boolean; hint?: string } = {},
): EditRejection {
  const first = state.byId.get(ids[0]!)!;
  return {
    code: 'target_ambiguous',
    operation,
    details: [
      `${shownSelector(selector)} matches ${ids.length} elements${options.stale ? ' now; one was added since your read?' : ':'}`,
      ...candidateLines(state, ids),
    ],
    hint:
      options.hint ??
      `use a ref, narrow with type:${kindOf(first)}${options.all ? ', or add all' : ''}`,
  };
}

// The one element a word inside a term names (a ref or a quoted label), or its refusal.
function resolveWord(state: EditState, word: string, operation: number): Resolved<{ el: Element }> {
  const terms = parseSelector(word);
  const named =
    typeof terms !== 'string' &&
    terms.length === 1 &&
    (terms[0]!.kind === 'ref' || terms[0]!.kind === 'label');
  if (!named)
    return {
      rejection: notFound(
        state,
        word,
        operation,
        `"${word}" must name one element: a ref or a "label"`,
      ),
    };
  return resolveOne(state, word, operation);
}

function labelMatches(el: Element, text: string, partial: boolean): boolean {
  const label = labelOf(el)?.trim().toLowerCase();
  if (label === undefined) return false;
  const wanted = text.trim().toLowerCase();
  return partial ? label.includes(text.toLowerCase()) : label === wanted;
}

const pinnedTo = (el: Element, end: 'from' | 'to', id: ElementId) =>
  el.type === 'arrow' && el[end].kind === 'pinned' && el[end].elementId === id;

// The ids a term keeps of `candidates`, or its refusal.
function applyTerm(
  state: EditState,
  term: SelectorTerm,
  candidates: readonly Element[],
  selector: string,
  operation: number,
): Resolved<{ kept: Element[] }> {
  const keep = (test: (el: Element) => boolean) => ({ kept: candidates.filter(test) });
  const word = (text: string) => resolveWord(state, text, operation);
  switch (term.kind) {
    case 'ref': {
      // An exact id names its element outright, as resolveRef would.
      const exact = state.byId.get(term.text);
      if (exact) return { kept: candidates.includes(exact) ? [exact] : [] };
      const found = resolveRef(term.text, refsOf(state));
      if (found.kind === 'ambiguous')
        return {
          rejection: ambiguous(state, term.text, operation, found.candidates, {
            stale: found.stale,
          }),
        };
      if (found.kind === 'not-found') return { kept: [] };
      return keep((el) => el.id === found.id);
    }
    case 'label':
      return keep((el) => labelMatches(el, term.text, false));
    case 'label~':
      return keep((el) => labelMatches(el, term.text, true));
    case 'type':
      return keep((el) => kindWordOf(el) === term.value || el.type === term.value);
    case 'shape':
      return keep((el) => el.type === 'shape' && el.shape === term.value);
    case 'selected': {
      if (state.selected === null) {
        state.log('[edit-ops] selection-unread', { operation });
        return {
          rejection: notFound(state, selector, operation, 'the selection could not be read'),
        };
      }
      if (state.selected.length === 0)
        return { rejection: notFound(state, selector, operation, 'nothing is selected') };
      const selected = new Set(state.selected);
      return keep((el) => selected.has(el.id));
    }
    case 'in': {
      const resolved = word(term.word);
      if ('rejection' in resolved) return resolved;
      const container = resolved.el;
      if (!isContainer(container)) {
        const containers = currentElements(state).filter(isContainer);
        return {
          rejection: {
            code: 'invalid_value',
            operation,
            details: [
              `in:${term.word}: ${refsOf(state).refOf(container.id)} is not a frame or lane`,
              ...(containers.length
                ? [`containers: ${containers.map((c) => refsOf(state).refOf(c.id)).join(' ')}`]
                : []),
            ],
            hint: 'name a frame or a lane',
          },
        };
      }
      const holders = holdersOf(state);
      const within = (id: ElementId): boolean => {
        const holder = holders.get(id);
        return holder === container.id || (holder ? within(holder) : false);
      };
      return keep((el) => el.type !== 'arrow' && within(el.id));
    }
    case 'from':
    case 'to': {
      const resolved = word(term.word);
      if ('rejection' in resolved) return resolved;
      return keep((el) => pinnedTo(el, term.kind, resolved.el.id));
    }
    case 'arrow': {
      const from = word(term.from);
      if ('rejection' in from) return from;
      const to = word(term.to);
      if ('rejection' in to) return to;
      return keep((el) => pinnedTo(el, 'from', from.el.id) && pinnedTo(el, 'to', to.el.id));
    }
    case 'downstream':
    case 'upstream': {
      const resolved = word(term.word);
      if ('rejection' in resolved) return resolved;
      const reached = reachableFrom(currentElements(state), resolved.el.id, term.kind);
      return keep((el) => el.type !== 'arrow' && reached.has(el.id));
    }
  }
}

// Every working element a selector matches, in element order; none is not a refusal here.
export function resolveSelector(
  state: EditState,
  selector: string,
  operation: number,
): Resolved<{ els: readonly Element[] }> {
  const terms = parseSelector(selector);
  if (typeof terms === 'string')
    return {
      rejection: { code: 'parse_error', operation, details: [`selector "${selector}": ${terms}`] },
    };
  let candidates = currentElements(state);
  for (const term of terms) {
    const applied = applyTerm(state, term, candidates, selector, operation);
    if ('rejection' in applied) return applied;
    candidates = applied.kept;
  }
  for (const el of candidates) noteTarget(state, el.id);
  return { els: candidates };
}

// Exactly one element.
export function resolveOne(
  state: EditState,
  selector: string,
  operation: number,
): Resolved<{ el: Element }> {
  const resolved = resolveSelector(state, selector, operation);
  if ('rejection' in resolved) return resolved;
  const { els } = resolved;
  if (els.length === 0) return { rejection: notFound(state, selector, operation) };
  if (els.length > 1)
    return {
      rejection: ambiguous(
        state,
        selector,
        operation,
        els.map((el) => el.id),
      ),
    };
  return { el: els[0]! };
}

// One element, or one or more with `all`.
export function resolveSome(
  state: EditState,
  selector: string,
  operation: number,
  all: boolean,
): Resolved<{ els: readonly Element[] }> {
  const resolved = resolveSelector(state, selector, operation);
  if ('rejection' in resolved) return resolved;
  const { els } = resolved;
  if (els.length === 0) return { rejection: notFound(state, selector, operation) };
  if (els.length > 1 && !all)
    return {
      rejection: ambiguous(
        state,
        selector,
        operation,
        els.map((el) => el.id),
        { all: true },
      ),
    };
  return { els };
}
