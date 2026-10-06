// The shape checks every reader in this package validates stored JSON with.

// A plain object: not null, not an array.
export function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

// A `#rrggbb` colour, either case.
export const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;
