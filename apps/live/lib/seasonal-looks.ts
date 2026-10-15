// Seasonal looks (docs/specs/011-theme/canvas-and-theme-dialog.md "Seasonal looks"): looks for New Year, Easter,
// Halloween and Christmas, kept out of the everyday carousel and shown only behind its Seasonal toggle. Each wears a
// seasonal theme and, mostly, a seasonal pattern, neither of which any picker lists. Every season is on offer all
// year; the season on now, or the next one coming, leads.
import type { TabLook } from '@/lib/tab-looks';

export type Season = 'new-year' | 'easter' | 'halloween' | 'christmas';

export const SEASON_LABELS: Record<Season, string> = {
  'new-year': 'New Year',
  easter: 'Easter',
  halloween: 'Halloween',
  christmas: 'Christmas',
};

/** The seasonal looks, grouped by season in calendar order; `seasonalLooksFor` reorders the seasons for a date. */
export const SEASONAL_LOOKS: readonly (TabLook & { season: Season })[] = [
  {
    id: 'countdown',
    season: 'new-year',
    label: 'Countdown',
    description: 'Sparkle, Professional, Abril, sparkles',
    theme: 'sparkle',
    finish: 'professional',
    font: 'abril-fatface',
    pattern: 'sparkles',
    patternOpacity: 0.7,
  },
  {
    id: 'egg-hunt',
    season: 'easter',
    label: 'Egg Hunt',
    description: 'Spring, Flexible, Nunito, eggs',
    theme: 'spring',
    finish: 'flexible',
    font: 'nunito',
    pattern: 'eggs',
    patternOpacity: 0.7,
  },
  {
    id: 'haunted',
    season: 'halloween',
    label: 'Haunted',
    description: 'Pumpkin, Sketch, marker pen, cobwebs',
    theme: 'pumpkin',
    finish: 'sketch',
    font: 'permanent-marker',
    pattern: 'cobwebs',
    patternOpacity: 0.7,
  },
  {
    id: 'christmas-morning',
    season: 'christmas',
    label: 'Christmas Morning',
    description: 'Yuletide, Flexible, Lora, candy stripes',
    theme: 'yuletide',
    finish: 'flexible',
    font: 'lora',
    pattern: 'candy-stripes',
    patternOpacity: 0.3,
  },
  {
    id: 'winter-wonderland',
    season: 'christmas',
    label: 'Winter Wonderland',
    description: 'Frost, Sketch, Caveat, snowflakes',
    theme: 'frost',
    finish: 'sketch',
    font: 'caveat',
    pattern: 'snowflakes',
    patternOpacity: 0.8,
  },
  {
    id: 'fireside',
    season: 'christmas',
    label: 'Fireside',
    description: 'Evergreen, Professional, slab serif, drift',
    theme: 'evergreen',
    finish: 'professional',
    font: 'roboto-slab',
    pattern: 'drift',
    patternOpacity: 0.6,
  },
];

/** The last day each season leads, as [month 0-11, day] in a year; Easter's moves, so it is worked out per year. */
const SEASON_ENDS: Record<Exclude<Season, 'easter'>, [number, number]> = {
  // The first week of January still feels like New Year.
  'new-year': [0, 7],
  halloween: [9, 31],
  // Boxing Day, then New Year takes over.
  christmas: [11, 26],
};

/** Easter Sunday in the Gregorian calendar (the anonymous Gregorian algorithm), as a local date. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

// The season's last leading day in `year`: Easter runs to Easter Monday.
function seasonEnd(season: Season, year: number): Date {
  if (season === 'easter') {
    const sunday = easterSunday(year);
    return new Date(year, sunday.getMonth(), sunday.getDate() + 1);
  }
  const [month, day] = SEASON_ENDS[season];
  return new Date(year, month, day);
}

/** The seasons in the order they come round from `now` (local time): the one on now, or the next, first. */
export function seasonOrder(now: Date): Season[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextEnd = (season: Season) => {
    const end = seasonEnd(season, today.getFullYear());
    return end >= today ? end : seasonEnd(season, today.getFullYear() + 1);
  };
  return (Object.keys(SEASON_LABELS) as Season[])
    .map((season) => ({ season, end: nextEnd(season).getTime() }))
    .sort((x, y) => x.end - y.end)
    .map(({ season }) => season);
}

/** The seasonal looks for `now`: the leading season's first, then the rest as they come round. */
export function seasonalLooksFor(now: Date): (TabLook & { season: Season })[] {
  return seasonOrder(now).flatMap((season) => SEASONAL_LOOKS.filter((l) => l.season === season));
}
