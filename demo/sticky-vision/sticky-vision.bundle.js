(() => {
  // packages/diagram/src/event-storming.ts
  var EVENT_STORMING_NOTES = [
    {
      kind: 'domain-event',
      label: 'Domain event',
      blurb: 'Something that happened, past tense',
      fill: '#fdba74',
      stage: 'big-picture',
      size: 'square',
    },
    {
      kind: 'command',
      label: 'Command',
      blurb: 'An intent that triggers an event',
      fill: '#93c5fd',
      stage: 'process',
      size: 'square',
    },
    {
      kind: 'actor',
      label: 'Actor',
      blurb: 'Who issues the command',
      fill: '#fef08a',
      stage: 'big-picture',
      size: 'small',
    },
    {
      kind: 'policy',
      label: 'Policy',
      blurb: 'Whenever X happens, then Y',
      fill: '#d8b4fe',
      stage: 'process',
      size: 'wide',
    },
    {
      kind: 'read-model',
      label: 'Read model',
      blurb: 'Information the actor decides on',
      fill: '#86efac',
      stage: 'process',
      size: 'square',
    },
    {
      kind: 'external-system',
      label: 'External system',
      blurb: 'A third party the flow touches',
      fill: '#f9a8d4',
      stage: 'process',
      size: 'wide',
    },
    {
      kind: 'aggregate',
      label: 'Aggregate',
      blurb: 'The thing commands act on',
      fill: '#fef9c3',
      stage: 'design',
      size: 'wide',
    },
    {
      kind: 'hotspot',
      label: 'Hotspot',
      blurb: 'A conflict, question, or risk',
      fill: '#fca5a5',
      stage: 'big-picture',
      size: 'square',
    },
  ];

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
      if (max === rr) h = ((gg - bb) / d) % 6;
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
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  // packages/sticky-vision/src/classify.ts
  var HUE_BANDS = [
    // Orange paper. Starts at 12 so the red-pink hotspot keeps its own ground.
    { kind: 'domain-event', from: 12, to: 44 },
    // Yellow: actor vs aggregate, split by saturation below.
    { kind: 'actor', from: 44, to: 70 },
    // Green, from the yellow-greens a warm room produces to a proper green.
    { kind: 'read-model', from: 70, to: 175 },
    // Blue.
    { kind: 'command', from: 185, to: 250 },
    // Purple. Runs to 305 because the pale lilac the operator's wall uses for a
    // policy measures h≈300 — a swatch would have said 280.
    { kind: 'policy', from: 250, to: 305 },
    // Pink, ALL of it: the operator's walls use pink for hotspots, and the
    // catalogue's external-system pink cannot be told from it in a photograph —
    // both are pink paper, and the pale one the catalogue uses is too pale to
    // clear the paper floor at all on a kraft wall. Hotspot wins; an
    // external-system read as a hotspot is re-kinded in the draft, which is one
    // click, and the alternative is a hotspot read as an external system, which
    // is a risk nobody flagged. See spec/139.
    { kind: 'hotspot', from: 305, to: 12 },
  ];
  var VALUE_FLOOR = 0.2;
  var SATURATION_FLOOR = 0.28;
  var PALE_YELLOW_MAX_SATURATION = 0.34;
  var YELLOW_KINDS = /* @__PURE__ */ new Set(['actor', 'aggregate']);
  var PAPER_CLASSES = EVENT_STORMING_NOTES.map((note) => {
    const hsv = rgbToHsv(hexToRgb(note.fill));
    return { kind: note.kind, hue: hsv.h, saturation: hsv.s, value: hsv.v };
  });
  var WALL_HUE_NEIGHBOURHOOD_DEG = 34;
  var OFF_HUE_MIN_SATURATION = 0.18;
  var DEFAULT_FLOORS = {
    saturation: SATURATION_FLOOR,
    value: VALUE_FLOOR,
    // A photo with no measurable wall has no hue to keep clear of.
    wallHue: -1,
  };
  function inBand(hue, band) {
    return band.from <= band.to
      ? hue >= band.from && hue < band.to
      : hue >= band.from || hue < band.to;
  }
  function classifyHsv(hsv, floors = DEFAULT_FLOORS) {
    if (hsv.v < VALUE_FLOOR) return 'ink';
    if (hsv.v < floors.value) return 'wall';
    const nearWallHue =
      floors.wallHue >= 0 && hueDistance(hsv.h, floors.wallHue) <= WALL_HUE_NEIGHBOURHOOD_DEG;
    const needed = nearWallHue
      ? floors.saturation
      : Math.min(floors.saturation, OFF_HUE_MIN_SATURATION);
    if (hsv.s < needed) return 'wall';
    const band = HUE_BANDS.find((b) => inBand(hsv.h, b));
    if (!band) return 'unknown';
    if (YELLOW_KINDS.has(band.kind)) {
      return hsv.s <= PALE_YELLOW_MAX_SATURATION ? 'aggregate' : 'actor';
    }
    return band.kind;
  }
  function classifyRgb(r, g, b, floors = DEFAULT_FLOORS) {
    return classifyHsv(rgbToHsv({ r, g, b }), floors);
  }
  var WALL_SATURATION_MARGIN = 0.14;
  var MIN_PAPER_SATURATION = 0.28;
  var WALL_VALUE_RATIO = 0.8;
  function medianHueOf(image) {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let i = 0; i < image.data.length; i += 4 * 7) {
      const r = image.data[i];
      const g = image.data[i + 1];
      const b = image.data[i + 2];
      const max = Math.max(r, g, b);
      if (max < 24) continue;
      const s = (max - Math.min(r, g, b)) / max;
      if (s > 0.3) continue;
      const h = (rgbToHsv({ r, g, b }).h * Math.PI) / 180;
      sx += Math.cos(h);
      sy += Math.sin(h);
      n += 1;
    }
    if (n === 0) return -1;
    const deg = (Math.atan2(sy / n, sx / n) * 180) / Math.PI;
    return deg < 0 ? deg + 360 : deg;
  }
  function otsu(buckets) {
    let total = 0;
    let sum = 0;
    for (let i = 0; i < buckets.length; i += 1) {
      total += buckets[i];
      sum += i * buckets[i];
    }
    if (total === 0) return 0;
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
      const between = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
      if (between > best) {
        best = between;
        bestAt = i;
      }
    }
    return bestAt / 100;
  }
  function wallFloorsOf(image) {
    const satBuckets = new Int32Array(101);
    const valBuckets = new Int32Array(101);
    let lit = 0;
    for (let i = 0; i < image.data.length; i += 4 * 7) {
      const r = image.data[i];
      const g = image.data[i + 1];
      const b = image.data[i + 2];
      const max = Math.max(r, g, b);
      if (max < 24) continue;
      const s = (max - Math.min(r, g, b)) / max;
      satBuckets[Math.round(s * 100)] += 1;
      valBuckets[Math.round((max / 255) * 100)] += 1;
      lit += 1;
    }
    if (lit === 0) return DEFAULT_FLOORS;
    const modeOf = (buckets) => {
      const window2 = 3;
      let bestAt = 0;
      let best = -1;
      for (let i = 0; i < buckets.length; i += 1) {
        let sum = 0;
        for (
          let j = Math.max(0, i - window2);
          j <= Math.min(buckets.length - 1, i + window2);
          j += 1
        ) {
          sum += buckets[j];
        }
        if (sum > best) {
          best = sum;
          bestAt = i;
        }
      }
      return bestAt / 100;
    };
    const wallSaturation = modeOf(satBuckets);
    const wallValue = modeOf(valBuckets);
    const split = otsu(satBuckets);
    return {
      saturation: Math.max(
        MIN_PAPER_SATURATION,
        Math.min(split, wallSaturation + WALL_SATURATION_MARGIN),
      ),
      value: Math.max(VALUE_FLOOR, wallValue * WALL_VALUE_RATIO),
      wallHue: medianHueOf(image),
    };
  }

  // packages/sticky-vision/src/components.ts
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
            pixels: 1,
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

  // packages/sticky-vision/src/boxes.ts
  var MIN_AREA_FRACTION = 0.35;
  var MERGE_GAP_FRACTION = 0.12;
  var PEN_STROKE_FRACTION = 6e-3;
  var MAX_MERGE_PASSES = 12;
  var NOISE_FLOOR_FRACTION = 8e-3;
  var MIN_SOLID_FILL = 0.55;
  var MIN_PAPER_FILL = 0.3;
  var MAX_PAPER_ASPECT = 2.4;
  var MAX_PAPER_SIZE_RATIO = 2.6;
  var SPLIT_RATIO = 1.9;
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
      pixels: c.pixels,
    };
  }
  function median(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
  function medianNoteSize(boxes) {
    return median(boxes.map((b) => Math.min(b.w, b.h)));
  }
  function gapBetween(a, b) {
    const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
    const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
    return Math.hypot(dx, dy);
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
    };
  }
  function mergeFragments(boxes, noteSize) {
    const gap = noteSize * MERGE_GAP_FRACTION;
    let out = boxes.map((b) => ({ ...b }));
    for (let pass = 0; pass < MAX_MERGE_PASSES; pass += 1) {
      const next = [];
      for (const box of out) {
        const hit = next.findIndex((o) => o.classId === box.classId && gapBetween(o, box) <= gap);
        if (hit === -1) next.push({ ...box });
        else next[hit] = union(next[hit], box);
      }
      if (next.length === out.length) return next;
      out = next;
    }
    return out;
  }
  function splitOversized(box, noteSize) {
    if (noteSize <= 0) return [box];
    if (fillRatio(box) < MIN_SOLID_FILL) return [box];
    const short = Math.max(1, Math.min(box.w, box.h));
    const cuts = (extent) =>
      extent / noteSize >= SPLIT_RATIO && extent / short >= SPLIT_RATIO
        ? Math.max(1, Math.round(extent / noteSize))
        : 1;
    const nx = cuts(box.w);
    const ny = cuts(box.h);
    if (nx * ny < 2) return [box];
    const stepX = box.w / nx;
    const stepY = box.h / ny;
    const out = [];
    for (let iy = 0; iy < ny; iy += 1) {
      for (let ix = 0; ix < nx; ix += 1) {
        out.push({
          classId: box.classId,
          x: Math.round(box.x + ix * stepX),
          y: Math.round(box.y + iy * stepY),
          w: Math.round(stepX),
          h: Math.round(stepY),
          pixels: Math.round(box.pixels / (nx * ny)),
        });
      }
    }
    return out;
  }
  function fitBoxes(components, opts = {}) {
    if (components.length === 0) return [];
    const raw = components.map(boxOf);
    const imageSize = opts.imageSize ?? raw.reduce((m, b) => Math.max(m, b.x + b.w, b.y + b.h), 0);
    const gap = Math.max(2, Math.round(imageSize * PEN_STROKE_FRACTION));
    const merged = mergeFragments(raw, gap / MERGE_GAP_FRACTION);
    const noiseFloor = Math.max(4, Math.round(imageSize * NOISE_FLOOR_FRACTION));
    const solid = merged.filter((b) => Math.min(b.w, b.h) >= noiseFloor);
    if (solid.length === 0) return [];
    const size = medianNoteSize(solid);
    const minArea = (size * MIN_AREA_FRACTION) ** 2;
    const kept = solid.filter((b) => b.w * b.h >= minArea);
    if (kept.length === 0) return [];
    const split = kept.flatMap((b) => splitOversized(b, size));
    return split.filter((b) => {
      const long = Math.max(b.w, b.h);
      const short = Math.max(1, Math.min(b.w, b.h));
      if (long / short > MAX_PAPER_ASPECT) return false;
      if (long > size * MAX_PAPER_SIZE_RATIO) return false;
      return fillRatio(b) >= MIN_PAPER_FILL;
    });
  }
  function silhouetteOf(box, noteSize) {
    if (noteSize <= 0) return 'square';
    const ratio = box.w / Math.max(1, box.h);
    if (ratio >= 1.35) return 'wide';
    if (Math.max(box.w, box.h) <= noteSize * 0.8) return 'small';
    return 'square';
  }

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
      row
        .slice()
        .sort((a, b) => a.box.x + a.box.w / 2 - (b.box.x + b.box.w / 2))
        .forEach(({ box }, order) => out.push({ ...box, row: rowIndex, order }));
    });
    return out;
  }

  // packages/sticky-vision/src/detect.ts
  var CLASS_IDS = new Map(EVENT_STORMING_NOTES.map((n, i) => [n.kind, i + 1]));
  var KIND_BY_ID = new Map([...CLASS_IDS].map(([kind, id]) => [id, kind]));
  function classMaskOf(image, floors) {
    const { width, height, data } = image;
    const paperFloors = floors ?? wallFloorsOf(image);
    const classes = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      if (data[i + 3] < 128) continue;
      const c = classifyRgb(data[i], data[i + 1], data[i + 2], paperFloors);
      const id = CLASS_IDS.get(c);
      if (id !== void 0) classes[p] = id;
    }
    return { width, height, classes };
  }
  function detectStickies(image, opts = {}) {
    const working = opts.balance === true ? greyWorldBalance(image) : image;
    const mask = classMaskOf(working);
    const boxes = fitBoxes(labelComponents(mask), {
      imageSize: Math.max(working.width, working.height),
    });
    if (boxes.length === 0) return [];
    const noteSize = medianNoteSize(boxes);
    return clusterRows(boxes, noteSize).map((box, i) => ({
      id: i,
      kind: KIND_BY_ID.get(box.classId) ?? 'domain-event',
      size: silhouetteOf(box, noteSize),
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      row: box.row,
      order: box.order,
      // A solid rectangle of paper is 1; handwriting and overlap take it down.
      confidence: Math.min(1, box.pixels / Math.max(1, box.w * box.h)),
    }));
  }

  // demo/sticky-vision/demo-entry.ts
  window.StickyVisionDemo = { detectStickies, EVENT_STORMING_NOTES };
})();
