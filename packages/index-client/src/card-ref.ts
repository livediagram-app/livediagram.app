// A card's number as places that list cards from several items show it (one-explorer-contracts.md "What an item
// pushes"; liveplanner/docs/specs/026-plan/item-types.md "Card number prefixes" "Across plans"): the prefixed `ref`
// its app pushed ("WI-100"), else "#100" for a card pushed before refs, or by an app with no prefixes.

// A ref as an app makes it: a prefix of 1 to 6 upper-case letters and digits starting with a letter, then its number.
const CARD_REF = /^[A-Z][A-Z0-9]{0,5}-(\d{1,15})$/;

/** `value` when it is a well-formed ref of card `key`, else undefined: what the index keeps of a pushed `ref`. */
export function cardRefFor(value: unknown, key: number | null): string | undefined {
  if (typeof value !== 'string' || key === null) return undefined;
  const m = CARD_REF.exec(value);
  return m && Number(m[1]) === key ? value : undefined;
}

/** "WI-100", "#100", or null for a card with no number. */
export function cardNumber(card: { key: number | null; ref?: string | undefined }): string | null {
  if (card.key === null) return null;
  return card.ref ?? `#${card.key}`;
}
