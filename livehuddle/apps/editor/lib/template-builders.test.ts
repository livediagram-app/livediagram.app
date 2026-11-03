import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import type { TemplateKind } from '@livehuddle/templates';
import { buildTemplate } from './template-builders';

// `buildTemplate` is the dispatch that turns a TemplateKind into the
// starting elements when the user picks a template (docs/specs/008-canvas/canvas-and-palette.md's
// picker). Each builder is documented as "pure: takes a centre
// (cx, cy) and returns a fresh array of Element". A regression in
// any one builder where elements hardcode (0, 0) instead of using
// (cx, cy) would drop the template off-centre on the canvas (the
// picker passes the viewport centre as cx/cy on every selection).
// One translation-invariance test covers every builder at once.

// Every TemplateKind listed here. Adding a kind to templates.ts
// without adding it here would let a new builder ship without
// translation-invariance coverage. The two checks below catch the
// drift at compile time:
//   - `satisfies readonly TemplateKind[]` guarantees every entry IS
//     a TemplateKind (catches typos in this list).
//   - The `MissingFromAllKinds` type computes the set of
//     TemplateKinds NOT in ALL_KINDS; the type assertion below
//     fails to compile when that set is non-empty.
// The previous wording claimed `satisfies` alone enforced
// exhaustiveness, which was wrong: `satisfies` only checks the
// other direction. `logo-design` slipped past the check that way.
const ALL_KINDS = [
  'retrospective',
  'swot',
  'journey',
  'prioritization-matrix',
  'roadmap',
  'raci-matrix',
  'user-story-map',
  'affinity-map',
  'lean-coffee',
  'pub-quiz',
  'icebreaker-questions',
  'virtual-office',
  'coworking-space',
  'team-pod',
  'all-hands-hall',
  'two-truths-and-a-lie',
  'would-you-rather',
  'people-bingo',
  'brainstorm',
  'workshop-board',
  'town-hall',
  'business-model-canvas',
  'empathy-map',
  'start-stop-continue',
  'mad-sad-glad',
  'four-ls',
  'sailboat',
  'incident-postmortem',
  'opportunity-solution-tree',
  'crazy-eights',
  'stakeholder-map',
  'risk-matrix',
  'value-proposition-canvas',
  'user-persona',
  'meeting-agenda',
  'objectives-planner',
  'pestle-analysis',
  'kwl-chart',
  'blank-session',
] as const satisfies readonly TemplateKind[];

// Real exhaustiveness check: any TemplateKind missing from
// ALL_KINDS surfaces as a non-`never` type and the assignment
// below stops compiling. The `void` discards the unused binding
// without tripping the lint rule.
type MissingFromAllKinds = Exclude<TemplateKind, (typeof ALL_KINDS)[number]>;
const _allKindsExhaustive: [MissingFromAllKinds] extends [never] ? true : never = true;
void _allKindsExhaustive;

// Every numeric coordinate carried by an element. For boxed
// elements (shape / text / sticky / image) that's (x, y). For
// arrows it's whichever endpoints are 'free' (pinned endpoints
// reference an element id rather than a coordinate, so they
// translate automatically when their target shape moves). Returned
// as an array so the assertions can iterate without knowing which
// shape an element is.
function coordsOf(el: Element): { x: number; y: number }[] {
  if (el.type === 'arrow') {
    const out: { x: number; y: number }[] = [];
    if (el.from.kind === 'free') out.push({ x: el.from.x, y: el.from.y });
    if (el.to.kind === 'free') out.push({ x: el.to.x, y: el.to.y });
    return out;
  }
  return [{ x: el.x, y: el.y }];
}

describe('buildTemplate translation invariance', () => {
  // For each kind, building at (Δx, Δy) must produce the same
  // element shapes as building at (0, 0) and shifting every
  // coordinate by (Δx, Δy). Asymmetric values intentionally so a
  // builder that swaps x/y or zeroes one axis fails loudly.
  const DX = 137;
  const DY = -421;

  // The blank, Blank Space, is intentionally empty (no seeded element, docs/specs/007-editor/new-document-route.md),
  // so it has no coordinates to shift: excluded from this invariance check (it stays in ALL_KINDS above for the
  // exhaustiveness assertion).
  it.each(ALL_KINDS.filter((k) => k !== 'blank-session'))(
    '%s: every coordinate shifts by (cx, cy)',
    (kind) => {
      const atOrigin = buildTemplate(kind, 0, 0);
      const atOffset = buildTemplate(kind, DX, DY);

      expect(atOffset.length).toBe(atOrigin.length);
      expect(atOrigin.length).toBeGreaterThan(0);

      for (let i = 0; i < atOrigin.length; i++) {
        const a = atOrigin[i]!;
        const b = atOffset[i]!;
        // Element types stay aligned (a 'shape' at position N stays
        // a 'shape' at position N regardless of the centre): the
        // builder is a pure function of (kind, cx, cy).
        expect(b.type).toBe(a.type);

        const ca = coordsOf(a);
        const cb = coordsOf(b);
        expect(cb.length).toBe(ca.length);
        for (let j = 0; j < ca.length; j++) {
          // toBeCloseTo (not toBe) because trig-based builders
          // (mindmap branches, flywheel sectors) introduce IEEE 754
          // rounding when the same trig terms get added in different
          // orders. The contract is "shift by (cx, cy)", not "shift
          // by exactly (cx, cy) bit-for-bit". Five-decimal precision
          // is well below sub-pixel and well above floating drift.
          expect(cb[j]!.x - ca[j]!.x).toBeCloseTo(DX, 5);
          expect(cb[j]!.y - ca[j]!.y).toBeCloseTo(DY, 5);
        }
      }
    },
  );

  it.each(ALL_KINDS)('%s: returns a fresh array per call (no shared mutable state)', (kind) => {
    // Builders are documented as pure, returning "a fresh array of
    // Element". A future revision that memoised or returned a
    // module-level constant would silently let one document's edits
    // leak into another template instantiation. Asserting distinct
    // references rules that out.
    const a = buildTemplate(kind, 0, 0);
    const b = buildTemplate(kind, 0, 0);
    expect(a).not.toBe(b);
    expect(a.length).toBe(b.length);
    if (a.length > 0) expect(a[0]).not.toBe(b[0]);
  });
});
