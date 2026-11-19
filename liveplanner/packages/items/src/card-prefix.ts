// Card number prefixes (docs/specs/026-plan/item-types.md "Card number prefixes"): the letters a card type puts
// before its cards' numbers (WI-100), made from its name unless it stores its own, unique in the plan. The number is
// the item's `key`, unchanged; the prefix is display and lookup only. Pure.
import type { ItemTypeDef } from './item-types';

export const CARD_PREFIX_MAX = 6;

const isUpper = (c: string) => c >= 'A' && c <= 'Z';
const isDigit = (c: string) => c >= '0' && c <= '9';

// A prefix as typed, read: trimmed, upper case, 1 to 6 letters and digits starting with a letter; null otherwise.
export function normalPrefix(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const p = input.trim().toUpperCase();
  if (p.length < 1 || p.length > CARD_PREFIX_MAX || !isUpper(p[0]!)) return null;
  for (const c of p) if (!isUpper(c) && !isDigit(c)) return null;
  return p;
}

// A name's words as prefix material: accents dropped, letters and digits only, upper case.
function wordsOf(label: string): string[] {
  const plain = label.normalize('NFD').toUpperCase();
  const words: string[] = [];
  let word = '';
  for (const c of plain) {
    if (isUpper(c) || isDigit(c)) word += c;
    else if (c >= '̀' && c <= 'ͯ') continue;
    else if (word) {
      words.push(word);
      word = '';
    }
  }
  if (word) words.push(word);
  // Leading digits are dropped, so a prefix always starts with a letter ("2024 Goals" reads as Goals).
  while (words.length && !isUpper(words[0]![0]!)) {
    const rest = [...words[0]!].findIndex(isUpper);
    if (rest < 0) words.shift();
    else words[0] = words[0]!.slice(rest);
  }
  return words;
}

// The prefix made from a type's name that `taken` (upper case) lacks: the first letter of each word, up to 6; then
// the last word's next letters one at a time; then a digit from 2. A name with nothing to read gives C (card).
export function autoPrefix(label: string, taken: ReadonlySet<string>): string {
  const words = wordsOf(label);
  if (words.length === 0) words.push('C');
  const base = words
    .map((w) => w[0]!)
    .join('')
    .slice(0, CARD_PREFIX_MAX);
  if (!taken.has(base)) return base;
  const last = words[Math.min(words.length, CARD_PREFIX_MAX) - 1]!;
  let grown = base;
  for (const c of last.slice(1)) {
    if (grown.length >= CARD_PREFIX_MAX) break;
    grown += c;
    if (!taken.has(grown)) return grown;
  }
  for (let n = 2; ; n++) {
    const digits = String(n);
    const tried = base.slice(0, CARD_PREFIX_MAX - digits.length) + digits;
    if (!taken.has(tried)) return tried;
  }
}

// Every type's prefix by id: stored ones claim theirs first, in catalogue order (a repeat of one already claimed, or
// one that is not a prefix, is made instead), then each other type makes one from its name, in catalogue order. Worked
// out once per catalogue array: a catalogue is replaced, never changed, so every card of a board reads one map.
const resolved = new WeakMap<readonly ItemTypeDef[], ReadonlyMap<string, string>>();
export function prefixesOf(types: readonly ItemTypeDef[]): ReadonlyMap<string, string> {
  let map = resolved.get(types);
  if (map) return map;
  const out = new Map<string, string>();
  const taken = new Set<string>();
  for (const t of types) {
    const own = normalPrefix(t.prefix);
    if (own && !taken.has(own)) {
      out.set(t.id, own);
      taken.add(own);
    }
  }
  for (const t of types) {
    if (out.has(t.id)) continue;
    const made = autoPrefix(t.label, taken);
    out.set(t.id, made);
    taken.add(made);
  }
  map = out;
  resolved.set(types, map);
  return map;
}

export function prefixOf(types: readonly ItemTypeDef[], typeId: string): string | undefined {
  return prefixesOf(types).get(typeId);
}

// A card's number as people see it: "WI-100"; "#100" when its type is not in the catalogue (it draws as Item) or the
// plan has no types; "" for a number of none (a tour's practice card is key 0).
export function cardRef(
  item: { key: number; type: string },
  types: readonly ItemTypeDef[] | undefined,
): string {
  if (!(item.key > 0)) return '';
  const prefix = types ? prefixOf(types, item.type) : undefined;
  return prefix ? `${prefix}-${item.key}` : `#${item.key}`;
}

// Its ref when its type has a prefix ("WI-100"), else undefined: what a card carries to places that list cards from
// several plans, which show "#100" for none (item-types.md "Card number prefixes" "Across plans").
export function prefixedCardRef(
  item: { key: number; type: string },
  types: readonly ItemTypeDef[] | undefined,
): string | undefined {
  const ref = cardRef(item, types);
  return ref && !ref.startsWith('#') ? ref : undefined;
}

// Its ref, or "#0" for a card of no number: where a card is always named (a rule's run line, an agent's listing).
export function cardRefOrKey(
  item: { key: number; type: string },
  types: readonly ItemTypeDef[] | undefined,
): string {
  return cardRef(item, types) || `#${item.key}`;
}

// "WI-100 Fix login", or the title alone for a card with no number.
export function cardRefTitle(
  item: { key: number; type: string },
  title: string,
  types: readonly ItemTypeDef[] | undefined,
): string {
  const ref = cardRef(item, types);
  return ref ? `${ref} ${title}` : title;
}

// The number a ref names: "WI-100", "wi-100", "#WI-100", "#100" and "100" all name 100. The prefix is not checked,
// so a ref written before a prefix changed, or before its card changed type, still finds the card. Null otherwise.
const REF = /^#?(?:[A-Za-z][A-Za-z0-9]{0,5}-)?(\d{1,15})$/;
export function cardRefKey(text: string): number | null {
  const m = REF.exec(text.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// The other type in `types` whose prefix is `prefix` (ignoring case), or null: what refuses a prefix.
export function prefixOwner(
  types: readonly ItemTypeDef[],
  typeId: string,
  prefix: string,
): ItemTypeDef | null {
  const want = prefix.trim().toUpperCase();
  const map = prefixesOf(types);
  return types.find((t) => t.id !== typeId && map.get(t.id) === want) ?? null;
}

export const prefixTaken = (prefix: string, owner: Pick<ItemTypeDef, 'label'>) =>
  `${prefix.trim().toUpperCase()} is already ${owner.label}'s prefix. Pick another.`;

export const PREFIX_RULE = 'A prefix is 1 to 6 letters and digits, starting with a letter.';

// `after` with prefixes stored where a change would otherwise move one: a type new in `after` stores its own, and a
// type that had none stored and still has none, whose made prefix would differ from the one it read before (it was
// renamed, or a type before it was deleted or moved), stores the earlier one. A type whose stored prefix the change
// cleared goes back to its made one. Every other type is returned as it is (the same object). Clashes it does not
// settle: a prefix stored in this change over another type's made one pins that type's, and the catalogue check then
// refuses the pair.
export function withPinnedPrefixes(
  before: readonly ItemTypeDef[],
  after: readonly ItemTypeDef[],
): ItemTypeDef[] {
  const was = prefixesOf(before);
  const now = prefixesOf(after);
  const old = new Map(before.map((t) => [t.id, t]));
  return after.map((t): ItemTypeDef => {
    if (t.prefix !== undefined) return t;
    const prior = old.get(t.id);
    if (!prior) return { ...t, prefix: now.get(t.id)! };
    if (prior.prefix !== undefined) return t;
    const earlier = was.get(t.id)!;
    return earlier === now.get(t.id) ? t : { ...t, prefix: earlier };
  });
}
