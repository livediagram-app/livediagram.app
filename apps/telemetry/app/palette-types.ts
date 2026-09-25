import { PALETTE_TELEMETRY_TYPES } from '@livediagram/api-schema';
import type { TypeAliases } from './rank';

// The palette's element kinds as the dashboard reads them (spec/22): the
// shared catalogue's tabs, plus the old spellings to fold in. Shared by the
// Palette tab's rankings and the Elements Added stack's per-tab charts, so
// both bucket an element the same way.

// Element·Added types the editor used to send hyphenated, before it settled on
// the catalogue tokens. Stored rows keep their old spelling until the 60-day
// retention sweep drops them, so the ranking folds them into today's token
// rather than showing each thing twice (or, for a kind the catalogue lists
// only under its new name, not at all). Safe to delete once no stored row is
// older than the emitter fix.
export const PALETTE_TYPE_ALIASES: TypeAliases = {
  'Mind-node': 'MindNode',
  'Session-button': 'SessionButton',
  'Comment-pin': 'CommentPin',
  'Done-check': 'DoneCheck',
  'Reaction-pad': 'ReactionPad',
  'Mode-button': 'ModeButton',
  'Action-card': 'ActionPanel',
  'Code-block': 'CodeBlock',
};

/** An Element·Added type as the catalogue spells it today. */
export const canonicalElementType = (type: string | null): string =>
  type === null ? '' : (PALETTE_TYPE_ALIASES[type] ?? type);

export type PaletteTab = keyof typeof PALETTE_TELEMETRY_TYPES;

/** Every kind the palette catalogue lists, across its tabs. */
export const PALETTE_KINDS: ReadonlySet<string> = new Set(
  Object.values(PALETTE_TELEMETRY_TYPES).flat(),
);

// The canvas selection modes (useCanvasTool's `Canvas·Used` tokens). Other
// Canvas·Used events are not modes a person selects: InsertBetween is a drag
// gesture and FollowMe is pinning your view to a peer's (it has its own card
// on the Collaboration tab), so the ranking names the modes it counts.
export const SELECTION_MODES: readonly string[] = [
  'Laser',
  'Spotlight',
  'Eraser',
  'Highlighter',
  'FormatPainter',
  'Isometric',
  'AvatarMode',
];
