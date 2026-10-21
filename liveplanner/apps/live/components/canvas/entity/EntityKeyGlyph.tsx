import {
  ENTITY_KEY_GLYPH_PATHS,
  ENTITY_KEY_GLYPH_PX,
  ENTITY_KEY_GLYPH_STEP_PX,
  ENTITY_KEY_GLYPH_STROKE,
  ENTITY_PRIMARY_KEY_INK,
  entityKeyGlyphs,
  type EntityKey,
} from '@liveplanner/document';

// A field's key in the gutter (docs/specs/009-elements/entity.md "How it looks"): the same glyphs the export
// draws (entity-look.ts). A primary key's is amber; a link or a U takes the row's ink, muted.
export function EntityKeyGlyph({
  fieldKey,
  color,
  muted = false,
}: {
  fieldKey: EntityKey;
  color: string;
  // Every glyph in `color`, the primary key's amber included: a placeholder for "no key yet".
  muted?: boolean;
}) {
  const glyphs = entityKeyGlyphs(fieldKey);
  return (
    <svg
      aria-hidden
      width={ENTITY_KEY_GLYPH_PX + (glyphs.length - 1) * ENTITY_KEY_GLYPH_STEP_PX}
      height={ENTITY_KEY_GLYPH_PX}
      viewBox={`0 0 ${ENTITY_KEY_GLYPH_PX + (glyphs.length - 1) * ENTITY_KEY_GLYPH_STEP_PX} ${ENTITY_KEY_GLYPH_PX}`}
      fill="none"
      strokeWidth={ENTITY_KEY_GLYPH_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {glyphs.map((g, i) => (
        <path
          key={g}
          d={ENTITY_KEY_GLYPH_PATHS[g]}
          transform={`translate(${i * ENTITY_KEY_GLYPH_STEP_PX} 0)`}
          stroke={g === 'key' && !muted ? ENTITY_PRIMARY_KEY_INK : color}
          opacity={g === 'key' && !muted ? 1 : 0.7}
        />
      ))}
    </svg>
  );
}
