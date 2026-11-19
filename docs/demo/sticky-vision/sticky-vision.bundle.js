(() => {
  // packages/diagram/src/event-storming.ts
  var EVENT_STORMING_NOTES = [
    {
      kind: "domain-event",
      label: "Domain event",
      blurb: "Something that happened, past tense",
      fill: "#fdba74",
      stage: "big-picture",
      size: "square"
    },
    {
      kind: "command",
      label: "Command",
      blurb: "An intent that triggers an event",
      fill: "#93c5fd",
      stage: "process",
      size: "square"
    },
    {
      kind: "actor",
      label: "Actor",
      blurb: "Who issues the command",
      fill: "#fef08a",
      stage: "big-picture",
      size: "small"
    },
    {
      kind: "policy",
      label: "Policy",
      blurb: "Whenever X happens, then Y",
      fill: "#d8b4fe",
      stage: "process",
      size: "wide"
    },
    {
      kind: "read-model",
      label: "Read model",
      blurb: "Information the actor decides on",
      fill: "#86efac",
      stage: "process",
      size: "square"
    },
    {
      kind: "external-system",
      label: "External system",
      blurb: "A third party the flow touches",
      fill: "#f9a8d4",
      stage: "process",
      size: "wide"
    },
    {
      kind: "aggregate",
      label: "Aggregate",
      blurb: "The thing commands act on",
      fill: "#fef9c3",
      stage: "design",
      size: "wide"
    },
    {
      kind: "hotspot",
      label: "Hotspot",
      blurb: "A conflict, question, or risk",
      fill: "#fca5a5",
      stage: "big-picture",
      size: "square"
    }
  ];

  // packages/diagram/src/colors.ts
  function hexToRgb(hex) {
    const m = /^#?([a-fA-F\d]{2})([a-fA-F\d]{2})([a-fA-F\d]{2})$/.exec(hex);
    if (!m) return null;
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
  }

  // packages/sticky-vision/src/colour.ts
  function rgbToHsv({ r, g, b }) {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === rr) h = (gg - bb) / d % 6;
      else if (max === gg) h = (bb - rr) / d + 2;
      else h = (rr - gg) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
  }
  function hueDistance(a, b) {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }
  var NEUTRAL_PERCENTILE = 0.25;
  var NEUTRAL_MAX_SATURATION = 0.35;
  var NEUTRAL_MIN_SATURATION = 0.15;
  function greyWorldBalance(image) {
    const { width, height, data } = image;
    const buckets = new Int32Array(256);
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      if (max < 24) continue;
      const s = (max - Math.min(r, g, b)) / max;
      buckets[Math.min(255, Math.round(s * 255))] += 1;
      lit += 1;
    }
    if (lit === 0) return image;
    let seen = 0;
    let cutoff = 255;
    const target = lit * NEUTRAL_PERCENTILE;
    for (let b = 0; b < 256; b += 1) {
      seen += buckets[b];
      if (seen >= target) {
        cutoff = b;
        break;
      }
    }
    const limit = Math.max(NEUTRAL_MIN_SATURATION, cutoff / 255);
    if (limit > NEUTRAL_MAX_SATURATION) return image;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      if (max < 24) continue;
      if ((max - Math.min(r, g, b)) / max > limit) continue;
      sumR += r;
      sumG += g;
      sumB += b;
      count += 1;
    }
    if (count === 0) return image;
    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;
    if (avgR < 1 || avgG < 1 || avgB < 1) return image;
    const grey = (avgR + avgG + avgB) / 3;
    const kr = grey / avgR;
    const kg = grey / avgG;
    const kb = grey / avgB;
    const out = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      out[i] = data[i] * kr;
      out[i + 1] = data[i + 1] * kg;
      out[i + 2] = data[i + 2] * kb;
      out[i + 3] = data[i + 3];
    }
    void width;
    void height;
    return { width, height, data: out };
  }
  function hexToRgb2(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) throw new Error(`Not a #rrggbb colour: ${hex}`);
    return rgb;
  }

  // packages/sticky-vision/src/lab.ts
  var XN = 0.95047;
  var YN = 1;
  var ZN = 1.08883;
  var EPSILON = 216 / 24389;
  var KAPPA = 24389 / 27;
  var LINEAR = new Float64Array(256);
  for (let v = 0; v < 256; v += 1) {
    const c = v / 255;
    LINEAR[v] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  function f(t) {
    return t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
  }
  function convertInto(r, g, b, out, p) {
    const lr = LINEAR[r];
    const lg = LINEAR[g];
    const lb = LINEAR[b];
    const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / XN;
    const y = (0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb) / YN;
    const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / ZN;
    const fx = f(x);
    const fy = f(y);
    const fz = f(z);
    out.l[p] = 116 * fy - 16;
    out.a[p] = 500 * (fx - fy);
    out.b[p] = 200 * (fy - fz);
  }
  var SCRATCH = { l: [0], a: [0], b: [0] };
  function rgbToLabInto(r, g, b, out) {
    convertInto(r | 0, g | 0, b | 0, SCRATCH, 0);
    out.l = SCRATCH.l[0];
    out.a = SCRATCH.a[0];
    out.b = SCRATCH.b[0];
    return out;
  }
  function labImageOf(image) {
    const n = image.width * image.height;
    const out = {
      width: image.width,
      height: image.height,
      l: new Float32Array(n),
      a: new Float32Array(n),
      b: new Float32Array(n)
    };
    const { data } = image;
    for (let p = 0, i = 0; p < n; p += 1, i += 4) {
      convertInto(data[i], data[i + 1], data[i + 2], out, p);
    }
    return out;
  }

  // packages/sticky-vision/src/histogram.ts
  function otsu(buckets) {
    let total = 0;
    let sum = 0;
    for (let i = 0; i < buckets.length; i += 1) {
      total += buckets[i];
      sum += i * buckets[i];
    }
    if (total === 0) return { at: 0, strength: 0 };
    const mean = sum / total;
    let variance = 0;
    for (let i = 0; i < buckets.length; i += 1) variance += buckets[i] * (i - mean) ** 2;
    variance /= total;
    let backgroundWeight = 0;
    let backgroundSum = 0;
    let best = 0;
    let bestAt = 0;
    for (let i = 0; i < buckets.length; i += 1) {
      backgroundWeight += buckets[i];
      if (backgroundWeight === 0) continue;
      const foregroundWeight = total - backgroundWeight;
      if (foregroundWeight === 0) break;
      backgroundSum += i * buckets[i];
      const backgroundMean = backgroundSum / backgroundWeight;
      const foregroundMean = (sum - backgroundSum) / foregroundWeight;
      const between = backgroundWeight / total * (foregroundWeight / total) * (backgroundMean - foregroundMean) ** 2;
      if (between > best) {
        best = between;
        bestAt = i;
      }
    }
    return { at: bestAt / 100, strength: variance > 0 ? best / variance : 0 };
  }
  function modeOf(buckets) {
    const window2 = 3;
    let bestAt = 0;
    let best = -1;
    for (let i = 0; i < buckets.length; i += 1) {
      let sum = 0;
      for (let j = Math.max(0, i - window2); j <= Math.min(buckets.length - 1, i + window2); j += 1) {
        sum += buckets[j];
      }
      if (sum > best) {
        best = sum;
        bestAt = i;
      }
    }
    return bestAt / 100;
  }

  // packages/sticky-vision/src/surface.ts
  var BLOWN_OUT = 250;
  var labScratch = { l: 0, a: 0, b: 0 };
  function measure(image, x0, y0, x1, y1, stride) {
    const surface = {
      saturation: new Int32Array(101),
      value: new Int32Array(101),
      lit: 0,
      hueX: new Float64Array(101),
      hueY: new Float64Array(101),
      hueCount: new Int32Array(101),
      labA: new Float64Array(101),
      labB: new Float64Array(101)
    };
    for (let y = y0; y < y1; y += stride) {
      for (let x = x0; x < x1; x += stride) {
        const i = (y * image.width + x) * 4;
        const r = image.data[i];
        const g = image.data[i + 1];
        const b = image.data[i + 2];
        const max = Math.max(r, g, b);
        if (max < 24) continue;
        if (Math.min(r, g, b) >= BLOWN_OUT) continue;
        const s = (max - Math.min(r, g, b)) / max;
        const bucket = Math.round(s * 100);
        surface.saturation[bucket] += 1;
        surface.value[Math.round(max / 255 * 100)] += 1;
        surface.lit += 1;
        const h = rgbToHsv({ r, g, b }).h * Math.PI / 180;
        surface.hueX[bucket] += Math.cos(h);
        surface.hueY[bucket] += Math.sin(h);
        surface.hueCount[bucket] += 1;
        rgbToLabInto(r, g, b, labScratch);
        surface.labA[bucket] += labScratch.a;
        surface.labB[bucket] += labScratch.b;
      }
    }
    return surface;
  }
  function hueOf(surface, below) {
    let x = 0;
    let y = 0;
    let n = 0;
    const limit = Math.min(100, Math.round(below * 100));
    for (let i = 0; i < limit; i += 1) {
      x += surface.hueX[i];
      y += surface.hueY[i];
      n += surface.hueCount[i];
    }
    if (n === 0) return -1;
    const deg = Math.atan2(y / n, x / n) * 180 / Math.PI;
    return deg < 0 ? deg + 360 : deg;
  }
  function wallLabOf(surface, below) {
    let a = 0;
    let b = 0;
    let n = 0;
    const limit = Math.min(100, Math.round(below * 100));
    for (let i = 0; i < limit; i += 1) {
      a += surface.labA[i];
      b += surface.labB[i];
      n += surface.hueCount[i];
    }
    return n === 0 ? {} : { wallA: a / n, wallB: b / n };
  }

  // packages/sticky-vision/src/floors.ts
  var WALL_SATURATION_MARGIN = 0.14;
  var MIN_PAPER_SATURATION = 0.28;
  var WALL_VALUE_RATIO = 0.7;
  var VALUE_FLOOR = 0.2;
  var SATURATION_FLOOR = 0.28;
  var DEFAULT_FLOORS = {
    saturation: SATURATION_FLOOR,
    value: VALUE_FLOOR,
    // A photo with no measurable wall has no hue to keep clear of.
    wallHue: -1
  };
  var FLOOR_TILES_LONG_SIDE = 8;
  var FLOOR_SAMPLE_STRIDE = 2;
  var TILE_BIMODAL_STRENGTH = 0.12;
  var TILE_WALL_TOLERANCE = 0.1;
  function floorsOf(surface) {
    if (surface.lit === 0) {
      return { floors: DEFAULT_FLOORS, bimodal: false, wallSaturation: SATURATION_FLOOR };
    }
    const wallSaturation = modeOf(surface.saturation);
    const wallValue = modeOf(surface.value);
    const split = otsu(surface.saturation);
    const bimodal = split.strength >= TILE_BIMODAL_STRENGTH;
    const margin = wallSaturation + WALL_SATURATION_MARGIN;
    const saturation = Math.max(MIN_PAPER_SATURATION, bimodal ? Math.min(split.at, margin) : margin);
    const wallHue = hueOf(surface, saturation);
    return {
      floors: {
        saturation,
        value: Math.max(VALUE_FLOOR, wallValue * WALL_VALUE_RATIO),
        wallHue,
        ...wallLabOf(surface, saturation),
        wallValue
      },
      bimodal,
      wallSaturation
    };
  }
  function localFloorsOf(image, opts = {}) {
    const longSide = Math.max(image.width, image.height);
    const tiles = opts.tiles ?? FLOOR_TILES_LONG_SIDE;
    const cell = Math.max(1, Math.round(longSide / tiles));
    const tilesX = Math.max(1, Math.round(image.width / cell));
    const tilesY = Math.max(1, Math.round(image.height / cell));
    const frame = floorsOf(measure(image, 0, 0, image.width, image.height, 7));
    const global = opts.global ?? frame.floors;
    const saturation = new Float64Array(tilesX * tilesY);
    const value = new Float64Array(tilesX * tilesY);
    const wallValue = new Float64Array(tilesX * tilesY);
    const hueX = new Float64Array(tilesX * tilesY);
    const hueY = new Float64Array(tilesX * tilesY);
    const wallA = new Float64Array(tilesX * tilesY);
    const wallB = new Float64Array(tilesX * tilesY);
    let wallColourKnown = true;
    const globalHue = global.wallHue * Math.PI / 180;
    for (let ty = 0; ty < tilesY; ty += 1) {
      for (let tx = 0; tx < tilesX; tx += 1) {
        const x0 = Math.floor(tx * image.width / tilesX);
        const x1 = Math.floor((tx + 1) * image.width / tilesX);
        const y0 = Math.floor(ty * image.height / tilesY);
        const y1 = Math.floor((ty + 1) * image.height / tilesY);
        const surface = measure(image, x0, y0, x1, y1, FLOOR_SAMPLE_STRIDE);
        const measured = floorsOf(surface);
        const local = measured.floors;
        const i = ty * tilesX + tx;
        value[i] = local.value;
        wallValue[i] = local.wallValue ?? 0;
        const trusted = surface.lit > 0 && (measured.bimodal || Math.abs(measured.wallSaturation - frame.wallSaturation) <= TILE_WALL_TOLERANCE);
        saturation[i] = trusted ? local.saturation : global.saturation;
        const colour = trusted && local.wallA !== void 0 ? local : global;
        if (colour.wallA === void 0 || colour.wallB === void 0) wallColourKnown = false;
        wallA[i] = colour.wallA ?? 0;
        wallB[i] = colour.wallB ?? 0;
        const hue = trusted && local.wallHue >= 0 ? local.wallHue * Math.PI / 180 : globalHue;
        const usable = trusted && local.wallHue >= 0 || global.wallHue >= 0;
        hueX[i] = usable ? Math.cos(hue) : 0;
        hueY[i] = usable ? Math.sin(hue) : 0;
      }
    }
    const cellW = image.width / tilesX;
    const cellH = image.height / tilesY;
    const floorsInto = (x, y, out) => {
      const fx = Math.min(tilesX - 1, Math.max(0, x / cellW - 0.5));
      const fy = Math.min(tilesY - 1, Math.max(0, y / cellH - 0.5));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(tilesX - 1, x0 + 1);
      const y1 = Math.min(tilesY - 1, y0 + 1);
      const ax = fx - x0;
      const ay = fy - y0;
      const i00 = y0 * tilesX + x0;
      const i10 = y0 * tilesX + x1;
      const i01 = y1 * tilesX + x0;
      const i11 = y1 * tilesX + x1;
      const w00 = (1 - ax) * (1 - ay);
      const w10 = ax * (1 - ay);
      const w01 = (1 - ax) * ay;
      const w11 = ax * ay;
      out.saturation = saturation[i00] * w00 + saturation[i10] * w10 + saturation[i01] * w01 + saturation[i11] * w11;
      out.value = value[i00] * w00 + value[i10] * w10 + value[i01] * w01 + value[i11] * w11;
      out.wallValue = wallValue[i00] * w00 + wallValue[i10] * w10 + wallValue[i01] * w01 + wallValue[i11] * w11;
      if (wallColourKnown) {
        out.wallA = wallA[i00] * w00 + wallA[i10] * w10 + wallA[i01] * w01 + wallA[i11] * w11;
        out.wallB = wallB[i00] * w00 + wallB[i10] * w10 + wallB[i01] * w01 + wallB[i11] * w11;
      }
      const hx = hueX[i00] * w00 + hueX[i10] * w10 + hueX[i01] * w01 + hueX[i11] * w11;
      const hy = hueY[i00] * w00 + hueY[i10] * w10 + hueY[i01] * w01 + hueY[i11] * w11;
      if (hx === 0 && hy === 0) {
        out.wallHue = -1;
        return;
      }
      const deg = Math.atan2(hy, hx) * 180 / Math.PI;
      out.wallHue = deg < 0 ? deg + 360 : deg;
    };
    return {
      tilesX,
      tilesY,
      global,
      floorsInto,
      floorsAt: (x, y) => {
        const out = { saturation: 0, value: 0, wallHue: -1 };
        floorsInto(x, y, out);
        return out;
      }
    };
  }
  var FLOOR_CALIBRATION = {
    VALUE_FLOOR,
    SATURATION_FLOOR,
    WALL_SATURATION_MARGIN,
    MIN_PAPER_SATURATION,
    WALL_VALUE_RATIO,
    FLOOR_TILES_LONG_SIDE,
    FLOOR_SAMPLE_STRIDE,
    BLOWN_OUT,
    TILE_BIMODAL_STRENGTH,
    TILE_WALL_TOLERANCE
  };

  // packages/sticky-vision/src/classify.ts
  var HUE_BANDS = [
    // Orange paper. Starts at 12 so the red-pink hotspot keeps its own ground.
    { kind: "domain-event", from: 12, to: 44 },
    // Yellow: actor vs aggregate, split by saturation below.
    { kind: "actor", from: 44, to: 70 },
    // Green, from the yellow-greens a warm room produces to a proper green, and
    // on to where blue begins: a pale mint read model on kraft measures h≈173
    // to 182 as photographed, and a gap between the bands made that paper
    // nobody's. Anywhere from 180 to 185 finds it and moves nothing else.
    { kind: "read-model", from: 70, to: 185 },
    // Blue.
    { kind: "command", from: 185, to: 250 },
    // Purple. Runs to 305 because the pale lilac the operator's wall uses for a
    // policy measures h≈300 — a swatch would have said 280.
    { kind: "policy", from: 250, to: 305 },
    // Pink, ALL of it: the operator's walls use pink for hotspots, and the
    // catalogue's external-system pink cannot be told from it in a photograph —
    // both are pink paper, and the pale one the catalogue uses is too pale to
    // clear the paper floor at all on a kraft wall. Hotspot wins; an
    // external-system read as a hotspot is re-kinded in the draft, which is one
    // click, and the alternative is a hotspot read as an external system, which
    // is a risk nobody flagged. See docs/specs/021-event-storming/event-storming.md.
    { kind: "hotspot", from: 305, to: 12 }
  ];
  var PALE_YELLOW_MAX_SATURATION = 0.34;
  var YELLOW_KINDS = /* @__PURE__ */ new Set(["actor", "aggregate"]);
  var PAPER_CLASSES = EVENT_STORMING_NOTES.map((note) => {
    const hsv = rgbToHsv(hexToRgb2(note.fill));
    return { kind: note.kind, hue: hsv.h, saturation: hsv.s, value: hsv.v };
  });
  var WALL_HUE_NEIGHBOURHOOD_DEG = 34;
  var OFF_HUE_MIN_SATURATION = 0.11;
  var WALL_HUE_MIN_LAB_DISTANCE = 7;
  var PALE_PAPER_MIN_LAB_DISTANCE = 12;
  var PALE_PAPER_MIN_BRIGHTNESS = 0.9;
  var DIM_HUE_MAX_VALUE = 0.4;
  function inBand(hue, band) {
    return band.from <= band.to ? hue >= band.from && hue < band.to : hue >= band.from || hue < band.to;
  }
  function nearWallHue(hsv, floors) {
    return floors.wallHue >= 0 && hueDistance(hsv.h, floors.wallHue) <= WALL_HUE_NEIGHBOURHOOD_DEG;
  }
  function classifyHsv(hsv, floors = DEFAULT_FLOORS) {
    if (hsv.v < VALUE_FLOOR) return "ink";
    if (hsv.v < floors.value) return "wall";
    const needed = nearWallHue(hsv, floors) ? floors.saturation : Math.min(floors.saturation, OFF_HUE_MIN_SATURATION);
    if (hsv.s < needed) return "wall";
    const band = HUE_BANDS.find((b) => inBand(hsv.h, b));
    if (!band) return "unknown";
    if (YELLOW_KINDS.has(band.kind)) {
      return hsv.s <= PALE_YELLOW_MAX_SATURATION ? "aggregate" : "actor";
    }
    if (band.kind === "policy" && hsv.v < DIM_HUE_MAX_VALUE) return "hotspot";
    return band.kind;
  }
  function classifyRgb(r, g, b, floors = DEFAULT_FLOORS) {
    const hsv = rgbToHsv({ r, g, b });
    const verdict = classifyHsv(hsv, floors);
    if (verdict === "wall") return paleVerdict(r, g, b, hsv, floors);
    if (verdict === "ink" || verdict === "unknown") return verdict;
    if (floors.wallA === void 0 || floors.wallB === void 0 || !nearWallHue(hsv, floors)) {
      return verdict;
    }
    const lab = rgbToLabInto(r, g, b, labScratch2);
    const distance = Math.hypot(lab.a - floors.wallA, lab.b - floors.wallB);
    return distance < WALL_HUE_MIN_LAB_DISTANCE ? "wall" : verdict;
  }
  var labScratch2 = { l: 0, a: 0, b: 0 };
  function paleVerdict(r, g, b, hsv, floors) {
    const { wallA, wallB, wallValue } = floors;
    if (wallA === void 0 || wallB === void 0 || wallValue === void 0) return "wall";
    if (hsv.v < wallValue * PALE_PAPER_MIN_BRIGHTNESS) return "wall";
    const band = HUE_BANDS.find((bb) => inBand(hsv.h, bb));
    if (!band || YELLOW_KINDS.has(band.kind)) return "wall";
    const lab = rgbToLabInto(r, g, b, labScratch2);
    return Math.hypot(lab.a - wallA, lab.b - wallB) >= PALE_PAPER_MIN_LAB_DISTANCE ? band.kind : "wall";
  }
  var PALE_SHADE_KINDS = /* @__PURE__ */ new Set(["command", "hotspot"]);
  var PALE_SHADE_MAX_SATURATION = 0.44;
  var PALE_SHADE_MIN_VALUE = 0.6;
  function isPaleShade(r, g, b, kind) {
    if (!PALE_SHADE_KINDS.has(kind)) return false;
    const max = Math.max(r, g, b);
    if (max < PALE_SHADE_MIN_VALUE * 255) return false;
    return (max - Math.min(r, g, b)) / max < PALE_SHADE_MAX_SATURATION;
  }
  var CALIBRATION = {
    DIM_HUE_MAX_VALUE,
    PALE_SHADE_MAX_SATURATION,
    PALE_SHADE_MIN_VALUE,
    HUE_BANDS,
    OFF_HUE_MIN_SATURATION,
    WALL_HUE_NEIGHBOURHOOD_DEG,
    WALL_HUE_MIN_LAB_DISTANCE,
    PALE_PAPER_MIN_LAB_DISTANCE,
    PALE_PAPER_MIN_BRIGHTNESS,
    PALE_YELLOW_MAX_SATURATION,
    // How the floors themselves are measured lives in `floors.ts`, next to the
    // code that uses each number; the whole calibrated table is here.
    ...FLOOR_CALIBRATION
  };

  // packages/sticky-vision/src/texture.ts
  var INTERIOR_INSET = 0.12;
  var INK_LUMA_RATIO = 0.8;
  var INK_MARGIN_PX = 2;
  var EDGE_STRIP = 0.12;
  var SPREAD_INSET = 0.15;
  var BLANK_SPREAD_RATIO = 0.3;
  var MIN_WRITTEN_SPREAD = 0.03;
  var BLANK_EDGE_CONTRAST = 0.05;
  var DARK_GRAIN_BRIGHTNESS = 0.5;
  var DARK_GRAIN_ROUGHNESS = 0.03;
  var lumaAt = (image, x, y) => {
    const i = (y * image.width + x) * 4;
    return 0.299 * image.data[i] + 0.587 * image.data[i + 1] + 0.114 * image.data[i + 2];
  };
  function interiorOf(image, box) {
    const inset = Math.max(1, Math.round(Math.min(box.w, box.h) * INTERIOR_INSET));
    const x0 = Math.max(0, box.x + inset);
    const y0 = Math.max(0, box.y + inset);
    const x1 = Math.min(image.width, box.x + box.w - inset);
    const y1 = Math.min(image.height, box.y + box.h - inset);
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < 5 || h < 5) return null;
    const luma = new Float32Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) luma[y * w + x] = lumaAt(image, x0 + x, y0 + y);
    }
    const sorted = Float32Array.from(luma).sort();
    const median2 = Math.max(1, sorted[sorted.length >> 1]);
    const ink = new Uint8Array(w * h);
    for (let p = 0; p < luma.length; p += 1) if (luma[p] < median2 * INK_LUMA_RATIO) ink[p] = 1;
    const clear = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        let near = 0;
        for (let dy = -INK_MARGIN_PX; dy <= INK_MARGIN_PX && !near; dy += 1) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -INK_MARGIN_PX; dx <= INK_MARGIN_PX; dx += 1) {
            const xx = x + dx;
            if (xx >= 0 && xx < w && ink[yy * w + xx]) {
              near = 1;
              break;
            }
          }
        }
        if (!near) clear[y * w + x] = 1;
      }
    }
    return { x0, y0, w, h, luma, clear, median: median2 };
  }
  function roughnessOf(image, box) {
    const inner = interiorOf(image, box);
    if (!inner) return 0;
    const { w, h, luma, clear, median: median2 } = inner;
    let sum = 0;
    let n = 0;
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const p = y * w + x;
        if (!clear[p]) continue;
        const gx = luma[p - w + 1] + 2 * luma[p + 1] + luma[p + w + 1] - luma[p - w - 1] - 2 * luma[p - 1] - luma[p + w - 1];
        const gy = luma[p + w - 1] + 2 * luma[p + w] + luma[p + w + 1] - luma[p - w - 1] - 2 * luma[p - w] - luma[p - w + 1];
        sum += Math.hypot(gx, gy) / 8;
        n += 1;
      }
    }
    return n === 0 ? 0 : sum / n / median2;
  }
  function edgeSidesOf(image, box) {
    const depth = Math.max(1, Math.round(Math.min(box.w, box.h) * EDGE_STRIP));
    const mean = (x0, y0, x1, y1) => {
      const xa = Math.max(0, x0);
      const ya = Math.max(0, y0);
      const xb = Math.min(image.width, x1);
      const yb = Math.min(image.height, y1);
      if (xb <= xa || yb <= ya) return null;
      const sum = [0, 0, 0];
      let n = 0;
      for (let y2 = ya; y2 < yb; y2 += 1) {
        for (let x2 = xa; x2 < xb; x2 += 1) {
          const i = (y2 * image.width + x2) * 4;
          sum[0] += image.data[i];
          sum[1] += image.data[i + 1];
          sum[2] += image.data[i + 2];
          n += 1;
        }
      }
      return [sum[0] / n, sum[1] / n, sum[2] / n];
    };
    const differ = (a, b) => a && b ? Math.max(...a.map((v, c) => Math.abs(v - b[c]))) / 255 : null;
    const { x, y, w, h } = box;
    const segments = 6;
    const side = (inner, outer) => {
      const diffs = [];
      for (let s = 0; s < segments; s += 1) {
        const d = differ(
          inner(s / segments, (s + 1) / segments),
          outer(s / segments, (s + 1) / segments)
        );
        if (d !== null) diffs.push(d);
      }
      if (diffs.length < segments / 2) return null;
      diffs.sort((a, b) => a - b);
      return diffs[diffs.length >> 1];
    };
    const along = (from, span, t) => Math.round(from + span * t);
    const sides = [
      // top
      side(
        (a, b) => mean(along(x, w, a), y, along(x, w, b), y + depth),
        (a, b) => y - depth < 0 ? null : mean(along(x, w, a), y - depth, along(x, w, b), y)
      ),
      // bottom
      side(
        (a, b) => mean(along(x, w, a), y + h - depth, along(x, w, b), y + h),
        (a, b) => y + h + depth > image.height ? null : mean(along(x, w, a), y + h, along(x, w, b), y + h + depth)
      ),
      // left
      side(
        (a, b) => mean(x, along(y, h, a), x + depth, along(y, h, b)),
        (a, b) => x - depth < 0 ? null : mean(x - depth, along(y, h, a), x, along(y, h, b))
      ),
      // right
      side(
        (a, b) => mean(x + w - depth, along(y, h, a), x + w, along(y, h, b)),
        (a, b) => x + w + depth > image.width ? null : mean(x + w, along(y, h, a), x + w + depth, along(y, h, b))
      )
    ].filter((d) => d !== null);
    return sides.sort((a, b) => a - b);
  }
  function edgeContrastOf(image, box) {
    const sides = edgeSidesOf(image, box);
    return sides.length === 0 ? Number.POSITIVE_INFINITY : sides[0];
  }
  function valueSpreadOf(image, box, insetShare = SPREAD_INSET) {
    const inset = Math.max(1, Math.round(Math.min(box.w, box.h) * insetShare));
    let sum = 0;
    let sumSq = 0;
    let n = 0;
    for (let y = Math.max(0, box.y + inset); y < Math.min(image.height, box.y + box.h - inset); y += 2) {
      for (let x = Math.max(0, box.x + inset); x < Math.min(image.width, box.x + box.w - inset); x += 2) {
        const i = (y * image.width + x) * 4;
        const { v } = rgbToHsv({ r: image.data[i], g: image.data[i + 1], b: image.data[i + 2] });
        sum += v;
        sumSq += v * v;
        n += 1;
      }
    }
    if (n === 0) return 0;
    const mean = sum / n;
    return Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  }
  function dropBlank(image, boxes) {
    if (boxes.length === 0) return boxes;
    const spreads = boxes.map((b) => valueSpreadOf(image, b));
    const sorted = [...spreads].sort((a, b) => a - b);
    const typical = sorted[sorted.length >> 1];
    if (typical < MIN_WRITTEN_SPREAD) return boxes;
    return boxes.filter(
      (box, i) => spreads[i] >= typical * BLANK_SPREAD_RATIO || edgeContrastOf(image, box) >= BLANK_EDGE_CONTRAST
    );
  }
  function brightnessOf(image, box) {
    const inset = Math.max(1, Math.round(Math.min(box.w, box.h) * SPREAD_INSET));
    const values = [];
    for (let y = Math.max(0, box.y + inset); y < Math.min(image.height, box.y + box.h - inset); y += 2) {
      for (let x = Math.max(0, box.x + inset); x < Math.min(image.width, box.x + box.w - inset); x += 2) {
        const i = (y * image.width + x) * 4;
        values.push(Math.max(image.data[i], image.data[i + 1], image.data[i + 2]) / 255);
      }
    }
    if (values.length === 0) return 1;
    values.sort((a, b) => a - b);
    return values[values.length >> 1];
  }
  function isDarkGrain(image, box) {
    return brightnessOf(image, box) < DARK_GRAIN_BRIGHTNESS && roughnessOf(image, box) > DARK_GRAIN_ROUGHNESS;
  }

  // packages/sticky-vision/src/standout.ts
  var STANDOUT_SATURATION = 0.15;
  var VALUE_STANDOUT_WEIGHT = 0.5;
  var MIN_WALL_VALUE = 0.15;
  var HUE_STANDOUT_WEIGHT = 0.25;
  var HUE_MIN_SATURATION = 0.2;
  var WALL_RING_QUANTILE = 0.25;
  function notStandingOut(image, box, opts = {}) {
    if (standoutOf(image, box) < STANDOUT_SATURATION) return "standout";
    if (opts.grain === false) return null;
    return isDarkGrain(image, box) ? "dark-grain" : null;
  }
  function standoutOf(image, box) {
    const parts = standoutPartsOf(image, box);
    return parts === null ? Number.POSITIVE_INFINITY : Math.max(
      parts.saturation,
      parts.value * VALUE_STANDOUT_WEIGHT,
      parts.hue * HUE_STANDOUT_WEIGHT
    );
  }
  function standoutPartsOf(image, box) {
    const short = Math.min(box.w, box.h);
    const inset = Math.max(1, Math.round(short * 0.15));
    const reach = Math.max(2, Math.round(short * 0.3));
    const inside = [];
    const around = [];
    const satAt = (x, y) => {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) return null;
      const i = (y * image.width + x) * 4;
      return rgbToHsv({ r: image.data[i], g: image.data[i + 1], b: image.data[i + 2] });
    };
    for (let y = box.y + inset; y < box.y + box.h - inset; y += 2) {
      for (let x = box.x + inset; x < box.x + box.w - inset; x += 2) {
        const s = satAt(x, y);
        if (s !== null) inside.push(s);
      }
    }
    for (let y = box.y - reach; y < box.y + box.h + reach; y += 2) {
      for (let x = box.x - reach; x < box.x + box.w + reach; x += 2) {
        if (x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h) continue;
        const s = satAt(x, y);
        if (s !== null) around.push(s);
      }
    }
    if (inside.length === 0 || around.length === 0) return null;
    const pick = (values, at) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * at))];
    };
    const bySat = [...around].sort((a, b) => a.s - b.s);
    const wall = bySat.slice(0, Math.max(1, Math.round(bySat.length * WALL_RING_QUANTILE)));
    const wallS = pick(
      wall.map((p) => p.s),
      0.5
    );
    const wallV = pick(
      wall.map((p) => p.v),
      0.5
    );
    const wallH = pick(
      wall.map((p) => p.h),
      0.5
    );
    const satIn = pick(
      inside.map((p) => p.s),
      0.5
    );
    const dS = satIn - wallS;
    const dV = (pick(
      inside.map((p) => p.v),
      0.5
    ) - wallV) / Math.max(MIN_WALL_VALUE, wallV);
    const hIn = pick(
      inside.map((p) => p.h),
      0.5
    );
    const dH = satIn < HUE_MIN_SATURATION ? 0 : Math.min(Math.abs(hIn - wallH), 360 - Math.abs(hIn - wallH));
    return { saturation: dS, value: dV, hue: dH / 60 };
  }
  var STANDOUT_CALIBRATION = {
    STANDOUT_SATURATION,
    VALUE_STANDOUT_WEIGHT,
    MIN_WALL_VALUE,
    HUE_STANDOUT_WEIGHT,
    HUE_MIN_SATURATION,
    WALL_RING_QUANTILE
  };

  // packages/sticky-vision/src/components.ts
  var CLOSE_RADIUS_FRACTION = 6e-3;
  function dilateAxis(src, width, height, radius, horizontal) {
    const out = new Uint8Array(src.length);
    if (horizontal) {
      for (let y = 0; y < height; y += 1) {
        const row = y * width;
        let last = -(radius + 1);
        for (let x = 0; x < width; x += 1) {
          if (src[row + x] !== 0) last = x;
          out[row + x] = x - last <= radius ? 1 : 0;
        }
        last = width + radius;
        for (let x = width - 1; x >= 0; x -= 1) {
          if (src[row + x] !== 0) last = x;
          if (last - x <= radius) out[row + x] = 1;
        }
      }
    } else {
      for (let x = 0; x < width; x += 1) {
        let last = -(radius + 1);
        for (let y = 0; y < height; y += 1) {
          if (src[y * width + x] !== 0) last = y;
          out[y * width + x] = y - last <= radius ? 1 : 0;
        }
        last = height + radius;
        for (let y = height - 1; y >= 0; y -= 1) {
          if (src[y * width + x] !== 0) last = y;
          if (last - y <= radius) out[y * width + x] = 1;
        }
      }
    }
    return out;
  }
  function dilateBinary(bin, width, height, radius) {
    const h = dilateAxis(bin, width, height, radius, true);
    return dilateAxis(h, width, height, radius, false);
  }
  function erodeBinary(bin, width, height, radius) {
    const inv = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) inv[i] = bin[i] !== 0 ? 0 : 1;
    const dilated = dilateBinary(inv, width, height, radius);
    for (let i = 0; i < dilated.length; i += 1) dilated[i] = dilated[i] !== 0 ? 0 : 1;
    return dilated;
  }
  function closePaperMask(mask, opts = {}) {
    const { width, height, classes } = mask;
    const n = width * height;
    const longSide = Math.max(width, height);
    const radius = opts.radius ?? Math.max(2, Math.round(longSide * CLOSE_RADIUS_FRACTION));
    if (radius <= 0) return mask;
    const out = new Uint8Array(classes);
    let maxClass = 0;
    for (let i = 0; i < n; i += 1) if (classes[i] > maxClass) maxClass = classes[i];
    const bin = new Uint8Array(n);
    for (let c = 1; c <= maxClass; c += 1) {
      for (let i = 0; i < n; i += 1) bin[i] = classes[i] === c ? 1 : 0;
      const dil = dilateBinary(bin, width, height, radius);
      for (let i = 0; i < n; i += 1) {
        if (dil[i] !== 0 && classes[i] !== c && classes[i] !== 0) dil[i] = 0;
      }
      const closed = erodeBinary(dil, width, height, radius);
      for (let i = 0; i < n; i += 1) {
        if (closed[i] !== 0 && (out[i] === 0 || out[i] === c)) out[i] = c;
      }
    }
    return { width, height, classes: out };
  }
  function erodePaperMask(mask, radius) {
    const { width, height, classes } = mask;
    const n = width * height;
    if (radius <= 0) return mask;
    const out = new Uint8Array(n);
    let maxClass = 0;
    for (let i = 0; i < n; i += 1) if (classes[i] > maxClass) maxClass = classes[i];
    const bin = new Uint8Array(n);
    for (let c = 1; c <= maxClass; c += 1) {
      for (let i = 0; i < n; i += 1) bin[i] = classes[i] === c ? 1 : 0;
      const eroded = erodeBinary(bin, width, height, radius);
      for (let i = 0; i < n; i += 1) if (eroded[i] !== 0) out[i] = c;
    }
    return { width, height, classes: out };
  }
  function labelComponents(mask) {
    const { width, height, classes } = mask;
    const labels = new Int32Array(width * height);
    const parent = [0];
    const find = (x) => {
      let root = x;
      while (parent[root] !== root) root = parent[root];
      let cur = x;
      while (parent[cur] !== root) {
        const next = parent[cur];
        parent[cur] = root;
        cur = next;
      }
      return root;
    };
    const union2 = (a, b) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
    };
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        const c = classes[i];
        if (c === 0) continue;
        const west = x > 0 && classes[i - 1] === c ? labels[i - 1] : 0;
        const north = y > 0 && classes[i - width] === c ? labels[i - width] : 0;
        if (west === 0 && north === 0) {
          const next = parent.length;
          parent.push(next);
          labels[i] = next;
        } else if (west !== 0 && north !== 0) {
          labels[i] = Math.min(west, north);
          union2(west, north);
        } else {
          labels[i] = west || north;
        }
      }
    }
    const byRoot = /* @__PURE__ */ new Map();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        const label = labels[i];
        if (label === 0) continue;
        const root = find(label);
        const found = byRoot.get(root);
        if (!found) {
          byRoot.set(root, {
            classId: classes[i],
            minX: x,
            minY: y,
            maxX: x,
            maxY: y,
            pixels: 1
          });
          continue;
        }
        if (x < found.minX) found.minX = x;
        if (x > found.maxX) found.maxX = x;
        if (y < found.minY) found.minY = y;
        if (y > found.maxY) found.maxY = y;
        found.pixels += 1;
      }
    }
    return [...byRoot.values()];
  }

  // packages/sticky-vision/src/necks.ts
  var NECK_ERODE_FRACTION = 0.15;
  var NECK_MIN_CORE = 0.25;
  var NECK_REGROW = 2;
  var NECK_FRINGE_FREE = 1.5;
  var OPEN = 1;
  var BESIDE = 2;
  function regionOf(box, mask, pad) {
    const width = box.w + 2 * pad;
    const height = box.h + 2 * pad;
    const classes = new Uint8Array(width * height);
    for (let y = 0; y < box.h; y += 1) {
      const sy = y + box.y;
      if (sy < 0 || sy >= mask.height) continue;
      for (let x = 0; x < box.w; x += 1) {
        const sx = x + box.x;
        if (sx < 0 || sx >= mask.width) continue;
        if (mask.classes[sy * mask.width + sx] !== box.classId) continue;
        classes[(y + pad) * width + x + pad] = besideOther(mask, sx, sy, box.classId) ? BESIDE : OPEN;
      }
    }
    return { width, height, classes };
  }
  function besideOther(mask, x, y, own) {
    for (let yy = Math.max(0, y - 1); yy <= Math.min(mask.height - 1, y + 1); yy += 1)
      for (let xx = Math.max(0, x - 1); xx <= Math.min(mask.width - 1, x + 1); xx += 1) {
        const c = mask.classes[yy * mask.width + xx];
        if (c !== 0 && c !== own) return true;
      }
    return false;
  }
  function labelsOf(bin, width, height) {
    const labels = new Int32Array(bin.length);
    const stack = [];
    let next = 0;
    for (let start = 0; start < bin.length; start += 1) {
      if (bin[start] === 0 || labels[start] !== 0) continue;
      next += 1;
      labels[start] = next;
      stack.push(start);
      while (stack.length > 0) {
        const p = stack.pop();
        const x = p % width;
        const y = (p - x) / width;
        for (const q of [
          x > 0 ? p - 1 : -1,
          x < width - 1 ? p + 1 : -1,
          y > 0 ? p - width : -1,
          y < height - 1 ? p + width : -1
        ]) {
          if (q < 0 || bin[q] === 0 || labels[q] !== 0) continue;
          labels[q] = next;
          stack.push(q);
        }
      }
    }
    return labels;
  }
  function splitAtNecks(box, mask, noteSize) {
    if (noteSize <= 0 || box.w <= 0 || box.h <= 0) return [box];
    const radius = Math.max(1, Math.round(noteSize * NECK_ERODE_FRACTION));
    const region = regionOf(box, mask, radius);
    const { width, height } = region;
    const paper = { width, height, classes: region.classes.map((c) => c === 0 ? 0 : 1) };
    const eroded = erodePaperMask(paper, radius).classes;
    const labels = labelsOf(eroded, width, height);
    const counts = /* @__PURE__ */ new Map();
    for (const l of labels) if (l !== 0) counts.set(l, (counts.get(l) ?? 0) + 1);
    const minCore = (noteSize * NECK_MIN_CORE) ** 2;
    const cores = [...counts].filter(([, n]) => n >= minCore).map(([l]) => l);
    if (cores.length === 0) return [box];
    const owner = new Int32Array(labels.length);
    const keep = new Set(cores);
    let frontier = [];
    for (let p = 0; p < labels.length; p += 1) {
      if (keep.has(labels[p])) {
        owner[p] = labels[p];
        frontier.push(p);
      }
    }
    for (let step = 0; frontier.length > 0 && step < NECK_REGROW * radius; step += 1) {
      const next = [];
      const body = step < NECK_FRINGE_FREE * radius;
      for (const p of frontier) {
        const x = p % width;
        const l = x > 0;
        const r = x < width - 1;
        for (const q of [
          l ? p - 1 : -1,
          r ? p + 1 : -1,
          p - width,
          p + width,
          l ? p - width - 1 : -1,
          r ? p - width + 1 : -1,
          l ? p + width - 1 : -1,
          r ? p + width + 1 : -1
        ]) {
          if (q < 0 || q >= owner.length || region.classes[q] === 0 || owner[q] !== 0) continue;
          if (!body && region.classes[q] === BESIDE) continue;
          owner[q] = owner[p];
          next.push(q);
        }
      }
      frontier = next;
    }
    const pieces = /* @__PURE__ */ new Map();
    for (let p = 0; p < owner.length; p += 1) {
      const o = owner[p];
      if (o === 0) continue;
      const x = p % width - radius + box.x;
      const y = Math.floor(p / width) - radius + box.y;
      const piece = pieces.get(o);
      if (!piece) {
        pieces.set(o, { classId: box.classId, x, y, w: 1, h: 1, pixels: 1 });
        continue;
      }
      const x1 = Math.max(piece.x + piece.w, x + 1);
      const y1 = Math.max(piece.y + piece.h, y + 1);
      piece.x = Math.min(piece.x, x);
      piece.y = Math.min(piece.y, y);
      piece.w = x1 - piece.x;
      piece.h = y1 - piece.y;
      piece.pixels += 1;
    }
    return [...pieces.values()];
  }

  // packages/sticky-vision/src/split.ts
  var SPLIT_RATIO = 1.8;
  var SPLIT_KEEP_RATIO = 1.4;
  var SPLIT_BAND_THICKNESS = 2.6;
  var CUT_SNAP_FRACTION = 0.3;
  var VALLEY_MAX_FILL = 0.7;
  var NECK_MIN_AREA = 1.5;
  var NECK_MAX_PIECE = 1.4;
  function splitOversized(box, noteSize, mask, seams) {
    if (noteSize <= 0) return [box];
    const band = Math.min(box.w, box.h) <= noteSize * SPLIT_BAND_THICKNESS;
    if (!mask && fillRatio(box) < MIN_SOLID_FILL && !band) return [box];
    return atNecks(box, noteSize, mask).flatMap(
      (piece) => splitAxis(piece, noteSize, mask, seams, 0)
    );
  }
  function atNecks(box, noteSize, mask) {
    if (!mask || box.w * box.h < NECK_MIN_AREA * noteSize * noteSize) return [box];
    const parts = splitAtNecks(box, mask, noteSize);
    return parts.every((p) => Math.max(p.w, p.h) <= noteSize * NECK_MAX_PIECE) ? parts : [box];
  }
  var SPLIT_MAX_DEPTH = 4;
  function splitAxis(box, noteSize, mask, seams, depth) {
    const ratioW = box.w / noteSize;
    const ratioH = box.h / noteSize;
    const horizontal = ratioW >= ratioH;
    const ratio = horizontal ? ratioW : ratioH;
    if (depth >= SPLIT_MAX_DEPTH || ratio < SPLIT_RATIO) return [box];
    const pieces = Math.max(2, Math.round(ratio));
    const lines = cutLines(box, pieces, mask, horizontal, seams);
    if (lines.length < 3) return [box];
    const out = [];
    for (let i = 0; i + 1 < lines.length; i += 1) {
      const cell = {
        classId: box.classId,
        x: horizontal ? lines[i] : box.x,
        y: horizontal ? box.y : lines[i],
        w: horizontal ? lines[i + 1] - lines[i] : box.w,
        h: horizontal ? box.h : lines[i + 1] - lines[i],
        pixels: Math.round(box.pixels / (lines.length - 1))
      };
      const tight = mask ? tightenTo(cell, mask) : cell;
      if (!tight) continue;
      out.push(...splitAxis(tight, noteSize, mask, seams, depth + 1));
    }
    return out.length > 0 ? out : [box];
  }
  function cutLines(box, pieces, mask, horizontal, seams) {
    const from = horizontal ? box.x : box.y;
    const extent = horizontal ? box.w : box.h;
    if (pieces < 2) return [from, from + extent];
    const step = extent / pieces;
    const lines = [from];
    if (!mask) {
      for (let i = 1; i < pieces; i += 1) lines.push(Math.round(from + i * step));
      lines.push(from + extent);
      return lines;
    }
    const reach = Math.round(step * CUT_SNAP_FRACTION);
    const across = horizontal ? box.h : box.w;
    const mean = Math.min(across, box.pixels / Math.max(1, extent));
    const seamBar = mean * VALLEY_MAX_FILL;
    for (let i = 1; i < pieces; i += 1) {
      const found = emptiestLine(box, Math.round(from + i * step), reach, seams ?? mask, horizontal);
      const cutAt = found.count > seamBar ? Math.round(from + i * step) : found.at;
      if (cutAt > lines[lines.length - 1]) lines.push(cutAt);
    }
    lines.push(from + extent);
    return lines;
  }
  function emptiestLine(box, at, reach, mask, horizontal) {
    let best = at;
    let bestCount = Infinity;
    for (let offset = -reach; offset <= reach; offset += 1) {
      const line = at + offset;
      let count = 0;
      if (horizontal) {
        if (line <= box.x || line >= box.x + box.w) continue;
        for (let y = box.y; y < box.y + box.h; y += 1) {
          if (mask.classes[y * mask.width + line] === box.classId) count += 1;
        }
      } else {
        if (line <= box.y || line >= box.y + box.h) continue;
        for (let x = box.x; x < box.x + box.w; x += 1) {
          if (mask.classes[line * mask.width + x] === box.classId) count += 1;
        }
      }
      if (count < bestCount) {
        bestCount = count;
        best = line;
      }
    }
    return { at: best, count: bestCount };
  }
  function tightenTo(cell, mask) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let pixels = 0;
    const x1 = Math.min(mask.width, cell.x + cell.w);
    const y1 = Math.min(mask.height, cell.y + cell.h);
    for (let y = Math.max(0, cell.y); y < y1; y += 1) {
      for (let x = Math.max(0, cell.x); x < x1; x += 1) {
        if (mask.classes[y * mask.width + x] !== cell.classId) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        pixels += 1;
      }
    }
    if (pixels === 0) return null;
    return {
      classId: cell.classId,
      x: minX,
      y: minY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
      pixels
    };
  }
  var SPLIT_CALIBRATION = {
    SPLIT_RATIO,
    SPLIT_KEEP_RATIO,
    SPLIT_BAND_THICKNESS,
    CUT_SNAP_FRACTION,
    VALLEY_MAX_FILL,
    NECK_MIN_AREA,
    NECK_MAX_PIECE
  };

  // packages/sticky-vision/src/contour.ts
  var DX = [1, 1, 0, -1, -1, -1, 0, 1];
  var DY = [0, 1, 1, 1, 0, -1, -1, -1];
  function directionOf(dx, dy) {
    for (let d = 0; d < 8; d += 1) if (DX[d] === dx && DY[d] === dy) return d;
    return 4;
  }
  function traceOuterContour(bin, width, height) {
    let start = -1;
    for (let i = 0; i < bin.length; i += 1) {
      if (bin[i] !== 0) {
        start = i;
        break;
      }
    }
    if (start === -1) return [];
    const set = (x, y) => x >= 0 && y >= 0 && x < width && y < height && bin[y * width + x] !== 0;
    const sx = start % width;
    const sy = start / width | 0;
    const contour = [{ x: sx, y: sy }];
    let cx = sx;
    let cy = sy;
    let back = 4;
    let firstMove = -1;
    const limit = 4 * bin.length + 8;
    for (let steps = 0; steps < limit; steps += 1) {
      let moved = -1;
      for (let k = 1; k <= 8; k += 1) {
        const d = (back + k) % 8;
        if (set(cx + DX[d], cy + DY[d])) {
          moved = d;
          break;
        }
      }
      if (moved === -1) return contour;
      if (cx === sx && cy === sy) {
        if (firstMove === -1) firstMove = moved;
        else if (moved === firstMove) {
          contour.pop();
          return contour;
        }
      }
      const prev = (moved + 7) % 8;
      const px = cx + DX[prev];
      const py = cy + DY[prev];
      cx += DX[moved];
      cy += DY[moved];
      back = directionOf(px - cx, py - cy);
      contour.push({ x: cx, y: cy });
    }
    return contour;
  }
  function largestRegion(bin, width, height) {
    const labels = new Int32Array(bin.length);
    const queue = new Int32Array(bin.length);
    let best = 0;
    let bestSize = 0;
    let next = 0;
    for (let i = 0; i < bin.length; i += 1) {
      if (bin[i] === 0 || labels[i] !== 0) continue;
      next += 1;
      let head = 0;
      let tail = 0;
      queue[tail++] = i;
      labels[i] = next;
      while (head < tail) {
        const p = queue[head++];
        const x = p % width;
        const y = p / width | 0;
        for (let d = 0; d < 8; d += 1) {
          const nx = x + DX[d];
          const ny = y + DY[d];
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const q = ny * width + nx;
          if (bin[q] === 0 || labels[q] !== 0) continue;
          labels[q] = next;
          queue[tail++] = q;
        }
      }
      if (tail > bestSize) {
        bestSize = tail;
        best = next;
      }
    }
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) if (labels[i] === best && best !== 0) out[i] = 1;
    return out;
  }
  function distanceToLine(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
  }
  function cross(o, a, b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }
  function hullKeys(points) {
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const half = (pts) => {
      const out = [];
      for (const p of pts) {
        while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0)
          out.pop();
        out.push(p);
      }
      out.pop();
      return out;
    };
    const hull = [...half(sorted), ...half([...sorted].reverse())];
    return new Set(hull.map((p) => `${p.x},${p.y}`));
  }
  function convexityDefects(contour, minDepth) {
    if (contour.length < 4) return [];
    const keys = hullKeys(contour);
    const seen = /* @__PURE__ */ new Set();
    const hullAt = [];
    contour.forEach((p, i) => {
      const key = `${p.x},${p.y}`;
      if (keys.has(key) && !seen.has(key)) {
        seen.add(key);
        hullAt.push(i);
      }
    });
    if (hullAt.length < 2) return [];
    const notches = [];
    for (let h = 0; h < hullAt.length; h += 1) {
      const from = hullAt[h];
      const to = hullAt[(h + 1) % hullAt.length];
      const a = contour[from];
      const b = contour[to];
      let deepest = -1;
      let depth = 0;
      const span = (to - from + contour.length) % contour.length;
      for (let k = 1; k < span; k += 1) {
        const i = (from + k) % contour.length;
        const d = distanceToLine(contour[i], a, b);
        if (d > depth) {
          depth = d;
          deepest = i;
        }
      }
      if (deepest !== -1 && depth >= minDepth) {
        notches.push({ at: contour[deepest], depth, index: deepest, from, to });
      }
    }
    return notches;
  }

  // packages/sticky-vision/src/chords.ts
  var NOTCH_MIN_DEPTH = 0.12;
  var CHORD_MAX_LENGTH = 1.3;
  var PIECE_MIN_SIDE = 0.5;
  var PIECE_MIN_AREA = 0.35;
  var CHORD_MAX_DEPTH = 3;
  function emptyPiece() {
    return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, pixels: 0 };
  }
  function grow(p, x, y) {
    if (x < p.minX) p.minX = x;
    if (x > p.maxX) p.maxX = x;
    if (y < p.minY) p.minY = y;
    if (y > p.maxY) p.maxY = y;
    p.pixels += 1;
  }
  function isNote(p, noteSize) {
    if (p.pixels === 0) return false;
    const side = Math.min(p.maxX - p.minX + 1, p.maxY - p.minY + 1);
    return side >= noteSize * PIECE_MIN_SIDE && p.pixels >= noteSize * noteSize * PIECE_MIN_AREA;
  }
  function regionOf2(box, mask) {
    const bin = new Uint8Array(box.w * box.h);
    for (let y = 0; y < box.h; y += 1) {
      const row = (y + box.y) * mask.width + box.x;
      for (let x = 0; x < box.w; x += 1) {
        if (mask.classes[row + x] === box.classId) bin[y * box.w + x] = 1;
      }
    }
    return largestRegion(bin, box.w, box.h);
  }
  function splitBy(region, width, height, a, b) {
    const left = emptyPiece();
    const right = emptyPiece();
    const dx = b.at.x - a.at.x;
    const dy = b.at.y - a.at.y;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (region[y * width + x] === 0) continue;
        const side = dx * (y - a.at.y) - dy * (x - a.at.x);
        grow(side < 0 ? left : right, x, y);
      }
    }
    return [left, right];
  }
  function cutAtNotches(box, mask, noteSize, depth = 0) {
    if (noteSize <= 0 || depth >= CHORD_MAX_DEPTH) return [box];
    if (box.w <= 0 || box.h <= 0) return [box];
    const region = regionOf2(box, mask);
    const contour = traceOuterContour(region, box.w, box.h);
    const notches = convexityDefects(contour, noteSize * NOTCH_MIN_DEPTH);
    if (notches.length < 2) return [box];
    let best = null;
    let bestScore = 0;
    for (let i = 0; i < notches.length; i += 1) {
      for (let j = i + 1; j < notches.length; j += 1) {
        const a = notches[i];
        const b = notches[j];
        const length = Math.hypot(b.at.x - a.at.x, b.at.y - a.at.y);
        if (length > noteSize * CHORD_MAX_LENGTH) continue;
        const score = a.depth + b.depth;
        if (score <= bestScore) continue;
        const pieces = splitBy(region, box.w, box.h, a, b);
        if (!isNote(pieces[0], noteSize) || !isNote(pieces[1], noteSize)) continue;
        best = pieces;
        bestScore = score;
      }
    }
    if (!best) return [box];
    return best.flatMap(
      (p) => cutAtNotches(
        {
          classId: box.classId,
          x: box.x + p.minX,
          y: box.y + p.minY,
          w: p.maxX - p.minX + 1,
          h: p.maxY - p.minY + 1,
          pixels: p.pixels
        },
        mask,
        noteSize,
        depth + 1
      )
    );
  }

  // packages/sticky-vision/src/stats.ts
  function median(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  // packages/sticky-vision/src/seam.ts
  function luminanceOf(image) {
    const { width, height, data } = image;
    const out = new Uint8Array(width * height);
    for (let p = 0, i = 0; p < out.length; p += 1, i += 4) {
      out[p] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    return { width, height, data: out };
  }
  var SEAM_MIN_DEPTH = 12;
  var SEAM_MIN_PIECE = 0.55;
  var SEAM_MIN_SPAN = 1.4;
  var SEAM_MAX_TILT = 0.08;
  var STEP_MIN_SPAN = 1.6;
  var INK_BELOW_PAPER = 60;
  var SEAM_INSET = 0.1;
  var SEAM_MIN_PAPER = 0.5;
  var SEAM_MAX_DEPTH = 3;
  function paperLevel(lum, box) {
    const hist = new Uint32Array(256);
    let n = 0;
    for (let y = box.y; y < box.y + box.h; y += 1)
      for (let x = box.x; x < box.x + box.w; x += 1) {
        hist[lum.data[y * lum.width + x]] += 1;
        n += 1;
      }
    let seen = 0;
    for (let v = 0; v < 256; v += 1) {
      seen += hist[v];
      if (seen >= n * 0.6) return v;
    }
    return 255;
  }
  function lineAt(at, tilt, t, length) {
    return Math.round(at + tilt * (t - length / 2) / length);
  }
  function seamDepthAlong(lum, box, vertical, at, tilt, paper, steps) {
    const length = vertical ? box.h : box.w;
    const start = vertical ? box.y : box.x;
    const inset = Math.round(length * SEAM_INSET);
    const { width, height, data } = lum;
    const dips = [];
    const rises = [];
    let samples = 0;
    for (let t = inset; t < length - inset; t += 1) {
      const across = lineAt(at, tilt, t, length);
      const along = start + t;
      const x = vertical ? across : along;
      const y = vertical ? along : across;
      if (x < 4 || y < 4 || x >= width - 4 || y >= height - 4) continue;
      samples += 1;
      const step = vertical ? 1 : width;
      const p = y * width + x;
      const centre = Math.min(data[p - step], data[p], data[p + step]);
      if (centre < paper - INK_BELOW_PAPER) continue;
      const before = (data[p - 2 * step] + data[p - 3 * step] + data[p - 4 * step]) / 3;
      const after = (data[p + 2 * step] + data[p + 3 * step] + data[p + 4 * step]) / 3;
      dips.push(Math.min(before, after) - centre);
      rises.push(after - before);
    }
    if (samples === 0 || dips.length < samples * SEAM_MIN_PAPER) return null;
    const dip = median(dips);
    return steps ? Math.max(dip, Math.abs(median(rises))) : dip;
  }
  function findSeam(lum, box, noteSize) {
    if (noteSize <= 0) return null;
    const paper = paperLevel(lum, box);
    const margin = Math.round(noteSize * SEAM_MIN_PIECE);
    let best = null;
    for (const vertical of [true, false]) {
      const from = vertical ? box.x : box.y;
      const extent = vertical ? box.w : box.h;
      const length = vertical ? box.h : box.w;
      if (extent < noteSize * SEAM_MIN_SPAN) continue;
      const steps = extent >= noteSize * STEP_MIN_SPAN;
      const maxTilt = Math.round(length * SEAM_MAX_TILT);
      for (let at = from + margin; at <= from + extent - margin; at += 1) {
        for (let k = 0; k <= 2 * maxTilt; k += 1) {
          const tilt = k % 2 === 0 ? k / 2 : -(k + 1) / 2;
          const depth = seamDepthAlong(lum, box, vertical, at, tilt, paper, steps);
          if (depth === null || depth < SEAM_MIN_DEPTH) continue;
          if (!best || depth > best.depth) best = { vertical, at, tilt, depth };
        }
      }
    }
    return best;
  }
  function cutAtSeam(box, lum, mask, noteSize, depth = 0) {
    if (depth >= SEAM_MAX_DEPTH) return [box];
    const seam = findSeam(lum, box, noteSize);
    if (!seam) return [box];
    const sides = [
      { minX: Infinity, minY: Infinity, maxX: -1, maxY: -1, pixels: 0 },
      { minX: Infinity, minY: Infinity, maxX: -1, maxY: -1, pixels: 0 }
    ];
    const length = seam.vertical ? box.h : box.w;
    for (let y = box.y; y < box.y + box.h; y += 1) {
      for (let x = box.x; x < box.x + box.w; x += 1) {
        if (mask.classes[y * mask.width + x] !== box.classId) continue;
        const t = seam.vertical ? y - box.y : x - box.x;
        const line = lineAt(seam.at, seam.tilt, t, length);
        const side = sides[(seam.vertical ? x : y) <= line ? 0 : 1];
        if (x < side.minX) side.minX = x;
        if (x > side.maxX) side.maxX = x;
        if (y < side.minY) side.minY = y;
        if (y > side.maxY) side.maxY = y;
        side.pixels += 1;
      }
    }
    if (sides.some((s) => s.pixels === 0)) return [box];
    return sides.flatMap(
      (s) => cutAtSeam(
        {
          classId: box.classId,
          x: s.minX,
          y: s.minY,
          w: s.maxX - s.minX + 1,
          h: s.maxY - s.minY + 1,
          pixels: s.pixels
        },
        lum,
        mask,
        noteSize,
        depth + 1
      )
    );
  }

  // packages/sticky-vision/src/narrow.ts
  var SEAM_SEARCH_FROM = 0.3;
  var SEAM_SEARCH_TO = 0.7;
  function seamAcross(box, raw) {
    const horizontal = box.w > box.h;
    const along = horizontal ? box.w : box.h;
    const across = horizontal ? box.h : box.w;
    const fills = [];
    for (let i = 0; i < along; i += 1) {
      let count = 0;
      for (let j = 0; j < across; j += 1) {
        const x = horizontal ? box.x + i : box.x + j;
        const y = horizontal ? box.y + j : box.y + i;
        if (x < 0 || y < 0 || x >= raw.width || y >= raw.height) continue;
        if (raw.classes[y * raw.width + x] === box.classId) count += 1;
      }
      fills.push(count);
    }
    const mean = fills.reduce((a, b) => a + b, 0) / Math.max(1, along);
    if (mean === 0) return 0;
    const middle = fills.slice(
      Math.floor(along * SEAM_SEARCH_FROM),
      Math.max(Math.floor(along * SEAM_SEARCH_FROM) + 1, Math.ceil(along * SEAM_SEARCH_TO))
    );
    return Math.min(...middle) / mean;
  }
  var NARROW_SHORT_RATIO = 0.5;
  var NARROW_LONG_RATIO = 0.9;
  var NARROW_MIN_SEAM = 0.5;
  function isNarrowNote(box, noteSize, raw) {
    const short = Math.min(box.w, box.h);
    const long = Math.max(box.w, box.h);
    if (short < noteSize * NARROW_SHORT_RATIO || long < noteSize * NARROW_LONG_RATIO) return false;
    return raw === void 0 || seamAcross(box, raw) >= NARROW_MIN_SEAM;
  }
  var NARROW_RUN_ASPECT = 2;
  var NARROW_RUN_MAX = 4;
  function cutNarrowRun(box, noteSize, mask, raw) {
    const short = Math.min(box.w, box.h);
    const long = Math.max(box.w, box.h);
    const count = Math.round(long / (short * NARROW_RUN_ASPECT));
    if (count < 2 || count > NARROW_RUN_MAX) return [];
    const horizontal = box.w > box.h;
    const pieces = [];
    for (let i = 0; i < count; i += 1) {
      const from = Math.round(i * long / count);
      const to = Math.round((i + 1) * long / count);
      const piece = horizontal ? { ...box, x: box.x + from, w: to - from } : { ...box, y: box.y + from, h: to - from };
      pieces.push({ ...piece, parts: void 0, pixels: paperIn(piece, box, mask) });
    }
    return pieces.every((p) => isNarrowNote(p, noteSize, raw)) ? pieces : [];
  }
  function paperIn(piece, box, mask) {
    if (!mask) return Math.round(box.pixels * piece.w * piece.h / Math.max(1, box.w * box.h));
    let count = 0;
    for (let y = piece.y; y < piece.y + piece.h; y += 1)
      for (let x = piece.x; x < piece.x + piece.w; x += 1)
        if (mask.classes[y * mask.width + x] === box.classId) count += 1;
    return count;
  }

  // packages/sticky-vision/src/boxes.ts
  var MIN_AREA_FRACTION = 0.35;
  var MERGE_GAP_FRACTION = 0.12;
  var MERGE_MIN_FILL = 0.55;
  var MERGE_REACH_FRACTION = 0.3;
  var MERGE_REACH_MIN_FILL = 0.7;
  var PEN_STROKE_FRACTION = 6e-3;
  var MAX_MERGE_PASSES = 12;
  var NOISE_FLOOR_FRACTION = 8e-3;
  function noiseFloorFor(imageSize) {
    return Math.max(4, Math.round(imageSize * NOISE_FLOOR_FRACTION));
  }
  var MIN_SOLID_FILL = 0.55;
  var MIN_PAPER_FILL = 0.45;
  var MAX_PAPER_ASPECT = 2.4;
  var MAX_PAPER_SIZE_RATIO = 2.6;
  var MIN_PAPER_SIZE_RATIO = 0.7;
  var CUT_PIECE_SIZE_RATIO = 0.6;
  function fillRatio(box) {
    return box.pixels / Math.max(1, box.w * box.h);
  }
  function boxOf(c) {
    return {
      classId: c.classId,
      x: c.minX,
      y: c.minY,
      w: c.maxX - c.minX + 1,
      h: c.maxY - c.minY + 1,
      pixels: c.pixels
    };
  }
  function medianNoteSize(boxes) {
    return median(boxes.map((b) => Math.min(b.w, b.h)));
  }
  var SIZE_SAMPLE_MIN_FILL = 0.5;
  var SIZE_SAMPLE_MAX_ASPECT = 2.4;
  var MIN_SIZE_SAMPLE = 3;
  var MIN_CLASS_SIZE_SAMPLE = 10;
  function isPlausibleNote(b, noiseFloor) {
    const short = Math.max(1, Math.min(b.w, b.h));
    if (short < noiseFloor) return false;
    if (Math.max(b.w, b.h) / short > SIZE_SAMPLE_MAX_ASPECT) return false;
    return fillRatio(b) >= SIZE_SAMPLE_MIN_FILL;
  }
  function estimateNoteSize(boxes, noiseFloor) {
    const plausible = boxes.filter((b) => isPlausibleNote(b, noiseFloor));
    if (plausible.length < MIN_SIZE_SAMPLE) return 0;
    return medianNoteSize(plausible);
  }
  function estimateNoteSizes(boxes, noiseFloor, minSample = MIN_CLASS_SIZE_SAMPLE) {
    const byClass = /* @__PURE__ */ new Map();
    for (const b of boxes) byClass.set(b.classId, [...byClass.get(b.classId) ?? [], b]);
    const sizes = /* @__PURE__ */ new Map();
    for (const [classId, group] of byClass) {
      const plausible = group.filter((g) => isPlausibleNote(g, noiseFloor));
      if (plausible.length < minSample) continue;
      sizes.set(classId, medianNoteSize(plausible));
    }
    return sizes;
  }
  function gapBetween(a, b) {
    const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
    const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
    return Math.hypot(dx, dy);
  }
  function partsOf(box) {
    return box.parts ?? [box];
  }
  function union(a, b) {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return {
      classId: a.classId,
      x,
      y,
      w: Math.max(a.x + a.w, b.x + b.w) - x,
      h: Math.max(a.y + a.h, b.y + b.h) - y,
      pixels: a.pixels + b.pixels,
      parts: [...partsOf(a), ...partsOf(b)]
    };
  }
  var WHOLE_NOTE_SIDE = 0.45;
  function isWholeNote(b, noteSize) {
    return Math.min(b.w, b.h) >= noteSize * WHOLE_NOTE_SIDE;
  }
  function mergeFragments(boxes, noteSize) {
    const gap = noteSize * MERGE_GAP_FRACTION;
    const reach = noteSize * MERGE_REACH_FRACTION;
    const joins = (a, b) => {
      if (a.classId !== b.classId) return false;
      if (isWholeNote(a, noteSize) && isWholeNote(b, noteSize)) return false;
      const between = gapBetween(a, b);
      if (between > reach) return false;
      const fill = fillRatio(union(a, b));
      return between <= gap ? fill >= MERGE_MIN_FILL : fill >= MERGE_REACH_MIN_FILL;
    };
    let out = boxes.map((b) => ({ ...b }));
    for (let pass = 0; pass < MAX_MERGE_PASSES; pass += 1) {
      const next = [];
      for (const box of out) {
        const hit = next.findIndex((o) => joins(o, box));
        if (hit === -1) next.push({ ...box });
        else next[hit] = union(next[hit], box);
      }
      if (next.length === out.length) return next;
      out = next;
    }
    return out;
  }
  var RESCUE_ERODE_FRACTION = 0.12;
  var RESCUE_ROUNDS = 3;
  function fitBoxes(components, opts = {}) {
    const drop = opts.onDrop ?? (() => {
    });
    if (components.length === 0) return [];
    const refuse = (b, reason) => {
      if (reason === false) return true;
      drop(b, reason);
      return false;
    };
    const raw = components.map(boxOf);
    const imageSize = opts.imageSize ?? raw.reduce((m, b) => Math.max(m, b.x + b.w, b.y + b.h), 0);
    const gap = Math.max(2, Math.round(imageSize * PEN_STROKE_FRACTION));
    const merged = mergeFragments(
      raw,
      opts.noteSize && opts.noteSize > 0 ? opts.noteSize : gap / MERGE_GAP_FRACTION
    );
    const noiseFloor = noiseFloorFor(imageSize);
    const solid = merged.filter((b) => refuse(b, Math.min(b.w, b.h) < noiseFloor && "noise"));
    if (solid.length === 0) return [];
    const size = opts.noteSize && opts.noteSize > 0 ? opts.noteSize : medianNoteSize(solid);
    const minArea = (size * MIN_AREA_FRACTION) ** 2;
    const kept = solid.filter((b) => refuse(b, b.w * b.h < minArea && "area"));
    if (kept.length === 0) return [];
    const floorOf = (b) => {
      const own = opts.classNoteSize?.get(b.classId);
      return own !== void 0 && own > 0 && own < size ? own : size;
    };
    const isPaper = (b) => notPaper(b, MIN_PAPER_SIZE_RATIO) === null;
    const paperAt = (b, sizeRatio) => notPaper(b, sizeRatio) === null;
    const notPaper = (b, sizeRatio, whole = false) => {
      const long = Math.max(b.w, b.h);
      const short = Math.max(1, Math.min(b.w, b.h));
      if (long / short > MAX_PAPER_ASPECT) return "aspect";
      if (long > size * MAX_PAPER_SIZE_RATIO) return "too-big";
      const floorSize = floorOf(b);
      const narrow = whole && isNarrowNote(b, floorSize, opts.seams);
      if (short < floorSize * sizeRatio && !narrow) return "size-floor";
      return fillRatio(b) >= MIN_PAPER_FILL ? null : "fill";
    };
    const bigEnough = (b) => Math.min(b.w, b.h) >= noiseFloor && b.w * b.h >= minArea;
    const keepPaper = (b, whole = false) => refuse(b, notPaper(b, MIN_PAPER_SIZE_RATIO, whole) ?? false);
    const keepPiece = (b) => refuse(b, !bigEnough(b) && "piece-small");
    const standsAsCut = (cuts) => cuts.length > 1 && cuts.every((c) => paperAt(c, CUT_PIECE_SIZE_RATIO) && fillRatio(c) >= MIN_SOLID_FILL);
    const notched = (b) => {
      if (!opts.mask) return [b];
      const cuts = cutAtNotches(b, opts.mask, size);
      return standsAsCut(cuts) ? cuts : [b];
    };
    const seamed = (b) => {
      if (!opts.mask || !opts.luminance) return [b];
      const here = opts.sizeField?.sizeAt(b.x + b.w / 2, b.y + b.h / 2) ?? size;
      const cuts = cutAtSeam(b, opts.luminance, opts.mask, here);
      return standsAsCut(cuts) ? cuts : [b];
    };
    return kept.flatMap((box) => {
      const pieces = splitOversized(box, size, opts.mask, opts.seams).flatMap(notched).flatMap(seamed).filter((b) => keepPaper(b, b === box) && (b === box || keepPiece(b)));
      if (pieces.length > 0) return pieces;
      const parts = partsOf(box).filter(keepPiece).flatMap(
        (part) => splitOversized(part, size, opts.mask, opts.seams).filter((p) => keepPaper(p, p === part))
      );
      if (parts.length > 0) return parts;
      const run = cutNarrowRun(box, size, opts.mask, opts.seams);
      if (run.length > 0 && run.every((p) => notPaper(p, MIN_PAPER_SIZE_RATIO, true) === null))
        return run;
      if (!opts.mask) return [];
      const rescued = rescue(box, opts.mask, size, isPaper, bigEnough, opts.seams);
      if (rescued.length === 0) drop(box, "rescue");
      return rescued;
    });
  }
  function rescue(box, mask, noteSize, isPaper, bigEnough, seams) {
    const base = Math.max(1, Math.round(noteSize * RESCUE_ERODE_FRACTION));
    const out = [];
    let pending = [box];
    for (let round = 1; round <= RESCUE_ROUNDS && pending.length > 0; round += 1) {
      const next = [];
      for (const piece of pending) {
        const cuts = rescueBlock(piece, mask, base * round).flatMap(
          (p) => splitOversized(p, noteSize, mask, seams)
        );
        for (const cut of cuts) {
          if (!bigEnough(cut)) continue;
          if (isPaper(cut) && fillRatio(cut) >= MIN_SOLID_FILL) out.push(cut);
          else next.push(cut);
        }
      }
      pending = next;
    }
    return out;
  }
  function rescueBlock(box, mask, radius) {
    const x0 = Math.max(0, box.x);
    const y0 = Math.max(0, box.y);
    const x1 = Math.min(mask.width, box.x + box.w);
    const y1 = Math.min(mask.height, box.y + box.h);
    const width = x1 - x0;
    const height = y1 - y0;
    if (width <= 0 || height <= 0) return [];
    const classes = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const c = mask.classes[(y + y0) * mask.width + (x + x0)];
        classes[y * width + x] = c === box.classId ? c : 0;
      }
    }
    const eroded = erodePaperMask({ width, height, classes }, radius);
    return labelComponents(eroded).map((piece) => ({
      classId: box.classId,
      // Back out the erosion, so a piece is the note again rather than the note
      // minus a margin.
      x: x0 + Math.max(0, piece.minX - radius),
      y: y0 + Math.max(0, piece.minY - radius),
      w: Math.min(width, piece.maxX + radius) - Math.max(0, piece.minX - radius) + 1,
      h: Math.min(height, piece.maxY + radius) - Math.max(0, piece.minY - radius) + 1,
      pixels: piece.pixels
    }));
  }
  function silhouetteOf(box, noteSize) {
    if (noteSize <= 0) return "square";
    const ratio = box.w / Math.max(1, box.h);
    if (ratio >= 1.35) return "wide";
    if (Math.max(box.w, box.h) <= noteSize * 0.8) return "small";
    return "square";
  }
  var BOX_CALIBRATION = {
    ...SPLIT_CALIBRATION,
    SIZE_SAMPLE_MIN_FILL,
    SIZE_SAMPLE_MAX_ASPECT,
    MIN_SIZE_SAMPLE,
    MIN_AREA_FRACTION,
    MERGE_GAP_FRACTION,
    MERGE_MIN_FILL,
    MERGE_REACH_FRACTION,
    MERGE_REACH_MIN_FILL,
    WHOLE_NOTE_SIDE,
    RESCUE_ERODE_FRACTION,
    RESCUE_ROUNDS,
    MAX_PAPER_ASPECT,
    MAX_PAPER_SIZE_RATIO,
    MIN_PAPER_SIZE_RATIO,
    CUT_PIECE_SIZE_RATIO,
    MIN_SOLID_FILL,
    MIN_PAPER_FILL
  };

  // packages/sticky-vision/src/rows.ts
  var ROW_GAP_FRACTION = 0.5;
  function clusterRows(boxes, noteSize) {
    if (boxes.length === 0) return [];
    const gap = Math.max(1, noteSize * ROW_GAP_FRACTION);
    const withCentres = boxes.map((b) => ({ box: b, cy: b.y + b.h / 2 }));
    withCentres.sort((a, b) => a.cy - b.cy);
    const rows = [];
    let current = [];
    let lastCy = -Infinity;
    for (const entry of withCentres) {
      if (current.length > 0 && entry.cy - lastCy > gap) {
        rows.push(current);
        current = [];
      }
      current.push(entry);
      lastCy = entry.cy;
    }
    if (current.length > 0) rows.push(current);
    const out = [];
    rows.forEach((row, rowIndex) => {
      row.slice().sort((a, b) => a.box.x + a.box.w / 2 - (b.box.x + b.box.w / 2)).forEach(({ box }, order) => out.push({ ...box, row: rowIndex, order }));
    });
    return out;
  }

  // packages/sticky-vision/src/spill.ts
  var SPILL_DELTA_E = 14;
  var SPILL_REACH = 3;
  var MAX_SPILL = 1.75;
  var PAPER_INSET = 0.15;
  function coverageOf(width, height, boxes) {
    const covered = new Uint16Array(width * height);
    for (const b of boxes) {
      const x1 = Math.min(width, b.x + b.w);
      const y1 = Math.min(height, b.y + b.h);
      for (let y = Math.max(0, b.y); y < y1; y += 1) {
        for (let x = Math.max(0, b.x); x < x1; x += 1) covered[y * width + x] += 1;
      }
    }
    return covered;
  }
  function paperOf(lab, box) {
    const inset = Math.max(1, Math.round(Math.min(box.w, box.h) * PAPER_INSET));
    const x0 = Math.max(0, box.x + inset);
    const y0 = Math.max(0, box.y + inset);
    const x1 = Math.min(lab.width, box.x + box.w - inset);
    const y1 = Math.min(lab.height, box.y + box.h - inset);
    const n = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
    const planes = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    let k = 0;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1, k += 1) {
        const p = y * lab.width + x;
        planes[0][k] = lab.l[p];
        planes[1][k] = lab.a[p];
        planes[2][k] = lab.b[p];
      }
    }
    const median2 = (values) => values.length === 0 ? 0 : values.sort()[values.length >> 1];
    return [median2(planes[0]), median2(planes[1]), median2(planes[2])];
  }
  function spillIn(lab, covered, box, limit) {
    const [pl, pa, pb] = paperOf(lab, box);
    const reach = SPILL_DELTA_E * SPILL_DELTA_E;
    const x0 = Math.max(0, box.x - SPILL_REACH * box.w);
    const y0 = Math.max(0, box.y - SPILL_REACH * box.h);
    const x1 = Math.min(lab.width, box.x + box.w + SPILL_REACH * box.w);
    const y1 = Math.min(lab.height, box.y + box.h + SPILL_REACH * box.h);
    const w = x1 - x0;
    const h = y1 - y0;
    const area = Math.max(1, box.w * box.h);
    const cap = limit * area;
    const seen = new Uint8Array(w * h);
    const stack = [];
    const visit = (x, y) => {
      if (x < x0 || y < y0 || x >= x1 || y >= y1) return;
      const k = (y - y0) * w + (x - x0);
      if (seen[k]) return;
      seen[k] = 1;
      const p = y * lab.width + x;
      if (covered[p] > 0) return;
      const dl = lab.l[p] - pl;
      const da = lab.a[p] - pa;
      const db = lab.b[p] - pb;
      if (dl * dl + da * da + db * db < reach) stack.push(k);
    };
    for (let x = box.x; x < box.x + box.w; x += 1) {
      visit(x, box.y - 1);
      visit(x, box.y + box.h);
    }
    for (let y = box.y; y < box.y + box.h; y += 1) {
      visit(box.x - 1, y);
      visit(box.x + box.w, y);
    }
    let grown = 0;
    while (stack.length > 0 && grown <= cap) {
      const k = stack.pop();
      grown += 1;
      const x = x0 + k % w;
      const y = y0 + (k / w | 0);
      visit(x - 1, y);
      visit(x + 1, y);
      visit(x, y - 1);
      visit(x, y + 1);
    }
    return grown / area;
  }
  function dropSurfaces(image, boxes, onDrop) {
    if (boxes.length === 0) return boxes;
    const lab = labImageOf(image);
    let kept = boxes;
    for (; ; ) {
      const covered = coverageOf(image.width, image.height, kept);
      const next = kept.filter((box) => {
        const surface = spillIn(lab, covered, box, MAX_SPILL) > MAX_SPILL;
        if (surface) onDrop?.(box);
        return !surface;
      });
      if (next.length === kept.length) return next;
      kept = next;
    }
  }

  // packages/sticky-vision/src/rect.ts
  function overlapArea(a, b) {
    const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return ix * iy;
  }
  function iou(a, b) {
    const i = overlapArea(a, b);
    return i / Math.max(1, a.w * a.h + b.w * b.h - i);
  }

  // packages/sticky-vision/src/pads.ts
  var PAD_MAX_ASPECT = 1.5;
  var PAD_MIN_FILL = 0.6;
  var PAD_MAX_SIZE = 0.7;
  var PAD_SIZE_RATIO = 1.45;
  var PAD_REACH = 3.25;
  var PAD_MIN_NOTES = 3;
  var FUSED_MIN_ASPECT = 1.75;
  var FUSED_MAX_NOTES = 4;
  var FUSED_SIZE_RATIO = 1.5;
  var SAME_BOX_IOU = 0.5;
  var MAX_KEPT_OVERLAP = 0.25;
  var shortOf = (b) => Math.min(b.w, b.h);
  var isSquare = (b) => Math.max(b.w, b.h) / Math.max(1, shortOf(b)) <= PAD_MAX_ASPECT;
  var isSmall = (b, noteSize) => shortOf(b) <= noteSize * PAD_MAX_SIZE;
  function siblings(a, b, sizeRatio = PAD_SIZE_RATIO) {
    const sa = shortOf(a);
    const sb = shortOf(b);
    if (Math.max(sa, sb) / Math.max(1, Math.min(sa, sb)) > sizeRatio) return false;
    const d = Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2);
    return d <= PAD_REACH * Math.max(sa, sb);
  }
  function squaresOf(b, note) {
    const k = Math.max(2, Math.round(Math.max(b.w, b.h) / Math.max(1, note)));
    const along = b.w >= b.h ? b.w : b.h;
    const edge = (i) => Math.round(i * along / k);
    return Array.from({ length: k }, (_, i) => {
      const from = edge(i);
      const extent = edge(i + 1) - from;
      return b.w >= b.h ? { classId: b.classId, x: b.x + from, y: b.y, w: extent, h: b.h, pixels: b.pixels / k } : { classId: b.classId, x: b.x, y: b.y + from, w: b.w, h: extent, pixels: b.pixels / k };
    });
  }
  function padNoteNear(b, pad) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const reach = PAD_REACH * Math.max(b.w, b.h);
    const longs = pad.filter((m) => Math.hypot(m.x + m.w / 2 - cx, m.y + m.h / 2 - cy) <= reach).map((m) => Math.max(m.w, m.h)).sort((p, q) => p - q);
    return longs.length === 0 ? null : longs[longs.length >> 1];
  }
  function findPads(refused, kept, frame, noteSize) {
    const taken = [];
    const admissible = (b) => fillRatio(b) >= PAD_MIN_FILL && isSmall(b, noteSize) && b.x > 0 && b.y > 0 && b.x + b.w < frame.width && b.y + b.h < frame.height && !kept.some((k) => overlapArea(b, k) > b.w * b.h * MAX_KEPT_OVERLAP) && !taken.some((t) => iou(t, b) > SAME_BOX_IOU);
    const seeds = [];
    for (const b of refused) {
      if (!isSquare(b) || !admissible(b)) continue;
      seeds.push(b);
      taken.push(b);
    }
    if (seeds.length === 0) return [];
    const anchors = kept.filter((k) => isSquare(k) && isSmall(k, noteSize));
    const nodes = [...seeds, ...anchors];
    const group = nodes.map((_, i) => i);
    const root = (i) => group[i] === i ? i : group[i] = root(group[i]);
    for (let i = 0; i < nodes.length; i += 1)
      for (let j = i + 1; j < nodes.length; j += 1)
        if (siblings(nodes[i], nodes[j])) group[root(i)] = root(j);
    const sizes = /* @__PURE__ */ new Map();
    nodes.forEach((_, i) => sizes.set(root(i), (sizes.get(root(i)) ?? 0) + 1));
    const inPad = (i) => sizes.get(root(i)) >= PAD_MIN_NOTES;
    const pad = nodes.filter((_, i) => inPad(i));
    const found = seeds.filter((_, i) => inPad(i));
    if (pad.length === 0) return [];
    const squares = [];
    for (const b of refused) {
      const aspect = Math.max(b.w, b.h) / Math.max(1, shortOf(b));
      if (aspect < FUSED_MIN_ASPECT || fillRatio(b) < PAD_MIN_FILL) continue;
      const note = padNoteNear(b, pad) ?? shortOf(b);
      if (Math.round(Math.max(b.w, b.h) / note) > FUSED_MAX_NOTES) continue;
      for (const square of squaresOf(b, note)) {
        if (!admissible(square)) continue;
        squares.push(square);
        taken.push(square);
      }
    }
    const strays = seeds.filter((_, i) => !inPad(i));
    for (let grew = true; grew; ) {
      grew = false;
      for (const square of [...squares, ...strays]) {
        if (found.includes(square) || !pad.some((m) => siblings(m, square, FUSED_SIZE_RATIO)))
          continue;
        pad.push(square);
        found.push(square);
        grew = true;
      }
    }
    return found;
  }

  // packages/sticky-vision/src/size-field.ts
  var SIZE_FIELD_SPREAD = 1.5;
  var SIZE_FIELD_MIN_WEIGHT = 2.5;
  var SIZE_FIELD_MIN_RATIO = 0.5;
  var SIZE_FIELD_MAX_RATIO = 2;
  function noteSizeField(samples, wallSize) {
    const notes = samples.map((s) => ({ cx: s.x + s.w / 2, cy: s.y + s.h / 2, size: Math.min(s.w, s.h) })).sort((a, b) => a.size - b.size);
    const spread = 2 * (SIZE_FIELD_SPREAD * wallSize) ** 2;
    const lo = wallSize * SIZE_FIELD_MIN_RATIO;
    const hi = wallSize * SIZE_FIELD_MAX_RATIO;
    return {
      sizeAt(x, y) {
        if (wallSize <= 0) return wallSize;
        const weights = notes.map((n) => Math.exp(-((n.cx - x) ** 2 + (n.cy - y) ** 2) / spread));
        const total = weights.reduce((a, w) => a + w, 0);
        if (total < SIZE_FIELD_MIN_WEIGHT) return wallSize;
        let seen = 0;
        for (let i = 0; i < notes.length; i += 1) {
          seen += weights[i];
          if (seen >= total / 2) return Math.min(hi, Math.max(lo, notes[i].size));
        }
        return wallSize;
      }
    };
  }

  // packages/sticky-vision/src/hybrid.ts
  var centreIn = (r, b) => {
    const x = r.x + r.w / 2;
    const y = r.y + r.h / 2;
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  };
  var clip = (r, to) => {
    const x = Math.max(r.x, to.x);
    const y = Math.max(r.y, to.y);
    return {
      x,
      y,
      w: Math.min(r.x + r.w, to.x + to.w) - x,
      h: Math.min(r.y + r.h, to.y + to.h) - y
    };
  };
  var medianArea = (boxes) => median(boxes.map((b) => b.w * b.h));
  function paperUnder(mask, r) {
    const counts = /* @__PURE__ */ new Map();
    let paper = 0;
    let total = 0;
    const x0 = Math.max(0, Math.round(r.x));
    const y0 = Math.max(0, Math.round(r.y));
    const x1 = Math.min(mask.width, Math.round(r.x + r.w));
    const y1 = Math.min(mask.height, Math.round(r.y + r.h));
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        total += 1;
        const c = mask.classes[y * mask.width + x];
        if (c === 0) continue;
        paper += 1;
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    let classId = 0;
    let pixels = 0;
    for (const [c, n] of counts) {
      if (n > pixels) [classId, pixels] = [c, n];
    }
    return { classId, pixels, fraction: total ? paper / total : 0 };
  }
  function boxOn(mask, r, fallbackClass) {
    const under = paperUnder(mask, r);
    return {
      classId: under.classId || fallbackClass,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      pixels: under.pixels
    };
  }
  function meanBackground(cues, b) {
    let sum = 0;
    let n = 0;
    const x1 = Math.min(cues.width, b.x + b.w * 0.75);
    const y1 = Math.min(cues.height, b.y + b.h * 0.75);
    for (let y = Math.max(0, Math.round(b.y + b.h * 0.25)); y < y1; y += 1) {
      for (let x = Math.max(0, Math.round(b.x + b.w * 0.25)); x < x1; x += 1) {
        sum += cues.background[y * cues.width + x];
        n += 1;
      }
    }
    return n ? sum / n / 255 : 0;
  }
  function combineWithModel(boxes, cues, mask, rules, onDrop = () => {
  }) {
    if (cues.width !== mask.width || cues.height !== mask.height) {
      throw new Error(
        `model cues are ${cues.width}x${cues.height}, the image is ${mask.width}x${mask.height}`
      );
    }
    const medianBox = medianArea(boxes.length ? boxes : cues.notes);
    const sure = (n, r) => n.confidence >= r.minConfidence && n.w * n.h >= r.minAreaOfMedian * medianBox;
    let out = [...boxes];
    const { drop, split, add, pad } = rules;
    if (drop) {
      out = out.filter((b) => {
        const keep = cues.notes.some((n) => centreIn(n.core, b)) || meanBackground(cues, b) < drop.minBackground;
        if (!keep) onDrop(b);
        return keep;
      });
    }
    if (split) {
      out = out.flatMap((b) => {
        const inside = cues.notes.filter((n) => centreIn(n.core, b) && sure(n, split));
        if (inside.length < 2) return [b];
        return inside.map((n) => boxOn(mask, clip(n, b), b.classId));
      });
    }
    if (add) {
      for (const n of cues.notes) {
        if (!sure(n, add)) continue;
        if (out.some((b) => centreIn(n, b) || centreIn(b, n))) continue;
        const under = paperUnder(mask, n);
        if (under.fraction < add.minPaper) continue;
        out.push(boxOn(mask, n, under.classId));
      }
    }
    if (pad) {
      for (const n of cues.notes) {
        if (n.confidence < pad.minConfidence) continue;
        if (out.some((b) => centreIn(n, b) || centreIn(b, n))) continue;
        const side = Math.sqrt(n.w * n.h);
        const siblings2 = out.filter((b) => {
          const s = Math.sqrt(b.w * b.h);
          if (s > side * pad.sizeRatio || s * pad.sizeRatio < side) return false;
          const d = Math.hypot(b.x + b.w / 2 - (n.x + n.w / 2), b.y + b.h / 2 - (n.y + n.h / 2));
          return d <= pad.reach * Math.max(s, side);
        });
        if (siblings2.length < pad.minSiblings) continue;
        const under = paperUnder(mask, n);
        if (under.fraction < pad.minPaper) continue;
        out.push(boxOn(mask, n, under.classId));
      }
    }
    return out;
  }

  // packages/sticky-vision/src/detect.ts
  var CLOSE_NOTE_FRACTION = 0.02;
  var CLOSE_MAX_IMAGE_FRACTION = 6e-3;
  function closeRadiusFor(noteSize, imageSize) {
    const cap = Math.max(2, Math.round(imageSize * CLOSE_MAX_IMAGE_FRACTION));
    if (noteSize <= 0) return cap;
    return Math.max(1, Math.min(cap, Math.round(noteSize * CLOSE_NOTE_FRACTION)));
  }
  var DETECT_CALIBRATION = {
    ...STANDOUT_CALIBRATION,
    NOISE_FLOOR_FRACTION,
    CLOSE_NOTE_FRACTION,
    CLOSE_MAX_IMAGE_FRACTION
  };
  var CLASS_IDS = new Map(
    EVENT_STORMING_NOTES.map((n, i) => [n.kind, i + 1])
  );
  var PALE_SHADE_IDS = new Map(
    [...PALE_SHADE_KINDS].map((kind, i) => [kind, EVENT_STORMING_NOTES.length + 1 + i])
  );
  var KIND_BY_ID = new Map([
    ...[...CLASS_IDS].map(([kind, id]) => [id, kind]),
    ...[...PALE_SHADE_IDS].map(([kind, id]) => [id, kind])
  ]);
  function classMaskOf(image, floors) {
    const { width, height, data } = image;
    const field = floors ? null : localFloorsOf(image);
    const at = floors ?? { saturation: 0, value: 0, wallHue: -1 };
    const classes = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      if (data[i + 3] < 128) continue;
      if (field) field.floorsInto(p % width, p / width | 0, at);
      const c = classifyRgb(data[i], data[i + 1], data[i + 2], at);
      const id = isPaleShade(data[i], data[i + 1], data[i + 2], c) ? PALE_SHADE_IDS.get(c) : CLASS_IDS.get(c);
      if (id !== void 0) classes[p] = id;
    }
    return { width, height, classes };
  }
  function detectStickies(image, opts = {}) {
    const working = opts.balance === true ? greyWorldBalance(image) : image;
    const imageSize = Math.max(working.width, working.height);
    const mask = classMaskOf(working);
    const noiseFloor = noiseFloorFor(imageSize);
    const blobs = labelComponents(mask).map(boxOf);
    const noteSize = estimateNoteSize(blobs, noiseFloor);
    const classNoteSize = estimateNoteSizes(blobs, noiseFloor);
    const closed = closePaperMask(mask, { radius: closeRadiusFor(noteSize, imageSize) });
    const refused = [];
    const boxes = fitBoxes(labelComponents(closed), {
      imageSize,
      noteSize,
      // The mask goes with the components: cutting a run of touching notes
      // apart is a question about pixels, not about a bounding box.
      mask: closed,
      // …and the RAW mask goes with it too, because the close is what erases
      // the evidence a cut needs. Two notes lapped over each other are told
      // apart by the seam between them — a paper edge and its shadow, a few
      // pixels of not-paper — and a close wide enough to fuse handwriting is
      // wide enough to fill that seam in. Seams are read before it, boxes are
      // measured after it.
      seams: mask,
      classNoteSize,
      // …and the picture's brightness, so a merged run is cut where the paper
      // edge's shadow actually runs (`cutAtSeam`), not merely where a
      // note-length step falls.
      luminance: luminanceOf(working),
      // …and how big a note is around each point, read off the same raw blobs
      // the wall's size is: a wide photograph's far end, or a pad of small
      // notes, has seams at its own scale.
      sizeField: noteSizeField(
        blobs.filter((b) => isPlausibleNote(b, noiseFloor)),
        noteSize
      ),
      onDrop: (box, reason) => {
        if (reason === "area" || reason === "size-floor" || reason === "aspect") refused.push(box);
        opts.onDrop?.(box, reason);
      }
    });
    const drop = opts.onDrop ?? (() => {
    });
    const standOut = (list, grain = true) => list.filter((box) => {
      const why = notStandingOut(working, box, { grain });
      if (why !== null) drop(box, why);
      return why === null;
    });
    const firstPass = standOut(boxes);
    const outstanding = [
      ...firstPass,
      ...standOut(findPads(refused, firstPass, working, noteSize), false)
    ];
    const blankless = dropBlank(working, outstanding);
    if (blankless.length < outstanding.length) {
      const kept = new Set(blankless);
      for (const box of outstanding) if (!kept.has(box)) drop(box, "blank");
    }
    const surfaced = dropSurfaces(working, blankless, (box) => drop(box, "surface"));
    const standing = opts.model ? combineWithModel(
      surfaced,
      opts.model.cues,
      mask,
      opts.model.rules,
      (box) => drop(box, "model-background")
    ) : surfaced;
    if (standing.length === 0) return [];
    return clusterRows(standing, noteSize).map((box, i) => ({
      id: i,
      kind: KIND_BY_ID.get(box.classId) ?? "domain-event",
      size: silhouetteOf(box, noteSize),
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      row: box.row,
      order: box.order,
      // A solid rectangle of paper is 1; handwriting and overlap take it down.
      confidence: Math.min(1, box.pixels / Math.max(1, box.w * box.h))
    }));
  }

  // docs/demo/sticky-vision/demo-entry.ts
  window.StickyVisionDemo = { detectStickies, EVENT_STORMING_NOTES };
})();
