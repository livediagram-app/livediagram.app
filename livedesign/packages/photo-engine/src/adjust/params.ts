// Reading an adjustment's stored settings within their bounds (docs/specs/031-photo/
// photo-adjustments.md "The adjustments"): a value missing or out of range is the default.
type Rec = Record<string, unknown>;

export const isRec = (v: unknown): v is Rec =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function num(p: unknown, key: string, min: number, max: number, def: number): number {
  const v = isRec(p) ? p[key] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
}

export function bool(p: unknown, key: string, def: boolean): boolean {
  const v = isRec(p) ? p[key] : undefined;
  return typeof v === 'boolean' ? v : def;
}

export function rec(p: unknown, key: string): Rec {
  const v = isRec(p) ? p[key] : undefined;
  return isRec(v) ? v : {};
}

export function hex(p: unknown, key: string, def: string): string {
  const v = isRec(p) ? p[key] : undefined;
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : def;
}

export function oneOf<T extends string>(p: unknown, key: string, options: readonly T[], def: T): T {
  const v = isRec(p) ? p[key] : undefined;
  return typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : def;
}
