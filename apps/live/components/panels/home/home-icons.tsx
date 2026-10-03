// Home's marks (docs/specs/013-workspace/blueprints/explorer-home-view.md): what kind of action an
// expanded What happened row is. Drawn from the Timeline's own glyphs, so a comment, an edit or a
// share looks the same in Home and in All activity.

import type { HomeVerb, KnownTimelineEventType } from '@livediagram/api-schema';
import { Glyph } from '@livediagram/ui';
import { EVENT_GLYPH_PATHS } from '@/app/explorer/timeline/icons';

const glyphOf = (type: KnownTimelineEventType) => EVENT_GLYPH_PATHS[type] ?? '';

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
