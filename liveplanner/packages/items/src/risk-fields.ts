// Risk fields (docs/specs/026-plan/item-types.md "Risk"): one of four fixed levels, most pressing first, built in as
// Priority is, so every plan spells, orders and colours risk the same way. The colours sit beside Priority's in
// packages/project plan-palette.ts (RISK_COLOURS). Pure.

export const RISKS = ['critical', 'high', 'medium', 'low'] as const;
export type Risk = (typeof RISKS)[number];

export const RISK_LABELS: Readonly<Record<Risk, string>> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const RISK_HINT = 'Pick Critical, High, Medium or Low';

export function isRisk(v: unknown): v is Risk {
  return typeof v === 'string' && (RISKS as readonly string[]).includes(v);
}

// A level from its id or its name, as a person or a file writes it ("High", " critical "); undefined for anything else.
export function riskOf(text: unknown): Risk | undefined {
  if (typeof text !== 'string') return undefined;
  const t = text.trim().toLowerCase();
  return isRisk(t) ? t : undefined;
}

// A stored level's name ("High"), or null for no level.
export function riskLabel(v: unknown): string | null {
  return isRisk(v) ? RISK_LABELS[v] : null;
}

// How pressing a stored level is, Low 0 to Critical 3, so a higher rank sorts as more pressing; undefined for none.
export function riskRank(v: unknown): number | undefined {
  return isRisk(v) ? RISKS.length - 1 - RISKS.indexOf(v) : undefined;
}
