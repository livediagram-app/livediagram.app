// The element-schema MCP resource and the server instructions (docs/specs/015-api/mcp-server.md §4.5): the element
// format as facts, carried inline on every tool argument that takes elements (ELEMENT_SCHEMA_HINT), with its
// vocabularies from packages/design. Split out of schema.ts (the tools' zod input shapes), which re-exports
// SCHEMA_RESOURCE_URI, elementSchemaDoc and SERVER_INSTRUCTIONS.
import {
  ANCHORS,
  BADGE_LABEL_MAX,
  CARD_TAGS_MAX,
  ELEMENT_FIELD_VALUES,
  GREY_PEN_COLOUR,
  INK_PEN_COLOUR,
  PEN_COLOUR_NAMES,
  CODE_LANGUAGES,
  CODE_MAX_LENGTH,
  CODE_THEMES,
  ELEMENT_TYPES,
  SANKEY_LINK_COLORS,
  SANKEY_MAX_FLOWS,
  SANKEY_NAME_MAX,
  SANKEY_UNIT_MAX,
  SANKEY_VALUE_LABELS,
  RETIRED_SHAPE_KINDS,
  SHAPE_KINDS,
  STEP_LABEL_MAX,
  STICKY_PRESETS,
  TEXT_PRESET_LIST,
  THEMES,
} from '@livedesign/design';

export const SCHEMA_RESOURCE_URI = 'livedesign://schema/elements';

const types = [...ELEMENT_TYPES].join(', ');
const anchors = [...ANCHORS].join(', ');
// The kinds an agent may write: a retired one (a tab window, docs/specs/009-elements/tab-window.md) is not offered.
const shapeKinds = [...SHAPE_KINDS].filter((k) => !RETIRED_SHAPE_KINDS.has(k)).join(', ');
export const themeIds = THEMES.map((t) => t.id).join(', ');
// The palette's text styles (docs/specs/008-canvas/canvas-and-palette.md "Text styles"), from the one table, so an
// agent sets a screen's text in the sizes and weights the editor's Write tiles place.
const textStyles = TEXT_PRESET_LIST.map(
  (p) => `${p.name} ${p.px}${p.bold ? ' bold' : p.italic ? ' italic' : ''}`,
).join(', ');

// The content fields of the kinds that carry content (docs/specs/015-api/mcp-server.md §4.7a), as
// facts. One copy, shared by the tool argument and the schema resource; the
// vocabularies come from packages/design so they can't drift.
const stickyPairs = STICKY_PRESETS.map((p) => `${p.name.toLowerCase()} ${p.fill}/${p.text}`).join(
  ', ',
);
const CONTENT_KINDS =
  'Content-carrying kinds: ' +
  'type "sticky": a note whose "label" is its text; the theme never recolours it, so its own ' +
  `"fillColor" + "textColor" are kept (palette pairs, fill/text: ${stickyPairs}); unset it is ` +
  'the classic amber note. ' +
  'type "image": a picture from the user\'s gallery: "imageId" is an id from list_images (one not in the ' +
  'gallery is refused); without it the element is a placeholder the user fills in the editor. "objectFit" ' +
  'contain (default, the whole picture) or cover (fills the box, cropping); "alt" describes it. A box in the ' +
  "picture's own proportions (its width and height from list_images, scaled) shows it uncropped. " +
  'type "table": "cells" is rows of strings (ragged rows are padded), "headerRow" / ' +
  '"headerColumn" style the first row / column, "zebra" tints alternate rows. ' +
  `shape "code-block": "code" (up to ${CODE_MAX_LENGTH} chars), "codeLanguage" (` +
  `${CODE_LANGUAGES.join(', ')}), "codeTheme" (${CODE_THEMES.map((t) => t.id).join(', ')}; ` +
  'default midnight, dark), "codeWrap"; the block draws itself and shows no label. ' +
  'shape "bar-chart" / "pie-chart": "pieSlices" is [{ "label", "value" }]; categories show in ' +
  'the legend. shape "line-chart": "lineCategories" is the x labels, "lineSeries" is ' +
  '[{ "name", "values" }] with one value per category. "chartVariant" picks the chart type: ' +
  'on "bar-chart" "horizontal" draws a Bar chart (absent: upright columns); on "line-chart" "area" ' +
  'fills each series down to zero and "scatter" draws points only, at x = each category read as a ' +
  'number; on "pie-chart" "doughnut" opens the middle. "chartValues": true prints each mark\'s ' +
  "number on the chart (a pie's as percentages when its values add up to 100; a column chart also " +
  'names each column under it, so "chartLegend": false can drop the key). "chartAxis": true draws the value axis, ' +
  'round tick values and gridlines (not on a pie). A "lineSeries" entry with "axis": "right" is drawn against a ' +
  'scale of its own, labelled on the right, so a series in the thousands and one in the tens both read. ' +
  'A chart draws no title (a caption is a ' +
  'separate "text" element) and draws sample data when its data is empty. ' +
  'shape "sankey": a Sankey diagram, bands as wide as the amount they carry, laid out in columns ' +
  'by itself. "sankeyFlows" is [{ "from", "to", "value" }] with node NAMES (the nodes are the ' +
  `names; up to ${SANKEY_MAX_FLOWS} flows, names up to ${SANKEY_NAME_MAX} chars, values above ` +
  'zero; a flow back to an earlier node is hidden, as is one into itself). Options: ' +
  `"sankeyLinkColor" (${SANKEY_LINK_COLORS.join(', ')}; default gradient), "sankeyAlign" ` +
  '(justify: end nodes in the last column, the default; left: each at its own step), ' +
  `"sankeyValueLabel" (${SANKEY_VALUE_LABELS.join(', ')}), "sankeyUnit" (e.g. "£", "kWh"; up ` +
  `to ${SANKEY_UNIT_MAX} chars), "sankeyNodes" [{ "name", "color", "leftover": false }] to colour a node or switch ` +
  'off its own leftover, ' +
  '"sankeyLeftover" (show, the default: a middle node that sends on less than it receives draws ' +
  'the difference to a "Leftover" end node; hide: it does not), "sankeyLeftoverName" (that ' +
  "node's name; do not write leftover flows yourself). Make it " +
  'wide (about 2:1); it draws no title. ' +
  // The building kinds (docs/specs/015-api/mcp-server.md §4.7a).
  'shape "card": a node with a title, meta line and body; "pageTitle" is the title, "pageSubtitle" ' +
  'the meta (a product or runtime), "label" the body, "cardMedia" + "iconId" the glyph (a badge disc, a ' +
  `tile or an initial), "cardHeader" true for a coloured header band, "tags" up to ${CARD_TAGS_MAX} short ` +
  'facts. Use cards for service and component nodes. "callout" is accepted and stored as a card. ' +
  '"accentEdge" on a square, stadium or card draws a coloured strip on that side. ' +
  `shape "badge": a small label pill (up to ${BADGE_LABEL_MAX} chars); shape "step": a numbered disc ` +
  `("label" the number, up to ${STEP_LABEL_MAX} chars). Both take "chipLook"; with "attachedTo" (a node id) ` +
  'and "attachAt" they sit on that point of the node and move, copy and delete with it; no x / y needed. ' +
  'shape "layer-stack" / "pyramid" / "cycle": "conceptRows" is [{ "label", "note"? }]: a stack 2 to 8 ' +
  '(note = a side note), a pyramid 2 to 6 (first row the apex; "pyramidVariant" funnel makes it a ' +
  'funnel and its note the row\'s value), a cycle 3 to 8 clockwise from the top (its "label" is the ' +
  'centre); "hub" 3 to 8 satellites round its "label" ("hubSpokes" false hides the lines), "onion" 2 to 6 ' +
  'rings from the core out, "chevrons" 2 to 8 stages left to right, "timeline-rail" 2 to 8 milestones ' +
  'left to right (label = what, note = when: a date, a quarter). They draw their own rows in the colour ramp; ' +
  'do not draw them from separate shapes. ' +
  // Round 2 (docs/specs/015-api/mcp-server.md §4.7a).
  'shape "pointer-note": a note ("label") with a leader to a tip; "pointerTip" { x, y } is relative to its ' +
  'top-left, or "attachedTo" + "attachAt" pins the tip to that point of a node. ' +
  'shape "stack": a container that lines up the elements whose centre is inside it; "stackDirection", ' +
  '"stackColumns" (2 to 6, grid), "stackGap" and "stackPadding" (0 to 64), "stackAlign"; place children ' +
  'anywhere inside and the editor lays them out. ' +
  // Components (docs/specs/024-agents/edit-operations.md "Components").
  'shape "instance": a copy of one of the design\u2019s components; "componentId" names its main (read_design ' +
  'view "components" lists them), and it takes the main\u2019s frame when no size is given. "componentOverrides" ' +
  'is { <main element id>: { label?, fillColor?, strokeColor?, textColor?, iconId? } }: what this copy shows ' +
  'differently; everything else follows the main.';

// The style fields a box or arrow takes beyond its geometry, as facts (docs/specs/015-api/mcp-server.md §4.7a "Style
// fields"): the closed vocabularies from the one list edit operations and the value check read, so they cannot drift.
const STYLE_FIELDS =
  'Style fields: ' +
  Object.entries(ELEMENT_FIELD_VALUES)
    .map(([key, values]) => `"${key}" (${values.join(', ')})`)
    .join(', ') +
  '; "textBold", "textItalic" (true/false); "colorPreset" (a shape\u2019s look from the theme, its border\u2019s ' +
  'width and style included, so it outranks a "strokeStyle" given with it; ghost and outline are dashed, dotted ' +
  'and dash-dot as named: theme, soft, ' +
  'tinted, solid, bold, ghost, paper, muted, slate, inked, hairline, outline, dotted, dash-dot, frame, info, ' +
  'success, warning, danger, highlight); "iconId" (an id from search_icons) with "iconPosition"; "note" (detail ' +
  'shown on the element); on text, wordmark type: "letterSpacing" (em between letters, -0.2 to 1), ' +
  '"fontWeight" (400, 500, 700), "textCase" (upper, lower), "textArc" (bends one line along a circle, -360 to ' +
  '360 degrees, positive bowing up: a badge\u2019s top line 180, its bottom -180); on an arrow "label", ' +
  '"strokeStyle", "arrowEnds", "arrowheadShape" (an ER line\u2019s ends: one, zero-or-one, many, zero-or-many, ' +
  'one-or-many), "arrowheadStartShape" (the start\u2019s, when it differs: a one at one table, a many at the ' +
  'other). A field a type ' +
  'does not have, or a value off its list, is refused naming what it takes. ' +
  'Kinds and what they hold: "checklist" its "checklistItems" ' +
  '([{"text", "done"}]); a stat row its "stats" ([{"value", "caption"}]); a callout its "pageTitle" over its "label" ' +
  '(the body); a banner its "pageTitle" and "pageSubtitle"; "sticker" a "stickerId" (an emoji- id from search_icons). ';

// Self-contained element schema, attached to each tool's element argument so the
// model reads it straight from the tool definition (see the comment above).
export const ELEMENT_SCHEMA_HINT =
  'An array of element objects. This is the COMPLETE format, documented inline ' +
  'here: the tool definition is the full reference for it. ' +
  'Each element: { "id": a unique string, "type", ' +
  '"x", "y", "width", "height", and optional "label" }. ' +
  'type "shape" is a NODE (a labelled box) and also needs "shape", one of ' +
  `${shapeKinds}. The default box is "square" (there is NO "rectangle"); use ` +
  '"diamond" for a decision, "cylinder" for a datastore, "stadium" for start/end. ' +
  'type "text" is BARE text with no box; use it only for a title, caption, or ' +
  'legend, never for a node; it is centred in its box, so a left-aligned heading or caption sets ' +
  '"textAlignX": "left". Set a text in the palette\'s text styles by "textSize" in px with "textBold" or ' +
  `"textItalic" true: ${textStyles}. ` +
  'type "freehand" is a HAND-DRAWN stroke: give "points" as canvas ' +
  'coordinates, [[x, y], ...] in drawing order (the box is taken from them), with "closed" true to ' +
  'close and fill the shape, and "penColour" (' +
  `${[INK_PEN_COLOUR, GREY_PEN_COLOUR, ...PEN_COLOUR_NAMES].join(', ')}` +
  '): underline a heading, ring a word or draw a doodle with a few strokes, a point every 10 to 20 px along a ' +
  'curve; an arrow between boxes stays a pinned "arrow", which a "sketch" finish draws by hand and ' +
  'which stays attached. Any box may carry "rotation" in degrees, a small tilt (-4 to 4) reading as ' +
  'placed by hand. type "arrow" needs "from" and "to" endpoints, each ' +
  'either { "kind": "pinned", "elementId", "anchor" } (anchors: ' +
  `${anchors}; preferred, so arrows track their shapes) or ` +
  '{ "kind": "free", "x", "y" }; an arrow may carry a "label". ' +
  'The theme owns fill, stroke, and text colour on every element except a sticky. ' +
  'Any element may carry "finish" ("flexible", "professional", "sketch" or "marker") to be drawn ' +
  'differently from its tab. ' +
  STYLE_FIELDS +
  CONTENT_KINDS;

export function elementSchemaDoc(): string {
  return `# livedesign element schema

A tab is { name, elements: Element[] }, and its pages (logo artboards, wireframe
screens and blank pages) sit on its canvas; an element is on the page whose
rectangle holds it. Every element needs a unique string "id". A design has one
or more tabs. create_design makes a design with one or more tabs at once;
add_tab appends another tab to an existing design. change_pages answers each
page's rectangle, so elements can be placed on it.

## Element types
${types}

Boxed elements (shape, text, sticky, table, image, annotation) carry:
  id, type, x, y, width, height, and an optional "label" (string).
  - "shape" is the element for a NODE — a labelled box, the default building
    block of almost every page. It also needs "shape": one of
    ${shapeKinds}. The default box / process step is "square" (a rounded
    rectangle that fills its width × height) — there is NO "rectangle" kind.
    Use "diamond" for a decision, "cylinder" for a datastore, "stadium" for a
    start/end, "circle", "hexagon", "parallelogram" for I/O, and "frame" for a
    section container. An unknown kind is coerced to "square".
  - "text" is BARE text with no box, fill, or border. Use it ONLY for a
    free-standing title, caption, legend, or note — NEVER for a node. A node
    that has a label is a "shape" with a "label" (use shape: "square"), not a
    "text". Defaulting to "text" for nodes makes a page of floating words
    with no boxes; reach for "shape" unless you specifically want loose text.
    Set it in the palette's text styles with "textSize" (px) and "textBold" or
    "textItalic": ${textStyles}.

## Content-carrying kinds
${CONTENT_KINDS}

## Arrows
type "arrow" with "from" and "to" endpoints. PREFER pinned endpoints so arrows
track their shapes when laid out or moved:
  from / to: { "kind": "pinned", "elementId": "<id>", "anchor": "<a>" }
  anchors: ${anchors}
A free endpoint is { "kind": "free", "x": number, "y": number }. Arrows may carry
an optional "label".

## Layout — your call
YOU decide the layout; the server does not override a real arrangement.
- For a deliberate shape, set explicit x/y and they are kept as given: a life
  CYCLE as a ring with an arrow looping back to the start, a hierarchy as a
  top-down tree, a comparison as a grid, a timeline as a row.
- For a simple flow you'd rather not position, leave coordinates rough or zero
  and the server arranges a clean graph (>= 3 nodes joined by pinned arrows).
- The "layout" tool argument forces it either way: "preserve" keeps your
  coordinates, "auto" re-lays-out the graph. Omitted = auto-detect (a real
  arrangement is kept; nodes left piled at one point get laid out).
- Supporting text (a per-node description, a caption, a title) is ALWAYS kept
  where you place it and never auto-arranged — so put it next to the node it
  describes, not in a loose pile.

## Themes (the look)
Set "theme" on create_design / add_tab to one of these presets and the server
paints the pages and their elements with it (you still omit per-element colours):
  ${themeIds}
Defaults to "brand", the Default scheme: the plain, un-themed canvas, which
follows each reader's own light / dark setting in the editor and paints no
element colours at all. Rough guide: cool blues = ocean / sky / teal; greens = forest /
pine / olive; warm = sunset / sand / rose / mocha; neutral = mono / steel /
cream; dark backdrops = midnight / plum / abyss / espresso (or leave it on
"brand", which is dark for a reader in dark mode); multi-colour (each branch a
different hue) = rainbow / pastel / tropical / autumn / jewel; uml = standard
UML notation colours. Pick one that fits the subject; one scheme applies to all
tabs in a create_design call.

## Design rules (pages that read well)
- Nodes are SHAPES, not text. Use type "shape" (shape: "square" by default,
  "diamond" for a decision, "cylinder" for a datastore) for every box on the
  page. Reserve type "text" for stand-alone titles, captions and running copy.
- Do NOT set colours. The theme owns fill / stroke / text colour; omit them and
  the page inherits a coherent palette. A sticky is the exception: it is not
  themed, so its own fillColor / textColor are kept.
- Size sibling nodes consistently (e.g. every box 160x64).
- Prefer pinned arrows (node -> node) so they track their shapes when moved.
- Give every node an id and a short, clear label.
- For a logo, a set of wireframe screens or another ready-made page,
  list_templates has ready-made pages to pass as "template", then replace their
  sample text with update_design.
`;
}

// Server-level instructions echo the essentials for clients that don't read
// resources (docs/specs/015-api/mcp-server.md §4.5). Phrased as facts about the server (what it does
// with what you send, and where the format is written down), not as rules for
// the calling model (docs/specs/015-api/mcp-server.md §4.15).
export const SERVER_INSTRUCTIONS = `Tools to find, view, create, add tabs to, edit, share, rename, archive and unarchive, delete (to the Trash) and restore the user's livedesign designs. An archived design is its owner's alone: it can't be read or changed until unarchive_design moves it out, and find_designs lists archived designs only with archived true.
A design holds tabs, and each tab holds pages: logo artboards and wireframes. change_pages adds, changes, lays out
(from a ready-made layout), moves, copies and deletes them and answers each page's rectangle on the canvas, where
update_design puts elements. Asked for a logo, add a logo page; asked for a screen, add a wireframe page. Every page
of a tab is one kind (its first page's): a logo and screens go in tabs of their own (add_tab). A new
design starts with create_design and one tab whose template is "blank-logo" for a logo (one empty artboard;
change_pages adds the rest, each change an object such as {"op": "add", "kind": "logo", "layout": ...}),
"blank-wireframe-phone", "blank-wireframe-browser" or another blank wireframe for screens, or "blank"
(one empty page that asks what it is for) otherwise; the other templates (logo-design, wireframe-mobile-app, wireframe-website, wireframe-dashboard, ...) start
from ready-made pages, and list_templates lists them all. A layout's elements hold sample text: read_design with view "pages" lists
each page's elements with their refs and text, to replace with update_design.
The calling model produces the elements on a page AND decides their layout; this server validates, persists, and
renders them, and only auto-arranges boxes and arrows when you ask it to (or leave nodes unplaced). The full element
format is documented inline on each tool's element argument, so the tool definitions are the complete reference for
it. Each element has a unique "id"; nodes are "shape" elements (a labelled box) NOT "text" (text is only for titles,
captions and running copy); pinned arrows (node -> node) track their boxes; and the theme owns colours (a sticky keeps
its own). Stickies, tables, code blocks and charts carry content fields, documented on each tool's element argument.
search_icons finds icon ids for "iconId"; list_images lists the user's pictures for an image element's "imageId".`;
