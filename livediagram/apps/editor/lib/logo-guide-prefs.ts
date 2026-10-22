// How a person likes a logo page's construction guides (docs/specs/007-editor/logo-pages.md
// "Construction guides"): which of them show and how strongly. Synced preferences, like Show
// Guides itself; read through these helpers so a missing or stale value is the default.
import type { UserPreferences } from './user-preferences';

export type LogoGuidePart = 'centre' | 'diagonals' | 'safe' | 'circles' | 'square' | 'grid';

export const LOGO_GUIDE_PARTS: readonly { id: LogoGuidePart; label: string }[] = [
  { id: 'centre', label: 'Centre Lines' },
  { id: 'diagonals', label: 'Diagonals' },
  { id: 'safe', label: 'Safe Area' },
  { id: 'circles', label: 'Circles' },
  { id: 'square', label: 'Square' },
  { id: 'grid', label: 'Grid' },
];

export type LogoGuideStrength = 'faint' | 'medium' | 'strong';

export const LOGO_GUIDE_STRENGTHS: readonly { id: LogoGuideStrength; label: string }[] = [
  { id: 'faint', label: 'Faint' },
  { id: 'medium', label: 'Medium' },
  { id: 'strong', label: 'Strong' },
];

// Each strength's opacity for the guides, and for the grid (always fainter than the rest).
export const LOGO_GUIDE_ALPHA: Record<LogoGuideStrength, { guides: number; grid: number }> = {
  faint: { guides: 0.2, grid: 0.08 },
  medium: { guides: 0.35, grid: 0.15 },
  strong: { guides: 0.6, grid: 0.3 },
};

/** A part's telemetry token: its label without spaces ("CentreLines"), as the Settings rows send. */
export function logoGuidePartToken(part: LogoGuidePart): string {
  return LOGO_GUIDE_PARTS.find((p) => p.id === part)!.label.replace(/ /g, '');
}

const isPart = (v: unknown): v is LogoGuidePart => LOGO_GUIDE_PARTS.some((p) => p.id === v);

/** The guide parts that show: every part but the ones the person hid. */
export function readLogoGuideParts(prefs: UserPreferences): ReadonlySet<LogoGuidePart> {
  const hidden = new Set((prefs.logoGuidesHidden ?? []).filter(isPart));
  return new Set(LOGO_GUIDE_PARTS.map((p) => p.id).filter((id) => !hidden.has(id)));
}

/** The preferences with one part shown or hidden; none hidden is stored as absent. */
export function withLogoGuidePart(
  prefs: UserPreferences,
  part: LogoGuidePart,
  shown: boolean,
): UserPreferences {
  const hidden = new Set((prefs.logoGuidesHidden ?? []).filter(isPart));
  if (shown) hidden.delete(part);
  else hidden.add(part);
  const { logoGuidesHidden: _drop, ...rest } = prefs;
  void _drop;
  const list = LOGO_GUIDE_PARTS.map((p) => p.id).filter((id) => hidden.has(id));
  return list.length ? { ...rest, logoGuidesHidden: list } : rest;
}

export function readLogoGuideStrength(prefs: UserPreferences): LogoGuideStrength {
  const v = prefs.logoGuideStrength;
  return v === 'faint' || v === 'strong' ? v : 'medium';
}
