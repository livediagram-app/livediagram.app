import { describe, expect, it } from 'vitest';
import { SHAPE_KINDS } from '@livediagram/diagram';
import { ALL_PALETTE_TELEMETRY_TYPES, PALETTE_TELEMETRY_TYPES } from '@livediagram/api-schema';
import { titleCaseType } from './telemetry';

// Completeness guard for the palette census (spec/22, issue #30).
//
// `Element·Added·<type>` is what the public dashboard's Palette ranking is
// built from, and the two ends have to agree exactly: the editor picks the
// token, the dashboard buckets by it. A token in one but not the other is
// invisible in the worst way — emitted, validated, stored, and simply never
// rendered. That is not hypothetical: the dashboard expected `Code-block`
// long after the editor settled on `CodeBlock`.
//
// This test lives in apps/live because it is the only workspace that depends
// on BOTH the element model and the telemetry vocabulary. Adding a shape kind
// without a home in the catalogue fails here rather than silently producing
// an event nobody ever sees.

// The tokens the editor derives from a shape kind, mirroring the one rule
// the creation paths use: title-case the kind, except the special cases.
const SHAPE_KIND_OVERRIDES: Record<string, string> = {
  // titleCaseType only capitalises the first character, so this would be
  // 'Code-block' — the Changed events already say 'CodeBlock'.
  'code-block': 'CodeBlock',
  // Same hyphen problem (spec/103).
  'mode-button': 'ModeButton',
  // And again for the session button (spec/105).
  'session-button': 'SessionButton',
  // And the mind node (spec/118).
  'mind-node': 'MindNode',
  // And the reaction pad (spec/135).
  'reaction-pad': 'ReactionPad',
  // And the comment pin (spec/136).
  'comment-pin': 'CommentPin',
  // And the done check (spec/137).
  'done-check': 'DoneCheck',
};

const tokenForShapeKind = (kind: string) => SHAPE_KIND_OVERRIDES[kind] ?? titleCaseType(kind);

describe('palette telemetry coverage', () => {
  it('gives every shape kind a bucket in the dashboard catalogue', () => {
    const missing = [...SHAPE_KINDS]
      .map(tokenForShapeKind)
      .filter((token) => !ALL_PALETTE_TELEMETRY_TYPES.includes(token));
    // A failure here means the editor can emit an Element·Added type the
    // /telemetry Palette view will never show. Add it to
    // PALETTE_TELEMETRY_TYPES in packages/api-schema.
    expect(missing).toEqual([]);
  });

  it('has no stale token that no shape kind can produce', () => {
    // Tokens that aren't shape kinds at all — tools, components, devices and
    // the icon buckets — are listed here so the check below can tell a
    // legitimately non-shape token from a typo'd shape one.
    const nonShape = new Set<string>([
      ...PALETTE_TELEMETRY_TYPES.tools,
      ...PALETTE_TELEMETRY_TYPES.components,
      ...PALETTE_TELEMETRY_TYPES.devices,
      ...PALETTE_TELEMETRY_TYPES.icons,
    ]);
    const producible = new Set([...SHAPE_KINDS].map(tokenForShapeKind));
    const stale = PALETTE_TELEMETRY_TYPES.shapes.filter(
      (token) => !producible.has(token) && !nonShape.has(token),
    );
    expect(stale).toEqual([]);
  });

  it('lists no token twice across the buckets', () => {
    const seen = new Set<string>();
    const duplicated: string[] = [];
    for (const token of ALL_PALETTE_TELEMETRY_TYPES) {
      if (seen.has(token)) duplicated.push(token);
      seen.add(token);
    }
    // A token in two buckets would be double-counted in the ranking.
    expect(duplicated).toEqual([]);
  });
});
