import { describe, expect, it } from 'vitest';
import { SHAPE_KINDS } from '@livediagram/diagram';
import {
  ALL_PALETTE_TELEMETRY_TYPES,
  PALETTE_TELEMETRY_TYPES,
  TELEMETRY_TYPE_PATTERN,
} from '@livediagram/api-schema';
import { COMPONENT_TELEMETRY, elementTelemetryType } from './element-telemetry';

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

// Ask the editor what it emits, rather than restating the rule here.
//
// This used to be a hand-written override map "mirroring the one rule the
// creation paths use", and it drifted from that rule without a word: it listed
// seven camel-case tokens where elementTelemetryType only spelled out three.
// So the session button, reaction pad, comment pin and done check emitted
// 'Session-button' and friends while this file asserted the catalogue held
// 'SessionButton' — which it did. Every test below passed, and the Added count
// for four features was zero.
//
// A copy of the rule can only ever prove the copy agrees with the catalogue.
// Calling the real function is what makes these tests about the editor.
const tokenForShapeKind = (kind: string) =>
  elementTelemetryType({ type: 'shape', shape: kind } as unknown as Parameters<
    typeof elementTelemetryType
  >[0]);

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

  it('produces tokens the api will actually accept', () => {
    // The tests above prove the two ends agree on a token. They cannot prove
    // the token ever arrives: `type` is the one part of an event that is a
    // free string, checked at ingest against TELEMETRY_TYPE_PATTERN and
    // DROPPED SILENTLY when it fails. Nothing fails locally, the editor keeps
    // firing, and the metric simply reads zero.
    //
    // titleCaseType does not sanitise — it upper-cases the first character and
    // passes the rest through. Today every kind is lowercase and hyphenated so
    // the result is clean, but a kind with a slash, colon, or apostrophe would
    // be emitted and thrown away. Only apiErrorType was guarded this way; the
    // element census, which is what the dashboard's Palette ranking counts,
    // was not.
    const offenders = [...SHAPE_KINDS]
      .map(tokenForShapeKind)
      .filter((token) => !TELEMETRY_TYPE_PATTERN.test(token));
    expect(offenders).toEqual([]);

    // The dashboard catalogue is hand-written, so it can carry a token no
    // shape kind produces and no ingest would accept.
    const badCatalogue = ALL_PALETTE_TELEMETRY_TYPES.filter(
      (token) => !TELEMETRY_TYPE_PATTERN.test(token),
    );
    expect(badCatalogue).toEqual([]);

    // Guard against the check going vacuous if either source stops resolving.
    expect([...SHAPE_KINDS].length).toBeGreaterThan(40);
    expect(ALL_PALETTE_TELEMETRY_TYPES.length).toBeGreaterThan(40);
  });

  it('gives every NON-shape element kind a bucket too', () => {
    // The checks above walk SHAPE_KINDS, so they are blind to the element
    // types that are not shapes at all. `Video` sat outside the catalogue from
    // the day the element shipped for exactly that reason: six embed tiles
    // (YouTube / Vimeo / Loom / Figma / Google Docs / website) all create a
    // `video` element, all report `Video`, and the Palette ranking had no
    // bucket to put them in.
    //
    // Driven off elementTelemetryType so the list cannot be a copy that
    // agrees with itself. Freehand's variants (Highlighter / Polygon /
    // Polyline) come from its flags rather than its type, and are covered by
    // the tokens listed beside them.
    const nonShapeElements = [
      { type: 'arrow' },
      { type: 'text' },
      { type: 'sticky' },
      { type: 'image' },
      { type: 'table' },
      { type: 'link-card' },
      { type: 'video' },
      { type: 'annotation' },
      { type: 'freehand' },
    ];
    const missing = nonShapeElements
      .map((el) =>
        elementTelemetryType(el as unknown as Parameters<typeof elementTelemetryType>[0]),
      )
      .filter((token) => !ALL_PALETTE_TELEMETRY_TYPES.includes(token));
    expect(missing).toEqual([]);
  });

  it('gives every composite a bucket, though none is an element', () => {
    // The composites drop as a GROUP, so they never pass through
    // elementTelemetryType and both checks above miss them. Their tokens are
    // typed `Record<ComponentKind, string>`, so TypeScript makes you name one
    // for a new composite — and then says nothing about whether the dashboard
    // has anywhere to put it. That is the same shape as the `Video` hole: the
    // compiler enforcing the half that is easy to enforce.
    const missing = Object.entries(COMPONENT_TELEMETRY)
      .filter(([, token]) => !ALL_PALETTE_TELEMETRY_TYPES.includes(token))
      .map(([kind, token]) => `${kind} -> ${token}`);
    expect(missing).toEqual([]);
    expect(Object.keys(COMPONENT_TELEMETRY).length).toBeGreaterThan(5);
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
