// Builds the 3D view's character models (docs/specs/008-canvas/3d-engine.md "Characters"): one GLB per pack from
// Quaternius' Ultimate Modular Men and Women (CC0; packages/licences/texts/quaternius-modular-characters-CC0.txt),
// every chosen part on one shared skeleton, only the animations the Space plays, quantized and meshopt-compressed.
// Writes components/canvas/real-3d/characters/{men,women}.glb. Run outside the workspace (its tools are not
// dependencies of the app), with the packs' GLBs (Poly Pizza's downloads, named as in PACKS) in <srcdir>:
//   npm i @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 meshoptimizer
//   node build-characters.mjs <srcdir> <outdir>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  mergeDocuments,
  prune,
  dedup,
  quantize,
  weld,
  unpartition,
  meshopt,
  reorder,
} from '@gltf-transform/functions';
import fs from 'node:fs';
const drop = (a) => {
  for (const c of a.listChannels()) c.dispose();
  for (const s of a.listSamplers()) s.dispose();
  a.dispose();
};
import { MeshoptEncoder } from 'meshoptimizer';
await MeshoptEncoder.ready;

const [src, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const { MeshoptDecoder } = await import('meshoptimizer');
await MeshoptDecoder.ready;
io.registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

/** A 4x4 column-major matrix's inverse (general). */
function invert(m) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10,
    b01 = a00 * a12 - a02 * a10,
    b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11,
    b04 = a01 * a13 - a03 * a11,
    b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30,
    b07 = a20 * a32 - a22 * a30,
    b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31,
    b10 = a21 * a33 - a23 * a31,
    b11 = a22 * a33 - a23 * a32;
  const det = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * det,
    (a02 * b10 - a01 * b11 - a03 * b09) * det,
    (a31 * b05 - a32 * b04 + a33 * b03) * det,
    (a22 * b04 - a21 * b05 - a23 * b03) * det,
    (a12 * b08 - a10 * b11 - a13 * b07) * det,
    (a00 * b11 - a02 * b08 + a03 * b07) * det,
    (a32 * b02 - a30 * b05 - a33 * b01) * det,
    (a20 * b05 - a22 * b02 + a23 * b01) * det,
    (a10 * b10 - a11 * b08 + a13 * b06) * det,
    (a01 * b08 - a00 * b10 - a03 * b06) * det,
    (a30 * b04 - a31 * b02 + a33 * b00) * det,
    (a21 * b02 - a20 * b04 - a23 * b00) * det,
    (a11 * b07 - a10 * b09 - a12 * b06) * det,
    (a00 * b09 - a01 * b07 + a02 * b06) * det,
    (a31 * b01 - a30 * b03 - a32 * b00) * det,
    (a20 * b03 - a21 * b01 + a22 * b00) * det,
  ];
}

/**
 * How much fuller each bone's flesh is made across its length (the owner, 2026-11-27: "a bit fatter, too thin and
 * wiry"): the packs' figures are slender. Head, hands and feet keep their size.
 */
const FULLER = [
  [/^(Hips|Abdomen|Torso)$/, 1.36],
  [/^Chest$/, 1.26],
  [/^Neck$/, 1.14],
  [/^Shoulder\./, 1.16],
  [/^UpperArm\./, 1.38],
  [/^LowerArm\./, 1.28],
  [/^Wrist\./, 1.1],
  [/^UpperLeg\./, 1.36],
  [/^LowerLeg\./, 1.26],
];
/** The child a bone's length runs to (the spine before the legs or shoulders). */
const NEXT = ['Abdomen', 'Torso', 'Chest', 'Neck', 'Head'];

/** Each vertex moved out from its bones' axes by their fullness, blended by its skin weights. */
function fatten(root, skin) {
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices();
  const at = joints.map((_, i) => {
    const m = invert(ibm.getElement(i, []));
    return [m[12], m[13], m[14]];
  });
  const bone = joints.map((j, i) => {
    const name = j.getName();
    const k = FULLER.find(([re]) => re.test(name))?.[1] ?? 1;
    const kids = j.listChildren().filter((c) => joints.includes(c));
    const next = kids.find((c) => NEXT.includes(c.getName())) ?? kids[0];
    if (k === 1 || !next) return null;
    const h = at[i];
    const t = at[joints.indexOf(next)];
    const a = [t[0] - h[0], t[1] - h[1], t[2] - h[2]];
    const len = Math.hypot(...a) || 1;
    return { k, h, a: a.map((v) => v / len) };
  });
  const done = new Set();
  for (const node of root.listNodes()) {
    if (node.getSkin() !== skin || !node.getMesh()) continue;
    for (const prim of node.getMesh().listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const js = prim.getAttribute('JOINTS_0');
      const ws = prim.getAttribute('WEIGHTS_0');
      if (!js || !ws || done.has(pos)) continue;
      done.add(pos);
      const p = [],
        j = [],
        w = [];
      for (let v = 0; v < pos.getCount(); v++) {
        pos.getElement(v, p);
        js.getElement(v, j);
        ws.getElement(v, w);
        const out = [0, 0, 0];
        let sum = 0;
        for (let q = 0; q < 4; q++) {
          if (w[q] <= 0) continue;
          sum += w[q];
          const b = bone[j[q]];
          if (!b) {
            for (let c = 0; c < 3; c++) out[c] += w[q] * p[c];
            continue;
          }
          const d = [p[0] - b.h[0], p[1] - b.h[1], p[2] - b.h[2]];
          const along = d[0] * b.a[0] + d[1] * b.a[1] + d[2] * b.a[2];
          for (let c = 0; c < 3; c++) {
            const axis = b.h[c] + along * b.a[c];
            out[c] += w[q] * (axis + (p[c] - axis) * b.k);
          }
        }
        if (sum > 0)
          pos.setElement(
            v,
            out.map((x) => x / sum),
          );
      }
    }
  }
}

/**
 * The women's heads name their eyes and brows by colour (Brown, Hair_Brown), and the bun's draws both in one: each
 * head's eyes become an `Eye` part and its brows `Eyebrows`, as the men's are, so the face can find them.
 */
const EYE_CORNERS = 48;
function faceParts(doc) {
  const root = doc.getRoot();
  const made = new Map();
  const material = (name, from) => {
    if (!made.has(name)) made.set(name, from.clone().setName(name));
    return made.get(name);
  };
  for (const node of root.listNodes()) {
    if (!node.getName().startsWith('head:') || !node.getMesh()) continue;
    const mesh = node.getMesh();
    const prims = mesh.listPrimitives();
    if (prims.some((p) => p.getMaterial()?.getName() === 'Eye')) continue;
    const named = (n) => prims.find((p) => p.getMaterial()?.getName() === n);
    const brows = named('Hair_Brown');
    if (brows && brows.getAttribute('POSITION').getCount() < 200)
      brows.setMaterial(material('Eyebrows', brows.getMaterial()));
    const eyes = named('Brown');
    if (!eyes) continue;
    const eyeMat = material('Eye', eyes.getMaterial());
    eyes.setMaterial(eyeMat);
    // Each head's eyes are 48 corners (24 a side); the bun's Brown draws its brows too, above them.
    if (eyes.getAttribute('POSITION').getCount() <= EYE_CORNERS) continue;
    const idx = eyes.getIndices().getArray();
    const pos = eyes.getAttribute('POSITION');
    const parent = Array.from({ length: pos.getCount() }, (_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let t = 0; t < idx.length; t += 3) {
      parent[find(idx[t + 1])] = find(idx[t]);
      parent[find(idx[t + 2])] = find(idx[t]);
    }
    const pieces = new Map();
    const p = [];
    for (let t = 0; t < idx.length; t += 3) {
      const r = find(idx[t]);
      const piece = pieces.get(r) ?? { tris: [], x: 0, z: 0, n: 0 };
      for (let c = 0; c < 3; c++) {
        pos.getElement(idx[t + c], p);
        piece.x += p[0];
        piece.z += p[2];
        piece.n++;
      }
      piece.tris.push(idx[t], idx[t + 1], idx[t + 2]);
      pieces.set(r, piece);
    }
    // Its pieces, highest first, are brows until what is left is the eyes.
    const browPieces = new Set();
    let left = pos.getCount();
    for (const piece of [...pieces.values()].sort((m, n) => n.z / n.n - m.z / m.n)) {
      if (left <= EYE_CORNERS) break;
      browPieces.add(piece);
      left -= new Set(piece.tris).size;
    }
    const browTris = [...browPieces].flatMap((pc) => pc.tris);
    const eyeTris = [...pieces.values()]
      .filter((pc) => !browPieces.has(pc))
      .flatMap((pc) => pc.tris);
    if (browTris.length === 0) continue;
    eyes.setIndices(
      doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(new Uint32Array(eyeTris))
        .setBuffer(root.listBuffers()[0]),
    );
    const brow = doc.createPrimitive().setMaterial(material('Eyebrows', eyes.getMaterial()));
    for (const s of eyes.listSemantics()) brow.setAttribute(s, eyes.getAttribute(s));
    brow.setIndices(
      doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(new Uint32Array(browTris))
        .setBuffer(root.listBuffers()[0]),
    );
    mesh.addPrimitive(brow);
  }
}

const KEEP_ANIMS = new Set(['Idle', 'Idle_Neutral', 'Walk', 'Run', 'Wave', 'Interact']);
const PACKS = {
  men: {
    base: 'm-casual',
    files: {
      'm-casual': {
        Casual2_Head: 'head:casual',
        Casual2_Body: 'body:tee',
        Casual2_Legs: 'legs:jeans',
        Casual2_Feet: 'feet:trainers',
      },
      'm-business': {
        Suit_Head: 'head:neat',
        Suit_Body: 'body:suit',
        Suit_Legs: 'legs:suit',
        Suit_Feet: 'feet:shoes',
      },
      'm-hoodie': {
        Casual_Head: 'head:curly',
        Casual_Body: 'body:hoodie',
        Casual_Legs: 'legs:shorts',
        Casual_Feet: 'feet:sneakers',
      },
      'm-beach': {
        Beach_Head: 'head:spiky',
        Beach_Body: 'body:vest',
        Beach_Legs: 'legs:board',
        Beach_Feet: 'feet:flipflops',
      },
      'm-punk': {
        Punk_Head: 'head:mohawk',
        Punk_Body: 'body:jacket',
        Punk_Legs: 'legs:ripped',
        Punk_Feet: 'feet:boots',
      },
      'm-farmer': {
        Farmer_Body: 'body:overalls',
        Farmer_Pants: 'legs:overalls',
        Farmer_Feet: 'feet:workboots',
      },
      'm-worker': {
        Worker_Body: 'body:hivis',
        Worker_Legs: 'legs:cargo',
        Worker_Feet: 'feet:safety',
      },
    },
  },
  women: {
    base: 'w-b',
    files: {
      'w-b': {
        Casual_Head: 'head:long',
        Casual_Body: 'body:tee',
        Casual_Legs: 'legs:jeans',
        Casual_Feet: 'feet:shoes',
      },
      'w-a': {
        Formad_Head: 'head:bun',
        Formal_Body: 'body:dress',
        Formal_Legs: 'legs:dress',
        Formal_Feet: 'feet:flats',
      },
      'w-suit': {
        Suit_Head: 'head:neat',
        Suit_Body: 'body:suit',
        Suit_Legs: 'legs:suit',
        Suit_Feet: 'feet:heels',
      },
      'w-punk': {
        Punk_Head: 'head:mohawk',
        Punk_Body: 'body:crop',
        Punk_Legs: 'legs:ripped',
        Punk_Feet: 'feet:boots',
      },
      'w-adventurer': {
        Adventurer_Head: 'head:short',
        Adventurer_Body: 'body:adventurer',
        Adventurer_Legs: 'legs:shorts',
        Adventurer_Feet: 'feet:boots2',
      },
      'w-worker': {
        Worker_Body: 'body:hivis',
        Worker_Legs: 'legs:cargo',
        Worker_Feet: 'feet:safety',
      },
    },
  },
};

for (const [gender, pack] of Object.entries(PACKS)) {
  const doc = await io.read(`${src}/${pack.base}.glb`);
  const root = doc.getRoot();
  const baseSkin = root.listSkins()[0];
  const baseScene = root.listScenes()[0];
  const baseNodes = new Set(root.listNodes());
  // Rename the base's own part nodes, drop its animations but the few we use.
  for (const a of root.listAnimations()) {
    const name = a.getName().replace(/^CharacterArmature\|/, '');
    if (KEEP_ANIMS.has(name)) a.setName(name);
    else drop(a);
  }
  const partParent =
    root
      .listNodes()
      .find((n) => n.getMesh() && baseNodes.has(n))
      ?.getParentNode() ?? null;
  for (const [file, parts] of Object.entries(pack.files)) {
    let nodes;
    if (file === pack.base) nodes = root.listNodes().filter((n) => n.getMesh());
    else {
      const other = await io.read(`${src}/${file}.glb`);
      for (const a of other.getRoot().listAnimations()) drop(a);
      const before = new Set(root.listNodes());
      mergeDocuments(doc, other);
      nodes = root.listNodes().filter((n) => !before.has(n) && n.getMesh());
    }
    for (const n of nodes) {
      const id = parts[n.getName()];
      if (!id) {
        if (file === pack.base) throw new Error(`unmapped base part ${n.getName()}`);
        n.dispose();
        continue;
      }
      n.setName(id);
      n.getMesh().setName(id);
      // Every part on the one skeleton (the packs give each part its own copy of the same skin).
      n.setSkin(baseSkin);
      if (file !== pack.base) {
        n.getParentNode()?.removeChild(n);
        for (const s of root.listScenes()) s.removeChild(n);
        if (partParent) partParent.addChild(n);
        else baseScene.addChild(n);
      }
    }
  }
  // Only the base's scene, skin and skeleton stay.
  for (const s of root.listScenes()) if (s !== baseScene) s.dispose();
  for (const s of root.listSkins()) if (s !== baseSkin) s.dispose();
  root.setDefaultScene(baseScene);
  // Leftovers of the merged files: their skins, armatures and the data only they used.
  const used = new Set(
    root
      .listNodes()
      .filter((n) => n.getMesh())
      .map((n) => n.getSkin()),
  );
  for (const s of root.listSkins()) if (!used.has(s)) s.dispose();
  const inScene = new Set();
  baseScene.traverse((n) => inScene.add(n));
  for (const n of root.listNodes()) if (!inScene.has(n)) n.dispose();
  for (const a of root.listAccessors())
    if (a.listParents().every((p) => p.propertyType === 'Root')) a.dispose();
  fatten(root, baseSkin);
  faceParts(doc);
  await doc.transform(
    prune(),
    // Names kept: the app finds the face's parts by their materials' names.
    dedup({ keepUniqueNames: true }),
    weld(),
    quantize({ quantizePosition: 14, quantizeNormal: 8 }),
    unpartition(),
    reorder({ encoder: MeshoptEncoder }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  fs.mkdirSync(out, { recursive: true });
  await io.write(`${out}/${gender}.glb`, doc);
  const parts = root
    .listNodes()
    .filter((n) => n.getMesh())
    .map((n) => n.getName());
  console.log(
    gender,
    fs.statSync(`${out}/${gender}.glb`).size,
    parts.join(' '),
    root
      .listAnimations()
      .map((a) => a.getName())
      .join(' '),
  );
}
