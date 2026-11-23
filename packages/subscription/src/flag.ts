// The one switch Pro sits behind (subscription.md "The flag"). Off by default: a deployment that sets nothing has no
// tiers, no limits beyond the legacy caps and no Pro UI.

/** Whether a `PRO_ENABLED` (or `NEXT_PUBLIC_PRO_ENABLED`) value turns Pro on: `true`, `1` or `on`, any case. */
export function proEnabled(value: string | undefined | null): boolean {
  if (typeof value !== 'string') return false;
  const flag = value.trim().toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'on';
}
