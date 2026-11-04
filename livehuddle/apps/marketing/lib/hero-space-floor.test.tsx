import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  createShape,
  renderElementsToSvg,
  shade,
  tint,
  type Element,
  type Tab,
} from '@livehuddle/document';
import { AVATAR_DEFAULTS, configureAvatar } from '@liveworkspace/avatar/bindings';
import { AvatarSprite } from '@liveworkspace/avatar/components/avatar-sprite';
import { reactionPose } from '@liveworkspace/avatar/reactions';
import { avatarBox, type AvatarFacing } from '@liveworkspace/avatar/walk';
import { Hero } from '@/components/Hero';
import {
  FLOOR_AVATAR_SCALE,
  FLOOR_CAST_HREF,
  FLOOR_FURNITURE_SCALE,
  FLOOR_PAPER,
  FLOOR_RUG,
  FLOOR_STAGES,
  floorArtHref,
  type FloorStage,
  type Walker,
} from '@/components/hero-space-floor-cast';
import {
  FRAME,
  floorCss,
  stillId,
  stillKeysOf,
  type StillKey,
} from '@/components/hero-space-floor-motion';

// The landing hero's Space (docs/specs/019-marketing/marketing-site.md "Hero"), written from the cast file: the
// furniture is the editor's own office pieces drawn by its own SVG renderer, once per stage and appearance; the
// characters' stills are Avatar mode's own sprite in one sheet; the moves are keyframes. This test is both the
// generator and the guard: it fails when a committed file drifts from what they make today, and
// `HERO_SPACE_WRITE=1 vitest run lib/hero-space-floor.test.tsx` writes them afresh.

// The shirt's shaded side in the editor's own colour maths, as the editor binds Avatar mode at startup.
configureAvatar({ ...AVATAR_DEFAULTS, shade, tint });

const SCHEMES = ['light', 'dark'] as const;
const appPath = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));
const write = (path: string, text: string) => {
  if (process.env.HERO_SPACE_WRITE === '1') writeFileSync(path, text);
};

/** The stage's furniture as canvas elements, scaled to the characters, rugs first so they lie under the rest. */
function furnitureElements(stage: FloorStage, scheme: (typeof SCHEMES)[number]): Element[] {
  const pieces = stage.furniture.map((piece, i) => {
    const base = createShape(piece.kind, piece.x, piece.y) as Element & {
      width: number;
      height: number;
    };
    const width = piece.width ?? base.width * FLOOR_FURNITURE_SCALE;
    const height = (base.height * width) / base.width;
    return {
      ...base,
      id: `floor-${i}`,
      width: Math.round(width),
      height: Math.round(height),
      label: '',
      ...(piece.facing ? { chairFacing: piece.facing } : {}),
      ...(piece.kind === 'rug' ? { fillColor: FLOOR_RUG[scheme] } : {}),
    } as Element;
  });
  const isRug = (e: Element) => (e as { shape?: string }).shape === 'rug';
  return [...pieces.filter(isRug), ...pieces.filter((e) => !isRug(e))];
}

/** The drawing on the stage's own box, with no paper of its own: the band shows through. */
function floorSvg(stage: FloorStage, scheme: (typeof SCHEMES)[number]): string {
  const tab = {
    id: 'hero',
    name: 'Hero',
    elements: furnitureElements(stage, scheme),
  } as unknown as Tab;
  const svg = renderElementsToSvg(tab, { padding: 0, background: FLOOR_PAPER[scheme] });
  const open = svg.indexOf('>') + 1;
  const paper = svg.indexOf('/>', open) + 2;
  const { width, height } = stage;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    svg.slice(paper) +
    '\n'
  );
}

const BOX = avatarBox(FLOOR_AVATAR_SCALE);

/** How the sprite draws one still. */
function spriteFor(walker: Walker, key: StillKey) {
  const base = {
    config: walker.config,
    shirt: walker.colour,
    scale: FLOOR_AVATAR_SCALE,
    holding: walker.holding ?? null,
    wave: null,
    stepFrame: 0,
    lift: 0,
    walking: false,
    pose: null,
    facing: 'down' as AvatarFacing,
  };
  const [kind, a, b] = key.split('-') as [string, string?, string?];
  if (kind === 'walk')
    return { ...base, facing: a as AvatarFacing, walking: true, stepFrame: Number(b) };
  if (kind === 'wave') return { ...base, pose: reactionPose('wave', Number(a) * 170) };
  if (kind === 'sit') return { ...base, seated: true };
  return { ...base, facing: a as AvatarFacing };
}

/** Every still of every character on every stage, one <symbol> each, cropped to the strip's frame. */
function castSheet(): string {
  const symbols = new Map<string, string>();
  for (const stage of FLOOR_STAGES) {
    for (const walker of stage.cast) {
      for (const key of stillKeysOf(walker)) {
        const id = stillId(walker, key);
        if (symbols.has(id)) continue;
        const sprite = renderToStaticMarkup(<AvatarSprite {...spriteFor(walker, key)} />);
        const top = BOX.height - FRAME.height;
        symbols.set(
          id,
          `<symbol id="${id}" viewBox="0 ${+top.toFixed(2)} ${FRAME.width} ${FRAME.height}">${sprite}</symbol>`,
        );
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg">\n${[...symbols.values()].join('\n')}\n</svg>\n`;
}

describe('the hero Space floor art', () => {
  it('crops each still to the frame the strip shows, feet where the stage puts them', () => {
    expect(BOX.width).toBe(FRAME.width);
    expect(+(BOX.offsetY - (BOX.height - FRAME.height)).toFixed(2)).toBe(FRAME.feetY);
    expect(BOX.offsetX).toBe(FRAME.feetX);
  });

  it('is drawn by the sprite as committed', () => {
    const sheet = castSheet();
    const path = appPath(`public${FLOOR_CAST_HREF}`);
    write(path, sheet);
    expect(readFileSync(path, 'utf8')).toBe(sheet);
  });

  it('holds every still the hero shows, and nothing it does not', () => {
    const sheet = readFileSync(appPath(`public${FLOOR_CAST_HREF}`), 'utf8');
    const held = [...sheet.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]);
    const used = new Set(
      [...renderToStaticMarkup(<Hero />).matchAll(/floor-cast\.svg#([^"]+)"/g)].map((m) => m[1]),
    );
    expect([...used].sort()).toEqual([...held].sort());
  });

  it('dresses a character the same on every stage, so they share their stills', () => {
    const byName = new Map<string, Walker>();
    for (const walker of FLOOR_STAGES.flatMap((s) => s.cast)) {
      const seen = byName.get(walker.name);
      if (seen) {
        expect(walker.config).toEqual(seen.config);
        expect(walker.colour).toBe(seen.colour);
        expect(walker.holding).toBe(seen.holding);
      }
      byName.set(walker.name, walker);
    }
  });

  it.each(
    FLOOR_STAGES.flatMap((stage) => SCHEMES.map((scheme) => [stage.key, scheme, stage] as const)),
  )('draws the %s stage’s furniture with the renderer as committed (%s)', (_, scheme, stage) => {
    const svg = floorSvg(stage, scheme);
    expect(svg).toMatch(new RegExp(`^<svg [^>]*viewBox="0 0 ${stage.width} ${stage.height}">`));
    // No paper of its own and nothing fetched from elsewhere.
    expect(svg).not.toContain(`fill="${FLOOR_PAPER[scheme]}"`);
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
    const path = appPath(`public${floorArtHref(stage.key, scheme)}`);
    write(path, svg);
    expect(readFileSync(path, 'utf8')).toBe(svg);
  });

  it('moves as the committed keyframes say', () => {
    const css = floorCss(FLOOR_STAGES);
    const path = appPath('app/hero-scenes/space-floor.generated.css');
    write(path, css);
    expect(readFileSync(path, 'utf8')).toBe(css);
  });
});
