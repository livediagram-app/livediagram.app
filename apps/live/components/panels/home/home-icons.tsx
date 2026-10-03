// Home's marks (docs/specs/013-workspace/blueprints/explorer-home-view.md): what happened on a
// Timeline entry and what kind of action an expanded What happened row is. Drawn from the
// Timeline's own glyphs, so a comment, an edit or a share looks the same in both places.

import type { HomeTimelineKind, HomeVerb, KnownTimelineEventType } from '@livediagram/api-schema';
import { Glyph } from '@livediagram/ui';
import { EVENT_GLYPH_PATHS } from '@/app/explorer/timeline/icons';

const glyphOf = (type: KnownTimelineEventType) => EVENT_GLYPH_PATHS[type] ?? '';

const KIND_PATHS: Readonly<Record<HomeTimelineKind, string>> = {
  created: glyphOf('document_created'),
  updated: glyphOf('document_edited'),
  opened: glyphOf('document_opened_by_visitor'),
};

const VERB_PATHS: Readonly<Record<HomeVerb, string>> = {
  commented: glyphOf('comment_added'),
  // The Timeline's curved back-arrow, read here as "reply".
  replied: glyphOf('team_document_removed'),
  resolved: glyphOf('comment_resolved'),
  edited: glyphOf('document_edited'),
  assigned_you: glyphOf('action_assigned'),
  assigned: glyphOf('action_assigned'),
  completed: glyphOf('action_completed'),
  shared: glyphOf('team_document_added'),
};

/** The kind's tone: a ring and glyph colour, always beside its own glyph, never alone. */
export const KIND_TONES: Readonly<Record<HomeTimelineKind, string>> = {
  created: 'text-emerald-600 ring-emerald-600 dark:text-emerald-400 dark:ring-emerald-400',
  updated: 'text-sky-600 ring-sky-600 dark:text-sky-400 dark:ring-sky-400',
  opened: 'text-slate-500 ring-slate-400 dark:text-slate-400 dark:ring-slate-500',
};

export function KindGlyph({ kind, size = 12 }: { kind: HomeTimelineKind; size?: number }) {
  return (
    <Glyph size={size} units={24}>
      <path d={KIND_PATHS[kind]} />
    </Glyph>
  );
}

export function VerbGlyph({ verb, size = 14 }: { verb: HomeVerb; size?: number }) {
  return (
    <Glyph size={size} units={24}>
      <path d={VERB_PATHS[verb]} />
    </Glyph>
  );
}

export function ChevronGlyph({ size = 16 }: { size?: number }) {
  return (
    <Glyph size={size} units={16}>
      <path d="M4 6l4 4 4-4" />
    </Glyph>
  );
}
