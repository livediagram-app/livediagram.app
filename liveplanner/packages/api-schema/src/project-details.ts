// A plan's description (docs/specs/026-plan/plan-overview.md "The description"): plain text everyone who can open
// the plan reads on its Overview; and the Overview's own style ("The Overview's style"). Written by PUT /api/projects/:id/details, read with the project, and relayed to the
// plan's open editors as the room's `project-details` op. One normaliser for the api's write, the editor's save and an
// offline record, so the three never keep a different value.

import {
  DEFAULT_SCHEME_ID,
  THEMES,
  isBackgroundPattern,
  isSafeColourValue,
  resolveFontStack,
  type Tab,
} from '@liveplanner/project';

// The most characters (UTF-16 code units) a description keeps.
export const PROJECT_DESCRIPTION_MAX = 500;

// `raw` as stored: a string trimmed and capped (never cut inside a surrogate pair); anything else is empty.
export function readProjectDescription(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (trimmed.length <= PROJECT_DESCRIPTION_MAX) return trimmed;
  let cut = trimmed.slice(0, PROJECT_DESCRIPTION_MAX);
  const last = cut.charCodeAt(cut.length - 1);
  // A high surrogate at the end has lost its pair: drop it rather than keep half a character.
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return cut.trimEnd();
}

// The Overview's style (docs/specs/026-plan/plan-overview.md "The Overview's style"): the part of a tab's style a page
// can wear, each setting as a tab holds it. Null (none set) is the default, the plan's first tab's.
export type OverviewStyle = Partial<
  Pick<
    Tab,
    | 'theme'
    | 'backgroundPattern'
    | 'backgroundColor'
    | 'patternColor'
    | 'backgroundOpacity'
    | 'backgroundPatternScale'
    | 'backgroundAnimationSpeed'
    | 'font'
    | 'defaultTextSize'
  >
>;

// The sliders' ranges (CanvasStyleControls, the Text panel), so a stored value is one the panel could have set.
const NUMBER_RANGES = {
  backgroundOpacity: [0, 1],
  backgroundPatternScale: [0.5, 2],
  backgroundAnimationSpeed: [0.25, 3],
} as const;
const TEXT_PX = [6, 48] as const;
const TEXT_PRESETS: ReadonlySet<unknown> = new Set(['scale', 'sm', 'md', 'lg']);
// A colour is a CSS colour a tab could hold: short, and nothing that is not one (isSafeColourValue).
const COLOUR_MAX = 64;
const KNOWN_THEMES: ReadonlySet<string> = new Set([DEFAULT_SCHEME_ID, ...THEMES.map((t) => t.id)]);

const inRange = (v: unknown, [min, max]: readonly [number, number]): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isColour = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= COLOUR_MAX && isSafeColourValue(v);

// `raw` as stored: only the settings above, each checked (a known theme, pattern and font, a safe colour, a number in
// its slider's range, a text size preset or whole px); anything else is dropped. Null when nothing is left.
export function readOverviewStyle(raw: unknown): OverviewStyle | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const style: OverviewStyle = {};
  if (typeof r.theme === 'string' && KNOWN_THEMES.has(r.theme)) style.theme = r.theme;
  if (isBackgroundPattern(r.backgroundPattern)) style.backgroundPattern = r.backgroundPattern;
  if (isColour(r.backgroundColor)) style.backgroundColor = r.backgroundColor;
  if (isColour(r.patternColor)) style.patternColor = r.patternColor;
  for (const key of Object.keys(NUMBER_RANGES) as (keyof typeof NUMBER_RANGES)[]) {
    const v = r[key];
    if (inRange(v, NUMBER_RANGES[key])) style[key] = v;
  }
  if (typeof r.font === 'string' && resolveFontStack(r.font) !== undefined) style.font = r.font;
  const size = r.defaultTextSize;
  if (TEXT_PRESETS.has(size) || (inRange(size, TEXT_PX) && Number.isInteger(size)))
    style.defaultTextSize = size as NonNullable<OverviewStyle['defaultTextSize']>;
  return Object.keys(style).length > 0 ? style : null;
}

// PUT /api/projects/:id/details answers what it wrote, as stored: the description, the Overview's style, or both.
export type ProjectDetailsResponse = {
  description?: string;
  overviewStyle?: OverviewStyle | null;
};

// The room op a details write sends (a system kind: only the api sends it), carrying what the write changed.
export type ProjectDetailsRoomOp = {
  kind: 'project-details';
  description?: string;
  overviewStyle?: OverviewStyle | null;
};
