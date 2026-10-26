// A colour as CSS writes it, to 0-255 channels: `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` (the `#` optional on the long
// two, either case) or one of CSS's named colours (CSS Color 4, `rebeccapurple` included), or null for anything else
// (an rgb() string, `transparent`, `currentColor`, a typo). Alpha is read past and dropped (parseCssColourAlpha keeps
// it): callers mix and compare solid colours. Tabs and elements carry user-picked colours, and older documents predate
// the hex-only rule, so a shorthand or a name does reach the models' colour sums (each model's `hexToRgb`).

export type CssRgb = { r: number; g: number; b: number };

// A shorthand needs its `#`, as CSS does (`fff` or `bad` alone is no colour); a full hex may leave it off, as older
// documents did.
const HEX = /^(?:#([a-f\d]{3,4})|#?([a-f\d]{6}|[a-f\d]{8}))$/i;

// The named colours, `name` then `rrggbb`, one string so the table costs one constant and a Map built on first use.
const NAMED =
  'aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc bisque ffe4c4 ' +
  'black 000000 blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 brown a52a2a burlywood deb887 ' +
  'cadetblue 5f9ea0 chartreuse 7fff00 chocolate d2691e coral ff7f50 cornflowerblue 6495ed cornsilk fff8dc ' +
  'crimson dc143c cyan 00ffff darkblue 00008b darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 ' +
  'darkgreen 006400 darkgrey a9a9a9 darkkhaki bdb76b darkmagenta 8b008b darkolivegreen 556b2f ' +
  'darkorange ff8c00 darkorchid 9932cc darkred 8b0000 darksalmon e9967a darkseagreen 8fbc8f ' +
  'darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f darkturquoise 00ced1 darkviolet 9400d3 ' +
  'deeppink ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969 dodgerblue 1e90ff firebrick b22222 ' +
  'floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc ghostwhite f8f8ff gold ffd700 ' +
  'goldenrod daa520 gray 808080 green 008000 greenyellow adff2f grey 808080 honeydew f0fff0 hotpink ff69b4 ' +
  'indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa lavenderblush fff0f5 ' +
  'lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff ' +
  'lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1 ' +
  'lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899 lightslategrey 778899 ' +
  'lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff ' +
  'maroon 800000 mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 mediumpurple 9370db ' +
  'mediumseagreen 3cb371 mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise 48d1cc ' +
  'mediumvioletred c71585 midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5 ' +
  'navajowhite ffdead navy 000080 oldlace fdf5e6 olive 808000 olivedrab 6b8e23 orange ffa500 ' +
  'orangered ff4500 orchid da70d6 palegoldenrod eee8aa palegreen 98fb98 paleturquoise afeeee ' +
  'palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 peru cd853f pink ffc0cb plum dda0dd ' +
  'powderblue b0e0e6 purple 800080 rebeccapurple 663399 red ff0000 rosybrown bc8f8f royalblue 4169e1 ' +
  'saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 seagreen 2e8b57 seashell fff5ee sienna a0522d ' +
  'silver c0c0c0 skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa ' +
  'springgreen 00ff7f steelblue 4682b4 tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347 ' +
  'turquoise 40e0d0 violet ee82ee wheat f5deb3 white ffffff whitesmoke f5f5f5 yellow ffff00 ' +
  'yellowgreen 9acd32';

let named: Map<string, string> | null = null;

function namedHex(name: string): string | undefined {
  if (!named) {
    named = new Map();
    const parts = NAMED.split(' ');
    for (let i = 0; i + 1 < parts.length; i += 2) named.set(parts[i]!, parts[i + 1]!);
  }
  return named.get(name.toLowerCase());
}

/** The names CSS knows, for tests. */
export function cssColourNames(): string[] {
  namedHex('');
  return [...named!.keys()];
}

// The colour's hex digits (3, 4, 6 or 8 of them, no `#`), or undefined when it is not one.
function digitsOf(input: string): string | undefined {
  const m = HEX.exec(input) ?? HEX.exec(input.trim());
  return m ? (m[1] ?? m[2]) : namedHex(input.trim());
}

// Read straight from the matched digits, with no strings built: colour sums run on render paths, and this keeps a
// six-digit hex near the cost of the old six-digit-only parser.
function channelsOf(hex: string): CssRgb {
  if (hex.length <= 4) {
    const digit = (i: number) => parseInt(hex[i]!, 16) * 17;
    return { r: digit(0), g: digit(1), b: digit(2) };
  }
  // One parse for all six digits (an eight-digit hex's alpha pair is cut off first), then a shift per channel.
  const n = parseInt(hex.length === 6 ? hex : hex.substring(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function parseCssColour(input: string): CssRgb | null {
  const hex = digitsOf(input);
  return hex ? channelsOf(hex) : null;
}

// The same colour with its alpha, 0-255 (255 when it gives none, as a name or a 3- or 6-digit hex): for the callers
// that ask whether a colour is opaque rather than mixing it.
export function parseCssColourAlpha(input: string): (CssRgb & { a: number }) | null {
  const hex = digitsOf(input);
  if (!hex) return null;
  const a =
    hex.length === 4
      ? parseInt(hex[3]!, 16) * 17
      : hex.length === 8
        ? parseInt(hex.substring(6, 8), 16)
        : 255;
  return { ...channelsOf(hex), a };
}
