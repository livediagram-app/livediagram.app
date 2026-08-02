// Arrow type definitions (anchors, endpoints, arrowheads, the ArrowElement
// itself), split out of index.ts the same way element-types.ts was and for the
// same reason: index.ts is the package's public surface plus the shared
// domain enums, and the two element families had grown past what one file
// should carry.
//
// Pure types; re-exported through index.ts so the public
// `@livediagram/diagram` surface is unchanged.

import type { ArrowFlow, ElementId, ElementLink, TextSize } from './index';
import type { ArrowheadShape, ArrowheadSize, ArrowStyle } from './arrow-style';
import type { AnimationSpeed } from './animation';
import type { BorderStyle } from './border-style';

export type Anchor = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export const ALL_ANCHORS: Anchor[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

export type Endpoint =
  | { kind: 'free'; x: number; y: number }
  // `manual` marks an anchor the user set by hand (dragging the endpoint
  // onto that face). The auto-rebind that re-chooses faces as boxes move
  // (`rebindArrowAnchorsAfterMove`) leaves a manual endpoint fixed, so a
  // deliberate correction sticks. Absent === auto-managed (the default).
  | { kind: 'pinned'; elementId: ElementId; anchor: Anchor; manual?: boolean }
  // Connected to a point ALONG another arrow's line (spec/50) — `t` is the
  // parametric position (0 = the target arrow's `from`, 1 = its `to`). The
  // position resolves dynamically from the target arrow's centreline, so it
  // tracks the target as it moves / reshapes (e.g. sequence-diagram messages
  // attached to a lifeline arrow). Resolved by `endpointPosition`.
  | { kind: 'on-arrow'; arrowId: ElementId; t: number }
  // Pinned to a GROUP's union bounding box (spec/09 group quick-connect):
  // resolves dynamically as the `anchor` point of the live union bounds of
  // every member sharing `groupId`, so the arrow tracks the group as it
  // moves / resizes / gains or loses members. Ungrouping (or deleting the
  // group's last member) converts these ends to `free` at their last
  // position — see `ungroup` / `freezeDanglingGroupEnds` in groups.ts.
  | { kind: 'pinned-group'; groupId: ElementId; anchor: Anchor };

// Which endpoint(s) of an arrow get an arrowhead marker. 'to' (default)
// is the conventional one-way arrow; 'from' flips it; 'both' makes a
// two-headed connector. There's no 'none' yet — a line with no
// direction is rare enough to defer.
export type ArrowEnds = 'from' | 'to' | 'both' | 'none';

export type ArrowElement = {
  id: ElementId;
  type: 'arrow';
  // Layer membership (spec/74) — see ShapeElement.layerId.
  layerId?: string;
  from: Endpoint;
  to: Endpoint;
  locked?: boolean;
  // Stroke colour for the line + arrowhead. Falls through to the
  // default arrow slate when unset. There's no fill or text on an
  // arrow so this is the only colour field.
  strokeColor?: string;
  opacity?: number; // 0..1, defaults to 1
  link?: ElementLink;
  arrowEnds?: ArrowEnds;
  // Stroke width in px. Defaults to the medium preset when unset so
  // existing arrows render unchanged. Presets surface via the Palette;
  // the underlying field is a free number so future inputs (sliders,
  // numeric entry) work without a schema migration.
  strokeWidth?: number;
  // Line pattern preset (solid / dashed / dotted). Shares the
  // BorderStyle union with the shape Border accordion so a future
  // pattern addition lands on both. Defaults to 'solid' (no
  // dasharray) so existing arrows render unchanged.
  strokeStyle?: BorderStyle;
  // Arrowhead size preset. Lives separately from `strokeWidth` so a
  // thin line can carry a chunky arrowhead and vice versa. Snapped
  // to a named preset for the toggle UI (see `arrowheadSizeOf`).
  arrowheadSize?: ArrowheadSize;
  // Arrowhead head SHAPE preset (filled triangle / hollow triangle /
  // open V / dot / diamond ...). Independent of size + ends so a UML
  // diagram can pair a hollow triangle (inheritance) or diamond
  // (aggregation / composition) with any line weight. Defaults to the
  // filled triangle so arrows authored before the field render
  // unchanged (see `arrowheadShapeOf`).
  arrowheadShape?: ArrowheadShape;
  // Path shape. 'straight' is the default and matches every arrow
  // authored before the field existed. 'curved' bows the line out
  // perpendicular to the from→to chord (smooth quadratic Bezier).
  // 'angled' renders the connector as an axis-aligned L-shape with
  // a single right-angle bend. See `arrowStyleOf`.
  arrowStyle?: ArrowStyle;
  // Route behind intervening boxes (spec/90): where the line would cross an
  // unrelated box it breaks a short distance before it and resumes on the far
  // side, so a dense parent-to-children fan doesn't draw arrows over the
  // boxes between. Absent = ON: this is the default reading for an arrow, and
  // `false` is the explicit opt-out for the cases where crossing is wanted.
  routeBehind?: boolean;
  // Flowing-arrow animation (spec/09): marching dashes or a travelling dot
  // along the path to show flow direction. Undefined = static.
  flow?: ArrowFlow;
  // Speed of `flow` (multiplier on its base duration). Default 'slow'
  // (DEFAULT_ANIMATION_SPEED).
  flowSpeed?: AnimationSpeed;
  // Whether `flow` loops. Undefined / true = loop forever (the default);
  // false = play once and hold.
  flowRepeat?: boolean;
  // Optional override for the curve control point. Stored as a
  // delta from the chord midpoint (canvas coords) so the curve
  // translates with the arrow when an endpoint moves: the chord
  // midpoint shifts, the offset stays the same, and the user's
  // chosen bow direction + magnitude is preserved. Only consulted
  // when `arrowStyle === 'curved'`; the auto perpendicular bow is
  // used whenever this field is absent so existing curved arrows
  // render unchanged. Setting it back to undefined "resets" the
  // curve to its default shape.
  curveOffset?: { dx: number; dy: number };
  // Optional extra control points for a multi-bend curve (spec/09). Each is
  // a delta from the chord midpoint (canvas coords), like `curveOffset`, so
  // the whole curve translates with the arrow when an endpoint moves. When
  // present (and `arrowStyle === 'curved'`) the curve is a smooth spline
  // through from -> these points -> to, letting the user click the line to
  // add bends rather than being stuck with a single bow. Absent or empty =
  // the single-control-point behaviour above. `curveOffset` is treated as
  // the first point when this is absent, so existing curved arrows are
  // unchanged.
  curvePoints?: { dx: number; dy: number }[];
  // Optional override for the angled-arrow elbow position. Stored
  // as a delta from the auto-computed elbow (the right-angle corner
  // a default angled arrow draws at `(to.x, from.y)` or `(from.x,
  // to.y)`). Lets the user drag the visible elbow handle to bend
  // the arrow somewhere other than the default corner. Only
  // consulted when `arrowStyle === 'angled'`; the auto right-angle
  // applies when this field is absent so existing angled arrows
  // render unchanged.
  elbowOffset?: { dx: number; dy: number };
  // Optional label rendered next to the arrow's midpoint. Empty /
  // missing → no label is drawn. Double-click on the arrow opens an
  // inline editor for this field. When `labelOffset` is absent the
  // placement is computed at render time to dodge nearby boxed
  // elements (right → below → left → above of midpoint).
  label?: string;
  // Optional user-chosen label placement: `t` is the position along
  // the line (0..1 by arc length), `offset` the signed perpendicular
  // distance from the line (positive = left of travel, negative =
  // right) so the label can sit on either side. Set by dragging the
  // label; absent → the auto midpoint placement above. Translates
  // with the arrow because it's parameterised against the line, not
  // stored as absolute coords.
  labelOffset?: { t: number; offset: number };
  // Optional label-text formatting, mirroring the boxed-element fields so
  // an arrow's label can be sized / styled / coloured / fonted from the
  // Selected Element panel's Text accordion. All optional: absent → the
  // label renders at the default small (12px) size in the arrow's stroke
  // colour. Alignment + padding don't apply (the label sits at the
  // midpoint), so those fields are intentionally omitted.
  textSize?: TextSize;
  textBold?: boolean;
  textItalic?: boolean;
  textUnderline?: boolean;
  textStrikethrough?: boolean;
  // Label colour, independent of `strokeColor` (the line). Falls back to
  // the stroke colour when unset so the label matches the line by default.
  textColor?: string;
  font?: string;
};
